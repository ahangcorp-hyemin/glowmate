# F2a — 코어 스키마 (venue · price_plan · need_tag · editor_report · source_record)

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 신설: 2026-08-03 (구 F2 분할 — `docs/audit/D1-F4-audit.md` §F2 필수 수정 #9)

```yaml
# ─── 식별 ───────────────────────────────
id:            F2a-CORE-SCHEMA
dag_id:        F2a
title:         코어 스키마 & 마이그레이션 (도메인 6테이블 · PostGIS · C4 출력 필드)
workstream:    foundation
owner_agent:   dev-data

# ─── 존재 이유 ──────────────────────────
traces_to:     [H1, H2, S1]
why:           "C4 가 산출하는 회당 단가·단위 유형·원문 스니펫을 담을 컬럼과 원문 보존 테이블이 없으면
                파이프라인 5건이 존재하지 않는 객체 위에 요구사항과 탐지를 세우게 된다."

# ─── DAG ────────────────────────────────
depends_on:     [F1-REPO-SCAFFOLD]
blocks:        [C1-CRAWLER-CORE, C4-PRICE-NORMALIZER, C5-ENTITY-RESOLUTION, C6-TAG-ASSIGN, C7-QUALITY-GATE, F2b-QUALITY-SCHEMA, F5-API-LAYER, W2-DISCOVERY-LIST, W3-VENUE-DETAIL]
parallel_with:  [O3-DEPLOY-MONITORING, DS1-TOKEN-LAYERS]
gate:          null                  # Phase 1은 게이트와 무관하게 선행 가능

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - packages/db/schema/core/**
    - packages/db/migrations/**
    - packages/db/src/types.ts
    - packages/db/test/core/**
    - packages/db/test/allowed-columns.core.json    # 허용 컬럼 화이트리스트 (계약 부록 = 기대값)
    - packages/db/package.json
    - .github/workflows/ci.yml                      # db-schema job 추가만
    - .github/ci-budget.json                        # db-schema 예산 항목 추가만
  artifacts:
    - "도메인 6테이블 DDL up/down 마이그레이션"
    - "PostGIS geography 컬럼 + GiST 인덱스"
    - "허용 컬럼 화이트리스트 파일 (기대값 원천)"
    - "source_record tombstone 함수 (파기 요구·보존기간 만료용)"
    - "TS 타입 생성물 packages/db/src/types.ts"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      마이그레이션 적용 후 도메인 테이블이 정확히 6개(venue, price_plan, need_tag, venue_need_tag,
      editor_report, source_record)이고, 각 테이블이 테스트 소스에 하드코딩된 필수 컬럼·제약 목록
      (venue: id·slug UNIQUE·name·category·gu·location / need_tag: slug UNIQUE·ontology_id /
      venue_need_tag: (venue_id, need_tag_id) PK·evidence_snippet /
      editor_report: venue_id FK·visited_at / source_record: source_url·raw_payload·fetched_at)을 전부 포함한다.
    acceptance: >
      `pnpm test:schema-core` — information_schema 질의 결과를 테스트 파일에 하드코딩된 기대 목록과 대조,
      누락 1건이라도 있으면 exit 1. 마이그레이션에서 덤프한 스냅샷을 기대값으로 사용하면 실패로 간주한다.

  - id: REQ-2
    statement: >
      venue.location 이 geography(Point,4326) NOT NULL 이고 GiST 인덱스를 가지며, 시드 50,000행에서
      반경 3km 검색 쿼리의 EXPLAIN 출력에 Index Scan 또는 Bitmap Index Scan 이 포함된다.
    acceptance: >
      `pnpm test:geo` — 실제 PostGIS 컨테이너(mock 금지)에서 시드 50,000행 적재 후 EXPLAIN(FORMAT JSON) 파싱.
      테스트 소스에 `enable_seqscan` 등 플래너 설정 변경 구문이 검출되면 exit 1.

  - id: REQ-3
    statement: >
      price_plan 이 원문 필드(raw_text NOT NULL, source_record_id NOT NULL FK)와 파생 필드를 분리하고,
      CHECK 제약 2종 — (a) price_per_session IS NULL → failure_reason NOT NULL,
      (b) price_unit_type <> 'per_session' → price_per_session IS NULL — 을 갖는다.
    acceptance: >
      `pnpm test:constraints-core` — (a) 위반 INSERT 가 SQLSTATE 23514 로 거부, (b) 위반 INSERT 가 23514 로 거부,
      raw_text NULL INSERT 가 23502 로 거부.

  - id: REQ-4
    statement: >
      price_plan 이 C4 출력 6필드를 보유한다 — price_unit_type ENUM('per_session','period_pass','single_session','unparseable') NOT NULL,
      price_per_month_krw integer NULL, period_days integer NULL, source_snippet text NOT NULL,
      captured_at timestamptz NOT NULL, parser_version text NOT NULL.
    acceptance: "`pnpm test:schema-core` — 6개 컬럼의 (타입, NULL 허용, ENUM 라벨 집합)이 테스트 하드코딩 기대값과 완전 일치."

  - id: REQ-5
    statement: >
      source_record 는 append-only 이며 UPDATE·DELETE 가 DB 레벨에서 거부되고, 보존기간 만료·파기 요구는
      함수 `tombstone_source_record(id, reason)` 로만 처리되어 행은 남고 raw_payload 가 NULL,
      tombstoned_at·tombstone_reason 이 기록된다.
    acceptance: >
      `pnpm test:append-only` — UPDATE 1건·DELETE 1건이 각각 예외 발생, tombstone 함수 호출 후
      해당 행이 조회되고 raw_payload IS NULL AND tombstoned_at IS NOT NULL.

  - id: REQ-6
    statement: >
      6개 테이블의 전체 컬럼 집합이 packages/db/test/allowed-columns.core.json 화이트리스트의 부분집합이다.
    acceptance: "`pnpm test:schema-core` — 화이트리스트 밖 컬럼이 1개라도 존재하면 컬럼명과 함께 exit 1."

  - id: REQ-7
    statement: >
      모든 마이그레이션이 up/down 쌍을 가지며 `up → down → up` 왕복 후 스키마 덤프의 sha256 이
      최초 up 직후 덤프의 sha256 과 일치한다.
    acceptance: "CI job `db-schema` — 왕복 실행 후 두 sha256 불일치 시 exit 1."

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      base 브랜치(origin/main)에 이미 존재하는 up 마이그레이션 파일의 내용이 변경되거나,
      신규 **up** 마이그레이션 SQL 에 DROP TABLE · DROP COLUMN · TRUNCATE · ALTER TYPE ... USING 이 포함된 경우
      (동일 버전 down 스크립트의 되돌림용 DROP 과, base 에 파일이 없는 최초 도입은 검사 대상이 아니다)
    must_not: "머지된 마이그레이션 편집 또는 up 방향 데이터 손실형 DDL 적용 (신규 컬럼 추가 → 백필 → 별도 태스크에서 폐기 순서를 따를 것)"
    because: >
      source_record 의 원문 스냅샷은 재수집 불가능한 자산이다. 소스가 차단되거나 페이지가 내려가면 영구 소실되고,
      "이 가격은 언제 어디서 왔는가"의 추적이 끊겨 정보 정정·삭제 요청(S5)에 응답할 근거가 사라진다.
    detect: >
      CI job `db-schema` — (a) 머지된 up 파일의 sha256 매니페스트 대조, (b) 신규 up 파일 정규식 검사.
      예외 통과는 `allow-destructive` 라벨만으로는 불가하며 packages/db CODEOWNERS 승인 리뷰
      (승인자 ≠ PR 작성자, GitHub API 조회) + 백업 아티팩트 첨부가 함께 있어야 한다.
    on_violation: block_merge

  - id: FORBID-2
    when: "price_plan.price_per_session 컬럼을 정의하거나 변경할 때"
    must_not: "NOT NULL 선언 또는 DEFAULT(0 · 카테고리 평균 · 중앙값 포함) 부여"
    because: >
      "파싱 실패"와 "회당 0원"이 같은 값이 되면 C4 가 실패를 기록할 자리를 잃고, W3 가격 블록에 0원 또는
      가짜 평균가가 노출된다. UVP 전체가 걸린 가격 신뢰는 단 한 건의 오노출로 붕괴한다.
    detect: "`pnpm test:schema-core` — is_nullable='YES' · column_default IS NULL · CHECK(price_per_session IS NULL OR price_per_session > 0) 존재를 assert"
    on_violation: block_merge

  - id: FORBID-3
    when: "6개 테이블에 allowed-columns.core.json 에 등재되지 않은 컬럼명 또는 ENUM 라벨을 추가하는 경우"
    must_not: "화이트리스트 갱신(= CODEOWNERS 승인) 없이 컬럼·ENUM 라벨 추가"
    because: >
      금지 정규식은 이름만 바꾸면 뚫린다 — `gender` 는 막아도 `target_audience ENUM('women','men')` 은 통과하고,
      그 순간 성별이 1급 스키마 축이 되어 4050 남성 확장 시 색인된 URL 까지 포함한 파괴적 마이그레이션이 발생한다.
      폐쇄 화이트리스트만이 "이름을 바꾼 같은 것"을 막는다.
    detect: >
      `pnpm test:schema-core` — 컬럼 집합 ⊄ 화이트리스트면 실패(REQ-6). 화이트리스트 파일 diff 는
      packages/db CODEOWNERS 승인 리뷰(승인자 ≠ 작성자) 없이는 CI 실패.
    on_violation: block_merge

  - id: FORBID-4
    when: "venue 를 참조하는 FK 를 정의할 때, 또는 업체·요금제를 내리는 경로를 스키마로 표현할 때"
    must_not: "ON DELETE CASCADE 부여, 또는 물리 DELETE 를 유일한 내림 표현으로 정의"
    because: >
      PRD G4 는 "미달 데이터는 비공개(삭제 아님)"다. 물리 삭제하면 (1) 다음 크롤링 사이클에 같은 업체가
      재수집되어 삭제 요청이 무력화되고, (2) CASCADE 로 source_record·editor_report 까지 사라져
      지표 시계열과 법적 증빙이 동시에 끊긴다.
    detect: "`pnpm test:schema-core` — venue 참조 FK 중 delete_rule='CASCADE' 가 1건이라도 있으면 실패"
    on_violation: block_merge

  - id: FORBID-5
    when: "source_record 의 보존기간 만료 또는 파기 요구를 처리하는 경로를 구현할 때"
    must_not: "행 DELETE 로 처리하거나, tombstone 함수를 우회해 raw_payload 를 직접 UPDATE"
    because: >
      C1 의 "원문 무조건 보존"과 D3 의 raw_retention_days 는 정면 충돌하며, 파기 요구가 오는 첫날 규칙이 깨진다.
      행이 사라지면 그 가격이 어느 소스에서 왔는지 영구히 알 수 없어 정정 요청에 답할 수 없다.
    detect: "`pnpm test:append-only` — DELETE·UPDATE 시도가 예외를 발생시키고, tombstone 함수 경로만 성공함을 assert"
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "visibility ENUM · confidence · quality_score · reason_codes · override · public_venue 뷰 · price_conflict · venue_suppression · lead_event → F2b-QUALITY-SCHEMA"
  - "need_tag 행 삽입(온톨로지 데이터 시드) → F4 정의 후 C6 소관. 본 태스크는 테이블 구조만"
  - "가격 파싱·정규화 로직 (C4) · 엔티티 병합 (C5)"
  - "조회 함수·zod 응답 계약 (F5)"
  - "읽기 성능용 추가 인덱스·머티리얼라이즈드 뷰"
  - "실제 업체 데이터 시드 — 시드는 합성 픽스처만 사용 (G3 이전)"

rollback: >
  1) `pnpm db:migrate:down --to <F2a 직전 버전>` 실행 (본 태스크 시점에는 파생 데이터가 없어 손실 없음)
  2) `git revert <merge-sha>`
  3) 스테이징 DB 는 down 실행 전 `pg_dump` 결과를 CI 아티팩트로 첨부한다.
  down 스크립트의 DROP 은 FORBID-1 의 검사 대상이 아니다(동일 버전 되돌림용).

done_when:
  - "`pnpm db:migrate && pnpm test:schema-core && pnpm test:constraints-core && pnpm test:geo && pnpm test:append-only` 전부 exit 0"
  - "up→down→up 왕복 후 덤프 sha256 동일"
  - "위반 픽스처 5종(price_per_session NOT NULL / 화이트리스트 밖 컬럼 / CASCADE FK / source_record DELETE / up 마이그레이션 DROP COLUMN)이 각각 대응 검사를 실패시킴을 확인"
  - "packages/db/src/types.ts 가 마이그레이션으로부터 생성되고 `pnpm typecheck` 통과"
  - "db-schema job 이 .github/ci-budget.json 예산 안에서 완료되고 F1 의 8개 job 이 여전히 green"
  - "packages/db/README 에 6테이블 관계도와 tombstone 처리 절차 포함"
```
