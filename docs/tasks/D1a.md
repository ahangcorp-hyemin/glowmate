# D1a — 조사 프로토콜 사전등록 (모집단·표집·"가격 확인됨" 정의·판정 임계)

> **분할 사유:** 사전등록과 현장조사가 한 PR에 있으면 통제가 원리적으로 무력하다.
> `git log` 커밋 시각 비교는 `GIT_COMMITTER_DATE` 조작과 squash merge 로 붕괴한다.
> 사전등록은 **PR 경계(=main 선머지)** 로만 강제할 수 있다.
> 구 `docs/tasks/D1.md` 는 폐기되었다.

---

## 계약 고정 상수 — 사전등록이 **선택할 수 없는** 값

> 감사 지적("사후 완화는 막았으나 사전 설정이 무방비")에 대한 대응.
> 아래 값·enum 은 D1a 저자가 정하는 것이 아니라 **본 계약이 정한다.** 잠금 대상의 허용 범위다.

### K-1. 허용 증거 채널 (이 집합의 **부분집합만** 선택 가능. 확대 불가)

| 값 | 정의 |
|---|---|
| `website` | 업체가 소유·운영하는 공식 웹사이트 |
| `naver_place` | 네이버 플레이스 업체 등록 정보 |
| `kakao_map` | 카카오맵 업체 등록 정보 |
| `instagram_public` | 업체 공식 계정의 **로그인 없이 열람 가능한** 게시물 |
| `official_blog` | 업체가 운영 주체로 명시된 공식 블로그 |

### K-2. 증거로 **인정 금지** (프로토콜에 포함하면 계약 위반)

전화·카카오톡·DM·방문 문의로 취득한 가격 · 제3자 후기/체험단/카페 글에 적힌 결제 금액 ·
쿠폰/딜 플랫폼(소셜커머스) 판매가 · 종료된 이벤트 가격 · 타 업체 가격의 유추 · 조사자 추정치

### K-3. `price_found = true` 성립 요건 (전부 충족해야 하며 완화 불가)

1. K-1 채널 중 하나에 **현재 게시**되어 있을 것 (열람 시점 스냅샷으로 증명)
2. **금액 숫자**와 **대상 서비스명**이 **동일 페이지**에 함께 게시되어 있을 것
3. "가격 문의" · "상담 후 안내" · "회원 문의" 만 있는 경우는 `false`

### K-4. 판정 임계 — PRD §4 G1 전사. **다른 값 기입 불가**

`proceed_threshold = 0.40` · `exclude_threshold = 0.25` · 그 사이 = `editor_augment`

### K-5. 표본 프레임 허용 소스 (부분집합만 선택 가능)

`map_category_enumeration`(지도 서비스의 지역×카테고리 **전수 나열**) · `public_license_registry`(공공 인허가 데이터)

**프레임 구축 필터에 사용 금지인 속성:** 가격/요금/이용권, 예약·결제 연동 여부, 광고·상위노출 상품 가입 여부,
리뷰 수·평점 상위 정렬, 검색 결과 상위 N

### K-6. 수치 상한·하한

| 항목 | 값 |
|---|---|
| 확정 표본 | 100 (축별 34 / 33 / 33) |
| (축 × 구) 9칸 각각 최소 | 8 |
| 홀드아웃 | 25 (층화 무작위, 봉인) |
| 표본 교체 상한 | 5건 |
| `blocked` 상한 | 5건 |
| 유효 조사 완료 정의 | `n = 100 − blocked − 교체불가` |
| 이중판정 대상 | 20건 (고정 시드 산출) |
| 이중판정 불일치 시 확정값 | `false` (보수적) |
| 홀드아웃 drift 허용 | `< 15%p` |

---

```yaml
# ─── 식별 ───────────────────────────────
id:            D1a-PROTOCOL
title:         조사 프로토콜 사전등록 (모집단·표집·"가격 확인됨" 정의·판정 임계)
workstream:    discovery
owner_agent:   research-discovery

# ─── 존재 이유 ──────────────────────────
traces_to:     [H1, G1, KM-price-coverage]
why:           "판정 기준을 데이터보다 먼저, 별도 PR로 main에 고정하지 않으면 G1은 '조사 결과'가 아니라 '원하는 결론에 맞춘 정의'의 함수가 되고, 그 위에 Phase 2 파이프라인 7개 태스크가 세워진다."

# ─── DAG ────────────────────────────────
depends_on:    [F1-REPO-SCAFFOLD]      # `discovery` CI job 이 없으면 block_merge 를 집행할 수단이 없다
blocks:        [D1b-FIELDWORK, F4-NEED-TAG-ONTOLOGY]
parallel_with: [D2-SEO-SERP-FEASIBILITY, D3-SOURCE-DUE-DILIGENCE, D4-MEDICAL-AD-GUARDRAIL]
gate:          null

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1                        # 이 PR이 main에 머지된 뒤에만 D1b PR을 열 수 있다
  touches:
    - docs/discovery/D1a/**
    - scripts/discovery/validate_d1a.py
  artifacts:
    - "docs/discovery/D1a/protocol.md — 프레임 규칙·판정 트리·집계 규칙·임계"
    - "docs/discovery/D1a/protocol.lock — protocol.md + sample.csv + ledger_schema.json 의 sha256"
    - "docs/discovery/D1a/frame_build.md — 프레임 구축 소스·쿼리·필터 전문 + 재현 로그"
    - "docs/discovery/D1a/population.csv — 모집단"
    - "docs/discovery/D1a/sample.csv — 확정 표본 100 (축 배정 포함) + 예비표본 20"
    - "docs/discovery/D1a/holdout.enc — 홀드아웃 25건 봉인 (키는 팀 리드 보관)"
    - "docs/discovery/D1a/ledger_schema.json — D1b가 채울 원장 스키마"
    - "docs/discovery/D1a/definition_examples/ — 판정 트리 검증용 실측 예시 20건 + 스냅샷"
    - "scripts/discovery/validate_d1a.py"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      저자는 frame_build.md 에 프레임 소스(K-5 enum), 수집 쿼리·필터 전문, 수집 일시, 재현 절차를
      기록하고 population.csv 를 300행 이상으로 구축한다.
    acceptance: >
      CI job `discovery` 에서 `python scripts/discovery/validate_d1a.py --check frame` exit 0.
      검사: population.csv ≥ 300행 · frame_source 값이 K-5 enum의 부분집합 ·
      filter_expressions 문자열이 K-5 금지 속성 토큰 사전과 0건 매칭 ·
      population.csv 의 (축,구) 9칸 각각 ≥ 20행.

  - id: REQ-2
    statement: >
      저자는 protocol.md 에 `price_found` 판정 트리를 분기 5개 이상으로 기술하되,
      허용 증거 채널을 K-1의 부분집합으로, 성립 요건을 K-3 전부로 고정한다.
    acceptance: >
      `validate_d1a.py --check definition` exit 0.
      검사: allowed_channels ⊆ K-1 · protocol.md 전문에 K-2 금지 채널 토큰
      (전화|통화|카톡|DM|방문문의|체험단|카페글|소셜커머스|추정) 0건 매칭 ·
      required_conditions 배열이 K-3의 3개 항목을 모두 포함.

  - id: REQ-3
    statement: >
      저자는 판정 트리를 **실제 관측 스냅샷** 20건(양성 10 / 음성 10)에 적용해 기대 라벨과
      100% 일치시킨다. 양성 10건은 표기 형태가 서로 다른 5종 이상(본문 텍스트·표·이미지·PDF·
      게시물 캡션)을 포함한다.
      *(원칙 2.5 짝 — 정의를 극단적으로 좁게 잡아 커버리지를 0으로 만드는 경로를 차단)*
    acceptance: >
      `validate_d1a.py --check definition-recall` exit 0.
      검사: definition_examples/ 하위 20건 각각에 snapshot 파일·취득 URL·sha256 존재 ·
      snippet 이 스냅샷 추출 텍스트의 부분문자열 · 판정 트리 적용 결과가 기대 라벨과 20/20 일치 ·
      양성 10건의 `display_form` 값 distinct ≥ 5.

  - id: REQ-4
    statement: >
      저자는 protocol.md 에 기록된 고정 시드로 population.csv 에서 확정 표본 100 + 예비표본 20 을
      추출하고, 축별 34/33/33 및 (축,구) 9칸 각각 ≥ 8 을 만족시킨다. 각 표본 행의 축 배정은
      protocol.md 의 축 결정표를 적용한 결과이며 D1b에서 변경 불가다.
    acceptance: >
      `validate_d1a.py --check sampling` exit 0.
      검사: status=primary 100행 · 축 카운트 = {34,33,33} · (축,구) 9칸 각각 ≥ 8 ·
      seed 재실행 결과가 sample.csv 와 완전 일치 · venue_id 중복 0 · 전 행이 population 에 존재.

  - id: REQ-5
    statement: >
      저자는 확정 표본 100 중 층화 무작위 25건을 홀드아웃으로 지정해 holdout.enc 로 봉인하고,
      평문 venue_id 를 리포지토리 어디에도 남기지 않는다.
    acceptance: >
      `validate_d1a.py --check holdout-sealed` exit 0.
      검사: holdout.enc 존재 · 복호화 키가 리포 내 부재 · 홀드아웃 25건의 venue_id 문자열이
      추적 대상 파일 전체에서 grep 0건 · 봉인 매니페스트에 축별 배분(9/8/8)과 sha256 기록.

  - id: REQ-6
    statement: >
      저자는 protocol.md 에 집계 규칙을 확정한다 — `n` 정의(K-6), blocked·교체 상한,
      이중판정 20건의 고정 시드 선정 절차, 불일치 시 확정값 `false`, Wilson 95% 구간 산식.
    acceptance: >
      `validate_d1a.py --check aggregation` exit 0.
      검사: n_definition 문자열 == `100 - blocked - unreplaceable` ·
      blocked_cap == 5 · replacement_cap == 5 · disagreement_resolution == `false` ·
      double_check_seed 로 재실행한 20건 목록이 protocol.md 기재 목록과 일치.

  - id: REQ-7
    statement: >
      저자는 protocol.md 에 K-4 임계값을 전사하고, `inconclusive` 강제 조건 3종
      (n < 90 · 교체 > 5 · 홀드아웃 drift ≥ 15%p)을 판정 규칙에 포함한다.
    acceptance: >
      `validate_d1a.py --check thresholds` exit 0.
      검사: proceed_threshold == 0.40 · exclude_threshold == 0.25 ·
      inconclusive_conditions 배열이 위 3종을 모두 포함 · 임계 필드에 소수점 3자리 초과 값 부재.

  - id: REQ-8
    statement: >
      저자는 ledger_schema.json 에 D1b가 채울 원장 컬럼을 확정한다 — 필수 컬럼 16종
      (venue_id, name, gu, axis, evidence_channel, source_url, snapshot_path, access_method,
      checked_at, price_found, price_evidence_snippet, price_structure_type, service_menu_raw,
      absence_check, evaluator, cohort) 및 각 컬럼의 타입·enum.
    acceptance: >
      `validate_d1a.py --check ledger-schema` exit 0.
      검사: 16개 컬럼 전부 정의 · `service_menu_raw` 가 필수(fallback `NONE_LISTED`) ·
      `absence_check` 가 K-1 5개 채널 각각의 확인 결과를 담는 객체 타입 ·
      스키마가 JSON Schema draft 2020-12 로 검증 통과.

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      frame_build.md 의 프레임 소스가 K-5 enum 밖이거나, 수집 필터 표현식에 K-5 금지 속성
      (가격·요금·이용권·예약·결제·광고상품·상위노출·평점정렬·검색상위N)이 포함된 경우
    must_not: >
      그 결과물을 population.csv 로 확정하거나 protocol.lock 에 포함
    because: >
      프레임 편향은 고정 시드 무작위 추출을 완벽히 지켜도 커버리지를 20~30%p 부풀린다.
      "네이버 예약 연동 업체 목록"으로 프레임을 짜면 임계값을 단 한 글자도 건드리지 않고
      G1을 통과시킬 수 있다 — 분모를 바꾸는 것이 임계를 바꾸는 것보다 쉽고 눈에 띄지 않는다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check frame` 이 frame_source enum 위반 또는
      금지 토큰 매칭 시 non-zero exit.
    on_violation: block_merge

  - id: FORBID-2
    when: >
      protocol.md 의 allowed_channels 가 K-1의 부분집합이 아니거나, 판정 트리 본문에
      K-2 금지 증거(전화·DM·체험단·카페글·소셜커머스·종료 이벤트·추정치) 취득 경로가 등장하는 경우
    must_not: >
      protocol.lock 을 발행
    because: >
      정의를 처음부터 넓게 잡고 잠그면 계약을 100% 준수하면서 H1이 부풀려진다. 특히 전화 취득
      가격과 체험단 후기 금액은 크롤러가 재현할 수 없어, G1 통과 후 파이프라인 실측에서
      커버리지가 20%대로 드러나고 UVP 피봇 결정이 6개월 늦어진다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check definition` 의 enum 부분집합 검사 +
      금지 토큰 사전 매칭.
    on_violation: block_merge

  - id: FORBID-3
    when: >
      protocol.md 의 proceed_threshold 또는 exclude_threshold 가 K-4(0.40 / 0.25)와 다른 값인 경우
    must_not: >
      해당 protocol.md 로 protocol.lock 을 발행
    because: >
      "사전등록이므로 자유롭게 정할 수 있다"는 해석으로 임계를 0.35로 낮춰 잠그면,
      잠금장치가 오히려 조작을 정당화한다. G1 임계는 PRD가 소유하며 조사자가 소유하지 않는다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check thresholds` 의 값 동등성 검사.
    on_violation: block_merge

  - id: FORBID-4
    when: >
      홀드아웃 25건의 venue_id·상호명이 평문으로 저장되었거나 sample.csv 의 컬럼·행 순서로
      역산 가능한 경우 (예: 홀드아웃이 말미 25행에 연속 배치)
    must_not: >
      holdout.enc 및 sample.csv 를 커밋
    because: >
      홀드아웃이 사전에 식별되면 조사자가 홀드아웃만 엄격하게(또는 느슨하게) 조사해
      drift 검출 장치가 무력화되고, 조사 후반으로 갈수록 판정이 느슨해지는 편향을
      D1b 단계에서 잡아낼 수단이 사라진다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check holdout-sealed` 가 평문 grep 매칭 또는
      sample.csv 내 홀드아웃 행의 연속 배치(런 길이 ≥ 5)를 검출하면 non-zero exit.
    on_violation: block_merge

  - id: FORBID-5
    when: >
      definition_examples/ 의 양성 예시 중 snapshot 파일이 없거나 snippet 이 스냅샷 추출 텍스트의
      부분문자열이 아닌 항목이 존재하는 경우
    must_not: >
      REQ-3 의 정의 검증을 통과로 간주하고 protocol.lock 을 발행
    because: >
      창작한 예시로 판정 트리를 검증하면, 실제 웹에 존재하는 가격 게시 형태(표 이미지·PDF 요금표·
      인스타 카드뉴스)를 정의가 배제해도 드러나지 않는다. 그 결과 커버리지가 하향 편향되어
      실제로는 40%를 넘는 축이 `axis_excluded` 로 제외되고, '웰니스 지도'가 단일 업종 디렉터리로 축소된다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check definition-recall` 의 스냅샷 존재·
      부분문자열·display_form distinct ≥ 5 검사.
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - 표본 100건의 실제 조사 (D1b)
  - ledger.csv 데이터 행 작성 (D1b. 본 태스크는 스키마까지)
  - G1 판정 결과 기록 (D1b가 docs/gates/G1.md 를 생성)
  - 크롤러·파서·스키마 구현 (C1·C4·F2)
  - 니즈 태그 온톨로지 설계 (F4)
  - 소스별 robots/ToS 판정 (D3) · 의료광고 표기 규칙 (D4)
  - 강남3구 외 지역 프레임

rollback: >
  1) `git revert -m 1 <merge_sha>` 로 docs/discovery/D1a/** 와 scripts/discovery/validate_d1a.py 제거.
  2) protocol.lock 이 main 에서 사라지면 D1b는 FORBID-1(선행 lock 부재)로 자동 차단되므로
     별도 조치 없이 하류가 멈춘다.
  3) 홀드아웃 봉인 키는 팀 리드 보관이므로 리포 롤백으로 유출 위험이 발생하지 않는다.
  4) 외부 발신·데이터 삭제가 없어 부수 효과 없음.

done_when:
  - protocol.md · protocol.lock · frame_build.md · population.csv · sample.csv · holdout.enc ·
    ledger_schema.json · definition_examples/ 가 전부 존재한다
  - `python scripts/discovery/validate_d1a.py --all` exit 0
  - **메타테스트**: `scripts/discovery/fixtures/d1a/` 의 위반 픽스처 5종이 각각 non-zero exit 함을 확인
    (① 프레임 필터에 `예약연동=Y` 포함 ② allowed_channels 에 `phone` 추가
     ③ proceed_threshold=0.35 ④ 홀드아웃 평문 노출 ⑤ 양성 예시 스냅샷 누락)
    — 검증기가 계약에 적힌 검사를 실제로 수행함을 보증한다
  - F1의 CI job `discovery` 가 `scripts/discovery/**` 를 실행하도록 등록되어 있고,
    본 PR에서 해당 job 이 실행된 로그가 존재한다
  - 홀드아웃 복호화 키가 팀 리드에게 전달되었다 (리포에 부재)
```
