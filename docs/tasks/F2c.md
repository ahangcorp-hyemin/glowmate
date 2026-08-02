# F2c — 운영·법적 저장소 (정정 요청 · 처리 이력 · 검수 감사 로그 · 필드 오버라이드 · 공개 전이 이벤트)

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 신설: 2026-08-03 (2차 감사 반영 — F2 분할 3분면. `docs/audit/round2-webops.md` §1-④ 착수 차단 1순위 해소)

```yaml
# ─── 식별 ───────────────────────────────
id:            F2c-OPS-LEGAL-SCHEMA
dag_id:        F2c
title:         운영·법적 저장소 (correction_request · correction_action_log · review_audit_log · venue_field_override · visibility_change_event)
workstream:    foundation
owner_agent:   dev-data

# ─── 존재 이유 ──────────────────────────
traces_to:     [S5, H1, G3]
why:           "삭제·정정 요청을 담을 테이블과 그 처리 이력을 남길 로그가 없으면, 요청을 접수할 수도
                이행했음을 증명할 수도 없어 W7·W8·O2 셋이 동시에 착수 불가가 된다."

# ─── DAG ────────────────────────────────
depends_on:    [F2a-CORE-SCHEMA]
blocks:        [O2-REVIEW-ADMIN, W7-CORRECTION-REQUEST, W8-CORRECTION-PROCESSING]
               # C7 도 visibility_change_event 를 발행하지만 depends_on 이 아직 F2b 를 가리킨다(타 저자 소유).
               # 수신자 정정이 상신되어 있으며, 반영 전까지 blocks 에 넣지 않는다 — 단방향 엣지 금지.
parallel_with:  [F2b-QUALITY-SCHEMA]
gate:          null                  # 법적 안전판이므로 게이트 뒤로 미루지 않는다 (W7 gate:null 과 정합)

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - packages/db/schema/ops/**
    - packages/db/migrations/**
    - packages/db/src/types.ts
    - packages/db/test/ops/**
    - packages/db/test/allowed-columns.ops.json
    - .github/workflows/ci.yml                 # db-schema job 의 대상 경로 확장만
  artifacts:
    - "ops 스키마 5테이블 DDL up/down 마이그레이션"
    - "append-only 트리거 3종 + consumed_at 단일 컬럼 예외"
    - "redact_ops_record() — 파기 요구·법적 명령 전용 마스킹 함수"
    - "due_at UPDATE 거부 트리거 (W8 FORBID-3 의 탐지 수단)"
    - "DB 롤 권한 (ops_writer / reviewer / approver)"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      DB 스키마 네임스페이스 `ops` 의 테이블 목록이 5개(correction_request, correction_action_log,
      review_audit_log, venue_field_override, visibility_change_event)와 집합 동등이고, 각 테이블이
      테스트 소스에 하드코딩된 필수 컬럼을 전부 포함한다 —
      correction_request(id, venue_id FK, type, body, contact_email NULL 허용, access_code UNIQUE,
      status, due_at, requires_takedown_review, resolution_note NULL 허용, reason_code NULL 허용,
      created_at, closed_at NULL 허용) /
      correction_action_log(id, request_id FK, actor_id, action, before, after, reason_code, note, created_at) /
      review_audit_log(id, record_id, actor_id, action, before, after, reason_code, note, created_at) /
      venue_field_override(id, venue_id FK, field, before, after, approver_ids, reason_code, note, created_at) /
      visibility_change_event(id, venue_id FK, from_value, to_value, changed_at, consumed_at NULL 허용).
    acceptance: >
      `pnpm test:schema-ops` — `information_schema.tables WHERE table_schema='ops'` 결과와 하드코딩 5개의
      집합 동등 비교(부분집합 비교로 구현하면 실패), 필수 컬럼 누락 1건이라도 있으면 컬럼명과 함께 exit 1.

  - id: REQ-2
    statement: >
      correction_request 의 type·status·reason_code 가 폐쇄 ENUM
      (type: price_error·info_error·takedown·other / status: received·in_review·resolved·rejected)이고,
      due_at 은 INSERT 후 어떤 경로로도 UPDATE 되지 않도록 트리거가 거부하며, access_code 는 UNIQUE 다.
    acceptance: >
      `pnpm test:constraints-ops` — enum 밖 값 INSERT 가 22P02/23514 로 거부,
      due_at UPDATE 시도가 예외 발생, 동일 access_code 2행 INSERT 가 23505 로 거부.

  - id: REQ-3
    statement: >
      로그 3종(correction_action_log, review_audit_log, visibility_change_event)은 append-only 이며
      UPDATE·DELETE 가 거부된다. 예외는 정확히 2개다 —
      (a) visibility_change_event.consumed_at 단일 컬럼 UPDATE(NULL → 타임스탬프, 역방향 불가),
      (b) 파기 요구·법적 명령 대응 함수 `redact_ops_record(table_name, row_id, legal_basis)` 로
      before·after·note 컬럼만 마스킹하고 행·actor_id·created_at 은 보존.
    acceptance: >
      `pnpm test:append-only-ops` — 3개 테이블 각각 UPDATE 1건·DELETE 1건이 예외,
      consumed_at UPDATE 는 성공하고 타임스탬프 → NULL 역방향은 예외,
      redact 함수 실행 후 대상 행이 존재하며 before/after/note IS NULL 이고 actor_id·created_at 불변,
      legal_basis 인자 없이 호출 시 예외.

  - id: REQ-4
    statement: >
      venue_field_override.field 는 폐쇄 ENUM 이며 그 라벨 집합이 정확히
      (total_amount_krw, session_count, price_per_session, price_unit_type, source_url, captured_at) 6개로,
      visibility·quality_score·reason_codes·suppression 계열 라벨을 포함하지 않는다.
      approver_ids 는 text[] CHECK(cardinality ≥ 2 AND 원소 중복 없음)이며 행은 append-only 다.
    acceptance: >
      `pnpm test:constraints-ops` — ENUM 라벨 집합 동등 비교 실패 시 exit 1,
      `visibility` 등 금지 라벨로 INSERT 시 22P02 거부, approver_ids 길이 1 INSERT 가 23514 거부.

  - id: REQ-5
    statement: >
      정상 처리 경로 하한 — 골든 접수 20건(type 4종 균등)이 전건 INSERT 성공하고, 그 20건이
      (status→in_review→resolved) 전이 + resolution_note + reason_code + correction_action_log 1행 생성까지
      **단일 트랜잭션 1회**로 전건 완료되며, takedown 6건은 F2b 의 venue_suppression 행 삽입까지 포함해
      완료 후 public_venue 조회가 0건이 된다.
    acceptance: >
      `pnpm test:ops-roundtrip` — 20건 접수 성공 + 20건 종결 성공(부분 실패 0) + takedown 6건의
      public_venue 조회 0건. 종결 성공 건수가 20 미만이면 exit 1 (전량 거부·전량 보류 구현 차단).

  - id: REQ-6
    statement: >
      DB 롤 권한이 (a) ops_writer: 5테이블 INSERT 가능·UPDATE/DELETE 불가,
      (b) reviewer·approver: 로그 3종 SELECT 만 가능·UPDATE/DELETE 시 42501,
      (c) 세 롤 모두 core.venue.visibility UPDATE 권한 없음 — 으로 구성된다.
    acceptance: >
      `pnpm test:roles-ops` — 롤별 3종 시나리오(로그 INSERT 성공 / 로그 UPDATE 42501 /
      venue.visibility UPDATE 42501)를 전수 assert.

  - id: REQ-7
    statement: >
      실제 PostgreSQL 16 + PostGIS 컨테이너에 F2a → F2c 순으로 마이그레이션을 적용하고 down 을 실행했을 때,
      down 직후 덤프 sha256 이 F2c 적용 이전 덤프와 일치하며 core 스키마 객체는 변하지 않는다.
    acceptance: >
      CI job `db-schema` — mock 없이 컨테이너에서 3개 덤프(pre / post-up / post-down) 채취,
      post-down == pre assert. no-op down 픽스처(빈 down 스크립트)에서 반드시 exit 1.
      down 실행 후 `information_schema` 의 core 테이블 6개가 그대로임을 함께 assert.

  - id: REQ-8
    statement: >
      ops 스키마 전 테이블의 컬럼 집합이 packages/db/test/allowed-columns.ops.json 화이트리스트의
      부분집합이며, 연락처 계열 컬럼은 correction_request.contact_email 하나뿐이다.
    acceptance: >
      `pnpm test:schema-ops` — 화이트리스트 밖 컬럼 1건이라도 있으면 exit 1,
      정규식 `(email|phone|tel|ip_addr|user_agent|device_id|fingerprint)` 에 매치되는 컬럼이
      contact_email 외에 존재하면 exit 1.

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      venue_field_override.field ENUM 에 visibility·quality_score·reason_codes·suppression 계열 라벨을
      추가하거나, ops 스키마의 트리거·함수가 core.venue.visibility 또는 F2b 의 venue_suppression 을
      갱신하도록 정의되는 경우
    must_not: "필드 정정 경로로 공개 상태를 바꿀 수 있게 만드는 것"
    because: >
      삭제 요청(hidden_request)·법적 명령(hidden_legal)으로 내린 업체를 "가격 정정"이라는 이름의
      오버라이드로 되살릴 수 있으면, F2b 가 확립한 불가역 비공개가 우회되고 W7 접수·W8 처리 기록이
      전부 거짓이 된다. 이행 실패는 지표가 아니라 소송으로 돌아온다.
    detect: >
      `pnpm test:constraints-ops` — ENUM 라벨 집합 동등(REQ-4) + 금지 라벨 INSERT 거부,
      `pnpm test:ops-roundtrip` — hidden_legal·hidden_request·활성 suppression 상태의 venue 에
      전 field 값으로 override 를 INSERT 한 뒤 public_venue 조회가 여전히 0건임을 18케이스 전수 assert,
      그리고 ops 마이그레이션 SQL 에 `core.venue`·`venue_suppression` 대상 UPDATE 문자열 검출 시 실패
    on_violation: block_merge

  - id: FORBID-2
    when: >
      로그 3종(correction_action_log · review_audit_log · visibility_change_event)에 대해
      REQ-3 이 규정한 2개 예외(consumed_at 단일 컬럼 전진 UPDATE, redact_ops_record 함수) 밖의
      UPDATE·DELETE 경로를 트리거·권한·운영 스크립트로 여는 경우
    must_not: "감사 로그를 수정·삭제 가능하게 만드는 것"
    because: >
      지울 수 있는 감사 로그는 감사 로그가 아니다. 삭제 요청을 언제 누가 어떻게 처리했는지가 사라지면
      분쟁에서 이행을 증명할 수단이 없다. 동시에 무조건 금지로 두면 파기 요구·법적 명령이 오는 첫날
      규칙이 깨지므로, 그 예외를 함수 하나로 좁혀 규칙 안에 넣는다.
    detect: >
      `pnpm test:append-only-ops` — 3테이블 UPDATE·DELETE 예외 발생 + 예외 2종의 정확한 동작(REQ-3) +
      위반 픽스처(로그 UPDATE 를 허용하는 트리거)에서 exit ≠ 0. CI 정적 검사로 ops 로그 대상
      DELETE/TRUNCATE 호출 검출 시 실패(redact 함수 호출은 allowlist).
    on_violation: block_merge

  - id: FORBID-3
    when: "correction_request 행을 물리 삭제하는 경로(트리거·권한·배치 스크립트)를 추가하는 경우 (REQ-1 의 contact_email 을 NULL 로 갱신하는 파기 배치는 규칙 안의 예외다)"
    must_not: "요청 본문·접수시각·상태 이력을 행 단위로 삭제 가능하게 만드는 것"
    because: >
      요청 레코드가 사라지면 "접수된 적 없다"와 "처리했다"가 구분되지 않는다. 재크롤링으로 같은 업체가
      다시 올라왔을 때 이전 삭제 요청을 근거로 재억제할 수 없고, overdue 지표도 요청을 지우면 0이 된다.
    detect: "`pnpm test:append-only-ops` — correction_request DELETE 시도가 예외 + contact_email UPDATE 는 성공 + 파기 배치 시뮬레이션 후 행 수 불변 assert"
    on_violation: block_merge

  - id: FORBID-4
    when: "due_at UPDATE 거부 트리거를 제거·비활성화하거나, correction_request 에 due_at 을 파생시키는 DEFAULT·계산 컬럼을 추가하는 경우"
    must_not: "기한을 사후에 움직일 수 있게 만드는 것 (기한 산정은 W7 애플리케이션 상수의 소관이며 저장 후에는 불변이다)"
    because: >
      overdue 지표를 0 으로 만드는 가장 빠른 방법은 처리를 잘하는 것이 아니라 기한을 늘리는 것이다.
      트리거가 없으면 W8 FORBID-3 의 탐지 수단 자체가 사라져, 방치가 지표에서 조용히 소멸한다.
    detect: "`pnpm test:constraints-ops` — due_at UPDATE 예외(REQ-2) + 마이그레이션 SQL 에 `due_at` DEFAULT·GENERATED 구문 검출 시 실패 + 트리거 존재를 pg_trigger 조회로 assert"
    on_violation: block_merge

  - id: FORBID-5
    when: "ops 스키마 테이블에 allowed-columns.ops.json 화이트리스트 밖 컬럼을 추가하거나, contact_email 외의 연락처·단말 식별자 계열 컬럼(phone·ip_addr·user_agent·device_id·fingerprint 등)을 화이트리스트에 최초 등재하는 경우"
    must_not: "화이트리스트 갱신(CODEOWNERS 승인) 없이 컬럼을 추가하거나, 식별자 축을 사전 등재해 두는 것"
    because: >
      정정 요청은 로그인 없는 사용자가 보내는 유일한 개인정보 유입 경로다. 연락처가 늘어나면 W7 의
      파기 배치가 커버하지 못하는 식별자가 남고, 수집 근거 없는 보관이 되어 창구 자체가 리스크가 된다.
    detect: "`pnpm test:schema-ops` — 컬럼 집합 ⊄ 화이트리스트 시 실패(REQ-8) + 금지 정규식 매치 시 실패. 화이트리스트 diff 는 packages/db CODEOWNERS 승인 리뷰(승인자 ≠ 작성자) 없이는 CI 실패."
    on_violation: block_merge

  - id: FORBID-6
    when: "이 태스크의 마이그레이션이 F2b 소유 객체(venue_suppression · public_venue 뷰 · core.venue.visibility · venue_visibility_override)를 CREATE·ALTER·REPLACE 하는 경우"
    must_not: "F2b 객체를 F2c 마이그레이션에서 생성·변경 (참조만 한다. 부족하면 작업을 중단하고 F2b 변경을 요청)"
    because: >
      같은 객체를 두 태스크가 소유하면 PR 1개 원칙이 실행 시점에 깨지고, 뷰 정의가 두 벌이 되어
      한쪽 테스트는 통과하는데 실제 서빙은 다른 정의를 쓰는 상태가 만들어진다. 그것이 1차·2차 감사에서
      C7 과 F2b 사이에 실제로 발생한 사고다.
    detect: "CI job `db-schema` — ops 마이그레이션 SQL 에 위 4개 객체명에 대한 CREATE/ALTER/CREATE OR REPLACE 구문 검출 시 exit 1 (SELECT 참조는 allowlist)"
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "venue_suppression · public_venue 뷰 · visibility ENUM · override 레이어 → F2b-QUALITY-SCHEMA (참조만 한다)"
  - "코어 6테이블 → F2a-CORE-SCHEMA"
  - "접수 폼·API·상태 조회 (W7) · 처리 큐·회신·SLA 지표 (W8) · 검수 어드민 UI (O2)"
  - "due_at 산정 상수(+7/+14) 정의 — W7 애플리케이션 소관. 본 태스크는 저장 후 불변성만 보장"
  - "visibility_change_event 소비자(캐시 무효화 워커) 구현 — 소유 태스크 미정, 상신 대상"
  - "contact_email 파기 배치 실행·스케줄 (W7 REQ-8) — 본 태스크는 UPDATE 허용 경로만 제공"
  - "지표 산출·알림 룰 (W7 REQ-7 · W8 REQ-7 · O3)"

rollback: >
  1) `pnpm db:migrate:down --to <F2c 직전 버전>` — ops 스키마만 제거되고 core·quality 스키마는 불변(REQ-7 로 검증).
  2) `git revert <merge-sha>`
  3) 단, 접수 레코드가 이미 존재하면 down 을 실행하지 않는다. 이행 이력이 사라지면 삭제 요청 대응을
     증명할 수 없으므로, 이 경우 `pg_dump -n ops` 아티팩트를 첨부하고 롤백 대신 전진 수정(patch PR)한다.

done_when:
  - "`pnpm test:schema-ops && pnpm test:constraints-ops && pnpm test:append-only-ops && pnpm test:roles-ops && pnpm test:ops-roundtrip` 전부 exit 0"
  - "REQ-7 실 컨테이너 스모크(F2a→F2c 적용 → down → pre 덤프 일치)가 통과하고 no-op down 픽스처가 실패함을 확인"
  - "위반 픽스처 6종(field ENUM 에 visibility 추가 / 로그 UPDATE 허용 트리거 / correction_request DELETE / due_at 트리거 제거 / 화이트리스트 밖 연락처 컬럼 / F2b 객체 ALTER)이 각각 대응 검사를 실패시킴을 확인"
  - "FORBID-1 의 18케이스(불가역 상태 × 전 field 값)에서 public_venue 조회가 전부 0건"
  - "REQ-5 왕복 20건이 전건 성공 — 전량 거부·전량 보류 구현이 아님을 확인"
  - "W7·W8·O2·C7 계약 저자에게 (a) 5테이블 컬럼 목록, (b) 예외 2종(consumed_at·redact_ops_record), (c) 선행 조건 표의 수신자를 F2b → F2c 로 정정할 항목이 전달됨"
```
