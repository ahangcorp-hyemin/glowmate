"""어댑터 공용 CI 가드 3종(path-guard · dataset-lock · dataset-order)의 단위 검증.

계약 done_when: "공용 CI 가드 잡 5종이 `services/crawler/adapters/*` 글롭으로 동작함을
더미 어댑터 PR로 1회 확인 — C2·C3 및 파생 어댑터 태스크가
워크플로 파일을 수정할 필요가 없어야 한다."

C1 의 touches 에 `services/crawler/adapters/**` 가 없어 더미 어댑터를 커밋할 수 없으므로,
여기서는 **더미 어댑터가 있는 diff 목록·트리를 구성해** 세 검사가 글롭만으로 동작함을 확인한다.
"""

from __future__ import annotations

import hashlib
import json
import subprocess

import pytest

from _helpers import REPO_ROOT
from crawler.ci._common import ADAPTERS_DIR, GuardError, Report, adapter_ids_in, pr_labels
from crawler.ci.adapter_guards import (
    DATASET_LABEL,
    check_adapter_paths,
    check_dataset_lock,
    check_dataset_order,
)

SID = "naver_place"
OTHER = "kakao_map"


def _diff(*paths: str) -> list[str]:
    return list(paths)


def test_adapter_ids_are_detected_by_glob() -> None:
    files = _diff(
        f"{ADAPTERS_DIR}/{SID}/adapter.py",
        f"{ADAPTERS_DIR}/{OTHER}/extract.py",
        "services/crawler/core/crawler/worker.py",
    )
    assert adapter_ids_in(files) == sorted([SID, OTHER])
    assert adapter_ids_in(["docs/tasks/C2.md"]) == []


def test_path_guard_passes_for_confined_adapter_diff() -> None:
    report = Report("path-guard")
    check_adapter_paths(
        report,
        REPO_ROOT,
        _diff(
            f"{ADAPTERS_DIR}/{SID}/adapter.py",
            f"{ADAPTERS_DIR}/{SID}/extract_price.py",
            f"services/crawler/tests/adapters/{SID}/test_extract.py",
            f"services/crawler/tests/fixtures/adapters/{SID}/page.html",
            ".github/pr-task",
        ),
    )
    assert report.failures == [], report.failures


def test_path_guard_blocks_core_edit_from_adapter_pr() -> None:
    report = Report("path-guard")
    check_adapter_paths(
        report,
        REPO_ROOT,
        _diff(
            f"{ADAPTERS_DIR}/{SID}/adapter.py",
            "services/crawler/core/crawler/registry.py",
        ),
    )
    assert any("공용 경로를 변경했다" in f for f in report.failures), report.failures


def test_path_guard_blocks_pyproject_edit_from_adapter_pr() -> None:
    report = Report("path-guard")
    check_adapter_paths(
        report,
        REPO_ROOT,
        _diff(f"{ADAPTERS_DIR}/{SID}/adapter.py", "services/crawler/pyproject.toml"),
    )
    assert any("공용 경로를 변경했다" in f for f in report.failures), report.failures


def test_path_guard_blocks_d3_edit_from_adapter_pr() -> None:
    report = Report("path-guard")
    check_adapter_paths(
        report,
        REPO_ROOT,
        _diff(f"{ADAPTERS_DIR}/{SID}/adapter.py", "docs/discovery/D3/verdicts.csv"),
    )
    assert any("공용 경로를 변경했다" in f for f in report.failures), report.failures


def test_path_guard_blocks_other_adapter_edit() -> None:
    report = Report("path-guard")
    check_adapter_paths(
        report,
        REPO_ROOT,
        _diff(f"{ADAPTERS_DIR}/{SID}/adapter.py", f"services/crawler/tests/adapters/{OTHER}/x.py"),
    )
    assert any("자기 경로 밖" in f for f in report.failures), report.failures


def test_path_guard_reports_zero_target_explicitly() -> None:
    """대상 0건을 조용히 통과시키지 않고 출력에 남긴다."""
    report = Report("path-guard")
    check_adapter_paths(report, REPO_ROOT, _diff("docs/tasks/C1.md"))
    assert report.failures == []
    assert any("검사 대상 0건" in note for note in report.notes), report.notes


# ── dataset-lock ─────────────────────────────────────────────────────────────


def _adapter_tree(tmp_path, sid: str, manifest: dict, lock_value: str | None = None):
    root = tmp_path / "repo"
    adir = root / ADAPTERS_DIR / sid
    adir.mkdir(parents=True)
    payload = json.dumps(manifest, ensure_ascii=False, sort_keys=True)
    (adir / "dataset_manifest.json").write_text(payload, encoding="utf-8")
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    (adir / "manifest.lock").write_text((lock_value or digest) + "\n", encoding="utf-8")
    return root


def test_dataset_lock_passes_when_hash_matches(tmp_path, monkeypatch) -> None:
    root = _adapter_tree(tmp_path, SID, {"seed": 42, "strata": {"강남구": 20}})
    monkeypatch.setenv("GLOWMATE_PR_LABELS", DATASET_LABEL)
    report = Report("dataset-lock")
    check_dataset_lock(report, root, _diff(f"{ADAPTERS_DIR}/{SID}/dataset_manifest.json"))
    assert report.failures == [], report.failures


def test_dataset_lock_detects_hash_mismatch(tmp_path, monkeypatch) -> None:
    root = _adapter_tree(tmp_path, SID, {"seed": 42}, lock_value="0" * 64)
    monkeypatch.setenv("GLOWMATE_PR_LABELS", DATASET_LABEL)
    report = Report("dataset-lock")
    check_dataset_lock(report, root, _diff(f"{ADAPTERS_DIR}/{SID}/dataset_manifest.json"))
    assert any("manifest.lock" in f for f in report.failures), report.failures


def test_dataset_lock_requires_label(tmp_path, monkeypatch) -> None:
    root = _adapter_tree(tmp_path, SID, {"seed": 42})
    monkeypatch.setenv("GLOWMATE_PR_LABELS", "")
    report = Report("dataset-lock")
    check_dataset_lock(report, root, _diff(f"{ADAPTERS_DIR}/{SID}/dataset_manifest.json"))
    assert any(DATASET_LABEL in f for f in report.failures), report.failures


def test_dataset_lock_detects_half_present_pair(tmp_path, monkeypatch) -> None:
    root = _adapter_tree(tmp_path, SID, {"seed": 42})
    (root / ADAPTERS_DIR / SID / "manifest.lock").unlink()
    monkeypatch.setenv("GLOWMATE_PR_LABELS", DATASET_LABEL)
    report = Report("dataset-lock")
    check_dataset_lock(report, root, _diff(f"{ADAPTERS_DIR}/{SID}/dataset_manifest.json"))
    assert any("하나만 있다" in f for f in report.failures), report.failures


def test_labels_are_fail_closed(monkeypatch) -> None:
    """라벨 조회 실패를 면제로 처리하지 않는다."""
    monkeypatch.delenv("GLOWMATE_PR_LABELS", raising=False)
    monkeypatch.delenv("GITHUB_EVENT_PATH", raising=False)
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *a, **k: subprocess.CompletedProcess(a, 1, "", "gh not available"),
    )
    with pytest.raises(GuardError, match="라벨을 조회할 수 없다"):
        pr_labels(REPO_ROOT)


def test_labels_from_github_event(tmp_path, monkeypatch) -> None:
    event = tmp_path / "event.json"
    event.write_text(
        json.dumps({"pull_request": {"labels": [{"name": DATASET_LABEL}]}}), encoding="utf-8"
    )
    monkeypatch.delenv("GLOWMATE_PR_LABELS", raising=False)
    monkeypatch.setenv("GITHUB_EVENT_PATH", str(event))
    labels = pr_labels(REPO_ROOT)
    assert labels.has(DATASET_LABEL)
    assert labels.origin == "GITHUB_EVENT_PATH"


# ── dataset-order ────────────────────────────────────────────────────────────


def test_dataset_order_no_adapters_is_explicit(tmp_path) -> None:
    root = tmp_path / "repo"
    (root / ".git").mkdir(parents=True)
    report = Report("dataset-order")
    check_dataset_order(report, root)
    assert report.failures == []
    assert any("어댑터 디렉터리 0개" in note for note in report.notes), report.notes


def test_dataset_order_detects_late_lock(tmp_path) -> None:
    """manifest.lock 이 extract*.py 보다 늦게 커밋되면 실패한다."""
    root = tmp_path / "repo"
    adir = root / ADAPTERS_DIR / SID
    adir.mkdir(parents=True)
    subprocess.run(["git", "init", "-q"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.email", "t@example.com"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=root, check=True)

    (adir / "extract_price.py").write_text("VALUE = 1\n", encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=root, check=True)
    subprocess.run(
        ["git", "commit", "-q", "-m", "extract first"],
        cwd=root,
        check=True,
        env={
            "PATH": "/usr/bin:/bin:/usr/local/bin",
            "GIT_AUTHOR_DATE": "2026-08-01T00:00:00Z",
            "GIT_COMMITTER_DATE": "2026-08-01T00:00:00Z",
            "HOME": str(root),
        },
    )
    (adir / "dataset_manifest.json").write_text("{}", encoding="utf-8")
    (adir / "manifest.lock").write_text(
        hashlib.sha256(b"{}").hexdigest() + "\n", encoding="utf-8"
    )
    subprocess.run(["git", "add", "-A"], cwd=root, check=True)
    subprocess.run(
        ["git", "commit", "-q", "-m", "lock later"],
        cwd=root,
        check=True,
        env={
            "PATH": "/usr/bin:/bin:/usr/local/bin",
            "GIT_AUTHOR_DATE": "2026-08-02T00:00:00Z",
            "GIT_COMMITTER_DATE": "2026-08-02T00:00:00Z",
            "HOME": str(root),
        },
    )

    report = Report("dataset-order")
    check_dataset_order(report, root)
    assert any("보다 늦다" in f for f in report.failures), report.failures
