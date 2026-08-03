#!/usr/bin/env python3
"""위반 픽스처 — 트리 루트에서 실행되어 산출물을 제자리 변형한다.
검증기가 이 변형을 잡지 못하면 메타테스트가 red 다."""
import json, csv, io, os, re, sys

D = "docs/discovery/D1a"


p = os.path.join(D, "population.csv")
rows = list(csv.DictReader(open(p, encoding="utf-8")))
cols = list(rows[0].keys())
rows[0]["phone"] = "010-1234-5678"
with open(p, "w", encoding="utf-8", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=cols, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
