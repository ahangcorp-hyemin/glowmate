"""어댑터 계약 스위트 — C2·C3 가 **외부 import 로 재사용**하는 공개 경로 (REQ-6).

    from crawler.adapter_contract_suite import (
        AdapterContractContext, CONTRACT_CASES, run_contract_case,
    )

C1 은 15개 케이스를 소유하고, 어댑터 태스크는 자기 테스트 파일에서 다음과 같이 쓴다::

    @pytest.mark.parametrize("case", CONTRACT_CASES, ids=[c.id for c in CONTRACT_CASES])
    def test_adapter_contract(case, ctx):
        run_contract_case(case, ctx)

케이스 수를 줄이는 것은 검사 대상 축소이므로 :data:`CONTRACT_CASE_COUNT` 로 못박아 두고,
스위트 자신이 개수를 자기검사한다. 케이스를 늘리는 것은 자유지만 이 상수도 같이 올라간다.
"""

from __future__ import annotations

import inspect
from collections.abc import Callable
from dataclasses import dataclass, field

from .allowlist import Allowlist
from .contracts.adapter import ExtractedRecord, FetchTarget, adapter_id_of, adapter_version_of
from .contracts.schemas import extracted_errors
from .errors import AdapterContractError

#: 계약 케이스 수. C1 REQ-6 acceptance 가 `passed=15, skipped=0` 을 요구한다.
CONTRACT_CASE_COUNT = 15

#: 어댑터가 노출하면 안 되는 속성 — 코어를 거치지 않는 자체 요청 경로.
#: 어댑터가 직접 소켓을 열면 allowlist·robots·rate limit 이 전부 무의미해진다.
FORBIDDEN_ADAPTER_ATTRS: tuple[str, ...] = (
    "fetch",
    "request",
    "get",
    "download",
    "urlopen",
    "session",
    "client",
    "browser",
    "http",
)

#: 어댑터 모듈에 들어오면 안 되는 접근통제 회피 수단 (FORBID-4).
FORBIDDEN_ADAPTER_MODULE_PREFIXES: tuple[str, ...] = (
    "playwright_stealth",
    "undetected_chromedriver",
    "seleniumbase",
    "fake_useragent",
    "cloudscraper",
    "selenium_stealth",
    "curl_cffi",
    "tls_client",
    "http.cookiejar",
)


@dataclass(slots=True)
class AdapterContractContext:
    """스위트 실행에 필요한 입력."""

    adapter: object
    allowlist: Allowlist
    #: `extract()` 에 넣을 정상 응답 본문 (어댑터 태스크의 픽스처에서 온다)
    sample_body: bytes
    #: `extract()` 가 반드시 실패해야 하는 입력 (기본: 빈 본문)
    failing_body: bytes = b""
    #: `extract()` 대상 타깃. 미지정이면 seed_targets()[0]
    sample_target: FetchTarget | None = None
    notes: dict[str, str] = field(default_factory=dict)

    def target(self) -> FetchTarget:
        if self.sample_target is not None:
            return self.sample_target
        targets = self.adapter.seed_targets()  # type: ignore[attr-defined]
        if not targets:
            raise AdapterContractError("seed_targets() 가 0건이라 extract 케이스를 실행할 수 없다")
        return targets[0]

    def policy(self):
        policy = self.allowlist.get(adapter_id_of(self.adapter))
        if policy is None:
            raise AdapterContractError(
                f"어댑터 source_id 가 allowlist 에 없다: {adapter_id_of(self.adapter)}"
            )
        return policy


@dataclass(frozen=True, slots=True)
class ContractCase:
    id: str
    why: str
    check: Callable[[AdapterContractContext], None]


def _fail(message: str) -> None:
    raise AdapterContractError(message)


# ── 케이스 정의 ──────────────────────────────────────────────────────────────


def _c01_source_id(ctx: AdapterContractContext) -> None:
    adapter_id_of(ctx.adapter)


def _c02_source_id_in_allowlist(ctx: AdapterContractContext) -> None:
    policy = ctx.policy()
    if not policy.approved:
        _fail(
            f"어댑터 소스 {policy.source_id} 가 allowlist 에서 approved=false 다 "
            f"(verdict={policy.verdict}) — 승인되지 않은 소스의 어댑터는 계약을 통과할 수 없다"
        )


def _c03_version(ctx: AdapterContractContext) -> None:
    adapter_version_of(ctx.adapter)


def _c04_seed_targets_type(ctx: AdapterContractContext) -> None:
    targets = ctx.adapter.seed_targets()  # type: ignore[attr-defined]
    if not isinstance(targets, list):
        _fail(f"seed_targets() 가 list 가 아니다: {type(targets).__name__}")
    for t in targets:
        if not isinstance(t, FetchTarget):
            _fail(f"seed_targets() 원소가 FetchTarget 이 아니다: {type(t).__name__}")


def _c05_seed_targets_nonempty(ctx: AdapterContractContext) -> None:
    targets = ctx.adapter.seed_targets()  # type: ignore[attr-defined]
    if len(targets) == 0:
        _fail(
            "seed_targets() 가 0건이다 — 수집 0건이 합법이 되는 순간 "
            "커버리지 지표가 무의미해진다"
        )


def _c06_target_keys_unique(ctx: AdapterContractContext) -> None:
    targets = ctx.adapter.seed_targets()  # type: ignore[attr-defined]
    keys = [t.target_key for t in targets]
    dupes = {k for k in keys if keys.count(k) > 1}
    if dupes:
        _fail(f"target_key 중복: {sorted(dupes)} — 중복 판정(REQ-1)의 키가 흔들린다")


def _c07_hosts_in_allowlist(ctx: AdapterContractContext) -> None:
    from urllib.parse import urlsplit

    policy = ctx.policy()
    bad = []
    for t in ctx.adapter.seed_targets():  # type: ignore[attr-defined]
        host = (urlsplit(t.url).hostname or "").lower()
        if not policy.allows_host(host):
            bad.append((t.url, host))
    if bad:
        _fail(f"allowlist hosts 밖 대상 {len(bad)}건: {bad[:5]}")


def _c08_urls_in_path_globs(ctx: AdapterContractContext) -> None:
    policy = ctx.policy()
    bad = [t.url for t in ctx.adapter.seed_targets() if not policy.allows_url(t.url)]  # type: ignore[attr-defined]
    if bad:
        _fail(
            f"D3 allowed_path_globs 밖 대상 {len(bad)}건: {bad[:5]} — "
            "실사에서 실제로 요청해 본 경로만 수집한다"
        )


def _c09_seed_targets_deterministic(ctx: AdapterContractContext) -> None:
    first = [(t.url, t.target_key) for t in ctx.adapter.seed_targets()]  # type: ignore[attr-defined]
    second = [(t.url, t.target_key) for t in ctx.adapter.seed_targets()]  # type: ignore[attr-defined]
    if first != second:
        _fail("seed_targets() 가 호출마다 다르다 — 재현 불가능한 수집 대상은 감사 불가능하다")


def _c10_extract_returns_record(ctx: AdapterContractContext) -> None:
    record = ctx.adapter.extract(ctx.target(), ctx.sample_body)  # type: ignore[attr-defined]
    if not isinstance(record, ExtractedRecord):
        _fail(f"extract() 가 ExtractedRecord 를 반환하지 않았다: {type(record).__name__}")


def _c11_extract_schema(ctx: AdapterContractContext) -> None:
    record = ctx.adapter.extract(ctx.target(), ctx.sample_body)  # type: ignore[attr-defined]
    errors = extracted_errors(record.to_dict())
    if errors:
        _fail("extract() 결과가 extracted 스키마를 위반한다:\n  " + "\n  ".join(errors))


def _c12_extract_source_id(ctx: AdapterContractContext) -> None:
    record = ctx.adapter.extract(ctx.target(), ctx.sample_body)  # type: ignore[attr-defined]
    expected = adapter_id_of(ctx.adapter)
    if record.source_id != expected:
        _fail(f"extract() 결과의 source_id 가 다르다: {record.source_id!r} != {expected!r}")


def _c13_extract_fails_loudly(ctx: AdapterContractContext) -> None:
    try:
        record = ctx.adapter.extract(ctx.target(), ctx.failing_body)  # type: ignore[attr-defined]
    except Exception:
        return
    _fail(
        "추출 불가 입력에서 extract() 가 예외 대신 값을 돌려줬다: "
        f"{record!r} — 조용한 실패는 잘못된 데이터보다 위험하다"
    )


def _c14_no_self_transport(ctx: AdapterContractContext) -> None:
    present = [a for a in FORBIDDEN_ADAPTER_ATTRS if hasattr(ctx.adapter, a)]
    if present:
        _fail(
            f"어댑터가 자체 요청 경로를 노출한다: {present} — "
            "요청은 코어의 사전 판정 게이트 → 레이트 리미터 경로로만 나간다"
        )


def _c15_no_evasion_imports(ctx: AdapterContractContext) -> None:
    module = inspect.getmodule(type(ctx.adapter))
    names: set[str] = set()
    if module is not None:
        for value in vars(module).values():
            mod = getattr(value, "__module__", None)
            if isinstance(mod, str):
                names.add(mod)
            if inspect.ismodule(value):
                names.add(value.__name__)
    hits = sorted(
        n
        for n in names
        if any(n == p or n.startswith(p + ".") for p in FORBIDDEN_ADAPTER_MODULE_PREFIXES)
    )
    if hits:
        _fail(
            f"어댑터 모듈이 접근통제 회피 수단을 들여온다: {hits} (FORBID-4) — "
            "비로그인 공개 정보라는 D3 실사의 전제를 파기한다"
        )


CONTRACT_CASES: tuple[ContractCase, ...] = (
    ContractCase("source_id_present", "source_id 없는 어댑터는 등록 키가 없다", _c01_source_id),
    ContractCase(
        "source_id_approved",
        "D3 미승인 소스의 어댑터를 통과시키지 않는다",
        _c02_source_id_in_allowlist,
    ),
    ContractCase(
        "version_present", "봉투의 adapter_version 이 비면 재처리 대상 판정이 깨진다", _c03_version
    ),
    ContractCase(
        "seed_targets_type", "코어가 소비할 수 있는 형태여야 한다", _c04_seed_targets_type
    ),
    ContractCase(
        "seed_targets_nonempty", "수집 0건을 합법으로 두지 않는다", _c05_seed_targets_nonempty
    ),
    ContractCase("target_keys_unique", "중복 enqueue 판정 키의 유일성", _c06_target_keys_unique),
    ContractCase(
        "hosts_in_allowlist", "allowlist 밖 host 를 대상으로 삼지 않는다", _c07_hosts_in_allowlist
    ),
    ContractCase("urls_in_path_globs", "D3 실증 경로 밖을 넓히지 않는다", _c08_urls_in_path_globs),
    ContractCase(
        "seed_targets_deterministic",
        "재현 불가능한 대상 집합은 감사 불가능하다",
        _c09_seed_targets_deterministic,
    ),
    ContractCase("extract_returns_record", "추출 결과 형태 고정", _c10_extract_returns_record),
    ContractCase("extract_schema_valid", "extracted 공통 스키마 준수", _c11_extract_schema),
    ContractCase(
        "extract_source_id_matches",
        "추출 결과의 소스 귀속이 흔들리지 않는다",
        _c12_extract_source_id,
    ),
    ContractCase("extract_fails_loudly", "조용한 실패(빈 값 반환) 금지", _c13_extract_fails_loudly),
    ContractCase("no_self_transport", "어댑터의 자체 요청 경로 금지", _c14_no_self_transport),
    ContractCase(
        "no_evasion_imports", "스텔스·프록시 로테이션·랜덤 UA 반입 금지", _c15_no_evasion_imports
    ),
)

if len(CONTRACT_CASES) != CONTRACT_CASE_COUNT:  # pragma: no cover - 임포트 시 자기검사
    raise AssertionError(
        f"계약 케이스 수가 {len(CONTRACT_CASES)} 다 — "
        f"CONTRACT_CASE_COUNT({CONTRACT_CASE_COUNT}) 와 "
        "함께 갱신하지 않으면 REQ-6 의 passed=15 판정이 조용히 흔들린다"
    )


def run_contract_case(case: ContractCase, ctx: AdapterContractContext) -> None:
    """케이스 1건 실행. 위반은 :class:`AdapterContractError` 로 올라간다."""
    case.check(ctx)
