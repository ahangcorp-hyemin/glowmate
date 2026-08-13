-- 시술 레슨(듀오링고식 카드 덱). 0001_init.sql 규약을 따름: public read RLS, 서비스롤 write.
-- UI 계약: src/lib/lessons/types.ts · 매핑 seam: src/lib/lessons/repo.ts

-- 시술 1개 = 레슨 1개. procedure_id는 procedures.id 참조.
create table lessons (
  procedure_id text primary key references procedures(id) on delete cascade,
  name_ko text not null,
  updated_at timestamptz not null default now()
);

-- 카드 한 장 = (레슨, 순서, 종류, payload). payload는 종류별 필드를 그대로 담는 jsonb.
-- kind ∈ intro | layers | timeline | compare | contra | price | reviewLiteracy | realReviews | questionSheet | done
-- payload 형태는 types.ts의 LessonCard union에서 kind별 필드와 1:1 대응.
-- (후기(realReviews/reviewLiteracy)는 지금 payload에 인라인. 추후 UGC가 커지면 별도 테이블로 승격 검토.)
create table lesson_cards (
  id uuid primary key default gen_random_uuid(),
  procedure_id text not null references lessons(procedure_id) on delete cascade,
  ord int not null,
  kind text not null check (kind in (
    'intro','layers','timeline','compare','contra','price',
    'reviewLiteracy','realReviews','questionSheet','done'
  )),
  payload jsonb not null default '{}'::jsonb,
  unique (procedure_id, ord)
);
create index lesson_cards_proc_ord on lesson_cards (procedure_id, ord);

alter table lessons enable row level security;
alter table lesson_cards enable row level security;

create policy "read lessons" on lessons for select using (true);
create policy "read lesson cards" on lesson_cards for select using (true);
-- write는 서비스롤(시드/어드민)만. 별도 정책 없음 = anon insert 불가.
