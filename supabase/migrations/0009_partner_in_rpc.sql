-- 0009: 근처조회 RPC가 is_partner를 함께 반환 → 목록/지도에서 파트너 배지 노출.
-- 반환형이 바뀌므로 재정의 전 DROP 필수(42P13).

drop function if exists nearby_hospitals(double precision, double precision, text, double precision, integer);
create or replace function nearby_hospitals(
  p_lat double precision, p_lng double precision,
  p_proc text, p_radius_km double precision default 10, p_limit int default 20
)
returns table (
  id uuid, name text, district text, address text, phone text, homepage_url text,
  cl_nm text, doctor_count int, estb_dd date, lat double precision, lng double precision,
  rating numeric, review_count int, distance_km double precision,
  price integer, is_ad boolean, is_partner boolean
) language sql stable as $$
  select h.id, h.name, h.district, h.address, h.phone, h.homepage_url,
    h.cl_nm, h.doctor_count, h.estb_dd, h.lat, h.lng, h.rating, h.review_count,
    (6371 * acos(least(1, greatest(-1,
      cos(radians(p_lat)) * cos(radians(h.lat)) * cos(radians(h.lng) - radians(p_lng))
      + sin(radians(p_lat)) * sin(radians(h.lat))
    )))) as distance_km,
    (select p.price from hospital_procedure_prices p
       where p.hospital_id = h.id and p.procedure_id = p_proc and p.is_current
       order by p.price asc limit 1) as price,
    exists(select 1 from ad_placements a
       where a.hospital_id = h.id and a.procedure_id = p_proc and a.active) as is_ad,
    coalesce(h.is_partner, false) as is_partner
  from hospitals h
  where h.status = 'active' and h.is_aesthetic
    and h.lat is not null and h.lng is not null
    and (6371 * acos(least(1, greatest(-1,
      cos(radians(p_lat)) * cos(radians(h.lat)) * cos(radians(h.lng) - radians(p_lng))
      + sin(radians(p_lat)) * sin(radians(h.lat))
    )))) <= p_radius_km
  order by is_partner desc, distance_km asc
  limit p_limit
$$;
