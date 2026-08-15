-- 0011: 파트너 문의 처리 상태(운영 어드민 v2). 신규→연락함→완료.
alter table partner_inquiries
  add column if not exists status text not null default 'new'
    check (status in ('new','contacted','done')),
  add column if not exists admin_memo text;

create index if not exists idx_partner_inquiries_status on partner_inquiries (status, created_at desc);
