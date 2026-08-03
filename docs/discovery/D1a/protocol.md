# D1a — 조사 프로토콜 (사전등록본)

> 계약 정본: [`docs/tasks/D1a.md`](../../tasks/D1a.md)
> 검증: `python scripts/discovery/validate_d1a.py --all`
> **이 문서는 D1b(현장 조사)가 시작되기 전에 별도 PR 로 main 에 고정된다.**
> 조사 결과를 본 뒤 이 문서를 고치면 사전등록이 성립하지 않는다 — D1b FORBID-1 이 그것을 차단한다.

이 문서가 정하는 것은 **판정 규칙**이고, 정하지 않는 것은 **판정 결과**다.
임계·상한·요건은 계약 §K-1~K-6 이 소유하며 본 문서는 그것을 전재할 뿐이다.
전재값이 계약과 한 글자라도 다르면 `validate_d1a.py` 가 red 를 낸다.

---

## 1. 조사 대상

| 항목 | 값 |
|---|---|
| 지역 | 강남구 · 서초구 · 송파구 |
| 축 | `exercise_body` · `relax_recovery` · `medical_wellness` |
| 모집단 | `population.csv` 2,937건 (구축 절차는 `frame_build.md`) |
| 확정 표본 | `sample.csv` `status=primary` 100건 |
| 예비 표본 | `sample.csv` `status=reserve` 20건 |
| 홀드아웃 | 확정 표본 중 25건. `holdout.enc` 로 봉인 |

## 2. 허용 증거 채널

`allowed_channels` = `website` · `naver_place` · `kakao_map` · `instagram_public` · `official_blog`
(계약 §K-1 의 5종 전부. K-1 밖으로 확대하는 것은 불가능하다.)

각 채널의 정의는 계약 §K-1 표를 따른다. 계약 §K-2 가 증거로 **인정 금지**한 취득 경로는
본 프로토콜에서도 증거가 아니며, 그 경로로 얻은 값은 `price_found` 판정에 입력되지 않는다.
K-2 목록은 계약 문서에만 둔다 — 본 문서 전문에 그 취득 경로 명칭이 등장하면
`--check definition` 이 red 가 된다. 금지 경로를 여기 옮겨 적는 순간 조사자가 그것을
"프로토콜에 언급된 채널"로 읽을 여지가 생기기 때문이다.

## 3. `price_found = true` 성립 요건 (계약 §K-3 전재. 완화 불가)

| id | 요건 |
|---|---|
| `posted_on_allowed_channel_now` | 허용 채널 중 하나에 **현재 게시**되어 있을 것. 열람 시점 스냅샷 파일로 증명한다 |
| `amount_and_service_on_same_page` | **금액 숫자**와 **대상 서비스명**이 **동일 페이지**에 함께 게시되어 있을 것 |
| `inquiry_only_is_false` | "가격 문의" · "상담 후 안내" · "회원 문의" 만 있는 경우는 `false` |

3요건은 **전부** 충족해야 한다. 하나라도 미충족이면 `price_found = false` 다.

## 4. 판정 트리

조사자는 표본 1건마다 아래 분기를 **위에서 아래로** 적용하고, 처음 일치한 분기의 판정을 기록한다.
기록 항목은 분기 id 와 근거 스냅샷이다.

| 순서 | 분기 id | 조건 | 판정 |
|---|---|---|---|
| 1 | `B1_channel_not_allowed` | 취득 채널이 `allowed_channels` 밖이다 | `false` |
| 2 | `B2_not_currently_posted` | 열람 시점에 해당 게시가 존재하지 않는다 (페이지 소멸 · 접근 차단 · 비공개 전환) | `false` |
| 3 | `B5_inquiry_only` | 금액 자리에 안내 요청 표기("가격 문의" · "상담 후 안내" · "회원 문의")만 있다 | `false` |
| 4 | `B3_no_amount_on_page` | 페이지에 금액 숫자가 없다 | `false` |
| 5 | `B6_ended_event_only` | 게시된 금액이 종료된 기간 한정 행사 금액뿐이다 | `false` |
| 6 | `B4_amount_without_service_name` | 금액은 있으나 대상 서비스명이 같은 페이지에 없다 | `false` |
| 7 | `B7_amount_and_service_same_page` | 금액과 대상 서비스명이 동일 페이지에 함께 게시되어 있다 | **`true`** |

`B5` 를 `B3` 보다 **먼저** 적용한다. "금액이 없다"로 뭉뚱그리면 K-3 3항이 별도 요건으로 존재할
이유가 사라지고, 조사 원장에서 "안내 요청만 있는 업체"와 "아무 정보도 없는 업체"가 구분되지 않는다.
그 둘은 D1b 이후 에디터 보강 대상 판단이 완전히 다르다. 검증기는 문서의 순서와 구현의 순서가
같은지도 검사한다.

7개 분기 id 는 `scripts/discovery/validate_d1a.py` 의 `DECISION_BRANCHES` 와 **1:1 대응**해야 하며,
검증기가 그 대응을 검사한다. 문서와 구현이 갈라지면 red 다.

### 4.1 트리가 좁아지는 것을 막는 장치

정의를 극단적으로 좁게 잡으면 커버리지는 0 에 수렴하고, 그 상태에서도 모든 금지사항은 지켜진다.
그래서 `definition_examples/` 에 **실제 관측 스냅샷 20건**(양성 10 / 음성 10)을 두고,
트리를 적용한 결과가 기대 라벨과 20/20 일치해야만 사전등록이 성립하도록 했다.
양성 10건은 표기 형태(`display_form`)가 서로 다른 5종 이상을 포함한다 — 요금표를 이미지로만
올린 업체를 정의가 배제하면 그 자리에서 red 가 난다.

### 4.2 `display_form` enum

`web_body_text` · `web_html_table` · `web_image_ocr` · `pdf_document` ·
`place_menu_list` · `post_caption`

## 5. 표집

| 항목 | 값 |
|---|---|
| 고정 시드 | `glowmate-d1a-sample-2026-08-03` |
| 층 | (축 × 구) 9칸 |
| 추출 순서 | 층 안에서 `sha256(seed \| venue_id)` 오름차순 |
| 축 정원 | `exercise_body` 34 · `relax_recovery` 33 · `medical_wellness` 33 |
| 구 배분 | 축 정원을 강남구 → 서초구 → 송파구 순으로 나눈다 (34 → 12/11/11, 33 → 11/11/11) |
| 칸 하한 | 9칸 각각 ≥ 8 |
| 예비 표본 | 20건. 9칸에 2건씩 배분하고 남는 2건을 (`exercise_body`,강남구) → (`exercise_body`,서초구) 순으로 |
| 파일 순서 | `sample.csv` 는 `venue_id` 오름차순 **정본 순서**다 |

`sample.csv` 의 행 순서를 `venue_id` 오름차순으로 못박은 이유는 홀드아웃 때문이다.
행 순서가 추출 순서나 배정 결과에 의존하면 파일을 보는 것만으로 홀드아웃 위치를 좁힐 수 있다.
`venue_id` 는 인허가 식별자의 해시이므로 배정과 독립이고, 따라서 행 순서에서 아무것도 새지 않는다.

축 배정은 `frame_build.md` §4 축 결정표를 적용한 결과이며 **D1b 에서 변경할 수 없다.**
검증기는 표본 행의 `name`·`axis`·`gu` 가 `population.csv` 와 동일한지 대조한다.

## 6. 홀드아웃

| 항목 | 값 |
|---|---|
| 규모 | 25건 (확정 표본 100건 중) |
| 층화 | 축별 `exercise_body` 9 · `relax_recovery` 8 · `medical_wellness` 8 |
| 선정 난수 | `secrets.SystemRandom` — **시드 없음**. 리포지토리 안의 어떤 값으로도 재산출되지 않는다 |
| 봉인 | `holdout.enc` (PBKDF2-HMAC-SHA256 600,000회 → HMAC-SHA256 CTR + encrypt-then-MAC) |
| 키 보관 | 팀 리드. 리포지토리에 두지 않는다 |
| 매니페스트 | `holdout_manifest.json` — 축별 배분 · 봉인 sha256 · 평문 sha256 · 키 지문 · 최대 연속 배치 |
| 개봉 시점 | D1b 가 주표본 75건 집계를 `interim_summary.json` 으로 확정한 **뒤** |

홀드아웃 선정에 시드를 쓰지 않은 것은 의도적이다. 시드를 문서에 적으면 홀드아웃이 즉시
재산출 가능해지고, 적지 않으면 재현 불가능한 선택이 된다. 그래서 난수는 시드 없이 뽑고,
결과를 봉인한 뒤 **평문 sha256 을 매니페스트에 공개**했다. 키 보유자는 복호화 결과가 봉인 시점의
그것과 같음을 대조할 수 있고, 키가 없는 CI 는 매니페스트만으로 구조 검사를 수행한다.

### 6.1 키 없는 CI 가 검사하는 것 / 검사하지 못하는 것

| CI(키 없음)가 검사한다 | 키 보유자만 검사할 수 있다 |
|---|---|
| 봉인 파일 포맷 · 매니페스트 필수 필드 | 복호화 집합 25건이 확정 표본의 부분집합인지 |
| 축별 배분 기재값 9/8/8 | 축별 배분 **실측값** |
| 최대 연속 배치 기재값 < 5 | 최대 연속 배치 **실측값**과 기재값의 일치 |
| 키가 리포 안에 있는지 (추적 파일 전문을 후보 키로 전수 대조) | |
| 표본 `venue_id` 가 허용 위치 밖에 평문으로 있는지 | |
| `sample.csv` 컬럼 집합 · 행 순서 정본성 | |

오른쪽 열은 **D1b REQ-6 에서 반드시 재검증된다** — 그 단계에서 키로 복호화하기 때문이다.
따라서 매니페스트 기재값을 속이면 D1b 에서 잡히며, 그 사이 구간의 위험은
왼쪽 열의 구조 검사(행 순서 정본성 + 표식 컬럼 금지)로 좁혀 둔다.
검증기는 매 실행마다 런 길이 계산기 · 키 지문 함수 · 봉인 인증을 합성 입력으로 자기검사한다 —
탐지 대상이 0건이어도 탐지기가 죽어 있으면 그 자리에서 red 다.

### 6.2 봉인 포맷

```
base64( "GMHO1\n" || salt(16) || nonce(16) || iterations(4, big-endian) || ciphertext || tag(32) )
  dk        = PBKDF2-HMAC-SHA256(passphrase, salt, iterations, dklen=64)
  enc_key   = dk[0:32],  mac_key = dk[32:64]
  keystream = HMAC-SHA256(enc_key, nonce || counter_be32) 를 이어붙인 것
  tag       = HMAC-SHA256(mac_key, header || ciphertext)
```

복호화는 `scripts/discovery/validate_d1a.py` 의 `unseal()` 로 수행한다.
D1b 는 이 함수를 그대로 호출해 홀드아웃 집합을 얻는다.

## 7. 집계 규칙

| 항목 | 값 |
|---|---|
| 유효 조사 완료 | `n = 100 - blocked - unreplaceable` |
| `blocked` 상한 | 5 |
| 표본 교체 상한 | 5 |
| 교체 절차 | 같은 (축,구) 층의 예비 표본을 `reserve_rank` 오름차순으로 사용한다 |
| 이중판정 | 20건. 시드 `glowmate-d1a-doublecheck-2026-08-03` 로 확정 표본에서 산출 |
| 이중판정 산출식 | `sha256(seed \| venue_id)` 오름차순 상위 20건 |
| 불일치 시 확정값 | `false` (보수적) |
| 신뢰구간 | Wilson 95% |

Wilson 95% 구간:

```
(p̂ + z²/(2n) ± z·√( p̂(1-p̂)/n + z²/(4n²) )) / (1 + z²/n),   z = 1.96
```

분자·분모를 다시 못박는다. **분모는 `n` 이고 `n` 은 위 정의 하나뿐이다.**
`blocked` 를 분자에서 빼고 분모에 남기거나, 조사 실패 건을 분모에서 빼는 것은 둘 다 금지다.
`blocked` 는 분모에서 제외되며(위 `n` 정의), 그 대가로 `blocked` 는 5건 상한을 갖는다.

### 7.1 이중판정 20건

`double_check_venue_ids` 는 §11 기계 판독 블록에 있다. 검증기가 시드로 재산출한 목록과
대조하므로 손으로 고칠 수 없다. 이 목록은 홀드아웃과 무관하며 (시드로 누구나 재산출 가능),
홀드아웃 25건에 대해 아무 정보도 주지 않는다.

## 8. 판정 임계 (계약 §K-4 = PRD §4 G1 전재)

| 항목 | 값 |
|---|---|
| `proceed_threshold` | **0.40** |
| `exclude_threshold` | **0.25** |
| 그 사이 | `editor_augment` |

축별 커버리지 `p̂ = (price_found=true 건수) / n` 을 위 임계에 적용한다.

| 조건 | verdict |
|---|---|
| `p̂ ≥ 0.40` | `proceed` |
| `0.25 ≤ p̂ < 0.40` | `editor_augment` |
| `p̂ < 0.25` | `axis_excluded` |

## 9. `inconclusive` 강제 조건

아래 3종 중 **하나라도** 성립하면 그 축의 verdict 는 §8 과 무관하게 `inconclusive` 다.

| id | 조건 | 임계 |
|---|---|---|
| `n_below_90` | 유효 조사 완료 표본 `n` 이 90 미만 | 90 |
| `replacement_above_5` | 표본 교체가 5건 초과 | 5 |
| `holdout_drift_ge_15pp` | 주표본 커버리지와 홀드아웃 커버리지의 차이가 15%p 이상 | 15.0 |

## 10. 원장 스키마

D1b 가 채울 원장의 컬럼·타입·enum 은 `ledger_schema.json` (JSON Schema draft 2020-12) 이 정본이다.
적합성 표본은 `ledger_schema_samples.json` 에 있고, 검증기는 적합 표본이 통과하고 **위반 표본이
거부되는지**를 함께 확인한다 — 아무것도 막지 않는 스키마를 통과로 처리하지 않기 위해서다.

## 11. 기계 판독 블록

<!-- BEGIN protocol.json -->
```json
{
  "protocol_version": "1.0.0",
  "prereg_date": "2026-08-03",
  "region": ["강남구", "서초구", "송파구"],
  "axes": ["exercise_body", "relax_recovery", "medical_wellness"],
  "allowed_channels": [
    "website",
    "naver_place",
    "kakao_map",
    "instagram_public",
    "official_blog"
  ],
  "required_conditions": [
    {
      "id": "posted_on_allowed_channel_now",
      "text": "허용 채널 중 하나에 현재 게시되어 있을 것. 열람 시점 스냅샷 파일로 증명한다"
    },
    {
      "id": "amount_and_service_on_same_page",
      "text": "금액 숫자와 대상 서비스명이 동일 페이지에 함께 게시되어 있을 것"
    },
    {
      "id": "inquiry_only_is_false",
      "text": "가격 문의 · 상담 후 안내 · 회원 문의 표기만 있는 경우 판정은 false 다"
    }
  ],
  "decision_tree": [
    {"order": 1, "id": "B1_channel_not_allowed", "verdict": false},
    {"order": 2, "id": "B2_not_currently_posted", "verdict": false},
    {"order": 3, "id": "B5_inquiry_only", "verdict": false},
    {"order": 4, "id": "B3_no_amount_on_page", "verdict": false},
    {"order": 5, "id": "B6_ended_event_only", "verdict": false},
    {"order": 6, "id": "B4_amount_without_service_name", "verdict": false},
    {"order": 7, "id": "B7_amount_and_service_same_page", "verdict": true}
  ],
  "display_forms": [
    "web_body_text",
    "web_html_table",
    "web_image_ocr",
    "pdf_document",
    "place_menu_list",
    "post_caption"
  ],
  "sampling": {
    "seed": "glowmate-d1a-sample-2026-08-03",
    "primary_n": 100,
    "reserve_n": 20,
    "min_cell": 8,
    "axis_allocation": {
      "exercise_body": 34,
      "relax_recovery": 33,
      "medical_wellness": 33
    },
    "gu_order": ["강남구", "서초구", "송파구"],
    "order_key": "sha256(seed|venue_id)",
    "file_order": "venue_id ascending"
  },
  "holdout": {
    "n": 25,
    "axis_allocation": {
      "exercise_body": 9,
      "relax_recovery": 8,
      "medical_wellness": 8
    },
    "selection": "secrets.SystemRandom — 시드 없음. 리포 안의 값으로 재산출 불가",
    "sealed_file": "holdout.enc",
    "manifest_file": "holdout_manifest.json",
    "open_after": "interim_summary.json 확정 후"
  },
  "aggregation": {
    "n_definition": "100 - blocked - unreplaceable",
    "blocked_cap": 5,
    "replacement_cap": 5,
    "replacement_order": "같은 (축,구) 층의 reserve_rank 오름차순",
    "double_check_n": 20,
    "double_check_seed": "glowmate-d1a-doublecheck-2026-08-03",
    "double_check_rule": "sha256(seed|venue_id) 오름차순 상위 20건",
    "disagreement_resolution": "false",
    "wilson_z": 1.96,
    "wilson_formula": "(p̂ + z²/(2n) ± z·sqrt(p̂(1-p̂)/n + z²/(4n²))) / (1 + z²/n)",
    "double_check_venue_ids": [
      "V03C94D0035A2", "V0614C40E1508", "V17C6973E8DB4", "V3BC39D34FB83",
      "V3EF988C05869", "V3F68F53E198E", "V40BF2770DD06", "V44D4AE567231",
      "V4555A5BA7A66", "V5FB7D9731819", "V5FE572283C75", "V6466C47D9E3D",
      "V7C4DF1DAD651", "V9F9545399E18", "VADCD319C1008", "VB822EDCF8746",
      "VC9363C647800", "VCCB60EF2A22F", "VF9A355558A7C", "VFED02AAB0A4F"
    ]
  },
  "thresholds": {
    "proceed_threshold": 0.4,
    "exclude_threshold": 0.25,
    "between_verdict": "editor_augment"
  },
  "inconclusive_conditions": [
    {"id": "n_below_90", "threshold": 90, "comparator": "<"},
    {"id": "replacement_above_5", "threshold": 5, "comparator": ">"},
    {"id": "holdout_drift_ge_15pp", "threshold": 15.0, "comparator": ">=", "unit": "%p"}
  ]
}
```
<!-- END protocol.json -->
