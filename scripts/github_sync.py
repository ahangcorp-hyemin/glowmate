#!/usr/bin/env python3
"""docs/tasks.json → GitHub Issues 동기화 (계약이 정본, 이슈는 파생물).

멱등이다. 여러 번 돌려도 이슈가 중복 생성되지 않는다 — 제목의 `[TASK-ID]` 접두로 기존 이슈를 찾는다.

    python3 scripts/github_sync.py --dry-run   # 무엇이 생성/갱신될지만 출력
    python3 scripts/github_sync.py             # 실제 동기화
    python3 scripts/github_sync.py --ready     # 착수 가능한 태스크만 출력

의존관계는 depends_on 만 --add-blocked-by 로 넣는다. blocks 는 그 역방향이므로
GitHub이 자동으로 양방향 표시한다 (중복 입력 금지).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "docs" / "tasks.json"
BODY_LIMIT = 60000  # GitHub 이슈 본문 상한 여유분

# 보드에 담을 Projects v2 (owner/number). `project` 스코프가 없으면 조용히 건너뛴다.
PROJECT_OWNER = "ahangcorp-hyemin"
PROJECT_NUMBER = "1"


def gh(*args: str, check: bool = True) -> str:
    r = subprocess.run(["gh", *args], capture_output=True, text=True, cwd=ROOT)
    if check and r.returncode != 0:
        raise SystemExit(f"gh {' '.join(args)}\n{r.stderr.strip()}")
    return r.stdout.strip()


def existing_issues() -> dict[str, int]:
    """제목의 [TASK-ID] 접두로 기존 이슈를 찾는다."""
    raw = gh("issue", "list", "--state", "all", "--limit", "300", "--json", "number,title")
    found = {}
    for issue in json.loads(raw or "[]"):
        m = re.match(r"\[([A-Za-z0-9-]+)\]", issue["title"])
        if m:
            found[m.group(1)] = issue["number"]
    return found


def ready_queue() -> None:
    """열린 이슈 중 자신을 막는 열린 이슈가 없는 것 = 착수 가능.

    GitHub 의 `is:blocked` 검색 필터는 실제 관계와 어긋나므로(실사 §1.3) 쓰지 않는다.
    blockedBy 필드를 직접 읽는 이 경로만 신뢰한다.
    """
    raw = gh("issue", "list", "--state", "open", "--limit", "300",
             "--json", "number,title,blockedBy")
    rows = [
        i for i in json.loads(raw or "[]")
        if not [n for n in (i.get("blockedBy") or {}).get("nodes", []) if n.get("state") == "OPEN"]
    ]
    if not rows:
        print("착수 가능한 태스크 없음 (전부 선행 대기 중이거나 이슈가 없음)")
        return
    print(f"착수 가능 {len(rows)}건:")
    for i in sorted(rows, key=lambda x: x["number"]):
        print(f"  #{i['number']}  {i['title']}")


def main() -> int:
    if "--ready" in sys.argv:
        ready_queue()
        return 0

    dry = "--dry-run" in sys.argv
    if not MANIFEST.exists():
        raise SystemExit("docs/tasks.json 이 없다. 먼저 scripts/tasks_manifest.py 를 실행하라.")

    tasks = [t for t in json.loads(MANIFEST.read_text())["tasks"] if not t["deprecated"]]
    mapping = {} if dry else existing_issues()

    # ── Pass 1: 이슈 생성/갱신 ──────────────────────────────
    created = updated = 0
    for t in tasks:
        title = f"[{t['id']}] {t.get('title', '')}".strip()
        body = (
            f"> 계약 정본: `{t['file']}` — **이슈가 아니라 계약 파일이 정본이다.**\n"
            f"> 내용 변경은 계약 파일에서 하고 `scripts/github_sync.py` 로 반영한다.\n\n"
            f"| | |\n|---|---|\n"
            f"| workstream | `{t.get('workstream', '-')}` |\n"
            f"| 담당 에이전트 | `{t.get('owner_agent', 'dev-executor')}` |\n"
            f"| 게이트 | {', '.join(t['gate']) or '없음'} |\n"
            f"| 가설 | {', '.join(t['traces_to']) or '-'} |\n\n"
            f"---\n\n{Path(ROOT / t['file']).read_text(encoding='utf-8')[:BODY_LIMIT]}"
        )
        if t["id"] in mapping:
            updated += 1
            if not dry:
                gh("issue", "edit", str(mapping[t["id"]]), "--title", title, "--body", body)
            print(f"  ↻ #{mapping[t['id']]:>3} {t['id']}")
        else:
            created += 1
            if dry:
                print(f"  + (신규) {t['id']} — {t.get('title', '')}")
                continue
            url = gh("issue", "create", "--title", title, "--body", body,
                     "--label", t.get("workstream", ""))
            mapping[t["id"]] = int(url.rsplit("/", 1)[-1])
            print(f"  + #{mapping[t['id']]:>3} {t['id']}")

    print(f"\n이슈: 생성 {created} · 갱신 {updated}")
    if dry:
        print("(dry-run — 의존관계는 이슈 생성 후에만 걸 수 있어 생략)")
        return 0

    # ── Pass 2: 의존관계 (양쪽 이슈가 존재해야 걸 수 있다) ──
    linked = 0
    for t in tasks:
        deps = [str(mapping[d]) for d in t["depends_on"] if d in mapping]
        if not deps:
            continue
        gh("issue", "edit", str(mapping[t["id"]]), "--add-blocked-by", ",".join(deps))
        linked += 1
        print(f"  #{mapping[t['id']]:>3} {t['id']} ← blocked by {', '.join('#' + d for d in deps)}")

    print(f"\n의존관계 {linked}건 반영 완료")

    # ── Pass 3: 보드에 담기 (project 스코프 없으면 건너뜀) ──
    probe = subprocess.run(
        ["gh", "project", "view", PROJECT_NUMBER, "--owner", PROJECT_OWNER],
        capture_output=True, text=True, cwd=ROOT,
    )
    if probe.returncode != 0:
        print("\n보드 담기 생략 — `gh auth refresh -h github.com -s project` 후 재실행하면 반영된다")
    else:
        repo = gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner")
        for tid, num in sorted(mapping.items(), key=lambda x: x[1]):
            subprocess.run(
                ["gh", "project", "item-add", PROJECT_NUMBER, "--owner", PROJECT_OWNER,
                 "--url", f"https://github.com/{repo}/issues/{num}"],
                capture_output=True, text=True, cwd=ROOT,
            )
        print(f"보드({PROJECT_OWNER}/projects/{PROJECT_NUMBER})에 {len(mapping)}건 담기 완료")

    print("\n착수 가능 태스크 확인: python3 scripts/github_sync.py --ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
