"""사전 판정 게이트 (REQ-5 · FORBID-1 (a) · FORBID-2).

요청을 만들기 **전에** 네 가지를 본다. 하나라도 걸리면 콘텐츠 요청은 0건이다.

  1. source_id 가 allowlist 에 있고 approved=true 인가            → 아니면 source_not_allowed
  2. host 가 그 소스의 hosts 에 있는가                             → 아니면 source_not_allowed
  3. URL 이 D3 `allowed_path_globs` 안인가                         → 아니면 source_not_allowed
  4. robots.txt 가 Allow 이고 **취득에 성공했는가**                → 아니면 blocked_robots

3번을 두는 이유: D3 는 "본 실사에서 실제로 요청해 본 경로만" 글롭에 담았다. 글롭 밖 URL 은
실사되지 않은 경로이므로, allowlist 에 host 가 있다는 이유로 통과시키면 실사 범위를
코드가 조용히 넓히게 된다.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlsplit

from ..allowlist import Allowlist, SourcePolicy
from ..models import JobStatus, PreflightDecision
from .robots import RobotsEvaluator


@dataclass(frozen=True, slots=True)
class PreflightResult:
    decision: PreflightDecision
    policy: SourcePolicy | None


class PreflightGate:
    def __init__(self, allowlist: Allowlist, robots: RobotsEvaluator) -> None:
        self.allowlist = allowlist
        self.robots = robots

    def check(self, source_id: str, url: str) -> PreflightResult:
        policy = self.allowlist.get(source_id)
        if policy is None:
            return PreflightResult(
                PreflightDecision.deny(
                    JobStatus.SOURCE_NOT_ALLOWED,
                    f"source_id 가 allowlist 에 없다: {source_id!r}",
                ),
                None,
            )
        if not policy.approved:
            return PreflightResult(
                PreflightDecision.deny(
                    JobStatus.SOURCE_NOT_ALLOWED,
                    f"{source_id}: approved=false (verdict={policy.verdict})",
                ),
                policy,
            )

        host = (urlsplit(url).hostname or "").lower()
        if not host:
            return PreflightResult(
                PreflightDecision.deny(
                    JobStatus.SOURCE_NOT_ALLOWED, f"host 를 뽑을 수 없는 URL: {url!r}"
                ),
                policy,
            )
        if not policy.allows_host(host):
            return PreflightResult(
                PreflightDecision.deny(
                    JobStatus.SOURCE_NOT_ALLOWED,
                    f"{source_id}: host {host!r} 가 allowlist 에 없다 "
                    f"(등재: {', '.join(policy.hosts) or '없음'})",
                ),
                policy,
            )
        if not policy.allows_url(url):
            return PreflightResult(
                PreflightDecision.deny(
                    JobStatus.SOURCE_NOT_ALLOWED,
                    f"{source_id}: {url} 가 D3 allowed_path_globs 밖이다 — "
                    "실사되지 않은 경로를 코드가 넓히지 않는다",
                ),
                policy,
            )

        verdict = self.robots.evaluate(url, user_agent=policy.user_agent)
        if not verdict.allowed:
            return PreflightResult(
                PreflightDecision.deny(JobStatus.BLOCKED_ROBOTS, verdict.reason), policy
            )
        return PreflightResult(PreflightDecision.ok(verdict.reason), policy)
