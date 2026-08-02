# F2b — 품질·공개판정 스키마 (visibility · confidence · override · public_venue 뷰)

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 신설: 2026-08-03 (구 F2 분할 · DAG 정정 #2 `visibility` ENUM 정본 · 정정 #4 판정/오버라이드 분리 저장)
> 개정: 2026-08-03 (2차 감사 — **불가역 비공개 확립**(force_public ⊂ hidden_quality) · venue_suppression 뷰 결합 · 뷰 단독 소유 · lead_event 컬럼 정합)

```yaml
# ─── 식별 ───────────────────────────────
id:            F2b-QUALITY-SCHEMA
dag_id:        F2b
title:         품질·공개판정 스키마 (visibility ENUM · confidence · 판정/override 분리 · public_venue 뷰 · lead_event)
workstream:    foundation
owner_agent:   dev-data

# ─── 존재 이유 ──────────────────────────
traces_to:     [H4, G4, S4]
why:           "공개 판정 결과와 사람의 오버라이드를 분리 저장하고 뷰로 결합하지 않으면, C7 의 단일 쓰기 경로와
                O2 의 2인 승인 공개가 같은 컬럼을 두고 충돌해 한쪽은 반드시 구현 불가가 된다."

# ─── DAG ────────────────────────────────
depends_on:     [F2a-CORE-SCHEMA]
blocks:        [C4-PRICE-NORMALIZER, C7-QUALITY-GATE, F5-API-LAYER, F6-PRICE-STATE, O1-METRICS-DASHBOARD, O2-REVIEW-ADMIN, W1-SEO-FOUNDATION, W2-DISCOVERY-LIST, W3-VENUE-DETAIL, W6-LEAD-TRACKING, W7-CORRECTION-REQUEST, W8-CORRECTION-PROCESSING, W9-OBSERVABILITY-EVENTS]
parallel_with:  [O3-DEPLOY-MONITORING, DS1-TOKEN-LAYERS]
gate:          null                  # Phase 1은 게이트와 무관하게 선행 가능

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - packages/db/schema/quality/**
    - packages/db/views/public_venue.sql        # 뷰 단독 소유. C7 은 touches 에서 제외해야 한다(상신)
    - packages/db/migrations/**
    - packages/db/src/types.ts
    - packages/db/test/quality/**
    - packages/db/test/allowed-columns.quality.json
    - .github/workflows/ci.yml                 # db-schema job 의 대상 경로 확장만
  artifacts:
    - "visibility ENUM(5값) + 컬럼 DEFAULT hidden_quality"
    - "venue_quality_judgement (C7 전용 쓰기) / venue_visibility_override (O2 전용 쓰기) 분리 테이블"
    - "public_venue 뷰 (단독 소유) — 판정 × 오버라이드 × 서프레션 결합 진리표 6행 + 컬럼 화이트리스트"
    - "price_conflict · venue_suppression · lead_event 테이블"
    - "DB 롤 3종(pipeline_writer, admin_writer, web_reader) 권한 정의"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      visibility 타입이 ENUM('public','needs_review','hidden_quality','hidden_request','hidden_legal') 5값이고,
      venue.visibility 와 price_plan.visibility 의 컬럼 DEFAULT 가 'hidden_quality' 이다.
    acceptance: "`pnpm test:schema-quality` — ENUM 라벨 집합이 5값과 정확히 일치, 두 컬럼의 column_default 가 `'hidden_quality'`, DEFAULT INSERT 행의 값 assert."

  - id: REQ-2
    statement: >
      C7 판정 결과가 venue_quality_judgement(venue_id PK, quality_score smallint CHECK 0~100,
      reason_codes text[] — 원소가 폐쇄 enum 6종(NO_PRICE, PRICE_CONFLICT, STALE_DATA, SINGLE_SOURCE,
      MEDICAL_GUARDRAIL_FAIL, MISSING_REQUIRED_FIELD) CHECK, judged_at, judge_version)에 저장된다.
    acceptance: "`pnpm test:constraints-quality` — quality_score=101 INSERT 가 23514 거부, reason_codes 에 enum 밖 문자열 INSERT 가 23514 거부."

  - id: REQ-3
    statement: >
      O2 오버라이드가 venue_visibility_override(venue_id, decision ENUM('force_public','force_hidden'),
      approver_ids text[] CHECK(cardinality ≥ 2 AND 원소 중복 없음), reason_code, reason_text, created_at)에
      append-only 로 저장되고 최신 행이 유효 오버라이드가 되며, decision='force_public' 은 대상 venue 의
      visibility 가 'hidden_quality' 인 경우에만 INSERT 가 허용된다(트리거 강제).
    acceptance: >
      `pnpm test:constraints-quality` — approver_ids 길이 1 INSERT 가 23514 거부, 동일 id 2개 INSERT 가 23514 거부,
      override 행 UPDATE·DELETE 가 예외. visibility ∈ {hidden_request, hidden_legal, needs_review} 인 venue 에 대한
      force_public INSERT 3케이스가 전부 예외로 거부됨을 assert.

  - id: REQ-4
    statement: >
      public_venue 뷰가 venue × venue_quality_judgement × venue_visibility_override × venue_suppression 을
      결합해 아래 진리표대로만 행을 노출하며, 노출 컬럼이 allowed-columns.quality.json 의 public_view
      화이트리스트와 정확히 일치한다 —
      (1) 활성 suppression(최신 action='suppress') 존재 → **항상 제외**,
      (2) visibility ∈ {hidden_request, hidden_legal} → **항상 제외**,
      (3) 최신 override.decision='force_hidden' → 제외,
      (4) visibility='hidden_quality' AND 최신 override.decision='force_public' → 노출,
      (5) visibility='public' AND (3)·(1)·(2) 미해당 → 노출,
      (6) 그 외(needs_review, override 없는 hidden_quality) → 제외.
    acceptance: >
      `pnpm test:public-view` — 진리표 6행 각각의 픽스처가 기대대로 판정되고, 특히
      (a) visibility 4개 hidden 값 + needs_review 픽스처 각 1건이 조회 0건,
      (b) force_hidden override 픽스처가 visibility='public' 이어도 0건,
      (c) **hidden_request·hidden_legal·활성 suppression 각각에 force_public override 를 얹은 3케이스가 전부 0건**,
      (d) 뷰의 컬럼 집합 == 화이트리스트, quality_score·reason_codes 미포함.

  - id: REQ-5
    statement: >
      visibility='public' 이고 override·suppression 이 없는 픽스처 20건 전건이 public_venue 뷰에서 조회되고,
      visibility='hidden_quality' 에 force_public override 를 얹은 픽스처 5건 전건이 조회된다 (정상 공개 경로 하한).
    acceptance: "`pnpm test:public-view` — 조회 결과 행수가 각각 정확히 20, 5 가 아니면 exit 1."

  - id: REQ-6
    statement: >
      price_plan.confidence 가 numeric(3,2) NULL 허용·DEFAULT 없음·CHECK(confidence >= 0 AND confidence <= 1) 이고,
      소스 간 불일치는 price_conflict(price_plan_id_a, price_plan_id_b, detected_at, resolved_at NULL 허용,
      UNIQUE(least(a,b), greatest(a,b)))로 표현되어 양쪽 요금제 행이 모두 보존된다.
    acceptance: "`pnpm test:constraints-quality` — confidence=1.5 거부, 동일 쌍 역순 중복 INSERT 가 23505 거부, conflict 행 삽입 후 참조된 두 price_plan 이 모두 조회됨."

  - id: REQ-7
    statement: >
      venue_suppression 이 append-only 이벤트 로그
      (venue_id, action ENUM('suppress','lift'), reason ENUM('request','legal'), actor_id NOT NULL,
      correction_request_id NULL 허용, created_at)로 존재하고, 활성 억제는 venue별 최신 행의
      action='suppress' 로 판정되며 행 UPDATE·DELETE 가 거부된다.
    acceptance: >
      `pnpm test:append-only-quality` — UPDATE 1건·DELETE 1건 각각 예외 발생.
      `pnpm test:public-view` — suppress 행 INSERT 직후 해당 venue 의 뷰 조회가 0건이 되고,
      이어 lift 행 INSERT 후 다시 조회됨(활성 판정이 최신 행 기준임을 확인).

  - id: REQ-8
    statement: >
      lead_event 의 컬럼 집합이 allowed-columns.quality.json 의 lead_event 화이트리스트
      (event_type, action_type, surface, venue_id, session_hash, visitor_hash, price_block_seen,
      is_bot, event_version, occurred_at)와 정확히 일치하고,
      admin_writer·web_reader 롤이 venue.visibility 를 UPDATE 할 권한을 갖지 않는다.
    acceptance: >
      `pnpm test:schema-quality` — 컬럼 집합 동등 비교 실패 시 exit 1.
      `pnpm test:roles` — admin_writer 롤로 `UPDATE venue SET visibility=...` 실행 시 SQLSTATE 42501,
      override INSERT 는 성공, pipeline_writer 롤은 judgement INSERT 성공.

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: "public_venue 뷰 정의 SQL 이 venue_quality_judgement · venue_visibility_override · venue_suppression 3종 중 하나라도 조인하지 않거나, WHERE 절 없이 base 테이블을 SELECT 하는 경우"
    must_not: "판정·오버라이드를 반영하지 않는 뷰를 공개면 소스로 정의"
    because: >
      뷰가 무시하면 C7 의 판정 함수가 아무리 정확해도 G4 는 존재하지 않는다. 최단 우회는 `SELECT * FROM venue`
      한 줄이며 이 상태에서도 C7 의 REQ·FORBID 는 전부 통과한다. 특히 suppression 을 결합하지 않으면
      W8 이 takedown 행을 넣어도 업체가 계속 공개되어, 삭제 요청 이행 경로가 통째로 존재하지 않게 된다.
    detect: "`pnpm test:public-view` — 진리표 6행 픽스처 전수(REQ-4) + 뷰 SQL 정적 검사(조인 대상 3테이블 문자열 존재, WHERE 절 존재)"
    on_violation: block_merge

  - id: FORBID-2
    when: "venue.visibility · price_plan.visibility · price_plan.confidence 세 컬럼의 DEFAULT 를 지정할 때"
    must_not: "visibility 에 DEFAULT 'public' 을 주거나 DEFAULT 를 생략하는 것 · confidence 에 NOT NULL 또는 DEFAULT(1.0 포함)를 주는 것"
    because: >
      기본값이 공개면 C1 크롤러가 넣는 모든 미검증 행이 즉시 노출 대상이 되어 C7 게이트를 통과하지 않은
      가격이 색인되고, 색인된 오가격은 DB 를 고쳐도 검색결과에서 즉시 사라지지 않는다.
      confidence 는 생산자가 C4 뿐이라 기본값 1.0 이 있으면 아무도 채우지 않아도 전 요금제가 최고 신뢰로
      저장되고, W2·W3·W4 의 확정/추정 구분이 전부 confirmed 로 붕괴한다.
      두 컬럼 모두 "아직 검증되지 않음"이 기본 상태여야 한다.
    detect: >
      `pnpm test:schema-quality` — visibility 2컬럼의 column_default == 'hidden_quality',
      confidence 의 column_default IS NULL · is_nullable='YES' assert +
      마이그레이션 SQL 의 `visibility ... DEFAULT 'public'` · `confidence ... DEFAULT` 정규식 매치 시 실패
    on_violation: block_merge

  - id: FORBID-3
    when: >
      대상 venue 의 visibility 가 hidden_request · hidden_legal 이거나 활성 suppression(최신 action='suppress')이
      존재하는 상태에서, 오버라이드·뷰 정의·마이그레이션 중 어느 경로로든 그 행을 public_venue 에 노출시키는
      변경을 만드는 경우
    must_not: "법적·삭제요청 비공개를 되돌릴 수 있게 만드는 것 (force_public 의 유효 범위는 hidden_quality 하나뿐이다)"
    because: >
      삭제 요청과 법적 명령으로 내린 업체가 어드민 2인 승인만으로 되살아나면, W7 접수와 W8 처리가 남긴
      "이행했다"는 기록이 거짓이 된다. 이행 실패는 지표가 아니라 소송으로 돌아오고, 그때 우리가 제시할
      증거는 되살릴 수 있는 오버라이드 로그뿐이다. 품질 미달(hidden_quality)만이 사람의 판단으로 뒤집을 수 있다.
    detect: >
      `pnpm test:public-view` REQ-4 (c) — hidden_request · hidden_legal · 활성 suppression 각각에
      force_public override 를 얹은 3케이스가 전부 조회 0건 +
      `pnpm test:constraints-quality` REQ-3 — 해당 상태의 venue 에 대한 force_public INSERT 가 트리거로 거부
    on_violation: block_merge

  - id: FORBID-4
    when: "pipeline 또는 admin 경로가 venue.visibility 를 직접 UPDATE 할 수 있도록 권한·트리거를 구성하는 경우"
    must_not: "판정 주체(C7)와 오버라이드 주체(O2)가 같은 컬럼에 쓰도록 스키마 권한을 부여"
    because: >
      두 주체가 같은 컬럼을 쓰면 C7 의 "쓰기 경로 정확히 1개"와 O2 의 "2인 승인 공개"가 동시에 성립할 수 없고,
      공개 상태가 왜 그렇게 되었는지 사후 추적이 불가능해져 삭제 요청 이행 여부를 증명할 수 없다.
    detect: "`pnpm test:roles` — admin_writer 롤의 venue.visibility UPDATE 가 42501, override INSERT 는 성공함을 assert"
    on_violation: block_merge

  - id: FORBID-5
    when: "lead_event · venue_quality_judgement · venue_visibility_override · venue_suppression 에 allowed-columns.quality.json 화이트리스트 밖 컬럼명을 추가하는 경우"
    must_not: "화이트리스트 갱신(CODEOWNERS 승인) 없이 컬럼 추가"
    because: >
      정규식 금지는 `user_agent`·`device_id`·`fingerprint`·`target_audience` 를 놓치고 `event_name` 을
      오탐한다. 로그인 없는 서비스에 식별자가 쌓이면 수집 근거 없는 개인정보 보관이 되고, 유출 시 서비스 중단 사유가 된다.
    detect: "`pnpm test:schema-quality` — 4개 테이블 컬럼 집합 ⊄ 화이트리스트면 실패. 화이트리스트 diff 는 packages/db CODEOWNERS 승인 리뷰(승인자 ≠ 작성자) 필요."
    on_violation: block_merge

  - id: FORBID-6
    when: "venue_visibility_override · venue_suppression · price_conflict 행에 대한 UPDATE 또는 DELETE 경로를 스키마가 허용하는 경우"
    must_not: "이력 행을 수정·삭제 가능하게 정의 (충돌 종료는 resolved_at 신규 행/컬럼 세팅이 아닌 새 이벤트 행으로 표현)"
    because: >
      지울 수 있는 감사 로그는 감사 로그가 아니다. 오버라이드 이력이 사라지면 "누가 이 업체를 공개로 되돌렸는가"를
      답할 수 없고, takedown 이력이 사라지면 법적 분쟁에서 이행 증빙이 없다.
    detect: "`pnpm test:append-only-quality` — 3개 테이블 각각에 UPDATE 1건·DELETE 1건 시도 시 예외 발생 assert"
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "코어 6테이블 정의 (F2a) — 본 태스크는 컬럼·테이블 추가만 하고 기존 컬럼을 변경하지 않는다"
  - "품질 스코어 산식·임계값·판정 실행 (C7)"
  - "어드민 UI·승인 워크플로 (O2)"
  - "이벤트 수집 엔드포인트·봇 판정 로직 (W6/W9) — 본 태스크는 lead_event 컬럼 계약만"
  - "correction_request · correction_action_log · review_audit_log · venue_field_override · visibility_change_event → 운영·법적 저장소 → F2c-OPS-LEGAL-SCHEMA 소관. 본 태스크는 W7·W8·O2 를 unblock 하지 않는다"
  - "takedown 판정·회신·SLA (W8) — 본 태스크는 suppression 행이 뷰에 반영되는 경로만 보장한다"
  - "public_venue 뷰를 소비하는 조회 함수 (F5)"
  - "가격 상태 판정 규칙 (F6)"

rollback: >
  1) `pnpm db:migrate:down --to <F2b 직전 버전>` — F2a 코어 테이블은 유지되고 품질 테이블·뷰·롤만 제거된다.
  2) `git revert <merge-sha>`
  3) 롤 3종은 down 스크립트에서 REVOKE 후 DROP ROLE 한다.
  판정·오버라이드 데이터가 이미 존재하면 down 전 `pg_dump -t venue_quality_judgement -t venue_visibility_override`
  아티팩트를 첨부한다(FORBID-6 취지상 데이터는 재적재 가능해야 한다).

done_when:
  - "`pnpm test:schema-quality && pnpm test:constraints-quality && pnpm test:public-view && pnpm test:append-only-quality && pnpm test:roles` 전부 exit 0"
  - "위반 픽스처 6종(SELECT * 뷰 / suppression 미결합 뷰 / visibility DEFAULT public / confidence DEFAULT 1.0 / admin 롤 visibility UPDATE / override 행 DELETE)이 각각 대응 검사를 실패시킴을 확인"
  - "hidden_request·hidden_legal·활성 suppression 에 force_public 을 얹은 3케이스가 전부 조회 0건 (법적 불가역성 확인)"
  - "suppress 행 INSERT → 뷰 0건 → lift 행 INSERT → 뷰 1건 왕복이 통과 (W8 REQ-2 의 달성 가능성 확인)"
  - "REQ-5 의 공개 픽스처 25건이 뷰에서 전건 조회됨(전량 hidden 구현 차단 확인)"
  - "up→down→up 왕복 후 덤프 sha256 동일"
  - "packages/db/README 에 visibility 상태 전이표와 판정×오버라이드 결합 진리표(2×5) 포함"
  - "C7·O2·W8·F5·F6 계약 저자에게 public_venue 뷰 진리표(6행)·컬럼 목록·롤 3종 이름이 전달되고, C7 touches 에서 public_venue.sql 제외가 상신됨"
  - "판정 테이블 명칭 정본이 `venue_quality_judgement` 임이 C7(현행 `quality_verdict`)에 상신됨"
```
