#!/usr/bin/env python3
"""docs/tasks/*.md 의 계약 블록을 파싱해 기계가 읽는 매니페스트를 만든다.

계약이 정본이고 매니페스트는 파생물이다. 손으로 고치지 말 것.
    python3 scripts/tasks_manifest.py            # docs/tasks.json 생성
    python3 scripts/tasks_manifest.py --check    # 정합성 검증만 (CI용, 비정상 시 exit 1)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASKS_DIR = ROOT / "docs" / "tasks"
OUT = ROOT / "docs" / "tasks.json"

# 계약 상단 ```yaml 블록에서 뽑는다. 전용 YAML 파서 없이 동작해야 하므로
# 필요한 스칼라/리스트 필드만 얕게 읽는다.
SCALAR = re.compile(r"^(id|title|workstream|owner_agent|pr_count):\s*(.+?)\s*$", re.M)
# 뒤에 `# 주석` 이 붙어도, 대괄호가 여러 줄에 걸쳐도 인식해야 한다.
# 여러 줄을 못 읽으면 필드가 통째로 빈 리스트가 되어 **위반이 조용히 통과한다** —
# 오탐보다 위험한 미탐이므로 DOTALL 로 읽되 최초 `]` 까지만 비탐욕 매칭한다.
LIST_INLINE = re.compile(
    r"^(traces_to|depends_on|blocks|parallel_with|gate):[ \t]*\[([^\]]*)\]", re.M
)
LIST_BLOCK = re.compile(
    r"^(traces_to|depends_on|blocks|parallel_with|gate):\s*\n((?:\s+-\s+.+\n)+)", re.M
)
# 폐기 판정은 "제목 줄" 또는 "상태 줄"에서만 한다.
# 개정 노트 본문의 "~ 자체 생성 폐기 → F6 의존" 같은 문구를 폐기로 오인하면 안 된다.
DEPRECATED_TITLE = re.compile(r"^#\s.*(폐기|DEPRECATED|SUPERSEDED)", re.I | re.M)
DEPRECATED_STATUS = re.compile(
    r"^>\s*(?:\*\*)?(?:상태|status)(?:\*\*)?\s*[:：].*?(폐기|DEPRECATED|SUPERSEDED)",
    re.I | re.M,
)


def parse(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    block = re.search(r"```yaml\n(.*?)```", text, re.S)
    if not block:
        return None
    body = block.group(1)

    task: dict = {"file": str(path.relative_to(ROOT))}
    for key, val in SCALAR.findall(body):
        task[key] = val.strip().strip('"').strip("'")

    for key, raw in LIST_INLINE.findall(body):
        items = [i.strip().strip('"').strip("'") for i in raw.split(",")]
        task[key] = [i for i in items if i and i.lower() not in ("null", "none")]
    for key, raw in LIST_BLOCK.findall(body):
        items = [
            ln.strip().lstrip("-").strip().strip('"').strip("'")
            for ln in raw.strip().splitlines()
        ]
        task[key] = [i for i in items if i]

    for key in ("traces_to", "depends_on", "blocks", "parallel_with", "gate"):
        task.setdefault(key, [])

    head = text[: text.find("```yaml")] if "```yaml" in text else text[:400]
    task["deprecated"] = bool(
        DEPRECATED_TITLE.search(head) or DEPRECATED_STATUS.search(head)
    )
    return task


def main() -> int:
    check_only = "--check" in sys.argv
    tasks = []
    for path in sorted(TASKS_DIR.glob("*.md")):
        parsed = parse(path)
        if parsed is None:
            print(f"  ! yaml 블록 없음: {path.name}", file=sys.stderr)
            continue
        tasks.append(parsed)

    by_id = {t["id"]: t for t in tasks if t.get("id")}
    live = {i for i, t in by_id.items() if not t["deprecated"]}
    problems: list[str] = []

    # 1) 미존재 ID 참조
    for tid, t in by_id.items():
        for field in ("depends_on", "blocks", "parallel_with"):
            for ref in t[field]:
                if ref not in by_id:
                    problems.append(f"{tid}.{field}: 미존재 ID '{ref}'")
                elif ref not in live and tid in live:
                    problems.append(f"{tid}.{field}: 폐기된 태스크 '{ref}' 참조")

    # 2) blocks ↔ depends_on 양방향 정합성 (감사 P5)
    #    폐기된 태스크는 양방향 요구에서 제외한다 — 폐기 태스크의 의존을 살아있는
    #    태스크의 blocks 에 채우면, 그 순간 다시 "폐기 태스크 참조" 위반이 된다.
    for tid, t in by_id.items():
        if tid not in live:
            continue
        for dep in t["depends_on"]:
            if dep in live and tid not in by_id[dep]["blocks"]:
                problems.append(f"{dep}.blocks 에 '{tid}' 누락 (역방향 불일치)")

    # 3) 순환 의존
    state: dict[str, int] = {}

    def walk(node: str, trail: list[str]) -> None:
        if state.get(node) == 2:
            return
        if state.get(node) == 1:
            problems.append("순환 의존: " + " → ".join(trail + [node]))
            return
        state[node] = 1
        for dep in by_id.get(node, {}).get("depends_on", []):
            if dep in by_id:
                walk(dep, trail + [node])
        state[node] = 2

    for tid in by_id:
        walk(tid, [])

    if not check_only:
        OUT.write_text(
            json.dumps(
                {"generated_from": "docs/tasks/*.md", "count": len(tasks), "tasks": tasks},
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"✓ {OUT.relative_to(ROOT)} — 계약 {len(tasks)}건 (유효 {len(live)}건)")

    if problems:
        print(f"\n✗ DAG 정합성 문제 {len(problems)}건", file=sys.stderr)
        for p in sorted(set(problems)):
            print(f"  - {p}", file=sys.stderr)
        return 1
    print("✓ DAG 정합성 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
