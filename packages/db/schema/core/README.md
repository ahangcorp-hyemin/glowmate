# packages/db — core 스키마 (F2a-CORE-SCHEMA)

> 계약 정본: [`docs/tasks/F2a.md`](../../../../docs/tasks/F2a.md)
> 이 문서가 `packages/db` 의 README 역할을 한다 — `packages/db/README.md` 는 F2a 의 `touches` 밖이라
> 만들 수 없다(F1 FORBID-4). 계약의 `done_when` 과 `touches` 가 어긋나는 지점이며 상신 대상이다.

## 6테이블 관계도

```
                    ┌──────────────────────────┐
                    │ core.venue               │
                    │  id (uuid, PK)           │
                    │  slug UNIQUE             │
                    │  name                    │
                    │  category  ENUM 4축      │
                    │  gu        ENUM 3구      │
                    │  location  geography     │◀── GiST 인덱스 (반경 검색)
                    │            (Point,4326)  │
                    └──────────┬───────────────┘
                               │  (전부 ON DELETE RESTRICT — CASCADE 금지, FORBID-4)
        ┌──────────────────────┼───────────────────────────┐
        │                      │                           │
┌───────▼────────────┐ ┌───────▼──────────────┐ ┌──────────▼─────────────┐
│ core.price_plan    │ │ core.venue_need_tag  │ │ core.editor_report     │
│  id (PK)           │ │  (venue_id,          │ │  id (PK)               │
│  venue_id       FK │ │   need_tag_id) PK    │ │  venue_id           FK │
│  source_record_id  │ │  evidence_snippet    │ │  slug UNIQUE           │
│  raw_text          │ │  assigned_at         │ │  editor_id             │
│  price_unit_type   │ └───────┬──────────────┘ │  visited_at            │
│  price_per_session │         │ FK             └────────────────────────┘
│  total_amount_krw  │ ┌───────▼──────────────┐
│  session_count     │ │ core.need_tag        │
│  price_per_month.. │ │  id (PK)             │
│  period_days       │ │  ontology_id UNIQUE  │ ← F4 need-tags.yaml 의 태그 id
│  failure_reason    │ │  slug UNIQUE         │
│  is_promotional    │ └──────────────────────┘
│  promo_valid_until │
│  source_snippet    │
│  captured_at       │
│  parser_version    │
└───────┬────────────┘
        │ FK (ON DELETE RESTRICT)
┌───────▼─────────────────────────┐
│ core.source_record   ★append-only│
│  id (PK)                        │
│  source_url                     │
│  raw_payload  jsonb (봉투)       │
│  fetched_at                     │
│  source_license_status ENUM 4값  │ ← D3 verdicts.csv 판정
│  tombstoned_at / tombstone_reason│
└─────────────────────────────────┘
```

- **ENUM**: `venue_category`(exercise_body · relax_recovery · medical_wellness · beauty_care) ·
  `gu_code`(gangnam · seocho · songpa) ·
  `price_unit_type`(per_session · period_pass · single_session · unparseable) ·
  `source_license_status`(allowed · conditional · pending · forbidden)
- **core 스키마는 6테이블로 닫혀 있다.** `information_schema.tables WHERE table_schema='core'` 가
  이 6개와 **집합 동등**이어야 하며(REQ-1), 7번째 테이블·뷰를 만들면 `test:schema-core` 가 실패한다.
  품질·공개판정 객체(F2b)와 운영·법적 객체(F2c)는 **다른 스키마**에 만든다.

## 좌표계 — EPSG:5174 는 WGS84 가 아니다

`venue.location` 은 `geography(Point,4326)` 다. D1a 가 다루는 공공데이터(LOCALDATA)의 원본 좌표계는
**EPSG:5174**(보정계수 미적용 Bessel 중부원점TM)이며, 변환 없이 넣으면 좌표가 한반도 밖으로 나간다.
적재 파이프라인이 5174 → 4326 변환을 마친 값만 넣는다. 컬럼 타입이 SRID 4326 을 강제하고,
반경 검색 결과가 즉시 비정상으로 드러나므로 미변환 유입은 조용히 지나가지 않는다.

## "가격 미공개"는 NULL 이 아니다

공공 API 에 가격이 없고, 업체 자체 채널에도 가격을 공개하지 않는 곳이 상당수다. 스키마는 세 상태를
서로 다른 모양으로 구별한다.

| 상태 | 표현 |
|---|---|
| 아직 수집하지 않음 | 그 업체에 연결된 `source_record` 가 0행 |
| 수집했으나 가격이 없음(미공개) | `source_record` 는 있고 `price_plan` 이 0행 |
| 가격 문자열은 있으나 해석 실패 | `price_plan.price_unit_type='unparseable'` + `failure_reason` NOT NULL |
| 회당가를 산출하지 못함 | `price_per_session IS NULL` (0 이나 평균값으로 대체 금지 — FORBID-2) |

`price_per_session` 에 NOT NULL·DEFAULT 를 주면 이 구분이 무너진다. 그래서 그 두 가지는
`test:schema-core` 가 컬럼 메타데이터로 직접 금지한다.

## tombstone 처리 절차 (보존기간 만료 · 파기 요구)

`core.source_record` 는 **append-only** 다. UPDATE·DELETE 는 트리거가 거부한다.
원문 스냅샷이 사라지면 "이 가격이 언제 어디서 왔는가"를 증명할 수 없어 정정·삭제 요청(S5/W7·W8)에
답할 근거가 없어지기 때문이다. 반대로 무조건 보존만 하면 개인정보 파기 요구에 응할 수 없으므로,
파기 경로를 **규칙 안의 지정 절차**로 둔다.

```sql
-- 유일한 파기 경로. 행은 남고 원문만 비운다.
SELECT core.tombstone_source_record('<source_record.id>', '보존기간 만료(D3 raw_retention_days)');
```

절차:

1. 파기 사유를 확정한다 — 보존기간 만료(D3 `raw_retention_days`) 또는 파기 요구 티켓(W8) ID.
2. 위 함수를 **사유 문자열과 함께** 호출한다. 사유가 비어 있으면 함수가 거부한다(SQLSTATE 22004).
3. 결과: `raw_payload IS NULL`, `tombstoned_at`·`tombstone_reason` 기록, 행과
   `source_url`·`fetched_at`·`source_license_status` 는 **그대로 남는다**.
4. blob 스토어의 본문 삭제는 C1 의 `crawler.purge --ticket <id>` 소관이다(DB 행은 남긴다).

우회 경로가 왜 막히는가:

- 직접 `UPDATE ... SET raw_payload = NULL` → 트리거가 거부(플래그 없음).
- 트랜잭션 플래그를 스스로 세우고 UPDATE → 트리거가 **tombstone 효과 밖의 변경**을 거부한다
  (`source_url`·`fetched_at`·`source_license_status` 위조 불가).
- `DELETE` → 항상 거부.

## 실행

`pnpm` 스크립트는 `packages/db` 에서 실행한다(루트 `package.json` 은 F2a 의 `touches` 밖이라
루트 스크립트를 추가할 수 없다).

```bash
cd packages/db
export DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/glowmate_test'

pnpm db:migrate              # up (원장 public.schema_migration)
pnpm db:migrate:status
pnpm db:migrate:down --to 0000

pnpm test:schema-core        # REQ-1 · REQ-4 · REQ-6 / FORBID-2 · FORBID-3 · FORBID-4
pnpm test:constraints-core   # REQ-3 (a)(b)(c) + C4 불변식 정합 픽스처 3종
pnpm test:geo                # REQ-2 (시드 50,000행 · EXPLAIN)
pnpm test:append-only        # REQ-5 / FORBID-5
pnpm test:violations-core    # 위반 픽스처 8종이 실제로 red 가 되는지
pnpm db:roundtrip            # REQ-7 up→down→up 스냅샷 sha256
pnpm db:check-migrations     # FORBID-1 (a)(b)
pnpm db:generate-types       # src/types.ts 재생성 (--check 로 대조만)
```

DB 는 **실제 PostgreSQL + PostGIS** 여야 한다. mock·인메모리 스텁을 두지 않는다(REQ-2 acceptance).
CI 는 `postgis/postgis:16-3.4` 서비스 컨테이너에서 `db-schema` job 으로 돌린다.

## 검사 ↔ 위반 픽스처 대응

| 픽스처 | 주입 방법 | 잡는 검사 |
|---|---|---|
| ① `price_per_session` NOT NULL / DEFAULT 0 | 트랜잭션 내 `ALTER TABLE` | FORBID-2 (`test:violations-core`) |
| ② 화이트리스트 밖 컬럼 | `ADD COLUMN nickname` | FORBID-3 |
| ③ core 7번째 테이블 · 뷰 | `CREATE TABLE/VIEW core.*` | REQ-1 (집합 동등) |
| ④ 금지 축 사전 등재 | `test/core/fixtures/whitelist-forbidden-axis.json` | FORBID-3 (컬럼명 + ENUM 라벨) |
| ⑤ CASCADE FK | FK 재정의 | FORBID-4 |
| ⑥ `source_record` DELETE | 실제 DELETE 시도 | REQ-5 / FORBID-5 (트리거) |
| ⑦ up 마이그레이션 DROP COLUMN | `test/core/fixtures/migrations-drop-column/` | FORBID-1 (b) |
| ⑦b 머지된 up 파일 편집 | base 원본 주입 | FORBID-1 (a) |
| ⑧ no-op down | `test/core/fixtures/migrations-noop-down/` | REQ-7 (되돌림 실효성) |
| (추가) 필수 컬럼·UNIQUE 제거 | `DROP COLUMN` / `DROP CONSTRAINT` | REQ-1 |
| (추가) C4 출력 필드 NOT NULL 해제 · ENUM 라벨 추가 · GiST 인덱스 제거 | 트랜잭션 내 DDL | REQ-4 · FORBID-3 · REQ-2 |

## 화이트리스트 (`test/allowed-columns.core.json`)

core 스키마의 컬럼·ENUM 라벨은 이 파일에 등재된 것만 존재할 수 있다. 등재 자체가 리뷰 대상이며
(packages/db CODEOWNERS), 금지 축(성별·연령대 추정·개인 식별자 계열)은 등재 단계에서 거부된다.
패턴 목록은 데이터 파일이 아니라 `schema/core/lib/whitelist.mjs` 에 하드코딩되어 있다 —
데이터에 두면 컬럼을 넣으려는 사람이 같은 PR 에서 패턴을 지우는 것이 최단 경로가 된다.

`reserved_for_f2b` 3컬럼(`venue.visibility` · `price_plan.visibility` · `price_plan.confidence`)은
F2b 가 이 파일을 수정하지 않고 추가할 수 있도록 계약 본문이 못박은 예외다.
**F2b 의 `visibility` ENUM 타입 자체는 core 밖 스키마에 만들어야 한다** — core 의 ENUM 라벨 집합은
화이트리스트와 정확히 일치해야 하고, 예약분은 컬럼 3개까지다.

## 하류 계약이 필요로 하지만 여기 없는 것

아래는 **의도적으로 만들지 않았다.** F2a 계약이 core 를 6테이블로 닫았고, 컬럼 목록도 REQ-1·REQ-4 가
열거했기 때문이다. 필요해지면 코드로 우회하지 말고 F2a 계약 개정을 요청한다.

| 하류 | 필요 객체 | 상태 |
|---|---|---|
| C5 | `venue_source_link` · `venue_merge_candidate` | 미생성 — REQ-1 의 6테이블 집합 동등과 충돌. 별도 스키마 또는 계약 개정 필요 |
| C6 | `venue_need_tag` 8컬럼 · `venue.tagging_status` | 미생성 — 화이트리스트 미등재. 계약 개정 필요 |
| C4 | `evidence_snippet` | 본 스키마의 이름은 `source_snippet` (F2a REQ-4 가 못박은 이름). C4 문면 정정 필요 |
| C1 | job 큐 테이블 | core 밖(크롤러 소유 저장소)에 두어야 한다 — core 는 6테이블로 닫혀 있다 |
