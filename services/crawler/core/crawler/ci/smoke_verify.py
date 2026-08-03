"""CI job `crawler-smoke-verify` — REQ-8 집행기.

`artifacts/smoke.json` 을 판정한다.

  records ≥ 10 · sha256_mismatch = 0 · http_429_403 = 0 ·
  min_interval_sec ≥ 정책값 · generated_at 이 기준 시점 대비 7일 이내

리포트가 **없으면 실패**다. 파일 부재를 "검사할 것이 없음"으로 처리하면 스모크를 지우는 것이
검사를 통과하는 가장 짧은 길이 된다. 그래서 워크플로는 리포트가 없을 때 실수집을 먼저
수행하고(`python -m crawler.smoke`), 그래도 없으면 이 검사기가 exit 1 한다.

`min_interval_sec` 의 판정 기준은 리포트 안의 `policy_min_interval_sec` 가 아니라
**allowlist 정본**에서 다시 계산한다. 리포트가 자기 채점 기준을 들고 오면 기준을 낮추는 것이
가장 싼 통과 방법이 되기 때문이다.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from ..allowlist import load_allowlist
from ..d3 import repo_root
from ..errors import ConfigError
from ._common import GuardError, Report

DEFAULT_REPORT = "artifacts/smoke.json"
DEFAULT_MAX_AGE_DAYS = 7
MIN_RECORDS = 10


def _parse_ts(value: str) -> datetime:
    text = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def verify(
    report_path: Path,
    *,
    root: Path | None = None,
    allowlist_path: Path | None = None,
    max_age_days: int = DEFAULT_MAX_AGE_DAYS,
    min_records: int = MIN_RECORDS,
    now: datetime | None = None,
) -> Report:
    out = Report("crawler-smoke-verify")
    if not report_path.is_file():
        out.fail(
            f"스모크 리포트가 없다: {report_path} — "
            "리포트 부재를 '검사할 것이 없음'으로 처리하지 않는다"
        )
        return out
    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        out.fail(f"스모크 리포트를 파싱할 수 없다: {exc}")
        return out
    if not isinstance(data, dict):
        out.fail("스모크 리포트가 객체가 아니다")
        return out

    source = str(data.get("source", ""))
    if not source:
        out.fail("리포트에 source 가 없다")
        return out
    out.note(f"source={source} crawl_run_id={data.get('crawl_run_id')}")

    records = int(data.get("records", -1))
    if records < min_records:
        out.fail(f"records={records} < 하한 {min_records}")
    else:
        out.note(f"records={records} ≥ {min_records}")

    mismatch = data.get("sha256_mismatch")
    if mismatch is None:
        out.fail("리포트에 sha256_mismatch 가 없다 — 필드 부재는 0 이 아니다")
    elif int(mismatch) != 0:
        out.fail(f"sha256_mismatch={mismatch} ≠ 0")
    else:
        out.note("sha256_mismatch=0")

    blocked = data.get("http_429_403")
    if blocked is None:
        out.fail("리포트에 http_429_403 이 없다 — 필드 부재는 0 이 아니다")
    elif int(blocked) != 0:
        out.fail(f"http_429_403={blocked} ≠ 0 — 차단 응답이 있었다")
    else:
        out.note("http_429_403=0")

    # 판정 기준은 allowlist 정본에서 다시 계산한다
    try:
        allowlist = load_allowlist(allowlist_path, root=root)
        policy = allowlist.get(source)
    except ConfigError as exc:
        out.fail(f"allowlist 를 읽을 수 없어 간격 기준을 세울 수 없다: {exc}")
        policy = None
    if policy is None:
        out.fail(f"allowlist 에 source={source} 가 없다 — 기준 없는 판정은 하지 않는다")
    elif not policy.approved:
        out.fail(
            f"source={source} 는 allowlist 에서 approved=false (verdict={policy.verdict}) — "
            "D3 가 금지·보류한 소스의 스모크 리포트는 통과시키지 않는다"
        )
    else:
        floor = policy.min_interval_sec
        observed = data.get("min_interval_sec")
        if observed is None:
            out.fail("리포트에 min_interval_sec 가 없다")
        elif float(observed) + 1e-6 < floor:
            out.fail(
                f"min_interval_sec={observed} < 정책값 {floor:.3f} "
                f"(60/{policy.max_requests_per_min})"
            )
        else:
            out.note(f"min_interval_sec={observed} ≥ 정책값 {floor:.3f}")

    generated_at = data.get("generated_at")
    if not generated_at:
        out.fail("리포트에 generated_at 이 없다 — 신선도를 판정할 수 없다")
    else:
        try:
            when = _parse_ts(str(generated_at))
        except ValueError as exc:
            out.fail(f"generated_at 파싱 실패: {generated_at!r} ({exc})")
        else:
            reference = now or datetime.now(UTC)
            age = reference - when
            if age > timedelta(days=max_age_days):
                out.fail(
                    f"generated_at={generated_at} 이 기준 시점 대비 {age.days}일 전이다 "
                    f"(허용 {max_age_days}일) — "
                    "오래된 리포트는 지금의 수집 가능 여부를 증명하지 않는다"
                )
            elif age < timedelta(seconds=-300):
                out.fail(f"generated_at={generated_at} 이 미래 시각이다 ({-age})")
            else:
                out.note(f"generated_at={generated_at} (경과 {age.days}일 ≤ {max_age_days}일)")

    escaped = int((data.get("worker") or {}).get("escaped_exceptions", 0))
    if escaped:
        out.fail(f"워커에서 격리되지 않은 예외 {escaped}건")
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m crawler.ci.smoke_verify")
    parser.add_argument("--report", default=DEFAULT_REPORT)
    parser.add_argument("--allowlist", default=None)
    parser.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE_DAYS)
    parser.add_argument("--min-records", type=int, default=MIN_RECORDS)
    args = parser.parse_args(argv)
    try:
        root = repo_root()
        report = verify(
            Path(args.report),
            root=root,
            allowlist_path=Path(args.allowlist) if args.allowlist else None,
            max_age_days=args.max_age_days,
            min_records=args.min_records,
        )
    except GuardError as exc:
        print(f"crawler-smoke-verify: 판정 불가 — {exc}", file=sys.stderr)
        return 1
    return report.emit()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
