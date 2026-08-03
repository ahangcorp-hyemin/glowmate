#!/usr/bin/env python3
"""위반 픽스처 — 트리 루트에서 실행되어 산출물을 제자리 변형한다.
검증기가 이 변형을 잡지 못하면 메타테스트가 red 다."""
import json, csv, io, os, re, sys

D = "docs/discovery/D1a"


HAIR = "일반미용업"
p = os.path.join(D, "frame.json")
meta = json.load(open(p, encoding="utf-8"))
meta["axis_sets"]["beauty_business_types"].append(HAIR)
for rule in meta["axis_decision_table"]:
    if rule["id"] == "R6":
        rule["when"]["business_type_any"].append(HAIR)
open(p, "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
