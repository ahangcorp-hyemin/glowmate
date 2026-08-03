"""REQ-6 집행기 — adapter_contract_suite 가 정확히 15건 통과하고 skip 이 0건인지 확인한다.

계약 acceptance 문면: "`pytest services/crawler/tests/core/test_adapter_contract.py` —
passed=15, skipped=0". `pytest` 의 종료 코드만 보면 **케이스를 8개로 줄여도 초록**이므로,
건수를 따로 센다.

`--collect-only` 로 노드 수를 세고, 실행 결과의 outcome 을 파싱해 두 값을 모두 판정한다.
어느 한쪽이라도 얻지 못하면 exit 1 이다 (판정 불가는 통과가 아니다).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from ..adapter_contract_suite import CONTRACT_CASE_COUNT
from ..d3 import repo_root
from ._common import Report

TEST_FILE = "tests/core/test_adapter_contract.py"


def _run_pytest(crawler_root: Path, extra: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "pytest", TEST_FILE, "-q", "--no-header", *extra],
        cwd=crawler_root,
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )


def _parse_summary(stdout: str) -> dict[str, int]:
    """`3 passed, 1 skipped in 0.1s` 형태의 마지막 요약 줄을 파싱한다."""
    counts: dict[str, int] = {}
    for line in reversed(stdout.splitlines()):
        stripped = line.strip().strip("=").strip()
        if " in " not in stripped:
            continue
        head = stripped.rsplit(" in ", 1)[0]
        parsed: dict[str, int] = {}
        for chunk in head.split(","):
            parts = chunk.strip().split()
            if len(parts) == 2 and parts[0].isdigit():
                parsed[parts[1]] = int(parts[0])
        if parsed:
            counts = parsed
            break
    return counts


def check(crawler_root: Path, expected: int = CONTRACT_CASE_COUNT) -> Report:
    report = Report("adapter-contract-count")

    collected = _run_pytest(crawler_root, ["--collect-only"])
    if collected.returncode != 0:
        report.fail(
            f"계약 스위트 수집에 실패했다 (exit={collected.returncode})\n"
            f"{collected.stdout[-2000:]}\n{collected.stderr[-2000:]}"
        )
        return report
    node_ids = [line.strip() for line in collected.stdout.splitlines() if "::" in line]
    if len(node_ids) != expected:
        report.fail(
            f"수집된 계약 케이스가 {len(node_ids)}건이다 — {expected}건이어야 한다. "
            "케이스를 줄이는 것은 검사 대상 축소다.\n  " + "\n  ".join(node_ids)
        )
    else:
        report.note(f"수집 노드 {len(node_ids)}건 == CONTRACT_CASE_COUNT({expected})")

    result = _run_pytest(crawler_root, [])
    counts = _parse_summary(result.stdout)
    if not counts:
        report.fail(
            "pytest 요약을 파싱하지 못했다 — 판정 불가를 통과로 처리하지 않는다\n"
            f"{result.stdout[-2000:]}"
        )
        return report
    report.note(f"pytest 요약: {json.dumps(counts, sort_keys=True)}")

    if result.returncode != 0:
        report.fail(f"계약 스위트가 실패했다 (exit={result.returncode})\n{result.stdout[-3000:]}")
    if counts.get("passed", 0) != expected:
        report.fail(f"passed={counts.get('passed', 0)} — {expected} 이어야 한다")
    if counts.get("skipped", 0) != 0:
        report.fail(
            f"skipped={counts['skipped']} — 0 이어야 한다. "
            "skip 은 '통과'가 아니라 '검사하지 않음'이다"
        )
    for bad in ("failed", "error", "errors", "xfailed", "xpassed", "deselected"):
        if counts.get(bad):
            report.fail(f"{bad}={counts[bad]} — 0 이어야 한다")
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m crawler.ci.contract_count")
    parser.add_argument("--expected", type=int, default=CONTRACT_CASE_COUNT)
    args = parser.parse_args(argv)
    crawler_root = repo_root() / "services" / "crawler"
    return check(crawler_root, args.expected).emit()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
