#!/usr/bin/env python3
"""위반 픽스처 — 트리 루트에서 실행되어 산출물을 제자리 변형한다.
검증기가 이 변형을 잡지 못하면 메타테스트가 red 다."""
import json, csv, io, os, re, sys

D = "docs/discovery/D1a"


p = os.path.join(D, "definition_examples", "examples.json")
ex = json.load(open(p, encoding="utf-8"))
target = [e for e in ex if e["expected_price_found"]][0]
snap = os.path.join(D, "definition_examples", target["snapshot_path"])
os.remove(snap)
