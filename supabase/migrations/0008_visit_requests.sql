-- 0008: 방문 희망 신청(미모먼트 패턴의 우리 버전) + 입점 구분.
-- 흐름: 유저 신청 → [입점 병원] 병원에 바로 전달 / [미입점] 글로우메이트가 전화로 확인(컨시어지)
-- §27: 예약·시술 건당 수수료 없음. 정보 전달·일정 확인 대행만. UI에 상시 고지.

alter table hospitals
  add column if not exists is_partner boolean not null default false;  -- 입점(파트너) 여부

create table if not exists visit_requests (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete set null,
  hospital_name text not null,          -- 비정규화(병원 삭제돼도 내역 유지)
  is_partner boolean not null default false, -- 신청 시점 스냅샷(전달 경로 결정)
  procedure_id text,                    -- 관심 시술(선택)
  visitor_name text not null,
  phone text not null,                  -- 병원/우리가 연락할 번호
  desired_date date not null,
  desired_times text[] not null,        -- 예: {'11:00','13:30'} 다중 선택
  note text,
  status text not null default 'requested'
    check (status in ('requested','forwarded','concierge','confirmed','declined','canceled')),
  admin_memo text,
  consented boolean not null,           -- 개인정보(연락처) 수집·이용 동의
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_visit_requests_status on visit_requests (status, created_at desc);

alter table visit_requests enable row level security;
-- 공개 정책 없음: 서버 액션(service_role)만 읽고 쓴다. 유저 내역은 localStorage 사본.
