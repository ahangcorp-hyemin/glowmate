# services/crawler/core — C1-CRAWLER-CORE

크롤러 코어. **스케줄 · 큐 · 재시도 · 원문 보관**과 어댑터 공용 계약을 소유한다.
계약 정본은 [`docs/tasks/C1.md`](../../../docs/tasks/C1.md) 이고, 이 문서는 그 계약이
`done_when` 으로 요구하는 **공개 import 경로 고정 기재**와 **마커 추가 절차**를 담는다.

```
services/crawler/
├── core/                      ← 소스 루트 (이 디렉터리)
│   └── crawler/               ← 임포트 패키지 `crawler`
│       ├── contracts/         ← 어댑터 공용 계약 (프로토콜 · 스키마 2종)
│       ├── blocking/          ← 차단 마커 사전 + 판정기
│       ├── net/               ← 트랜스포트 · robots · 레이트 리미터 · 사전 판정 게이트
│       ├── storage/           ← blob 스토어 · source_record 기록기
│       └── ci/                ← CI 가드 잡 구현체
├── config/                    ← allowlist · 스모크 시드 (전사물)
├── adapters/<source_id>/      ← 어댑터 (C2·C3 및 파생 태스크 소유. 규약 디렉터리)
└── tests/core/                ← 코어 테스트
```

`core/` 가 소스 루트이고 그 안의 `crawler/` 가 패키지인 이유: REQ-8 의 acceptance 가
`python -m crawler.smoke` 를 요구해 임포트 이름이 `crawler` 여야 하는데, hatchling 은
editable 설치에서 접두사를 **치환**하는 `sources` 재작성을 지원하지 않는다
("Dev mode installations are unsupported when any path rewrite in the `sources` option
changes a prefix rather than removes it"). 접두사 **제거**만 가능하므로
`core/crawler` → `crawler` 가 유일하게 성립하는 배치다.
계약 본문의 `core/contracts/...` · `core/blocking/markers.yaml` 은 이 트리의
`core/crawler/contracts/...` · `core/crawler/blocking/markers.yaml` 에 해당한다.

---

## 1. 공개 import 경로 (고정 — 개명하지 않는다)

C2·C3 및 파생 어댑터 태스크는 아래 경로만 import 한다. 이 경로가 바뀌면 어댑터 태스크가
전부 깨지므로, 개명은 C1 계약 개정 사항이다.

| 무엇 | import 경로 | 파일 |
|---|---|---|
| `SourceAdapter` 프로토콜 | `from crawler.contracts import SourceAdapter` | `crawler/contracts/adapter.py` |
| 수집 대상 값 객체 | `from crawler.contracts import FetchTarget` | 〃 |
| 추출 결과 값 객체 | `from crawler.contracts import ExtractedRecord` | 〃 |
| **extracted 공통 필드 스키마** | `from crawler.contracts import EXTRACTED_SCHEMA` | `crawler/contracts/extracted.schema.json` |
| 봉투 스키마 | `from crawler.contracts import ENVELOPE_SCHEMA` | `crawler/contracts/source_envelope.schema.json` |
| 스키마 검증 | `from crawler.contracts import validate_extracted, validate_envelope` | `crawler/contracts/schemas.py` |
| **adapter_contract_suite** | `from crawler.adapter_contract_suite import CONTRACT_CASES, AdapterContractContext, run_contract_case` | `crawler/adapter_contract_suite.py` |
| 레지스트리 | `from crawler.registry import discover_adapters` | `crawler/registry.py` |
| 사전 판정 게이트 | `from crawler.net import PreflightGate, RobotsEvaluator` | `crawler/net/` |
| 레이트 리미터 | `from crawler.net import RateLimiter, RequestLog` | `crawler/net/ratelimit.py` |
| 원문 저장 | `from crawler.storage import BlobStore, SourceRecordRow` | `crawler/storage/` |
| 차단 판정 | `from crawler.blocking import BlockingDetector` | `crawler/blocking/` |

### 어댑터 계약 스위트 사용법

어댑터 태스크는 자기 테스트에서 15 케이스를 그대로 재사용한다. 케이스를 골라 쓰거나
줄이지 않는다 — 줄이는 것은 검사 대상 축소다.

```python
import pytest
from crawler.adapter_contract_suite import (
    CONTRACT_CASES, AdapterContractContext, run_contract_case,
)

@pytest.mark.parametrize("case", CONTRACT_CASES, ids=[c.id for c in CONTRACT_CASES])
def test_adapter_contract(case, allowlist, sample_body):
    ctx = AdapterContractContext(adapter=ADAPTER, allowlist=allowlist, sample_body=sample_body)
    run_contract_case(case, ctx)
```

---

## 2. 어댑터 등록 규약 (파일 하나로 끝난다)

```
services/crawler/adapters/<source_id>/adapter.py
```

이 파일이 `ADAPTER` 상수 또는 `build_adapter()` 팩토리를 노출하면 등록이 끝난다.
**`core/` · `pyproject.toml` · 다른 어댑터 디렉터리를 수정할 필요가 없다.**
entry-point 방식을 쓰지 않는 이유는 그 방식이 `pyproject.toml` 편집을 요구하는데,
C2·C3 계약이 그 파일을 touches 밖으로 못박고 있기 때문이다.

레퍼런스 구현: [`../tests/fixtures/core/reference_adapter/adapter.py`](../tests/fixtures/core/reference_adapter/adapter.py)
(그대로 복사해 `source_id` 와 셀렉터만 바꾸면 된다.)

`allowlist` 에서 `approved=false` 인 소스의 어댑터는 **모듈 실행조차 하지 않는다.**
import 부작용만으로 요청이 나가는 코드를 막기 위해서다.

---

## 3. 차단 마커 사전 — `crawler/blocking/markers.yaml`

FORBID-4 의 판정 근거다. 소스별 마커 목록과 `min_body_bytes` 를 담는다.

* 소스 항목은 `_default` 를 **상속**한다(대체하지 않는다). 같은 `id` 를 쓰면 소스 항목이 우선하고,
  `min_body_bytes` 는 두 값 중 큰 쪽이 쓰인다. 여기에 allowlist 의 `min_body_bytes` 도
  `max()` 로 합쳐진다.
* 파일 부재 · 파싱 실패 · `_default` 부재 · `min_body_bytes < 1` · `markers` 0건 ·
  `evidence` 누락은 **전부 예외**다 (fail-closed). "마커 없음 = 차단 없음" 으로 넘어가지 않는다.

### 신규 마커 추가 절차

1. 차단 응답의 원문을 blob 스토어에서 꺼내 **실제 문자열을 확인한다** (추측 금지).
2. 해당 소스 항목의 `markers` 에 `{id, kind, pattern, evidence}` 를 추가한다.
   `kind: substring` 은 대소문자 무시 부분문자열, `kind: regex` 는 정규식이다.
   `evidence` 에는 그 문자열을 관측한 `crawl_run_id` 또는 `blob_key` 를 적는다.
3. 파일 상단의 `version` 을 올린다 (`YYYY-MM-DD.N`).
4. `tests/fixtures/core/blocked/` 에 축약 픽스처를 넣고
   `tests/core/test_blocked_access.py` 의 `MARKER_FIXTURES` 에 등재한다.
   픽스처 없는 마커는 오탐·미탐 어느 쪽도 검증되지 않는다.
5. 오탐 대조군(`test_normal_body_is_not_flagged`)이 계속 통과하는지 확인한다.

---

## 4. 규칙의 우선순위 — REQ-2 vs FORBID-4 (429)

계약 REQ-2 는 "네트워크 오류·5xx·**429**" 를 지수 백오프 재시도 대상으로 적고,
FORBID-4 는 "http 401·403·429" 에서 `status=blocked_access` 이고 **아웃바운드 재요청 0회** 를
요구한다. 429 에서 두 조항이 정면으로 부딪힌다.

**구현은 FORBID-4 를 우선한다.** 429 는 상대 서버가 "그만"이라고 말한 것이고, 간격을
벌린 재시도도 그 말을 무시하는 행위다. 한 번의 IP 차단이 이후 어떤 소스에서도 가격을
못 모으게 만든다. 따라서:

| 응답 | 처리 |
|---|---|
| 네트워크 오류 · 5xx | 60s → 300s → 1500s (±20% 지터) 재시도 3회 → `dead_letter` |
| 401 · 403 · 429 | 즉시 `blocked_access`, 재요청 0회, 해당 소스 서킷 카운터 +1 |
| 200 + 차단 마커 매칭 | 즉시 `blocked_access` |
| 200 + 본문 < `min_body_bytes` | 즉시 `blocked_access` |
| 4xx (기타) | `failed` (재시도해도 달라지지 않는다) |

이 우선순위는 `tests/core/test_blocked_access.py::test_429_is_not_retried_precedence` 가
고정한다. 뒤집으려면 그 테스트를 고쳐야 하고, 그 diff 는 리뷰에서 보인다.

---

## 5. CLI

```bash
# 실수집 스모크 (REQ-8) — 실제 아웃바운드를 수행한다
python -m crawler.smoke --source official_website \
    --seed-file services/crawler/config/smoke_seeds.yaml \
    --report artifacts/smoke.json

# 지정 파기 (FORBID-6) — 티켓 ID 없이는 아무것도 지우지 않는다
python -m crawler.purge --ticket <W8 티켓 ID> --blob-key <키> \
    --blob-root <blob 루트> --audit-root audit --reason "<사유>"

# CI 가드 잡 (워크플로가 호출하는 진입점)
python -m crawler.ci.allowlist_guard
python -m crawler.ci.smoke_verify   --report artifacts/smoke.json
python -m crawler.ci.adapter_guards --check path-guard | dataset-lock | dataset-order
python -m crawler.ci.symbol_guard
```

---

## 6. allowlist 와 D3 의 관계

`config/sources.allowlist.yaml` 은 **판정하지 않는다. 전사한다.** 원천은
`docs/discovery/D3/verdicts.csv` 와 `docs/discovery/D3/crawl_policy.yaml` 뿐이다.

대조 원천은 `crawler.d3.load_d3_artifact()` 가 세 경로로 해석하며, **어느 경로로 얻든
sha256 이 `crawler.d3.D3_PINNED_SHA256` 과 일치해야만** 인정한다.

1. 워킹트리 `docs/discovery/D3/<name>` (D3 머지 후의 정상 경로)
2. `git show <ref>:docs/discovery/D3/<name>` (D3 브랜치가 아직 안 머지된 중간 상태)
3. `tests/fixtures/core/d3/<name>` (전사 시점 사본 — 1·2 가 모두 불가능한 환경에서
   검사가 **공허하게 통과**하는 것을 막는다)

D3 정본이 개정되면 sha256 이 달라져 즉시 실패한다. 그때 해야 하는 일은
allowlist 재전사 + `D3_PINNED_SHA256` 갱신 + `d3-change-approved` 라벨이며,
숫자만 올려서 통과시키는 경로는 없다.

---

## 7. 로컬 실행

```bash
cd services/crawler
python -m venv .venv && source .venv/bin/activate
python -m pip install -e ".[dev]"
python -m ruff check .
python -m pytest tests/core -q
```

macOS 프레임워크 파이썬은 CA 번들이 비어 있을 수 있다. 실수집 스모크가
`CERTIFICATE_VERIFY_FAILED` 로 `blocked_robots` 를 내면(= fail-closed 가 정상 작동한 것),
`SSL_CERT_FILE=/etc/ssl/cert.pem` 를 지정하거나 Python 설치본의
`Install Certificates.command` 를 실행한다. **코드에서 인증서 검증을 끄지 않는다.**
