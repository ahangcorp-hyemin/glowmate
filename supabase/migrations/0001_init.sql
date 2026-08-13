-- GlowMate 초기 스키마 (spec §4). 모든 가격 KRW 정수(원). 크롤 유래 데이터는 source_url·fetched_at 필수.
-- §27 인바리언트: 매출을 예약/진료비에 연동하는 컬럼은 존재하지 않는다(광고=정액만).

create extension if not exists "pgcrypto";

-- 시술 카탈로그(코드 시드 = lib/catalog/procedures.ts와 동기)
create table procedures (
  id text primary key,
  name_ko text not null,
  category text not null check (category in ('lifting','volume','pigment')),
  tagline text not null,
  mechanism text not null,
  effect text not null,
  downtime text not null,
  caution text not null,
  good_for text not null,
  price_min integer not null,
  price_max integer not null,
  price_unit text not null,
  sessions text,
  updated_at timestamptz not null default now()
);

create table procedure_sources (
  id bigserial primary key,
  procedure_id text references procedures(id) on delete cascade,
  label text not null,
  url text,
  source_type text not null check (source_type in ('mfds','fda','society','crawl_avg')),
  ord int not null default 0
);

create table concerns (id text primary key, name_ko text not null);

create table concern_procedure_rules (
  concern_id text references concerns(id) on delete cascade,
  procedure_id text references procedures(id) on delete cascade,
  role text not null check (role in ('base','addon','optional')),
  weight int not null,
  rationale text not null,
  primary key (concern_id, procedure_id)
);

create table hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  district text,
  address text, lat numeric, lng numeric,
  rating numeric, review_count int default 0,
  source_url text, fetched_at timestamptz,
  status text not null default 'active' check (status in ('active','hidden')),
  created_at timestamptz default now()
);

create table hospital_procedure_prices (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete cascade,
  procedure_id text references procedures(id),
  unit text not null,
  price integer not null,
  is_promo boolean default false,
  source_url text not null, fetched_at timestamptz not null,
  snapshot_id uuid not null,
  is_current boolean not null default true,
  unique (hospital_id, procedure_id, unit, snapshot_id)
);
create index on hospital_procedure_prices (procedure_id, is_current, price);
create index on hospital_procedure_prices (snapshot_id);

create table ad_placements (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete cascade,
  procedure_id text references procedures(id),
  slot text not null check (slot in ('top','list')),
  monthly_fee integer not null,  -- 정액(원). 예약/건당 수수료 컬럼 없음(§27)
  starts_at date, ends_at date, active boolean default true
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete cascade,
  procedure_id text references procedures(id),
  author_masked text, age int, concern text,
  rating int, weeks_elapsed int,
  body text not null,
  is_verified_visit boolean not null default false,
  is_sponsored boolean not null default false,
  is_adverse boolean not null default false,
  status text not null default 'shown' check (status in ('shown','demoted','hidden')),
  created_at timestamptz default now()
);
create index on reviews (hospital_id, status, is_adverse);

create table estimate_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  concerns text[] not null, age_band text, budget_band text, note text,
  created_at timestamptz default now()
);

create table estimates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references estimate_requests(id) on delete cascade,
  items jsonb not null,
  total_min integer, total_max integer,
  answer_blocks jsonb not null,
  sources jsonb not null,
  engine_version text not null,
  created_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid, hospital_id uuid references hospitals(id),
  procedure_id text,
  consented_sensitive boolean not null,  -- §23 민감정보 별도 동의
  created_at timestamptz default now()
);

-- RLS: 카탈로그·현재가격·노출후기는 공개 읽기. 쓰기/광고/hidden은 서비스롤.
alter table procedures enable row level security;
alter table procedure_sources enable row level security;
alter table concerns enable row level security;
alter table concern_procedure_rules enable row level security;
alter table hospitals enable row level security;
alter table hospital_procedure_prices enable row level security;
alter table reviews enable row level security;

create policy "read catalog" on procedures for select using (true);
create policy "read catalog src" on procedure_sources for select using (true);
create policy "read concerns" on concerns for select using (true);
create policy "read rules" on concern_procedure_rules for select using (true);
create policy "read active hospitals" on hospitals for select using (status = 'active');
create policy "read current prices" on hospital_procedure_prices for select using (is_current = true);
create policy "read shown reviews" on reviews for select using (status = 'shown');
