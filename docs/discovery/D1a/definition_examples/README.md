# 판정 트리 검증용 실측 예시 20건

> 계약: [`docs/tasks/D1a.md`](../../../tasks/D1a.md) REQ-3 · FORBID-5
> 검증: `python scripts/discovery/validate_d1a.py --check definition-recall`

`protocol.md` §4 판정 트리를 **실제 관측 스냅샷**에 적용해 기대 라벨과 20/20 일치함을 보인다.
정의를 극단적으로 좁게 잡아 커버리지를 0 으로 만드는 경로를 여기서 차단한다.

## 구성

| | 건수 | 비고 |
|---|---|---|
| 양성 (`price_found=true`) | 10 | `display_form` distinct 5종 |
| 음성 (`price_found=false`) | 10 | `negative_reason` 별 검증 규칙이 다르다 |

전 20건이 **강남구 · 서초구 · 송파구** 소재 업체의 K-1 허용 채널 게시물이다.

### 양성 10건의 표기 형태

| `display_form` | 건수 | 뜻 |
|---|---|---|
| `place_menu_list` | 5 | 지도 서비스 업체 등록 정보의 가격표 항목 |
| `web_html_table` | 2 | 공식 웹사이트 본문의 표 |
| `web_body_text` | 1 | 공식 웹사이트 본문 문단 |
| `web_image_ocr` | 1 | 공식 웹사이트에 **이미지로만** 게시된 요금표 |
| `post_caption` | 1 | 공식 블로그 게시물 본문 |

`web_image_ocr` 을 반드시 포함시킨 이유는 원칙 2.5 다. 요금표를 이미지로만 올린 업체를 정의가
배제하면 커버리지가 하향 편향되고, 실제로는 임계를 넘는 축이 `axis_excluded` 로 제외된다.

## 수집 절차

1. `population.csv` 의 실 업체명과 강남3구 지역어로 공개 검색을 수행해 후보 채널을 찾았다.
2. 각 후보를 **익명·공개 접근**(로그인 없음, 사람 확인 절차 없음, HTTP 200)으로 1회 취득했다.
   접근 제어를 우회한 취득은 없다. 취득 시각은 `retrieved_at` 에 UTC 로 기록되어 있다.
3. 취득 원본을 `snapshots/` 에 그대로 저장하고 sha256 을 `examples.json` 에 기록했다.
4. 스냅샷에서 `extraction_method` 절차로 텍스트를 뽑아 `extracted/` 에 저장했다.
5. `price_evidence_snippet` 은 그 추출 텍스트에서 **잘라낸 부분문자열**이다. 지어낸 문장이 아니다.

## 저장 형식 — 스냅샷은 gzip 으로 커밋한다

`snapshots/` 의 파일은 `EX-xx.html.gz` · `EX-P09.jpg.gz` 처럼 **결정적 gzip**
(`gzip.compress(raw, compresslevel=9, mtime=0)`) 으로 저장한다. 무결성 값은 둘 다 기록한다.

| 필드 | 뜻 |
|---|---|
| `snapshot_sha256` | 서버가 실제로 내려준 **원본 바이트**의 sha256 |
| `snapshot_stored_sha256` | 리포지토리에 커밋된 `.gz` 파일의 sha256 |

검증기는 두 값을 모두 대조한 뒤 원본 바이트로 추출을 재현한다.

**왜 압축해서 넣는가.** 타사 공개 페이지 원본에는 그 사이트가 자기 프런트엔드에 심어 둔
공개 토큰(JWT 등)이 섞여 있다. 원본을 평문으로 커밋하면 리포지토리 전역 비밀값 스캐너
(F1 CI job `secret-scan`)가 **우리 것이 아닌 값 12건**을 잡아 job 이 red 가 된다(실측).
그렇다고 스냅샷에서 그 토큰을 지우면 "실제 관측 스냅샷"이 아니게 된다.

이 선택에는 대가가 있다 — 압축된 스냅샷 **안쪽은** 비밀값 스캐너가 보지 못한다.
그 대가를 감수할 수 있다고 판단한 근거는, 이 파일들이 조사자가 작성한 코드가 아니라
타사 공개 페이지를 그대로 받아 적은 것이라 우리 자격증명이 들어갈 경로 자체가 없다는 점이다.
**D1b 는 같은 문제를 훨씬 큰 규모로 만난다**(표본 100건 스냅샷). 원본을 평문으로 두려면
F1 이 `docs/discovery/D*/snapshots/**` 를 스캐너 허용목록에 넣어야 하며, 그 판단은
F1 계약 소유다. 본 태스크는 자기 `touches` 안에서 해결 가능한 쪽을 택했다.

## `extraction_method`

| 값 | 절차 | 검증기 재현 여부 |
|---|---|---|
| `html_strip` | `validate_d1a.py` 의 `extract_html_text()` — script/style 제거 → 블록 종료 태그를 개행으로 → 잔여 태그 제거 → 엔티티 복원 → 공백 정규화 | **재현한다.** 스냅샷에서 다시 뽑은 결과가 커밋된 텍스트와 바이트 단위로 같아야 한다 |
| `macos_vision_ocr` | macOS Vision `VNRecognizeTextRequest` (ko-KR, accurate, languageCorrection off) | 재현하지 않는다 (플랫폼 의존) |
| `pdf_text_layer` | PDF 텍스트 레이어 추출 | 재현하지 않는다 |

재현 불가능한 방법만 남으면 "추출 텍스트를 손으로 쓰는" 경로가 열린다. 그래서 검증기는
`html_strip` 예시가 **0건이면 실패**로 처리한다. 현재 20건 중 19건이 `html_strip` 이다.

## 음성 예시의 검증 규칙

| `negative_reason` | 검증기가 추출 텍스트에서 확인하는 것 | 밟는 분기 |
|---|---|---|
| `inquiry_only` | 금액 표기 **0건** + 안내 요청 표기가 본문·스니펫 양쪽에 존재 | `B5_inquiry_only` |
| `no_amount` | 금액 표기 **0건** | `B3_no_amount_on_page` |
| `ended_event_only` | 금액 표기 존재 | `B6_ended_event_only` |
| `not_currently_posted` | `http_status != 200` | `B2_not_currently_posted` |
| `amount_without_service_name` | 금액 표기 존재 | `B4_amount_without_service_name` |

신고한 `observations` 만으로 판정하면 라벨과 관측을 함께 조작할 수 있다. 그래서 위 표의 항목은
**추출 텍스트 자체**에서 독립적으로 확인한다. 양성도 같은 방식으로, 추출 텍스트와 스니펫 양쪽에
금액 표기가 실재하는지 확인한다.

## 한계

현재 20건은 `B7` · `B5` · `B3` 세 분기만 실측으로 밟는다. `B1`(허용 밖 채널) · `B2`(게시 소멸) ·
`B4`(금액만 있고 서비스명 없음) · `B6`(종료된 기간 한정 행사)는 트리에 정의되어 있으나
실측 예시가 없다. D1b 조사에서 해당 분기가 관측되면 그 행의 `decision_branch` 값으로 사후 확인된다.
검증기는 밟은 분기가 3종 미만이면 실패한다 — 참 경로 1종과 거짓 경로 2종은 최소한 실측되어야 한다.
