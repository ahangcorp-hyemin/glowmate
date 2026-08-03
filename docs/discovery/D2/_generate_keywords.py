#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""keyword_rule.md 의 기계 판독 블록으로부터 keywords.csv 를 재생성한다 (REQ-1).

    python docs/discovery/D2/_generate_keywords.py

산출물은 결정적이다 — 같은 규칙에서 같은 CSV 가 나온다. 검증기
(`validate_d2.py --check keywords`)는 CSV 를 다시 규칙에 대조하므로,
이 스크립트를 쓰지 않고 손으로 행을 끼워 넣으면 검사에서 잡힌다.
"""
from __future__ import annotations

import csv
import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
VALIDATOR = REPO / "scripts" / "discovery" / "validate_d2.py"


def load_validator():
    spec = importlib.util.spec_from_file_location("validate_d2", VALIDATOR)
    if spec is None or spec.loader is None:
        raise SystemExit(f"검증기를 로드할 수 없다: {VALIDATOR}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["validate_d2"] = mod
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    v = load_validator()
    rule = v.read_yaml_block(HERE / "keyword_rule.md", "template")
    template = rule["template"]
    regions = rule["regions"]
    axes = rule["axes"]
    needs = rule["needs"]
    intents = rule["intents"]
    groups = rule.get("axis_groups") or {}

    unknown = [r for r in regions if r not in v.REGION_DICT]
    if unknown:
        raise SystemExit(f"검증기 지역 사전 밖의 region: {unknown}")

    rows = []
    for region in regions:
        for axis in axes:
            for need in needs:
                for intent in intents:
                    rows.append(
                        {
                            "keyword": template.format(region=region, axis=axis, need=need, intent=intent),
                            "region": region,
                            "axis": axis,
                            "need": need,
                            "intent": intent,
                            "axis_group": groups.get(axis, ""),
                        }
                    )

    out = HERE / "keywords.csv"
    with out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["keyword", "region", "axis", "need", "intent", "axis_group"])
        w.writeheader()
        w.writerows(rows)
    print(f"{out} — {len(rows)}행 (regions {len(regions)} × axes {len(axes)} × needs {len(needs)} × intents {len(intents)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
