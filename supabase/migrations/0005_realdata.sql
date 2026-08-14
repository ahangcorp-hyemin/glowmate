-- 0005: 실데이터 전환 — HIRA 인제스트 대상 컬럼 + 거리기반 조회 RPC + 비급여 매핑.
-- 병원/가격은 이제 목업 시드가 아니라 scripts/ingest-hira.ts가 채운다.

alter table hospitals
  add column if not exists ykiho text unique,        -- 요양기호(HIRA 병원 유일키)
  add column if not exists phone text,
  add column if not exists kakao_url text,
  add column if not exists is_aesthetic boolean not null default false; -- 피부과/성형외과 여부(인제스트가 판정)

alter table hospital_procedure_prices
  add column if not exists nonpay_code text;          -- HIRA 비급여코드(추적/디버그)

-- 비급여코드 ↔ 우리 시술 매핑(관리형). 인제스트가 항목명 매칭으로 채움.
create table if not exists procedure_nonpay_map (
  procedure_id text references procedures(id) on delete cascade,
  nonpay_code text not null,
  label text,
  primary key (procedure_id, nonpay_code)
);
alter table procedure_nonpay_map enable row level security;
create policy "read nonpay map" on procedure_nonpay_map for select using (true);

-- 위치기반 근처 병원 조회. haversine(순수 SQL, 확장 불필요). 시술 공개가 left join.
create or replace function nearby_hospitals(
  p_lat double precision, p_lng double precision,
  p_proc text, p_radius_km double precision default 10, p_limit int default 20
)
returns table (
  id uuid, name text, district text, phone text, kakao_url text,
  rating numeric, review_count int, distance_km double precision,
  price integer, is_ad boolean
) language sql stable as $$
  select h.id, h.name, h.district, h.phone, h.kakao_url, h.rating, h.review_count,
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
