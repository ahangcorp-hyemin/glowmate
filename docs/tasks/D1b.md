# D1b — 현장 조사 실행 (표본 100, 사전등록된 프로토콜대로만)

> **선행 조건:** `docs/discovery/D1a/protocol.lock` 이 **origin/main 에 이미 존재**해야 한다.
> 본 PR의 diff 에 D1a 산출물이 1바이트라도 포함되면 사전등록이 성립하지 않는다 (FORBID-1).
> 구 `docs/tasks/D1.md` 는 폐기되었다.

---

## 이 계약이 D1a 로부터 상속하는 고정값

> 아래는 D1b 가 **선택할 수 없다.** 전부 `protocol.lock` 에 해시로 고정되어 있다.

| 항목 | 값 |
|---|---|
| 표본 | `sample.csv` status=primary 100행 (축 배정 포함, 변경 불가) |
| `price_found` 성립 요건 | D1a §K-3 |
| 허용 증거 채널 | D1a §K-1 (5종) |
| 판정 임계 | proceed 0.40 / exclude 0.25 |
| 유효 조사 완료 | `n = 100 − blocked − unreplaceable` |
| 상한 | 교체 ≤ 5 · blocked ≤ 5 → **n ≥ 90** |
| 이중판정 | 고정 시드 20건 · 불일치 시 `false` 확정 |
| 홀드아웃 | 25건 봉인. 주표본 75건 집계 확정 후 개봉 |
| `inconclusive` 강제 | n < 90 · 교체 > 5 · 홀드아웃 drift ≥ 15%p |

---

```yaml
# ─── 식별 ───────────────────────────────
id:            D1b-FIELDWORK
title:         현장 조사 실행 (강남3구 표본 100, 3축 균등)
workstream:    discovery
owner_agent:   research-discovery

# ─── 존재 이유 ──────────────────────────
traces_to:     [H1, H2, G1, S1, KM-price-coverage]
why:           "공개 채널 가격 노출율을 축별로 실측해 G1 판정을 산출하지 않으면, UVP 전체와 Phase 2 파이프라인 7개 태스크가 검증되지 않은 가정 위에 놓인다."

# ─── DAG ────────────────────────────────
depends_on:    [D1a-PROTOCOL, F1-REPO-SCAFFOLD]
blocks:        [F4-NEED-TAG-ONTOLOGY]
parallel_with: [D2-SEO-SERP-FEASIBILITY, D3-SOURCE-DUE-DILIGENCE, D4-MEDICAL-AD-GUARDRAIL]
gate:          null                   # 이 태스크가 G1의 입력을 산출한다
# 주: C1·C4는 게이트(G1) 매개 의존이므로 blocks 에 넣지 않는다. 게이트 선행 검사는
#     docs/gates/G1.md 의 verdict 로 수행한다 (감사 지적 E 반영).

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - docs/discovery/D1b/**
    - docs/gates/G1.md
    - scripts/discovery/validate_d1b.py
  artifacts:
    - "docs/discovery/D1b/ledger.csv — 100행 조사 원장 (스키마는 D1a ledger_schema.json)"
    - "docs/discovery/D1b/snapshots/<venue_id>.{html,png,pdf} — 증거 스냅샷"
    - "docs/discovery/D1b/interim_summary.json — 주표본 75건 집계 (홀드아웃 개봉 전 확정)"
    - "docs/discovery/D1b/double_check.csv — 이중판정 20건"
    - "docs/discovery/D1b/replacement_log.csv — 표본 교체 기록 (≤5)"
    - "docs/discovery/D1b/report.md — 축별 커버리지·Wilson 구간·drift·H2 예비"
    - "docs/gates/G1.md — 축별 G1 verdict (게이트 상태 정본)"
    - "scripts/discovery/validate_d1b.py"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      조사자는 확정 표본 100건 전부에 대해 D1a `ledger_schema.json` 의 필수 컬럼 16종을
      빈 값 없이 기록하며, 각 행의 `axis` 는 sample.csv 의 값과 동일하다.
    acceptance: >
      CI job `discovery` 에서 `python scripts/discovery/validate_d1b.py --check ledger` exit 0.
      검사: ledger.csv 100행 · JSON Schema 검증 통과 · 16개 컬럼 빈 값 0 ·
      (venue_id, axis) 쌍이 sample.csv primary 와 100/100 일치.

  - id: REQ-2
    statement: >
      조사자는 `price_found=true` 인 모든 행에 대해 스냅샷 파일을 남기고,
      `price_evidence_snippet` 이 그 스냅샷에서 추출한 텍스트의 부분문자열임을 성립시킨다.
      이미지/PDF 스냅샷은 OCR 추출 텍스트 파일을 동반한다.
    acceptance: >
      `validate_d1b.py --check evidence-integrity` exit 0.
      검사: true 행 100%에 snapshot_path 파일 존재 · sha256 기록 ·
      snippet ∈ substring(extracted_text) 가 100% 성립 · 실패 1건이라도 non-zero.

  - id: REQ-3
    statement: >
      조사자는 `price_found=false` 인 모든 행에 대해 `absence_check` 에 D1a K-1의 5개 채널
      각각의 확인 결과를 (확인 URL | `not_present` | `channel_absent`) 로 기록한다.
      *(조사 소진 증거 — 확인하지 않고 false 로 처리하는 경로를 차단)*
    acceptance: >
      `validate_d1b.py --check absence-evidence` exit 0.
      검사: false 행 100%의 absence_check 객체가 5개 채널 키를 모두 보유 ·
      값이 URL 형식이거나 허용 코드 2종 중 하나 · 5개 전부 `channel_absent` 인 행 비율 ≤ 10%.

  - id: REQ-4
    statement: >
      조사자는 유효 조사 완료 표본 수 `n = 100 − blocked − unreplaceable` 를 90 이상으로 확보하며,
      표본 교체는 5건 이하이고 각 교체 행에 폐업·중복·구역이탈 증거 스냅샷을 첨부한다.
      *(원칙 2.5 짝 — 전 행을 blocked 처리하면 모든 FORBID를 준수하면서 조사가 0이 되는 경로를 차단)*
    acceptance: >
      `validate_d1b.py --check completeness` exit 0.
      검사: n ≥ 90 · replacement_log.csv 행수 ≤ 5 · 각 교체 행에 reason enum
      (closed|duplicate|out_of_region) + evidence 스냅샷 파일 존재 ·
      대체 업체가 sample.csv 예비표본 순번대로 사용되었는지 순서 검증.

  - id: REQ-5
    statement: >
      조사자는 D1a 고정 시드가 산출한 20건에 대해 서로 다른 두 `cohort` 값으로 독립 판정을 수행하고
      `price_found` 일치율 0.90 이상을 확보하며, 불일치 건의 최종 확정값을 `false` 로 기록한다.
    acceptance: >
      `validate_d1b.py --check double-check` exit 0.
      검사: double_check.csv 대상 20건이 protocol 시드 재산출 목록과 일치 ·
      두 판정 컬럼의 cohort 값이 서로 다르고 각 판정에 별도 스냅샷 취득 시각 존재 ·
      agreement ≥ 0.90 · 불일치 건의 ledger.price_found 가 전부 false.

  - id: REQ-6
    statement: >
      조사자는 주표본 75건 집계를 `interim_summary.json` 으로 확정한 뒤에만 홀드아웃 25건을
      개봉·조사하고, 주표본 커버리지와 홀드아웃 커버리지의 차이(drift)를 축별로 산출한다.
    acceptance: >
      `validate_d1b.py --check holdout-order` exit 0.
      검사: interim_summary.json 존재 · 최종 ledger 의 주표본 75행 재집계값이
      interim_summary 값과 소수점 4자리까지 일치(= 홀드아웃 결과를 보고 주표본을 되돌려 고치지 않음) ·
      holdout.enc 복호화 결과 venue_id 집합 == ledger 의 홀드아웃 행 집합 ·
      drift 값이 report.md 에 축별로 기재.

  - id: REQ-7
    statement: >
      조사자는 `price_found=true` 행의 `price_structure_type` 을 5종 enum
      (total_and_count / total_and_period / per_session_direct / total_only / range_only) 으로
      분류하고 회당 단가 환산 가능 구조(앞 3종) 비율을 축별로 산출한다 (H2 예비 측정).
    acceptance: >
      `validate_d1b.py --check h2-precheck` exit 0.
      검사: 값이 전부 enum 내 · report.md 축별 환산가능비율 표가 ledger 재집계와 소수점 3자리 일치.

  - id: REQ-8
    statement: >
      조사자는 축별 커버리지율·Wilson 95% 구간·G1 verdict(proceed / editor_augment /
      axis_excluded / inconclusive)를 `docs/gates/G1.md` 에 기록한다. verdict 는 protocol.md 의
      임계·inconclusive 조건을 기계 적용한 결과와 일치해야 한다.
    acceptance: >
      `validate_d1b.py --check verdict` exit 0.
      검사: G1.md 의 축별 verdict 가 (ledger 집계 + protocol 임계 + inconclusive 조건 3종)
      재계산 결과와 3축 모두 일치 · G1.md front-matter 에 gate/status/decided_at/source_pr 필드 존재.

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      `git diff --name-only origin/main...HEAD` 결과에 `docs/discovery/D1a/` 경로 파일이
      1건 이상 포함되거나, `docs/discovery/D1a/protocol.lock` 이 origin/main 에 부재한 경우
    must_not: >
      본 PR을 머지
    because: >
      사전등록을 조사 PR 안에서 수정하면 사전등록이 성립하지 않는다. 커밋 시각 비교는
      `GIT_COMMITTER_DATE` 조작과 squash merge 로 붕괴하므로, "base 에 이미 존재하고 이 diff 에는
      없다"만이 유일하게 견디는 증거다. 이 조항이 없으면 커버리지가 37%로 나왔을 때
      정의를 넓히는 커밋을 같은 PR에 얹어 41%로 만드는 것을 아무도 막지 못한다.
    detect: >
      CI job `discovery` — `validate_d1b.py --check prereg-separation` 이
      (a) base 대비 diff 경로 목록에 D1a 포함 (b) origin/main 의 protocol.lock 부재
      (c) protocol.lock 값 ≠ sha256(현재 protocol.md) 중 하나라도 참이면 non-zero exit.
    on_violation: block_merge

  - id: FORBID-2
    when: >
      ledger.csv 의 (venue_id, axis) 집합이 sample.csv primary 집합과 다르고,
      그 차이가 replacement_log.csv 5행 이내 + 증거 스냅샷으로 설명되지 않는 경우
    must_not: >
      해당 ledger 로 커버리지를 집계
    because: >
      가격이 보이는 업체로 갈아끼우거나 축을 재배정하면 커버리지가 10~20%p 부풀려진다.
      특히 축 재배정은 <25%인 축을 다른 축에 숨겨 MVP에서 제외되어야 할 축을 통과시키고,
      medical_wellness 업체가 exercise_body 로 옮겨가면 D4 가드레일 적용 대상에서도 누락된다.
    detect: >
      CI job `discovery` — `validate_d1b.py --check sample-integrity` 가 대칭차집합을
      replacement_log 로 소거한 뒤 잔여 1건이라도 있으면 non-zero exit. 교체 행수 > 5 도 실패.
    on_violation: block_merge

  - id: FORBID-3
    when: >
      `price_found=true` 인 행의 `price_evidence_snippet` 이 해당 스냅샷 추출 텍스트의
      부분문자열이 아닌 경우
    must_not: >
      그 행을 커버리지 분자에 포함
    because: >
      전화로 취득했거나 창작한 가격이 공개 채널 취득으로 위장되면 H1 전체가 재검증 불가능한
      자기신고가 된다. `evidence_channel` enum 과 URL 존재만 검사하면 아무 페이지 URL 을 넣고
      스니펫을 지어내는 것으로 전 검사를 통과할 수 있다 — 형식 검사가 아니라 내용 검사여야 한다.
    detect: >
      CI job `discovery` — `validate_d1b.py --check evidence-integrity` 의 부분문자열 검사.
      이미지/PDF 는 동반 OCR 텍스트 파일 기준. 스냅샷 sha256 이 ledger 기록값과 다르면 실패.
    on_violation: block_merge

  - id: FORBID-4
    when: >
      `n < 90` 이거나 홀드아웃 drift 가 15%p 이상인 축이 존재하는 경우
    must_not: >
      해당 축에 proceed / editor_augment / axis_excluded 확정 verdict 를 부여
    because: >
      blocked 를 "가격 미공개"로 집계하면 커버리지가 하향 편향되고, 분모에서 임의 제외하면
      상향 편향된다. 어느 쪽이든 재량이 개입하면 G1이 조사자 선택의 함수가 된다.
      drift 15%p 이상은 조사 후반으로 갈수록 판정 기준이 이동했다는 신호이며,
      이 상태의 확정 판정은 축 하나를 부당하게 제외하거나 통과시킨다.
    detect: >
      CI job `discovery` — `validate_d1b.py --check verdict` 가 inconclusive 강제 조건
      3종 중 하나라도 성립하는 축의 verdict 가 `inconclusive` 가 아니면 non-zero exit.
    on_violation: block_merge

  - id: FORBID-5
    when: >
      `interim_summary.json` 이 부재하거나, 최종 ledger 의 주표본 75행 재집계값이
      interim_summary.json 의 값과 다른 경우
    must_not: >
      홀드아웃 25건의 조사 결과를 ledger 에 반영
    because: >
      홀드아웃을 주표본과 동시에 조사하거나 홀드아웃 결과를 본 뒤 주표본 판정을 되돌려 고치면,
      조사 기준 drift 검출 장치가 통째로 사라진다. 그러면 "정의는 지켰지만 뒤로 갈수록
      느슨해진 조사"를 잡아낼 수단이 하나도 남지 않는다.
    detect: >
      CI job `discovery` — `validate_d1b.py --check holdout-order` 의 재집계 동등성 검사 +
      holdout.enc 복호화 집합 대조.
    on_violation: block_merge

  - id: FORBID-6
    when: >
      조사 대상 페이지가 로그인·회원가입을 요구하거나 캡차 / HTTP 403 / 429 를 반환한 경우
    must_not: >
      계정 생성·캡차 우회·프록시 로테이션으로 접근해 그 결과를 증거로 기록
    because: >
      D3(G3) 실사 결론 이전에 ToS 위반 접근 이력이 생기면 실사 자체가 오염되고,
      해당 소스에서 IP·계정이 차단되면 C2·C3 어댑터가 사용할 최대 데이터 공급원을 잃는다.
    detect: >
      CI job `discovery` — `validate_d1b.py --check access-method` 가
      access_method enum(anonymous_public|blocked) 위반, 또는 blocked 행에 응답 상태코드
      스냅샷이 없거나 price_found=true 인 경우 non-zero exit.
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - protocol.md · sample.csv · ledger_schema.json 수정 (D1a 소유. 수정이 필요하면 D1a 재실행)
  - 표본 밖 업체 대량 수집 (C1~C3)
  - 가격 문자열 → 회당 단가 파서 구현 (C4)
  - DB 스키마·마이그레이션 (F2) · 니즈 태그 온톨로지 (F4)
  - 강남3구 외 지역
  - 업체와의 접촉·제휴·데이터 제공 협의
  - 소스별 robots/ToS 판정 (D3) · 의료광고 표기 규칙 (D4)

rollback: >
  1) `git revert -m 1 <merge_sha>` 로 docs/discovery/D1b/**, docs/gates/G1.md,
     scripts/discovery/validate_d1b.py 를 제거한다.
  2) `docs/gates/G1.md` 가 사라지면 G1은 미판정 상태가 되고, 이를 선행 조건으로 삼는
     C1·C4·F4 는 게이트 선행 검사에서 자동 차단된다 (별도 시스템 불필요).
  3) D1a 산출물은 본 PR diff 에 없으므로 롤백 대상이 아니다 — 프로토콜은 유지한 채
     데이터만 재수집할 수 있다. 이것이 분할의 실질적 이득이다.
  4) 외부 발신·데이터 삭제가 없어 부수 효과 없음.

done_when:
  - ledger.csv 100행이 D1a 스키마로 검증 통과
  - price_found=true 행 100%에 스냅샷 + 부분문자열 검증 통과
  - price_found=false 행 100%에 5채널 absence_check 기록
  - n ≥ 90, 교체 ≤ 5, blocked ≤ 5
  - double_check.csv 20건 일치율 ≥ 0.90, 불일치 건 false 확정
  - interim_summary.json 이 홀드아웃 개봉 전 집계로 존재하고 최종 재집계와 일치
  - docs/gates/G1.md 에 축별 verdict 기록
  - `python scripts/discovery/validate_d1b.py --all` exit 0
  - **메타테스트**: `scripts/discovery/fixtures/d1b/` 위반 픽스처 6종이 각각 non-zero exit
    (① D1a 파일이 diff 에 포함 ② sample 밖 venue 추가 ③ snippet 이 스냅샷에 없음
     ④ n=85 인데 verdict=proceed ⑤ interim_summary 없이 홀드아웃 기록 ⑥ blocked 행에 price_found=true)
  - F1의 CI job `discovery` 에서 본 PR의 검증기가 실행된 로그가 존재한다
```
