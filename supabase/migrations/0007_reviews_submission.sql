-- 0007: 후기 수집(U4) + 입점 문의(U5). 계약: docs/REVIEW_PRODUCT_PLAN.md
-- 원칙: 모든 제출은 hidden(검수 대기)으로 적재, 영수증은 비공개 버킷, 보상 표기 필드 선반영.

alter table reviews
  add column if not exists age_band text,             -- "40대"/"50대+" (기존 age int보다 수집 마찰 낮음)
  add column if not exists hospital_name text,        -- 유저 입력 병원명(매칭 전 원문 보존)
  add column if not exists receipt_path text,         -- 비공개 스토리지 경로(있으면 인증 후보)
  add column if not exists reward_disclosed boolean not null default false, -- 표시광고법(보상 후기 표기)
  add column if not exists source text not null default 'web',              -- web/interview/snowball
  add column if not exists flagged_phrases text;      -- §56 필터 히트(검수 우선순위용)

-- 제출 기본값을 검수 대기로(기존 seed용 'shown' 기본값 대체)
alter table reviews alter column status set default 'hidden';

-- 영수증 비공개 버킷(공개 접근 불가, service_role만)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 입점 문의(U5). 쓰기는 service_role(서버 액션), 읽기도 내부만.
create table if not exists partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  hospital_name text not null,
  region text,
  contact_name text not null,
  contact text not null,             -- 전화 or 이메일
  message text,
  consented boolean not null,        -- 개인정보 수집·이용 동의
  created_at timestamptz default now()
);
alter table partner_inquiries enable row level security;
-- 공개 정책 없음: anon 읽기/쓰기 차단(서버 액션이 service_role로 insert)
