-- 0003: §56(의료광고 금지표현) write-time 방어선.
-- D3=B(DB 완전 주인·스튜디오 직접 수정) 선택의 필수 조건:
-- 앱 assertCompliant만으로는 studio 직접 편집을 막지 못하므로 DB 트리거로 심층화.
-- banned_phrases는 src/lib/compliance/bannedPhrases.ts의 BANNED_PHRASES를 시드 소스로 동기.

create table if not exists banned_phrases (
  phrase text primary key
);

alter table banned_phrases enable row level security;
create policy "read banned phrases" on banned_phrases for select using (true);

-- 주어진 텍스트에 금지표현이 있으면 그 표현을 반환(대소문자 무시), 없으면 null.
create or replace function first_banned_phrase(txt text)
returns text language sql stable as $$
  select p.phrase from banned_phrases p
  where txt is not null and position(lower(p.phrase) in lower(txt)) > 0
  limit 1
$$;

-- procedures 문구 컬럼 검증.
create or replace function check_procedure_compliance()
returns trigger language plpgsql as $$
declare hit text; col text; val text;
begin
  foreach val in array array[
    new.tagline, new.mechanism, new.effect, new.caution,
    new.side_effects, new.contraindication, new.misconception, new.vs_note, new.good_for
  ] loop
    hit := first_banned_phrase(val);
    if hit is not null then
      raise exception '[§56 의료광고 위반] procedure %: 금지표현 "%"', new.id, hit;
    end if;
  end loop;
  return new;
end $$;

-- procedure_sources.label 검증.
create or replace function check_source_compliance()
returns trigger language plpgsql as $$
declare hit text;
begin
  hit := first_banned_phrase(new.label);
  if hit is not null then
    raise exception '[§56 의료광고 위반] source: 금지표현 "%"', hit;
  end if;
  return new;
end $$;

-- concerns.sentence 검증.
create or replace function check_concern_compliance()
returns trigger language plpgsql as $$
declare hit text;
begin
  hit := first_banned_phrase(new.sentence);
  if hit is not null then
    raise exception '[§56 의료광고 위반] concern %: 금지표현 "%"', new.id, hit;
  end if;
  return new;
end $$;

drop trigger if exists trg_procedure_compliance on procedures;
create trigger trg_procedure_compliance
  before insert or update on procedures
  for each row execute function check_procedure_compliance();

drop trigger if exists trg_source_compliance on procedure_sources;
create trigger trg_source_compliance
  before insert or update on procedure_sources
  for each row execute function check_source_compliance();

drop trigger if exists trg_concern_compliance on concerns;
create trigger trg_concern_compliance
  before insert or update on concerns
  for each row execute function check_concern_compliance();
