-- 0013: 컨시어지 역경매(#72, SPEC_REVERSE_AUCTION v1.1 — /autoplan 리뷰 반영).
-- 핵심 결정: RLS enable(정책 0=서버 전용) / viewed_at 분리 / connect 배선 / 회신 원자화 RPC.

create table if not exists quote_requests (
  id uuid primary key default gen_random_uuid(),
  procedure_id text references procedures(id),
  concerns text[] default '{}',
  age_band text,
  budget_max int,                    -- 만원
  downtime text check (downtime in ('none','weekend','week','any')),
  region_label text, lat double precision, lng double precision,
  note text,                         -- 연락처 정규식 마스킹 후 저장(#S-1)
  phone text,                        -- 선택. 병원 절대 미전달. 파기: 터미널+30일 상한(cron)
  notify_channel text not null default 'app' check (notify_channel in ('app','sms')),
  status text not null default 'submitted' check (status in
    ('submitted','collecting','quoted','connected','closed','expired')),
  viewed_at timestamptz,             -- 열람은 별도 축(명시 POST로만 기록 — 프리뷰봇 오염 방지)
  sla_due_at timestamptz,            -- 영업일 24h(공휴일 테이블 기반, 서버 계산)
  selection_note text,               -- 병원 선정 수동 개입 시 사유(감사 로그, §27)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_quote_requests_queue on quote_requests (status, sla_due_at);

create table if not exists quote_replies (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references quote_requests(id) on delete cascade,
  hospital_id uuid references hospitals(id) on delete set null,
  hospital_name text not null,       -- 비정규화(0008 교훈)
  offer_id uuid,                     -- 0012 배포 후 연결(FK 없음 — 커플링 제거)
  total_price int,                   -- 원 단위
  price_type text not null default 'fixed' check (price_type in ('fixed','from','range','consult')),
  price_max int,
  sku_summary text,                  -- §56 필터 통과 후 저장(유저 노출 필드)
  conditions text[] default '{}',    -- event_price|first_visit|vat_excluded|vat_included|anesthesia_included ...
  extra_costs text,                  -- 부대비용 분리 라인("검진비 9,500원")
  valid_until date,
  refused boolean not null default false,
  refuse_reason text,
  asked_back text,                   -- 병원 되물음 로그(=차기 폼 필드 후보, PM 루프)
  created_at timestamptz default now(),
  unique (request_id, hospital_id)
);
create index if not exists idx_quote_replies_request on quote_replies (request_id);

-- connect 배선(#A-3): 방문예약이 어느 견적요청에서 왔는지
alter table visit_requests add column if not exists quote_request_id uuid;

-- RLS(#A-1): 정책 0개 = anon/authenticated 전면 차단, service_role 서버 액션만
alter table quote_requests enable row level security;
alter table quote_replies enable row level security;

-- 회신 저장 원자화(#E-4): 회신 insert + 상태 전환을 한 트랜잭션으로
create or replace function admin_add_quote_reply(
  p_request_id uuid, p_hospital_id uuid, p_hospital_name text,
  p_total_price int, p_price_type text, p_price_max int,
  p_sku_summary text, p_conditions text[], p_extra_costs text,
  p_valid_until date, p_refused boolean, p_refuse_reason text, p_asked_back text
) returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into quote_replies (request_id, hospital_id, hospital_name, total_price, price_type,
    price_max, sku_summary, conditions, extra_costs, valid_until, refused, refuse_reason, asked_back)
  values (p_request_id, p_hospital_id, p_hospital_name, p_total_price, p_price_type,
    p_price_max, p_sku_summary, p_conditions, p_extra_costs, p_valid_until, p_refused, p_refuse_reason, p_asked_back)
  returning id into v_id;
  update quote_requests set
    status = case when p_refused then status
                  when status in ('submitted','collecting') then 'quoted' else status end,
    updated_at = now()
  where id = p_request_id;
  return v_id;
end $$;

-- 만료·파기(#E-1): Vercel cron이 호출. 멱등.
create or replace function expire_and_purge_quotes() returns int language plpgsql security definer as $$
declare n int;
begin
  update quote_requests set status = 'expired', updated_at = now()
  where status = 'quoted' and viewed_at is null
    and updated_at < now() - interval '72 hours';
  update quote_requests set phone = null, updated_at = now()
  where phone is not null and (
    (status in ('connected','closed','expired') and updated_at < now() - interval '7 days')
    or created_at < now() - interval '30 days'
  );
  get diagnostics n = row_count;
  return n;
end $$;
