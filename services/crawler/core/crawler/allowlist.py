"""`sources.allowlist.yaml` 로더.

두 가지를 한다.

1. **로드 시점 검증** — verdict ∈ {forbidden, pending} 인데 approved=true 이거나 hosts 가
   비어 있지 않으면 `ConfigError`. approved=false 인 소스는 애초에 레지스트리·큐에 실리지 않는다.
2. **오버라이드 상한 집행 (FORBID-3)** — 코드·환경변수에서 `max_rps`·`per_host_concurrency`
   를 allowlist 기재 상한보다 **크게** 지정하면 `ValueError`. 낮추는 것은 언제나 허용한다.

allowlist 값 자체가 D3 정본과 맞는지는 여기서 보지 않는다. 그 대조는 CI job
`allowlist-guard`(`crawler.ci.allowlist_guard`)가 D3 산출물을 실제로 열어서 한다.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

import yaml

from .d3 import DENIED_VERDICTS, VERDICT_VALUES, repo_root
from .errors import ConfigError, PolicyViolationError

#: 리포 기준 기본 위치
DEFAULT_ALLOWLIST_PATH = "services/crawler/config/sources.allowlist.yaml"

#: REQ-4 가 명시한 기본값. allowlist 에 값이 없을 때만 쓰인다.
DEFAULT_MAX_RPS = 0.5
DEFAULT_PER_HOST_CONCURRENCY = 2

#: 환경변수 오버라이드 접두사. 예) GLOWMATE_CRAWLER_MAX_RPS__official_website=0.05
ENV_MAX_RPS_PREFIX = "GLOWMATE_CRAWLER_MAX_RPS__"
ENV_CONCURRENCY_PREFIX = "GLOWMATE_CRAWLER_CONCURRENCY__"


def _glob_to_regex_parts(glob: str) -> list[str]:
    return glob.split("*")


def glob_match(url: str, glob: str) -> bool:
    """`*` 가 임의 문자열(경로 + 쿼리스트링 전체)에 대응하는 글롭 매칭.

    D3 `crawl_policy.yaml` 헤더의 규정과 같은 의미다.
    """
    parts = _glob_to_regex_parts(glob)
    if len(parts) == 1:
        return url == glob
    if not url.startswith(parts[0]):
        return False
    pos = len(parts[0])
    for mid in parts[1:-1]:
        found = url.find(mid, pos)
        if found == -1:
            return False
        pos = found + len(mid)
    tail = parts[-1]
    if tail == "":
        return True
    return url.endswith(tail) and len(url) - len(tail) >= pos


@dataclass(frozen=True, slots=True)
class SourcePolicy:
    """소스 1건의 준수 파라미터."""

    source_id: str
    verdict: str
    approved: bool
    max_rps: float
    per_host_concurrency: int
    hosts: tuple[str, ...]
    allowed_path_globs: tuple[str, ...]
    user_agent: str
    min_body_bytes: int
    retry_backoff_sec: int
    raw_retention_days: int
    expiry_action: str
    max_requests_per_min: float

    @property
    def min_interval_sec(self) -> float:
        """요청 간 최소 간격. 1/max_rps 이며 D3 의 60/max_requests_per_min 과 같다."""
        if self.max_rps <= 0:
            raise ConfigError(f"{self.source_id}: max_rps 가 0 이하다 ({self.max_rps})")
        return 1.0 / self.max_rps

    def allows_host(self, host: str) -> bool:
        return host.lower() in self.hosts

    def allows_url(self, url: str) -> bool:
        return any(glob_match(url, g) for g in self.allowed_path_globs)


@dataclass(frozen=True, slots=True)
class Allowlist:
    """allowlist 전체."""

    path: Path
    provenance: dict[str, str]
    sources: dict[str, SourcePolicy] = field(default_factory=dict)

    def get(self, source_id: str) -> SourcePolicy | None:
        return self.sources.get(source_id)

    @property
    def approved_sources(self) -> dict[str, SourcePolicy]:
        """레지스트리·스케줄러가 보는 유일한 집합."""
        return {sid: p for sid, p in self.sources.items() if p.approved}

    def policy_for_url(self, url: str) -> SourcePolicy | None:
        """URL 의 host 를 소유한 **승인된** 소스. 없으면 None."""
        host = (urlsplit(url).hostname or "").lower()
        if not host:
            return None
        for policy in self.approved_sources.values():
            if policy.allows_host(host):
                return policy
        return None


def _require(mapping: dict, key: str, source_id: str):
    if key not in mapping:
        raise ConfigError(f"allowlist {source_id}: 필수 키 `{key}` 가 없다")
    return mapping[key]


def _parse_source(source_id: str, raw: object) -> SourcePolicy:
    if not isinstance(raw, dict):
        raise ConfigError(f"allowlist {source_id}: 항목이 매핑이 아니다")
    verdict = str(_require(raw, "verdict", source_id))
    if verdict not in VERDICT_VALUES:
        raise ConfigError(
            f"allowlist {source_id}: verdict={verdict!r} 가 허용 집합 밖이다 "
            f"({', '.join(VERDICT_VALUES)})"
        )
    approved = bool(_require(raw, "approved", source_id))
    hosts = tuple(str(h).lower() for h in raw.get("hosts") or ())
    globs = tuple(str(g) for g in raw.get("allowed_path_globs") or ())

    if verdict in DENIED_VERDICTS:
        if approved:
            raise ConfigError(
                f"allowlist {source_id}: verdict={verdict} 인데 approved=true 다 — "
                "D3 판정을 뒤집는 값이며 어떤 사유로도 허용되지 않는다"
            )
        if hosts or globs:
            raise ConfigError(
                f"allowlist {source_id}: verdict={verdict} 인데 "
                f"hosts/allowed_path_globs 가 비어 있지 않다 "
                f"(hosts={len(hosts)}, globs={len(globs)}) — "
                "금지 소스에 요청 대상을 남겨두지 않는다"
            )

    if approved and not hosts:
        raise ConfigError(
            f"allowlist {source_id}: approved=true 인데 hosts 가 0건이다 — "
            "대상 없는 승인은 검사를 공허하게 만든다"
        )
    if approved and not globs:
        raise ConfigError(
            f"allowlist {source_id}: approved=true 인데 allowed_path_globs 가 0건이다"
        )

    max_rpm = float(raw.get("max_requests_per_min", 0) or 0)
    max_rps = float(raw.get("max_rps", DEFAULT_MAX_RPS if approved else 0.0) or 0.0)
    if approved:
        if max_rpm <= 0:
            raise ConfigError(
                f"allowlist {source_id}: approved=true 인데 max_requests_per_min 이 없다"
            )
        if max_rps <= 0:
            raise ConfigError(f"allowlist {source_id}: approved=true 인데 max_rps 가 없다")

    return SourcePolicy(
        source_id=source_id,
        verdict=verdict,
        approved=approved,
        max_rps=max_rps,
        per_host_concurrency=int(raw.get("per_host_concurrency", DEFAULT_PER_HOST_CONCURRENCY)),
        hosts=hosts,
        allowed_path_globs=globs,
        user_agent=str(raw.get("user_agent", "")),
        min_body_bytes=int(raw.get("min_body_bytes", 0)),
        retry_backoff_sec=int(raw.get("retry_backoff_sec", 0)),
        raw_retention_days=int(raw.get("raw_retention_days", 0)),
        expiry_action=str(raw.get("expiry_action", "")),
        max_requests_per_min=max_rpm,
    )


def load_allowlist(path: str | Path | None = None, root: Path | None = None) -> Allowlist:
    """allowlist 를 읽고 검증한다. 파일 부재·파싱 실패는 예외다."""
    if path is None:
        path = repo_root(root) / DEFAULT_ALLOWLIST_PATH
    p = Path(path)
    if not p.is_file():
        raise ConfigError(f"allowlist 파일이 없다: {p}")
    data = yaml.safe_load(p.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ConfigError(f"allowlist 를 매핑으로 읽지 못했다: {p}")
    raw_sources = data.get("sources")
    if not isinstance(raw_sources, dict) or not raw_sources:
        raise ConfigError(f"allowlist 의 sources 가 비었다: {p} — 검사 대상 0건은 통과가 아니다")
    provenance = {str(k): str(v) for k, v in (data.get("d3_provenance") or {}).items()}
    if not provenance:
        raise ConfigError(f"allowlist 에 d3_provenance 가 없다: {p}")

    sources = {sid: _parse_source(str(sid), raw) for sid, raw in raw_sources.items()}
    if not any(p_.approved for p_ in sources.values()):
        raise ConfigError(
            f"allowlist 에 approved=true 인 소스가 0건이다: {p} — "
            "수집 대상 0건은 '안전'이 아니라 파이프라인 정지다"
        )
    return Allowlist(path=p, provenance=provenance, sources=sources)


# ─── FORBID-3: 상한 오버라이드 차단 ──────────────────────────────────────────


def resolve_max_rps(policy: SourcePolicy, override: float | None = None,
                    env: dict[str, str] | None = None) -> float:
    """실효 max_rps. allowlist 상한보다 **큰** 값이 오면 ValueError (FORBID-3).

    `ValueError` 로 올리는 이유: 계약 detect 가 "설정 로더 단위테스트(allowlist 상한 초과
    오버라이드 시 ValueError)" 를 명시한다. `PolicyViolationError` 는 ValueError 의 하위형이
    아니므로 두 조건을 동시에 만족시키기 위해 ValueError 를 직접 쓴다.
    """
    envmap = os.environ if env is None else env
    candidates: list[tuple[str, float]] = []
    if override is not None:
        candidates.append(("코드 오버라이드", float(override)))
    env_key = f"{ENV_MAX_RPS_PREFIX}{policy.source_id}"
    if env_key in envmap:
        candidates.append((f"환경변수 {env_key}", float(envmap[env_key])))

    effective = policy.max_rps
    for origin, value in candidates:
        if value > policy.max_rps:
            raise ValueError(
                f"FORBID-3 — {origin} 가 allowlist 상한을 넘는 max_rps 를 지정했다: "
                f"{value} > {policy.max_rps} (source={policy.source_id}). "
                "상한을 넘겨야 한다면 D3 재실사 → allowlist 갱신 경로를 쓰라. "
                "재시도·백필·수동 트리거는 상한을 여는 사유가 아니다."
            )
        effective = min(effective, value)
    return effective


def resolve_concurrency(policy: SourcePolicy, override: int | None = None,
                        env: dict[str, str] | None = None) -> int:
    """실효 per-host 동시성. allowlist 상한 초과는 ValueError (FORBID-3)."""
    envmap = os.environ if env is None else env
    candidates: list[tuple[str, int]] = []
    if override is not None:
        candidates.append(("코드 오버라이드", int(override)))
    env_key = f"{ENV_CONCURRENCY_PREFIX}{policy.source_id}"
    if env_key in envmap:
        candidates.append((f"환경변수 {env_key}", int(envmap[env_key])))

    effective = policy.per_host_concurrency
    for origin, value in candidates:
        if value > policy.per_host_concurrency:
            raise ValueError(
                f"FORBID-3 — {origin} 가 allowlist 상한을 넘는 per_host_concurrency 를 지정했다: "
                f"{value} > {policy.per_host_concurrency} (source={policy.source_id})"
            )
        if value < 1:
            raise PolicyViolationError(f"동시성은 1 이상이어야 한다: {value}")
        effective = min(effective, value)
    return effective
