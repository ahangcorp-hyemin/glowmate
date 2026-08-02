#!/usr/bin/env python3
"""계약의 depends_on / blocks / parallel_with 에 쓰인 축약형 태스크 ID를 정본으로 바꾸고,
blocks ↔ depends_on 역방향 대칭을 채운다.

계약 파일의 yaml 블록 안, 해당 3개 필드만 건드린다. 요구사항·금지사항 본문은 손대지 않는다.
    python3 scripts/normalize_ids.py --dry-run
    python3 scripts/normalize_ids.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASKS = ROOT / "docs" / "tasks"
FIELDS = ("depends_on", "blocks", "parallel_with")


def canonical_ids() -> dict[str, str]:
    """계약 파일에서 정본 ID를 수집하고 축약형 → 정본 매핑을 만든다."""
    ids = set()
    for path in TASKS.glob("*.md"):
        m = re.search(r"^id:\s*(\S+)", path.read_text(encoding="utf-8"), re.M)
        if m:
            ids.add(m.group(1))
    mapping = {i: i for i in ids}
    for full in ids:
        short = full.split("-")[0]  # C4-PRICE-NORMALIZER -> C4
        if short in mapping and mapping[short] != full:
            raise SystemExit(f"축약형 '{short}' 가 2개 정본에 대응한다 — 수동 확인 필요")
        mapping[short] = full
    return mapping


def rewrite(text: str, mapping: dict[str, str]) -> tuple[str, int]:
    n = 0

    def fix_token(tok: str) -> str:
        nonlocal n
        t = tok.strip().strip('"').strip("'")
        if t and t in mapping and mapping[t] != t:
            n += 1
            return mapping[t]
        return t

    def inline(m: re.Match) -> str:
        key, body = m.group(1), m.group(2)
        if not body.strip():
            return m.group(0)
        items = [fix_token(x) for x in body.split(",") if x.strip()]
        return f"{key}:{' ' * max(1, 15 - len(key))}[{', '.join(items)}]"

    text = re.sub(
        rf"^({'|'.join(FIELDS)}):\s*\[(.*?)\]\s*$", inline, text, flags=re.M
    )

    def block(m: re.Match) -> str:
        key, body = m.group(1), m.group(2)
        lines = []
        for ln in body.rstrip("\n").split("\n"):
            stripped = ln.strip()
            if stripped.startswith("-"):
                indent = ln[: len(ln) - len(ln.lstrip())]
                lines.append(f"{indent}- {fix_token(stripped[1:])}")
            else:
                lines.append(ln)
        return f"{key}:\n" + "\n".join(lines) + "\n"

    text = re.sub(
        rf"^({'|'.join(FIELDS)}):\s*\n((?:[ \t]+-[ \t]+\S.*\n)+)", block, text, flags=re.M
    )
    return text, n


def fill_reverse_blocks(dry: bool) -> int:
    """X.depends_on 에 Y 가 있으면 Y.blocks 에 X 를 채운다 (순수 대칭, 판단 불필요)."""
    files = {}
    for path in TASKS.glob("*.md"):
        text = path.read_text(encoding="utf-8")
        m = re.search(r"^id:\s*(\S+)", text, re.M)
        if m:
            files[m.group(1)] = (path, text)

    needed: dict[str, set[str]] = {tid: set() for tid in files}
    for tid, (_, text) in files.items():
        for dep in re.findall(r"^depends_on:\s*\[(.*?)\]", text, re.M):
            for d in (x.strip() for x in dep.split(",")):
                if d in needed:
                    needed[d].add(tid)
        for blk in re.findall(r"^depends_on:\s*\n((?:[ \t]+-[ \t]+\S.*\n)+)", text, re.M):
            for ln in blk.strip().split("\n"):
                d = ln.strip().lstrip("-").strip()
                if d in needed:
                    needed[d].add(tid)

    added = 0
    for tid, want in needed.items():
        path, text = files[tid]
        cur = set()
        for raw in re.findall(r"^blocks:\s*\[(.*?)\]", text, re.M):
            cur |= {x.strip() for x in raw.split(",") if x.strip()}
        for raw in re.findall(r"^blocks:\s*\n((?:[ \t]+-[ \t]+\S.*\n)+)", text, re.M):
            cur |= {ln.strip().lstrip("-").strip() for ln in raw.strip().split("\n")}
        missing = sorted(want - cur)
        if not missing:
            continue
        added += len(missing)
        print(f"  {path.name}: blocks += {', '.join(missing)}")
        if dry:
            continue
        merged = ", ".join(sorted(cur | set(missing)))
        if re.search(r"^blocks:\s*\[", text, re.M):
            text = re.sub(r"^blocks:\s*\[.*?\]", f"blocks:        [{merged}]", text, count=1, flags=re.M)
        elif re.search(r"^blocks:\s*\n[ \t]+-", text, re.M):
            text = re.sub(
                r"^blocks:\s*\n(?:[ \t]+-[ \t]+\S.*\n)+",
                f"blocks:        [{merged}]\n", text, count=1, flags=re.M,
            )
        else:
            text = re.sub(r"^(depends_on:.*(?:\n[ \t]+-.*)*\n)", rf"\1blocks:        [{merged}]\n", text, count=1, flags=re.M)
        path.write_text(text, encoding="utf-8")
    return added


def main() -> int:
    dry = "--dry-run" in sys.argv
    mapping = canonical_ids()
    total = 0
    for path in sorted(TASKS.glob("*.md")):
        original = path.read_text(encoding="utf-8")
        updated, n = rewrite(original, mapping)
        if n:
            total += n
            print(f"  {path.name}: {n}건")
            if not dry:
                path.write_text(updated, encoding="utf-8")
    print(f"\n{'(dry-run) ' if dry else ''}축약형 → 정본 치환 {total}건")
    print("\n역방향 blocks 대칭:")
    print(f"{'(dry-run) ' if dry else ''}추가 {fill_reverse_blocks(dry)}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
