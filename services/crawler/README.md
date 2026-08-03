# services/crawler

glowmate 크롤러 — **Python 3.12 + Playwright 독립 툴체인**.
범위: F1-REPO-SCAFFOLD **REQ-4** (스모크 추출 함수 1개 + 브라우저 기동 테스트). 사이트별 어댑터
로직은 C1~C3 계약 소관이며 이 디렉터리에 선행 작성하지 않는다.

## pnpm workspace 에 포함되지 않는다

`pnpm-workspace.yaml` 의 글롭은 `apps/*` · `packages/*` 뿐이고 `services/*` 는 없다.
또한 이 디렉터리에는 **`package.json` 을 두지 않는다.** 두 조건 중 하나라도 깨지면
python 미설치 러너에서 `pnpm -r build` 가 이 트리를 빌드 대상으로 삼아 실패한다(REQ-4).

```
glowmate/
├── apps/*         ← pnpm workspace
├── packages/*     ← pnpm workspace
└── services/
    └── crawler/   ← 워크스페이스 밖. python job 에서만 실행된다
```

## 로컬 실행

Python 은 루트 `.python-version` 의 **3.12** 를 쓴다.

```bash
cd services/crawler
python -m venv .venv && source .venv/bin/activate
python -m pip install -e ".[dev]"
python -m playwright install --with-deps chromium   # 브라우저 바이너리 (필수)
python -m ruff check .
python -m ruff format --check .
python -m pytest
```

## CI `python` job 인터페이스

`.github/workflows/ci.yml` 의 `python` job 이 `working-directory: services/crawler` 로 실행하는
순서다. 이 디렉터리는 아래 계약을 만족해야 한다.

| # | 단계 | 명령 | 이 디렉터리가 만족해야 하는 것 |
|---|---|---|---|
| 1 | Python 3.12 | `actions/setup-python@v5` (`python-version-file: .python-version`) | `requires-python = ">=3.12"` |
| 2 | 의존 설치 | `pip install --disable-pip-version-check -e '.[dev]'` | editable 설치 가능(hatchling + `src/` 레이아웃) · `dev` extra 에 ruff · pytest · playwright |
| 3 | lint | `ruff check .` | ruff 설정이 `pyproject.toml` 안에 있음 |
| 4 | 브라우저 | `python -m playwright install --with-deps chromium` | 테스트는 **chromium 만** 사용 |
| 5 | 테스트 | `python -m pytest -q` | `testpaths`·`pythonpath` 가 `pyproject.toml` 안에 있음 · 수집 ≥ 1 |

**4단계가 빠지면 테스트는 skip 되지 않고 실패한다** — 의도된 동작이다. 브라우저가 없다는 이유로
REQ-4 검증이 조용히 사라지면 job 이 영구 초록이 된다.

브라우저는 `chromium` 만 쓴다. firefox/webkit 을 도입하면 3단계가 준비하지 않은 바이너리를
요구하게 되어 CI 가 깨진다.

캐시 대상(선택): `~/.cache/ms-playwright` (macOS 는 `~/Library/Caches/ms-playwright`).

`ruff format --check .` 는 job 에 포함돼 있지 않지만 이 트리는 포맷도 통과 상태로 유지한다.

## 구성

| 경로 | 내용 |
|---|---|
| `pyproject.toml` | 의존(playwright / pytest / ruff) · ruff 설정 · pytest 설정 |
| `src/glowmate_crawler/extract.py` | 스모크 추출 함수 `extract_text(url, selector)` |
| `tests/fixtures/venue_page.html` | 고정 HTML 픽스처. `file://` 로만 로드하며 외부 자원을 참조하지 않는다 |
| `tests/test_extract_smoke.py` | REQ-4 assert — Chromium 기동 → 고정 HTML → 셀렉터 텍스트 1건 추출 |
| `tests/test_suite_integrity.py` | REQ-4 수집 검사 + FORBID-2 관용구 스캔 |
| `tests/forbidden_idioms.txt` | FORBID-2 패턴 사전 (**검사기의 패턴 정의 파일** — 리포 전역 diff 스캐너의 제외 목록에 등재할 것) |

## 실패 처리 원칙

`extract_text` 는 추출 실패 시 빈 문자열이나 `None` 을 반환하지 않고 `ExtractionError` 를 올린다.
실패 경로는 4가지다: 페이지 로드 실패 · 셀렉터 미매칭 · 복수 매칭(모호) · 텍스트가 공백뿐.
각 경로는 `tests/test_extract_smoke.py` 에서 개별 테스트로 고정돼 있으므로, 나중에 누군가
"실패 시 빈 값 반환"으로 바꾸면 테스트가 깨진다.

## 네트워크 금지

테스트는 `file://` 픽스처만 사용한다. 실사이트 접속을 테스트에 넣으면 CI 가 외부 사이트의 가용성과
마크업 변경에 의존하게 되고, 그 시점에 가장 짧은 해결책이 검사 무력화(FORBID-2)다.
