-- 0001_core_schema.up.sql — F2a-CORE-SCHEMA
--
-- core 스키마 6테이블(venue · price_plan · need_tag · venue_need_tag · editor_report · source_record).
-- REQ-1 은 이 6개와의 **집합 동등**을 요구한다. 7번째 테이블·뷰를 core 에 만들면 test:schema-core 가 실패한다.
-- 품질/공개판정 객체(F2b)와 운영/법적 객체(F2c)는 별도 스키마에 만든다.
--
-- 이 파일은 머지 후 내용이 변경되면 FORBID-1 (a) 매니페스트 대조로 차단된다.
-- 컬럼 폐기가 필요하면 이 파일을 고치지 말고 새 마이그레이션에서 신규 컬럼 추가 → 백필 →
-- 별도 태스크 폐기 순서를 따른다.

-- PostGIS 는 환경 수준 객체다. down 에서 DROP 하지 않는다 —
-- 같은 인스턴스의 다른 데이터베이스·확장 소비자를 끊고, 되돌림 단위를 스키마 밖으로 넓힌다.
-- (runner 의 bootstrap 이 동일 문장을 먼저 실행하므로 여기서는 멱등 재확인이다.)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA core;

COMMENT ON SCHEMA core IS
  'F2a — 도메인 코어 6테이블. 공개 판정(F2b)·운영/법적 저장소(F2c)는 이 스키마에 두지 않는다.';

-- ── 열거형 ────────────────────────────────────────────────────────────────
-- 라벨 집합은 allowed-columns.core.json 의 enums 에 등재되어야 한다(FORBID-3).
-- 축 4종은 D1a v1.2 정본(exercise_body · relax_recovery · medical_wellness · beauty_care).
CREATE TYPE core.venue_category AS ENUM (
  'exercise_body',
  'relax_recovery',
  'medical_wellness',
  'beauty_care'
);

-- 강남 3구 시드(PRD). 구를 문자열로 두면 표기 흔들림이 그대로 커버리지 분모가 된다.
CREATE TYPE core.gu_code AS ENUM ('gangnam', 'seocho', 'songpa');

-- C4 가 산출하는 단가 유형. 'unparseable' 은 "파싱 실패"를 1급 상태로 남기기 위한 값이며
-- 회당 0원으로 뭉개지 않는다(FORBID-2 because).
CREATE TYPE core.price_unit_type AS ENUM (
  'per_session',
  'period_pass',
  'single_session',
  'unparseable'
);

-- D3 verdicts.csv 의 4-enum. C1 REQ-3 이 source_record 행마다 이 값을 요구한다.
CREATE TYPE core.source_license_status AS ENUM (
  'allowed',
  'conditional',
  'pending',
  'forbidden'
);

-- ── venue ─────────────────────────────────────────────────────────────────
CREATE TABLE core.venue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL,
  name        text NOT NULL,
  category    core.venue_category NOT NULL,
  gu          core.gu_code NOT NULL,
  -- REQ-2: geography(Point,4326) NOT NULL + GiST.
  -- 원본 공공데이터 좌표계는 EPSG:5174(보정계수 미적용 Bessel 중부원점TM)이며 WGS84 가 아니다.
  -- 적재 파이프라인이 5174 → 4326 변환을 마친 값만 넣는다. 컬럼 타입이 4326 을 강제하므로
  -- 미변환 좌표는 서울 밖(수백 m~수 km 편차가 아니라 좌표계 자체가 다른 값)으로 들어가
  -- 반경 검색에서 즉시 드러난다. 변환 이력은 source_record 원문으로 추적한다.
  location    geography(Point, 4326) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_slug_key UNIQUE (slug),
  CONSTRAINT venue_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  CONSTRAINT venue_name_not_blank CHECK (btrim(name) <> '')
);

COMMENT ON TABLE core.venue IS
  '업체. 미달 데이터는 비공개(F2b visibility)로 격리하며 물리 삭제하지 않는다(PRD G4 / FORBID-4).';
COMMENT ON COLUMN core.venue.location IS
  'WGS84(EPSG:4326) geography. 원본 EPSG:5174 좌표는 적재 전에 변환한다.';

-- REQ-2 — 반경 검색이 Index Scan / Bitmap Index Scan 으로 풀리게 하는 인덱스.
CREATE INDEX venue_location_gist ON core.venue USING GIST (location);

-- ── source_record ─────────────────────────────────────────────────────────
-- 원문 스냅샷. 재수집 불가능한 자산이므로 append-only 이며 DELETE·임의 UPDATE 를 트리거가 거부한다.
CREATE TABLE core.source_record (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url            text NOT NULL,
  -- C1 의 봉투(envelope): blob_key · body_sha256 · http_status · final_url · headers ·
  -- crawl_run_id · adapter_version · source_id. 스키마 검증은 C1 소유다.
  -- tombstone 이후에만 NULL 이 될 수 있다(아래 CHECK 2종).
  raw_payload           jsonb,
  fetched_at            timestamptz NOT NULL,
  -- D3 실사 판정. C1 REQ-3 이 "NULL 0건"을 assert 하므로 NOT NULL 이다.
  source_license_status core.source_license_status NOT NULL,
  tombstoned_at         timestamptz,
  tombstone_reason      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_record_url_not_blank CHECK (btrim(source_url) <> ''),
  -- 원문 없는 행을 애초에 만들 수 없게 한다. "원문 미보존"이 정상 상태가 되면
  -- C4 재처리 대상이 조용히 사라진다.
  CONSTRAINT source_record_payload_present
    CHECK (raw_payload IS NOT NULL OR tombstoned_at IS NOT NULL),
  -- 파기된 행은 반드시 원문이 비어 있다. 절반만 지운 상태를 허용하지 않는다.
  CONSTRAINT source_record_tombstoned_payload_null
    CHECK (tombstoned_at IS NULL OR raw_payload IS NULL),
  -- 사유 없는 파기 금지. 사유가 없으면 "언제 왜 지웠는가"에 답할 수 없다.
  CONSTRAINT source_record_tombstone_pair
    CHECK ((tombstoned_at IS NULL) = (tombstone_reason IS NULL))
);

COMMENT ON TABLE core.source_record IS
  'append-only 원문 스냅샷. 보존기간 만료·파기 요구는 core.tombstone_source_record(id, reason) 로만 처리한다.';

-- ── price_plan ────────────────────────────────────────────────────────────
CREATE TABLE core.price_plan (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FORBID-4: venue 참조 FK 에 ON DELETE CASCADE 를 주지 않는다.
  venue_id            uuid NOT NULL REFERENCES core.venue (id) ON DELETE RESTRICT,
  -- REQ-3: 원문 필드. 어느 원문에서 나온 값인지 끊기면 정정 요청에 답할 수 없다.
  source_record_id    uuid NOT NULL REFERENCES core.source_record (id) ON DELETE RESTRICT,
  raw_text            text NOT NULL,
  -- REQ-4: C4 출력 6필드
  price_unit_type     core.price_unit_type NOT NULL,
  price_per_month_krw integer,
  period_days         integer,
  source_snippet      text NOT NULL,
  captured_at         timestamptz NOT NULL,
  parser_version      text NOT NULL,
  -- 파생 금액 필드
  total_amount_krw    integer,
  session_count       integer,
  -- FORBID-2: NOT NULL 도, DEFAULT 도 주지 않는다.
  -- "파싱 실패"와 "회당 0원"이 같은 값이 되는 순간 실패를 기록할 자리가 사라진다.
  price_per_session   integer,
  failure_reason      text,
  -- C4 FORBID-3 의 프로모션 감점 경로. 값의 판정 규칙과 사전은 C4 소유다.
  is_promotional      boolean NOT NULL DEFAULT false,
  promo_valid_until   date,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT price_plan_total_amount_positive
    CHECK (total_amount_krw IS NULL OR total_amount_krw > 0),
  CONSTRAINT price_plan_session_count_positive
    CHECK (session_count IS NULL OR session_count > 0),
  CONSTRAINT price_plan_month_amount_positive
    CHECK (price_per_month_krw IS NULL OR price_per_month_krw > 0),
  CONSTRAINT price_plan_period_days_positive
    CHECK (period_days IS NULL OR period_days > 0),
  CONSTRAINT price_plan_snippet_not_blank CHECK (btrim(source_snippet) <> ''),
  CONSTRAINT price_plan_raw_text_not_blank CHECK (btrim(raw_text) <> ''),

  -- REQ-3 (a) — 파싱 실패는 사유를 남긴다. 사유 없는 실패는 재처리 대상을 잃는다.
  CONSTRAINT price_plan_unparseable_needs_reason
    CHECK (price_unit_type <> 'unparseable' OR failure_reason IS NOT NULL),
  -- REQ-3 (b) — 회차 개념이 없는 유형(period_pass · unparseable)에 회당 단가를 기록하지 않는다.
  --             (C4 FORBID-2: 주 n회 가정으로 기간권 회당가를 만드는 경로를 스키마가 먼저 막는다.)
  CONSTRAINT price_plan_per_session_scope
    CHECK (price_unit_type IN ('per_session', 'single_session') OR price_per_session IS NULL),
  -- REQ-3 (c) — 0원·음수 회당가 금지.
  CONSTRAINT price_plan_per_session_positive
    CHECK (price_per_session IS NULL OR price_per_session > 0)
);

COMMENT ON COLUMN core.price_plan.price_per_session IS
  '회당 단가(KRW). NULL 은 "산출하지 못했다"이며 0 이나 평균값으로 대체하지 않는다(FORBID-2).';
COMMENT ON COLUMN core.price_plan.source_snippet IS
  '해당 source_record.raw_payload 에서 인용한 원문 스니펫(C4 불변식 I5 의 대상).';

-- ── need_tag ──────────────────────────────────────────────────────────────
CREATE TABLE core.need_tag (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- F4 need-tags.yaml 의 태그 id. 온톨로지 파일이 정본이고 이 테이블은 참조 무결성용이다.
  ontology_id text NOT NULL,
  slug        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT need_tag_slug_key UNIQUE (slug),
  CONSTRAINT need_tag_ontology_id_key UNIQUE (ontology_id),
  CONSTRAINT need_tag_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$')
);

COMMENT ON TABLE core.need_tag IS
  '니즈 태그. 행 삽입(온톨로지 시드)은 F4 정의 후 C6 소관이며 본 태스크는 구조만 만든다.';

-- ── venue_need_tag ────────────────────────────────────────────────────────
CREATE TABLE core.venue_need_tag (
  venue_id         uuid NOT NULL REFERENCES core.venue (id) ON DELETE RESTRICT,
  need_tag_id      uuid NOT NULL REFERENCES core.need_tag (id) ON DELETE RESTRICT,
  -- 근거 없는 태그를 막기 위한 필수 인용문.
  evidence_snippet text NOT NULL,
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, need_tag_id),
  CONSTRAINT venue_need_tag_evidence_not_blank CHECK (btrim(evidence_snippet) <> '')
);

-- ── editor_report ─────────────────────────────────────────────────────────
CREATE TABLE core.editor_report (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid NOT NULL REFERENCES core.venue (id) ON DELETE RESTRICT,
  slug       text NOT NULL,
  editor_id  text NOT NULL,
  visited_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editor_report_slug_key UNIQUE (slug),
  CONSTRAINT editor_report_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  CONSTRAINT editor_report_editor_not_blank CHECK (btrim(editor_id) <> '')
);

COMMENT ON TABLE core.editor_report IS
  '에디터 방문 리포트의 DB 측 인덱스. 본문·이미지는 W5 의 MDX 자산이 보유한다.';

-- ── source_record append-only 집행 (REQ-5 · FORBID-5) ──────────────────────
--
-- 왜 트리거인가: 애플리케이션 규칙으로 두면 "이번 한 번만" 하는 스크립트가 반드시 생기고,
-- 그 순간 어느 가격이 어느 원문에서 왔는지 영구히 알 수 없게 된다.

CREATE FUNCTION core.source_record_block_delete() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION
    'core.source_record 는 append-only 다 — DELETE 거부 (F2a REQ-5 / FORBID-5). 파기는 core.tombstone_source_record(id, reason) 로만 처리한다'
    USING ERRCODE = '42501';
END;
$fn$;

CREATE FUNCTION core.source_record_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  -- tombstone 함수가 세운 트랜잭션 로컬 플래그가 없으면 어떤 UPDATE 도 거부한다.
  IF current_setting('core.tombstone_in_progress', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      'core.source_record 는 append-only 다 — UPDATE 거부 (F2a REQ-5 / FORBID-5). 파기는 core.tombstone_source_record(id, reason) 로만 처리한다'
      USING ERRCODE = '42501';
  END IF;

  -- 플래그가 있어도 허용 범위는 tombstone 효과 그 자체뿐이다.
  -- 이것이 없으면 플래그 한 줄로 원문 위조가 가능해진다.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.source_url IS DISTINCT FROM OLD.source_url
     OR NEW.fetched_at IS DISTINCT FROM OLD.fetched_at
     OR NEW.source_license_status IS DISTINCT FROM OLD.source_license_status
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.raw_payload IS NOT NULL
     OR NEW.tombstoned_at IS NULL
     OR NEW.tombstone_reason IS NULL THEN
    RAISE EXCEPTION
      'core.source_record UPDATE 는 tombstone 효과(raw_payload NULL · tombstoned_at · tombstone_reason)만 허용한다'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER source_record_no_delete
  BEFORE DELETE ON core.source_record
  FOR EACH ROW EXECUTE FUNCTION core.source_record_block_delete();

CREATE TRIGGER source_record_guard_update
  BEFORE UPDATE ON core.source_record
  FOR EACH ROW EXECUTE FUNCTION core.source_record_guard_update();

-- 보존기간 만료·파기 요구의 **유일한** 처리 경로.
-- 행은 남고 원문만 비운다 — 행이 사라지면 그 가격의 출처를 영원히 증명할 수 없다.
CREATE FUNCTION core.tombstone_source_record(p_id uuid, p_reason text)
RETURNS core.source_record
LANGUAGE plpgsql AS $fn$
DECLARE
  v_row core.source_record;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'tombstone 사유(reason)는 필수다 — 사유 없는 파기는 기록이 아니다'
      USING ERRCODE = '22004';
  END IF;

  PERFORM set_config('core.tombstone_in_progress', 'on', true);

  UPDATE core.source_record
     SET raw_payload      = NULL,
         tombstoned_at    = COALESCE(tombstoned_at, now()),
         tombstone_reason = p_reason
   WHERE id = p_id
  RETURNING * INTO v_row;

  PERFORM set_config('core.tombstone_in_progress', 'off', true);

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'core.source_record % 가 존재하지 않는다', p_id USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$fn$;

COMMENT ON FUNCTION core.tombstone_source_record(uuid, text) IS
  'F2a REQ-5 — 보존기간 만료·파기 요구 처리. 행 유지 + raw_payload NULL + tombstone 2컬럼 기록.';
