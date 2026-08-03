# D3 — 소스 판정 룰 (verdict rule)

> 계약: [D3-SOURCE-DUE-DILIGENCE](../../tasks/D3.md) · K-1 준수
> 조사 기간: 2026-08-03 (UTC) · 조사자: research-discovery
> 이 문서는 **내부 조사 문서이며 법률 자문이 아니다** (계약 `out_of_scope`).

---

## 1. verdict 4-enum (K-1 고정. 조사자가 값을 추가·변경할 수 없다)

| verdict | 성립 조건 | 어댑터 대상 |
|---|---|---|
| `allowed` | robots 미차단 + ToS 원문 스냅샷·조항 번호 확보 + 별도 조건 부과 없음 | ✅ |
| `conditional` | robots 미차단 + ToS 원문 스냅샷·조항 번호 확보 + 준수 파라미터 부과 시 허용 | ✅ |
| `pending` | ToS 원문 미확보 또는 조항 특정 실패 | ❌ |
| `forbidden` | robots Disallow · ToS 명시 금지 · `max_requests_per_min` 하한(6) 미달 | ❌ |

`conditional` 은 "추가 확인이 필요한 상태"가 **아니다.** ToS 확보를 마친 소스에만 부여한다.

---

## 2. rule_id 정의 집합

`verdicts.csv` 의 `rule_id` 는 아래 집합 안에서만 쓸 수 있다.
(`scripts/discovery/validate_d3.py --check verdicts` 가 이 표를 파싱해 대조한다.)

| rule_id | 적용 조건 | 산출 verdict |
|---|---|---|
| `R-ROBOTS-DISALLOW` | 수집 대상 경로가 해당 User-agent 그룹 기준 robots `Disallow` 에 매칭 | `forbidden` |
| `R-ROBOTS-UNKNOWN` | robots.txt 를 HTTP 200 으로 취득하지 못해(429·5xx·연결 실패) 판정 불가 | `forbidden` |
| `R-TOS-PROHIBIT` | ToS 원문에 자동수집·스크래핑·대량 다운로드·경쟁 DB 구축을 금지하는 조항이 존재 | `forbidden` |
| `R-RPS-FLOOR` | 429 회피에 필요한 요청률이 K-2 하한(6 rpm) 미만 | `forbidden` |
| `R-PENDING-NO-TOS` | robots 는 미차단이나 ToS 원문을 확보하지 못했거나 조항을 특정하지 못함 | `pending` |
| `R-COND-ATTRIB` | robots 미차단 + ToS 확보 + **출처표시·재공개 범위 제한** 조건 부과 시 허용 | `conditional` |
| `R-COND-RATE` | robots 미차단 + ToS 확보 + **요청률·동시성 상한** 조건 부과 시 허용 | `conditional` |
| `R-ALLOWED-OPEN` | robots 미차단 + ToS 확보 + 별도 조건 없음 | `allowed` |

> 한 소스에 복수 근거가 성립하면 **더 강한 제한**을 적용한다:
> `forbidden` > `pending` > `conditional` > `allowed`.
> `verdicts.csv` 의 `rule_id` 에는 최종 verdict 를 산출한 규칙 하나를 적고,
> 보조 근거는 `sources/<source>.md` 의 `risk_note` 에 남긴다.

---

## 3. 판정 절차 (재현 가능한 순서)

1. **robots 취득** — `https://<host>/robots.txt` 를 조사용 User-agent 로 GET.
   원문을 `snapshots/robots/` 에 byte-exact 로 저장하고
   `snapshots/robots/index.csv` 에 (source, host, url, fetched_at_utc, http_status, sha256, path) 기록.
   HTTP 200 이 아니면 그 호스트는 **확인 불가**이며 `R-ROBOTS-UNKNOWN` 을 적용한다.
   *(RFC 9309 는 4xx 를 "제한 없음"으로 볼 여지를 두지만, 429 는 사업자가 자동 접근을 억제하고
   있다는 신호이므로 본 실사는 확인 불가 = 금지로 처리한다. 추정을 허용으로 바꾸지 않는다.)*
2. **robots 대조** — 수집하려는 경로를 해당 User-agent 그룹 기준으로 판정.
   `Disallow` 매칭 시 즉시 `forbidden` (`R-ROBOTS-DISALLOW`). 이후 절차를 진행하지 않는다.
3. **ToS 취득** — 이용약관/Terms 원문을 `snapshots/tos/` 에 byte-exact 로 저장하고
   `snapshots/tos/index.csv` 에 기록. 원문을 얻지 못하면 `pending` (`R-PENDING-NO-TOS`).
4. **ToS 조항 특정** — 자동수집·스크래핑 관련 조항 번호를 `tos_clause` 에 적는다.
   금지 조항이 있으면 `forbidden` (`R-TOS-PROHIBIT`).
5. **요청률 실측** — `crawl_policy.yaml` 의 요청률로 20회 접근(HAR 물증).
   429 회피에 6 rpm 미만이 필요하면 `forbidden` (`R-RPS-FLOOR`).
   **429 를 피하려고 요청률을 1~5 로 낮추는 것은 허용되지 않는다** (K-2).
6. **조건 부과** — 남은 소스에 출처표시·재공개 범위·요청률 조건을 부과해 `conditional`,
   조건이 필요 없으면 `allowed`.

---

## 4. `official_website` 처럼 **도메인 집합**인 소스의 취급

`official_website` 는 단일 호스트가 아니라 업체 도메인의 집합이다. 따라서:

- robots·ToS 판정은 **도메인 단위**로 수행하고, 그 결과를 `sources/official_website.md` 의
  도메인 매트릭스에 남긴다.
- 소스 단위 verdict 는 "**매트릭스를 통과한 도메인만 수집한다**"는 조건이 붙은 `conditional`
  (`R-COND-ATTRIB`) 이다. `verdicts.csv` 의 `tos_ref` 는 allowlist 도메인 중 실제로 확보한
  ToS 스냅샷 파일 하나를 가리키며, 나머지 도메인의 ToS 상태는 매트릭스와
  `snapshots/tos/index.csv` 로 추적한다.
- `crawl_policy.yaml` 의 `allowed_path_globs` 는 **실사에서 실제로 요청해 본 경로만** 포함한다.
  검증하지 않은 경로를 C1 allowlist 로 전사하지 않기 위한 규칙이며,
  `--check glob-probe-consistency` 가 양방향(미매칭 URL / 미실증 글롭)으로 강제한다.

---

## 5. 판정에 쓰지 않는 것 (명시)

- "기술적으로 접근이 가능하다"는 **허용 근거가 아니다.** robots 가 열려 있어도
  ToS 가 금지하면 `forbidden` 이다 (`google_maps` 가 이 경우다).
- 검색엔진 봇(Googlebot·Yeti)에만 열린 robots 는 우리에게 열린 것이 아니다.
  `User-agent: *` 그룹이 판정 기준이다 (`official_website` 의 `manicure2004.com` 이 이 경우다).
- 조회하지 못한 문서는 "없는 것"이 아니라 **확인 불가**다. 확인 불가는 통과가 아니다.
