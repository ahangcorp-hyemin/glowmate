-- 0006: 병원 상세정보 재기획 — HIRA 병원정보/비급여가 주는 실필드를 병원에 저장하고,
-- 근처조회 RPC가 상세뷰+문의 CTA에 필요한 값을 한 번에 반환하도록 확장.
-- 병원정보 실필드: estbDd(설립일)·drTotCnt(의사수)·telno·좌표·clCdNm(종별)·emdongNm(동)·postNo
-- 비급여 실필드: itmCdNm(항목)·prcMin/Max(금액)·url(병원 URL)

alter table hospitals
  add column if not exists estb_dd date,           -- 개원일(estbDd YYYYMMDD)
  add column if not exists doctor_count int,        -- 총 의사수(drTotCnt)
  add column if not exists homepage_url text,       -- 병원 홈페이지(비급여 url / hospUrl)
  add column if not exists cl_nm text,              -- 종별명(의원/병원)
  add column if not exists emdong text,             -- 법정동
  add column if not exists postal text;             -- 우편번호

-- 근처 병원 + 상세 + 시술 공개가. 상세뷰/CTA용 필드 포함(추가 조회 불필요).
-- 0005의 반환형과 달라 재정의 전에 반드시 DROP(그렇지 않으면 42P13).
drop function if exists nearby_hospitals(double precision, double precision, text, double precision, integer);
create or replace function nearby_hospitals(
  p_lat double precision, p_lng double precision,
  p_proc text, p_radius_km double precision default 10, p_limit int default 20
)
returns table (
  id uuid, name text, district text, address text, phone text, homepage_url text,
  cl_nm text, doctor_count int, estb_dd date, lat double precision, lng double precision,
  rating numeric, review_count int, distance_km double precision,
  price integer, is_ad boolean
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
       where a.hospital_id = h.id and a.procedure_id = p_proc and a.active) as is_ad
  from hospitals h
  where h.status = 'active' and h.is_aesthetic
    and h.lat is not null and h.lng is not null
    and (6371 * acos(least(1, greatest(-1,
      cos(radians(p_lat)) * cos(radians(h.lat)) * cos(radians(h.lng) - radians(p_lng))
      + sin(radians(p_lat)) * sin(radians(h.lat))
    )))) <= p_radius_km
  order by distance_km asc
  limit p_limit
$$;
