#!/usr/bin/env python3
"""위반 픽스처 — 트리 루트에서 실행되어 산출물을 제자리 변형한다.
검증기가 이 변형을 잡지 못하면 메타테스트가 red 다."""
import json, csv, io, os, re, sys

D = "docs/discovery/D1a"


p = os.path.join(D, "frame.json")
meta = json.load(open(p, encoding="utf-8"))
meta["axis_sets"]["medical_subjects"] = [s for s in meta["axis_sets"]["medical_subjects"]
                                         if s != "피부과"]
for rule in meta["axis_decision_table"]:
    subs = rule["when"].get("medical_subjects_any")
    if subs:
        rule["when"]["medical_subjects_any"] = [s for s in subs if s != "피부과"]
open(p, "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
