# F1b — 계약 거버넌스 정본 (ID 레지스트리 · 게이트 상태 파일 · DAG 검증기)

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 신설: 2026-08-03 (F1 분할 — 2차 감사 §F1 필수 수정 #1~#5 · #8 · #11 수용)

```yaml
# ─── 식별 ───────────────────────────────
id:            F1b-CONTRACT-GOVERNANCE
dag_id:        F1b
title:         계약 거버넌스 정본 (docs/registry/ids.yaml · docs/gates/G1~G5.md · dag-check)
workstream:    foundation
owner_agent:   dev-platform

# ─── 존재 이유 ──────────────────────────
traces_to:     [G1, G2, G3, G4]
why:           "게이트 판정을 기록할 정본 파일과 그 어휘가 확정되지 않으면 D1b·D2·F4 가 서로 다른 어휘로
                같은 파일을 읽고 써서, 게이트 통과 여부를 기계적으로 확인할 수단이 사라진다."

# ─── DAG ────────────────────────────────
depends_on:    [F1-REPO-SCAFFOLD]
blocks:        [F4-NEED-TAG-ONTOLOGY, O1-METRICS-DASHBOARD]
               # D1b-FIELDWORK 도 docs/gates/G1.md 를 쓰므로 실질 의존이나, 해당 계약의 depends_on 반영은
               # 별도 상신 대상이다(타 저자 소유). 반영 전까지 blocks 에 넣지 않는다 — 단방향 엣지 금지.
parallel_with:  [F2a-CORE-SCHEMA, DS3-BASE-WIRING]
gate:          null                  # Phase 1은 게이트와 무관하게 선행 가능

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - docs/registry/ids.yaml
    - docs/registry/ids.schema.json
    - docs/metrics/registry.yaml            # 지표 임계 정본 (O1 이 파싱)
    - docs/metrics/registry.schema.json
    - docs/gates/_schema.json
    - docs/gates/G1.md
    - docs/gates/G2.md
    - docs/gates/G3.md
    - docs/gates/G4.md
    - docs/gates/G5.md
    - tools/dag-check/**
    - scripts/tasks_manifest.py            # 승계 대상 (REQ-5)
    - scripts/normalize_ids.py             # 승계 대상 (REQ-5)
    - .github/workflows/ci.yml             # dag-check job 추가만
    - .github/ci-budget.json               # dag-check 예산 항목 추가만
  artifacts:
    - "docs/registry/ids.yaml — traces_to 사용 가능 ID 정본 (H·S·G·KM·NSM)"
    - "docs/metrics/registry.yaml — 지표별 임계 정본 (G1 3구간 차등 포함). O1 대시보드가 파싱하는 단일 원천"
    - "docs/gates/G1~G5.md + _schema.json — 게이트별 verdict 어휘표 고정"
    - "tools/dag-check — 기존 파이썬 검증기를 승계한 단일 검증기 + 유형별 baseline"
    - "오탐 회귀 픽스처 3종 · 미탐 픽스처 7종"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      docs/registry/ids.yaml 이 H1~H7 · S1~S5 · G1~G5 · KM-* · NSM-* 를 각각 (id, 정의 1문장,
      출처 문서·섹션) 3필드로 열거하고, 계약들이 실제 참조 중인 지표 ID 4종
      (KM-price-coverage · KM-qualified-lead · KM-override-public-ratio · NSM-qualified-lead)의
      출처가 PRD 또는 Lean Canvas 의 실제 섹션을 가리키며, `KM-qualified-lead` 는 `NSM-qualified-lead` 의
      별칭으로 등재되어 정본 ID 가 1개다.
    acceptance: >
      CI job `dag-check` — `--check registry` 가 ids.schema.json 검증 통과 + 4종 ID 의 출처 필드가
      실재 파일·섹션 앵커를 가리키는지 대조 + 동일 개념 ID 가 2개 이상 정본으로 등재되면 exit 1.

  - id: REQ-2
    statement: >
      docs/metrics/registry.yaml 이 ids.yaml 의 KM-*·NSM-* 각 지표에 대해
      (id, 임계 표현, 판정 구간, 출처 가설, 분모 정의) 5필드를 열거하고, G1 관련 지표는 단일 임계가 아니라
      PRD §4 의 3구간(≥40% proceed / 25~40% editor_augment / <25% axis_excluded)을 구간 배열로 표현한다.
    acceptance: >
      CI job `dag-check` — `--check metrics` 가 registry.schema.json 검증 통과 +
      ids.yaml 의 KM-*·NSM- 전 항목이 metrics/registry.yaml 에 1:1 대응(누락·잉여 0) +
      G1 지표의 구간 배열 길이가 3이 아니거나 경계값이 PRD 수치와 다르면 exit 1.

  - id: REQ-3
    statement: >
      docs/gates/G1~G5.md 5개 파일이 docs/gates/_schema.json 을 만족하며, verdict 어휘가 게이트별로 고정된다 —
      G1: per_axis 표(3축) 각 값 ∈ {undecided, proceed, editor_augment, axis_excluded, inconclusive},
      G2: {undecided, pass, fail, channel_redesign, inconclusive},
      G3: {undecided, pass, fail}, G4: {undecided, pass, fail}, G5: {undecided, option_a, option_b}.
    acceptance: >
      CI job `dag-check` — `--check gates` 가 5개 파일 front-matter 를 스키마 검증하고,
      G1 의 per_axis 표 축 키가 (exercise_body, relax_recovery, medical_wellness) 3개와 정확히 일치,
      본 PR 시점의 전 verdict 가 `undecided` 임을 assert. 어휘 밖 값이 1건이라도 있으면 exit 1.

  - id: REQ-4
    statement: >
      dag-check 가 단일 검증기로서 (a) traces_to ⊄ ids.yaml, (b) depends_on/blocks ⊄ 정본 ID 레지스트리,
      (c) 폐기 표시 ID 참조, (d) blocks ↔ depends_on 단방향, (e) 순환, (f) 게이트 전이 위반
      (gate=G_i 인 태스크를 depends_on 하는 태스크의 gate 가 G_i 미포함), (g) 승인 게이트를 선언한 계약의
      대상 경로에 CODEOWNERS 소유자 부재 — 7종을 판정하고, 위반 수를 **유형별로** baseline.json 과 대조한다.
    acceptance: >
      CI job `dag-check` — (1) 미탐 픽스처 7종을 정확히 7건으로 판정, (2) **오탐 회귀 픽스처 3종**
      (① 개정 노트 본문에 "폐기" 문구가 있으나 살아있는 계약 ② 인라인 리스트 뒤 `# 주석` 이 붙은 계약
       ③ 폐기 태스크를 depends_on 하는 살아있는 계약)에서 **0건** 판정, (3) docs/tasks 전수 실행 시
      유형별 위반 수가 baseline.json 의 유형별 값 이하이고 `traces_to` 유형 값이 0.
      `gate` 필드는 문자열·배열 양쪽 표기를 모두 처리해야 하며, 배열을 미처리해 스킵하면 (f) 픽스처가 실패한다.

  - id: REQ-5
    statement: >
      dag-check 는 기존 파이썬 검증기의 규칙을 전량 승계하며, 승계 완료 후 리포지토리에 DAG 정합성을
      판정하는 검증기가 정확히 1개만 존재한다 (`scripts/tasks_manifest.py` 는 dag-check 호출 래퍼로
      축소되거나 삭제된다).
    acceptance: >
      CI job `dag-check` — `--check self` 가 `scripts/` 이하에서 독립 판정 로직(ID 정규식·역방향 대조·순환 탐지)의
      잔존을 검출하면 exit 1. 승계 검증으로 파이썬 검증기의 기존 출력과 dag-check 출력이 docs/tasks 전수에 대해
      동일 집합임을 1회 비교한 로그를 PR 에 첨부한다.

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: "dag-check 머지 후 `scripts/` 이하에 DAG 정합성 판정 로직(ID 정규식 대조 · blocks 역방향 검사 · 순환 탐지)이 독립적으로 남아 있는 경우"
    must_not: "규칙이 서로 다른 검증기 2개를 공존시키는 것"
    because: >
      기존 파이썬 검증기는 개발 중 오탐 3종을 이미 교정했다. 규칙이 갈라지면 node 재구현이 그 3종을 되살리고,
      두 검증기가 서로 다른 답을 낼 때 사람은 통과하는 쪽을 근거로 삼는다. 그 순간 DAG 검증은 의견이 된다.
    detect: "CI job `dag-check` — `--check self` 정적 검사(REQ-5) + 위반 픽스처(판정 로직을 남긴 스크립트)에서 exit ≠ 0"
    on_violation: block_merge

  - id: FORBID-2
    when: "dag-check 가 red 인 상태에서 baseline.json 의 유형별 값을 상향하거나, `traces_to` 유형 값을 0 이 아닌 값으로 설정하는 경우 (base 에 파일이 없는 최초 도입에도 traces_to 유형 상한 0 은 적용된다)"
    must_not: "baseline 을 올려 통과시키는 것 (계약을 고치거나 ids.yaml 출처를 확정해 해결)"
    because: >
      총건수 단일 카운터는 한 계약을 고치고 다른 계약에 새 위반을 넣으면 통과한다. 특히 traces_to 위반을
      baseline 에 흡수하면 존재하지 않는 지표 ID 를 참조하는 8개 계약이 영구 면죄되고, O1 이 그 표를 파싱하는
      CI 를 만들 때 깨진다.
    detect: "CI job `dag-check` — baseline diff 가 상향이면 docs/registry CODEOWNERS 승인 리뷰(승인자 ≠ PR 작성자, GitHub API 조회) 없이 exit 1 + traces_to 유형 값 > 0 이면 무조건 exit 1"
    on_violation: block_merge

  - id: FORBID-3
    when: "ids.yaml 에 PRD·Lean Canvas 의 실제 섹션으로 출처를 지정할 수 없는 ID 를 등재하는 경우"
    must_not: "검사를 통과시키기 위해 신규 가설·지표 ID 를 창설하는 것 (PRD 확정 PR 을 선행 머지할 것)"
    because: >
      레지스트리는 traces_to 검사의 기대값이다. 기대값을 자유롭게 만들 수 있으면 "무엇을 적어도 통과"가 되고,
      가설과 무관한 태스크가 가설 참조를 갖춘 것처럼 보인 채 배치에 들어간다.
    detect: "CI job `dag-check` — `--check registry` 가 각 ID 의 출처 앵커를 실제 문서에서 조회, 미존재 시 exit 1"
    on_violation: block_merge

  - id: FORBID-4
    when: "이 PR 에서 docs/gates/G*.md 의 verdict 또는 per_axis 값을 `undecided` 외의 값으로 기입하는 경우"
    must_not: "게이트 판정을 거버넌스 태스크에서 선기입"
    because: >
      판정 주체는 D1b(G1) · D2(G2) · D3(G3) · C7(G4) 이다. 파일 소유자가 값까지 정하면 게이트는
      증거가 아니라 선언이 되고, F4 처럼 게이트를 읽어 착수 여부를 정하는 태스크가 근거 없이 진행된다.
    detect: "CI job `dag-check` — `--check gates` 가 본 PR diff 에서 verdict 값이 undecided 아닌 파일을 발견하면 exit 1 (판정 PR 은 해당 Discovery 계약의 CODEOWNERS 승인 경로로만 통과)"
    on_violation: block_merge

  - id: FORBID-5
    when: "REQ-4 의 오탐 회귀 픽스처 3종 중 하나라도 삭제하거나, 기대 판정을 0건에서 다른 값으로 변경하는 경우"
    must_not: "오탐 픽스처를 제거·완화해 검증기를 통과시키는 것"
    because: >
      이 검증기는 실제로 3회 오탐을 냈다. 없는 결함을 만들어내는 검증기는 사람이 무시하게 되고,
      무시되는 검사는 원칙 3 상 존재하지 않는 것과 같다. 미탐만 막고 오탐을 방치하면 정확히 그 상태가 된다.
    detect: "CI job `dag-check` — 픽스처 디렉터리 diff 에서 오탐 픽스처 3종의 삭제·기대값 변경이 감지되면 docs/registry CODEOWNERS 승인 리뷰 없이 exit 1"
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "워크스페이스·번들·CI 러너 구성 (F1)"
  - "게이트 판정값 기입 (D1b · D2 · D3 · C7 소관)"
  - "PRD·Lean Canvas 본문 수정 — KM-*/NSM-* 확정은 별도 선행 PR (done_when 참조)"
  - "지표 산출 SQL·대시보드 구현 (O1) — 본 태스크는 임계 정본 파일과 그 스키마만 소유한다"
  - "타 저자 소유 계약 파일(docs/tasks/W*·O*·C*·D*)의 depends_on/blocks 수정 — 위반은 baseline 유형별 계상 후 상신"
  - "계약 내용(REQ·FORBID) 품질 심사 — task-auditor 소관. dag-check 는 구조 정합성만 판정"
  - "게이트 통과 시 후속 태스크를 자동 착수시키는 오케스트레이션"

rollback: >
  `git revert <merge-sha>` 로 정본 파일 3종과 dag-check job 이 함께 제거된다.
  REQ-4 로 파이썬 검증기를 삭제·축소한 경우 revert 시 원본이 복원되므로 검증 공백이 생기지 않는다.
  브랜치 보호 필수 체크에서 dag-check 를 함께 해제한다. DB·배포 대상 없음.

done_when:
  - "`KM-*`·`NSM-*` 4종 ID 를 PRD 또는 Lean Canvas 에 확정하는 선행 PR 이 main 에 머지되어 있고, ids.yaml 의 출처 필드가 그 섹션을 가리킴"
  - "`node tools/dag-check --check registry --check gates --check self` 및 전수 실행이 exit 0"
  - "미탐 픽스처 7종이 7건으로, **오탐 회귀 픽스처 3종이 0건으로** 판정됨"
  - "파이썬 검증기 출력과 dag-check 출력이 docs/tasks 전수에서 동일 집합임을 비교한 로그가 PR 에 첨부되고, 승계 후 판정 로직이 1개만 남음"
  - "baseline.json 이 유형별 카운터로 기록되고 `traces_to` 유형 값이 0"
  - "docs/gates/G1~G5.md 5개 파일의 전 verdict 가 undecided 이며 게이트별 어휘표가 _schema.json 에 인코딩됨"
  - "docs/metrics/registry.yaml 이 ids.yaml 과 1:1 대응하고 G1 지표가 3구간으로 표현됨 (O1 REJECT 사유 해소 확인)"
  - "D1b·D2·C7 계약 저자에게 게이트별 verdict 어휘표가 전달되고, D1b 의 depends_on 에 F1b 추가가 상신됨"
```
