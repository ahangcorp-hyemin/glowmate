#!/usr/bin/env python3
"""위반 픽스처 — 트리 루트에서 실행되어 산출물을 제자리 변형한다.
검증기가 이 변형을 잡지 못하면 메타테스트가 red 다."""
import json, csv, io, os, re, sys

D = "docs/discovery/D1a"


BAD = "예약연동 == 'Y'"

p = os.path.join(D, "frame.json")
meta = json.load(open(p, encoding="utf-8"))
meta["filter_expressions"].append(BAD)
open(p, "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")

# frame_build.md 의 필터 전문 블록도 같이 고친다 — 블록 불일치가 아니라
# "금지 속성 토큰"으로 red 가 나야 탐지력이 입증된다.
q = os.path.join(D, "frame_build.md")
t = open(q, encoding="utf-8").read()
t = t.replace("axis_of(slug, license_category, business_type, medical_subjects) is not None\n```",
              "axis_of(slug, license_category, business_type, medical_subjects) is not None\n"
              + BAD + "\n```")
open(q, "w", encoding="utf-8").write(t)
