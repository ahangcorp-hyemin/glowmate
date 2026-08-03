#!/usr/bin/env python3
"""위반 픽스처 — 트리 루트에서 실행되어 산출물을 제자리 변형한다.
검증기가 이 변형을 잡지 못하면 메타테스트가 red 다."""
import json, csv, io, os, re, sys

D = "docs/discovery/D1a"


p = os.path.join(D, "protocol.md")
t = open(p, encoding="utf-8").read()
t = t.replace('"proceed_threshold": 0.4', '"proceed_threshold": 0.35', 1)
open(p, "w", encoding="utf-8").write(t)
