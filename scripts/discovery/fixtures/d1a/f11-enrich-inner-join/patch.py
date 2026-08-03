#!/usr/bin/env python3
"""위반 픽스처 — 트리 루트에서 실행되어 산출물을 제자리 변형한다.
검증기가 이 변형을 잡지 못하면 메타테스트가 red 다."""
import json, csv, io, os, re, sys

D = "docs/discovery/D1a"


p = os.path.join(D, "population.csv")
rows = list(csv.DictReader(open(p, encoding="utf-8")))
cols = list(rows[0].keys())
kept = [r for r in rows
        if r["axis"] != "medical_wellness" or r["enrich_match"] == "matched"]
with open(p, "w", encoding="utf-8", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=cols, lineterminator="\n")
    w.writeheader()
    w.writerows(kept)

q = os.path.join(D, "frame.json")
meta = json.load(open(q, encoding="utf-8"))
axes = {}
for r in kept:
    axes[r["axis"]] = axes.get(r["axis"], 0) + 1
meta["row_counts"]["by_axis"] = axes
meta["row_counts"]["total"] = len(kept)
st = meta["enrichment"]["stats"]
st["no_match"] = sum(1 for r in kept if r["enrich_match"] == "no_match")
st["ambiguous"] = sum(1 for r in kept if r["enrich_match"] == "ambiguous")
st["matched"] = sum(1 for r in kept if r["enrich_match"] == "matched")
open(q, "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
