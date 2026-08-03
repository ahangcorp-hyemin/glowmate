"""★ 이 파일은 **검사기의 패턴 정의 파일**이다.

FORBID-4 · FORBID-6 (c) 가 찾는 금지 문자열의 **리터럴은 이 파일에만 존재**해야 한다.
다른 검사기 파일에 리터럴을 두면 그 파일이 스스로 스캔에 걸려, 검사기를 지우는 것이
가장 짧은 해결책이 된다 (F1 `tools/ci-meta/forbid2-patterns.mjs` 가 같은 이유로 자기 자신을
제외 목록에 넣는다).

따라서 스캐너는 :data:`SELF_EXCLUDED` 에 있는 경로를 스캔 대상에서 뺀다.
"""

from __future__ import annotations

#: 스캔에서 제외되는 경로 (리포 루트 기준 상대경로 접미사 매칭)
SELF_EXCLUDED: tuple[str, ...] = (
    "core/crawler/ci/patterns.py",
    # 계약 스위트는 어댑터가 회피 수단을 들여왔는지 **판정**하기 위해 같은 이름을 갖는다.
    "core/crawler/adapter_contract_suite.py",
)

# ── FORBID-4 — 접근통제 회피 수단 ────────────────────────────────────────────
#
# 판정 기준은 열거가 아니라 "비로그인 공개 정보라는 D3 실사의 전제를 파기하는 수단"이라는
# 성질이며, 아래는 그 성질에 해당하는 것들이다.

#: (1) 의존성 이름 — pyproject.toml 의 dependencies 에 들어오면 실패
FORBIDDEN_DEPENDENCIES: tuple[str, ...] = (
    "playwright-stealth",
    "playwright_stealth",
    "undetected-chromedriver",
    "undetected_chromedriver",
    "selenium-stealth",
    "selenium_stealth",
    "seleniumbase",
    "cloudscraper",
    "fake-useragent",
    "fake_useragent",
    "user-agent",
    "random-user-agent",
    "requests-random-user-agent",
    "rotating-proxies",
    "proxybroker",
    "free-proxy",
    "curl-cffi",
    "curl_cffi",
    "tls-client",
    "tls_client",
    "puppeteer-extra-plugin-stealth",
    "2captcha-python",
    "anticaptchaofficial",
    "capsolver",
)

#: (2) 코드 심볼 — core/ 안에 나타나면 실패
FORBIDDEN_CODE_SYMBOLS: tuple[tuple[str, str], ...] = (
    ("stealth(", "헤드리스 탐지 우회 플러그인 호출"),
    ("stealth_sync", "헤드리스 탐지 우회 플러그인 호출"),
    ("stealth_async", "헤드리스 탐지 우회 플러그인 호출"),
    ("UserAgent()", "랜덤 User-Agent 생성기"),
    ("random_user_agent", "User-Agent 무작위화"),
    ("random.choice(USER_AGENTS", "User-Agent 무작위화"),
    ("rotate_proxy", "프록시/IP 로테이션"),
    ("proxy_pool", "프록시/IP 로테이션"),
    ("rotating_proxy", "프록시/IP 로테이션"),
    ("http.cookiejar", "세션 쿠키 보존 — 비로그인 전제 파기"),
    ("CookieJar(", "세션 쿠키 보존 — 비로그인 전제 파기"),
    ("HTTPCookieProcessor", "세션 쿠키 주입"),
    ("set_cookie", "세션 쿠키 주입"),
    ("add_cookies", "세션 쿠키 주입"),
    ("--disable-blink-features=AutomationControlled", "헤드리스 탐지 우회 옵션"),
    ("navigator.webdriver", "헤드리스 탐지 우회 옵션"),
    ("solve_captcha", "캡차 우회"),
    ("anticaptcha", "캡차 우회"),
)

#: (3) 설정 키 — 프록시 로테이션 설정이 파일로 들어오는 경로
FORBIDDEN_CONFIG_KEYS: tuple[tuple[str, str], ...] = (
    ("proxies:", "프록시 로테이션 설정 키"),
    ("proxy_list", "프록시 로테이션 설정 키"),
    ("user_agents:", "User-Agent 목록(무작위화 전제) 설정 키"),
    ("login:", "계정 로그인 설정 키"),
    ("credentials:", "계정 자격증명 설정 키"),
)

# ── FORBID-6 (c) — source_record 대상 UPDATE/DELETE ──────────────────────────
#
# DB 트리거는 F2a REQ-6 이 이미 강제한다. 이 검사는 **blob 경로와 우회 호출**이 대상이다.
# `crawler/purge.py` · `crawler/storage/record.py` · `crawler/storage/blob.py` 밖에서
# 원문을 지우는 코드가 생기면 잡는다.

SOURCE_RECORD_MUTATION_PATTERNS: tuple[tuple[str, str], ...] = (
    ("DELETE FROM core.source_record", "source_record 행 DELETE"),
    ("DELETE FROM source_record", "source_record 행 DELETE"),
    ("delete from core.source_record", "source_record 행 DELETE"),
    ("delete from source_record", "source_record 행 DELETE"),
    ("UPDATE core.source_record", "source_record 행 UPDATE"),
    ("UPDATE source_record", "source_record 행 UPDATE"),
    ("update core.source_record", "source_record 행 UPDATE"),
    ("update source_record", "source_record 행 UPDATE"),
    ("source_record.delete(", "ORM 을 통한 source_record 삭제"),
    ("source_record.update(", "ORM 을 통한 source_record 갱신"),
    ("SourceRecord.delete", "ORM 을 통한 source_record 삭제"),
    ("SourceRecord.objects.filter", "ORM 우회 질의 진입점"),
)

#: blob 객체를 지우는 호출. purge 모듈 밖에 있으면 위반이다.
BLOB_REMOVAL_PATTERNS: tuple[tuple[str, str], ...] = (
    (".rmtree(", "blob 트리 삭제"),
    ("os.remove(", "blob 객체 삭제"),
    (".unlink(", "blob 객체 삭제"),
)

#: 위 두 사전의 예외 경로 (원문 파기의 지정 절차 자체)
PURGE_ALLOWED_PATHS: tuple[str, ...] = (
    "core/crawler/purge.py",
    "core/crawler/storage/blob.py",
    "core/crawler/storage/record.py",
)
