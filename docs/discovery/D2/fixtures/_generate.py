#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""D2 검증기 메타테스트 픽스처 생성기.

    python docs/discovery/D2/fixtures/_generate.py

산출물은 `docs/discovery/D2/fixtures/<case>/` 에 커밋된다. 생성기를 커밋하는 이유는
픽스처를 손으로 고쳐 "위반인데 통과" 상태를 만들 수 없게 하기 위해서다 —
재생성하면 diff 가 난다.

**이 데이터는 합성이다.** SERP 실측 데이터가 아니며 G2 판정에 쓰이지 않는다.
용도는 하나다: `validate_d2.py` 가 FORBID-1~6 위반을 **실제로 잡는지** 입증하는 것.
정상 픽스처 `00-valid` 가 exit 0 을 내는 것도 함께 입증한다 — 전부 실패시키는
검사기는 위반과 정상을 구분하지 못하므로 검사기가 아니다 (원칙 2.5).
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
D2 = HERE.parent
REPO = D2.parents[2]
VALIDATOR = REPO / "scripts" / "discovery" / "validate_d2.py"

# 저엔트로피 문자열을 쓴다 — 실비밀이 아니고, secret-scan(gitleaks) 오탐도 피한다.
CONTROL_KEY = "fixturekey"
MEASURED_N = 12          # K-2 자격 키워드 수
NAVER_BLOCKED_N = 2      # 그중 네이버에서 차단된 수
GOOGLE_ENTERABLE_N = 7
NAVER_ENTERABLE_N = 4


def load_validator():
    spec = importlib.util.spec_from_file_location("validate_d2", VALIDATOR)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["validate_d2"] = mod
    spec.loader.exec_module(mod)
    return mod


V = load_validator()

# ── 합성 SERP 구성 ──────────────────────────────────────────────────────────
# ENTERABLE: 대형 플랫폼 제외 후 독립 도메인 6개, 그중 UGC 4개 → ratio 0.667 ≥ 0.5
ENTERABLE_URLS = [
    "https://blog.naver.com/fixture_a/1001",
    "https://cafe.naver.com/fixture_b/1002",
    "https://gall.dcinside.com/board/lists/1003",
    "https://www.82cook.com/bbs/1004",
    "https://www.clien.net/community/1005",
    "https://ryoenjoy.com/room/1006",
    "https://blog.naver.com/fixture_a/1007",
    "https://namu.wiki/w/1008",
    "https://www.instiz.net/pt/1009",
    "https://www.woondoc.com/clinic/1010",
]
# HARD: 독립 도메인 3개인데 전부 업체 홈페이지 → ugc_ratio 0.0
HARD_URLS = [
    "https://blog.naver.com/fixture_c/2001",
    "https://cafe.naver.com/fixture_d/2002",
    "https://m.place.naver.com/place/2003",
    "https://bigstudio1.co.kr/price/2004",
    "https://bigstudio2.co.kr/price/2005",
    "https://bigstudio3.com/price/2006",
    "https://www.youtube.com/watch/2007",
    "https://www.instagram.com/p/2008",
    "https://blog.naver.com/fixture_c/2009",
    "https://fixture.tistory.com/2010",
]

LOGIN_MARKER_SNIPPET = (
    '<div id="gbw"><a href="https://accounts.google.com/SignOutOptions?hl=ko">'
    "로그아웃 옵션</a></div>"
)


def keyword_hash(keyword: str) -> str:
    return hashlib.sha256(keyword.encode("utf-8")).hexdigest()[:16]


def snapshot_html(keyword: str, engine: str, urls: list[str], *, login_marker: bool = False) -> str:
    chrome = "https://search.naver.com/search.naver?query=x" if engine == "naver" else "https://www.google.com/preferences"
    items = "\n".join(f'    <li><a href="{u}">결과 {i + 1}</a></li>' for i, u in enumerate(urls))
    return (
        "<!doctype html>\n"
        '<html lang="ko"><head><meta charset="utf-8">'
        f"<title>{keyword} : {engine} (합성 픽스처)</title></head>\n"
        "<body>\n"
        f'  <nav><a href="{chrome}">검색</a></nav>\n'
        + (f"  {LOGIN_MARKER_SNIPPET}\n" if login_marker else "")
        + "  <ol id=\"results\">\n"
        + items
        + "\n  </ol>\n</body></html>\n"
    )


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


# ══════════════════════════════════════════════════════════════════════════════
# 00-valid — 정상 트리
# ══════════════════════════════════════════════════════════════════════════════

METRICS_COLS = [
    "keyword", "google_volume", "naver_volume",
    "google_source_tool", "naver_source_tool", "measured_on", "status",
]
SERP_COLS = [
    "keyword", "engine", "rank", "url", "domain",
    "snapshot_path", "snapshot_sha256", "captured_on", "capture_mode", "collection_note",
]
LABEL_COLS = ["keyword", "engine", "label", "independent_domains", "ugc_ratio", "status"]
LOG_COLS = ["keyword", "engine", "attempted_at", "http_status", "status", "evidence_path", "note"]


def build_valid(dest: Path) -> dict:
    d2 = dest / "D2"
    d2.mkdir(parents=True, exist_ok=True)

    # 규칙 문서·키워드는 실제 산출물을 그대로 쓴다 (REQ-1 검사가 동일하게 통과해야 한다)
    shutil.copy2(D2 / "keyword_rule.md", d2 / "keyword_rule.md")
    shutil.copy2(D2 / "keywords.csv", d2 / "keywords.csv")
    shutil.copy2(D2 / "difficulty_rule.md", d2 / "difficulty_rule.md")

    with (D2 / "keywords.csv").open(encoding="utf-8", newline="") as fh:
        keywords = [r["keyword"] for r in csv.DictReader(fh)]

    measured = keywords[:MEASURED_N]
    low_volume = keywords[MEASURED_N : MEASURED_N + 3]
    control_pool = keywords[500:520]

    # ── keyword_metrics.csv ────────────────────────────────────────────
    metrics_rows = []
    for kw in keywords:
        if kw in measured:
            metrics_rows.append(dict(zip(METRICS_COLS, [kw, "20", "30", "google_keyword_planner", "naver_searchad_keywordtool", "2026-08-03", "ok"])))
        elif kw in low_volume:
            metrics_rows.append(dict(zip(METRICS_COLS, [kw, "6", "6", "google_keyword_planner", "naver_searchad_keywordtool", "2026-08-03", "ok"])))
        else:
            metrics_rows.append(dict(zip(METRICS_COLS, [kw, "", "", "google_keyword_planner", "naver_searchad_keywordtool", "", "no_volume_data"])))
    write_csv(d2 / "keyword_metrics.csv", METRICS_COLS, metrics_rows)

    naver_blocked = set(measured[-NAVER_BLOCKED_N:])

    rule = V.DifficultyRule(V.read_yaml_block(d2 / "difficulty_rule.md", "min_independent_domains"))

    serp_rows: dict[str, list[dict]] = {"google": [], "naver": []}
    label_rows: list[dict] = []
    enterable_sets: dict[str, set[str]] = {"google": set(), "naver": set()}

    for engine in ("google", "naver"):
        want_enterable = GOOGLE_ENTERABLE_N if engine == "google" else NAVER_ENTERABLE_N
        made = 0
        for kw in measured:
            if engine == "naver" and kw in naver_blocked:
                label_rows.append(dict(zip(LABEL_COLS, [kw, engine, "blocked", "0", "0.0000", "blocked"])))
                continue
            urls = ENTERABLE_URLS if made < want_enterable else HARD_URLS
            made += 1
            khash = keyword_hash(kw)
            rel = f"snapshots/{engine}/{khash}.html"
            html = snapshot_html(kw, engine, urls)
            write(d2 / rel, html)
            sha = V.sha256_file(d2 / rel)
            parsed = V.parse_snapshot_results(html, engine, limit=10)
            for i, (host, url) in enumerate(parsed, start=1):
                serp_rows[engine].append(
                    dict(zip(SERP_COLS, [kw, engine, str(i), url, host, rel, sha, "2026-08-03", "clean_profile", ""]))
                )
            n, ratio, label = rule.evaluate([{"rank": str(i), "url": u} for i, (_, u) in enumerate(parsed, 1)])
            label_rows.append(dict(zip(LABEL_COLS, [kw, engine, label, str(n), f"{ratio:.4f}", "ok"])))
            if label == "enterable":
                enterable_sets[engine].add(kw)
        write_csv(d2 / f"serp_{engine}.csv", SERP_COLS, serp_rows[engine])

    # 검색량 하한 미달 키워드도 라벨 대상이다 (no_volume_data 로 분자·분모에서 빠진다)
    for kw in low_volume:
        for engine in ("google", "naver"):
            label_rows.append(dict(zip(LABEL_COLS, [kw, engine, "no_volume_data", "0", "0.0000", "no_volume_data"])))
    write_csv(d2 / "labels.csv", LABEL_COLS, label_rows)

    # ── collection_log.csv ─────────────────────────────────────────────
    log_rows = []
    for kw in measured:
        for engine in ("google", "naver"):
            if engine == "naver" and kw in naver_blocked:
                log_rows.append(dict(zip(LOG_COLS, [kw, engine, "2026-08-03T01:00:00Z", "429", "blocked", "", "rate limited · 재시도하지 않음"])))
            else:
                log_rows.append(dict(zip(LOG_COLS, [kw, engine, "2026-08-03T01:00:00Z", "200", "ok", "", ""])))
    write_csv(d2 / "collection_log.csv", LOG_COLS, log_rows)

    # ── control_set.enc ────────────────────────────────────────────────
    control_lines = ["keyword,engine,expected_label,visual_domains,snapshot_path,snapshot_sha256"]
    for i, kw in enumerate(control_pool):
        engine = "google" if i % 2 == 0 else "naver"
        expected = "enterable" if i < 10 else "hard"
        urls = ENTERABLE_URLS if expected == "enterable" else HARD_URLS
        rel = f"snapshots/control/{engine}/{keyword_hash(kw)}.html"
        html = snapshot_html(kw, engine, urls)
        write(d2 / rel, html)
        sha = V.sha256_file(d2 / rel)
        doms = "|".join(V.parse_snapshot_domains(html, engine, limit=10))
        control_lines.append(f"{kw},{engine},{expected},{doms},{rel},{sha}")
    sealed = V.seal_control_set(("\n".join(control_lines) + "\n").encode("utf-8"), CONTROL_KEY)
    write(d2 / "control_set.enc", sealed)

    # ── report.md ──────────────────────────────────────────────────────
    g_ent = len(enterable_sets["google"])
    n_ent = len(enterable_sets["naver"])
    union = len(enterable_sets["google"] | enterable_sets["naver"])
    blocked_counts = {"google": 0, "naver": NAVER_BLOCKED_N}
    g_verdict = V.engine_verdict(g_ent, blocked_counts["google"])
    n_verdict = V.engine_verdict(n_ent, blocked_counts["naver"])
    final = V.combine_verdicts(g_verdict, n_verdict)
    write(
        d2 / "report.md",
        "# 합성 픽스처 report (00-valid)\n\n"
        "실측 데이터가 아니다. 검증기 메타테스트 전용.\n\n"
        "```yaml\n"
        f"google_enterable: {g_ent}\n"
        f"naver_enterable: {n_ent}\n"
        f"union_enterable: {union}\n"
        f"google_verdict: {g_verdict}\n"
        f"naver_verdict: {n_verdict}\n"
        f"google_blocked: {blocked_counts['google']}\n"
        f"naver_blocked: {blocked_counts['naver']}\n"
        "```\n",
    )

    # ── G2.md ──────────────────────────────────────────────────────────
    write(
        dest / "G2.md",
        "---\n"
        "gate: G2\n"
        "status: decided\n"
        "decided_at: 2026-08-03\n"
        "source_pr: fixture://00-valid\n"
        f"google_verdict: {g_verdict}\n"
        f"naver_verdict: {n_verdict}\n"
        f"final: {final}\n"
        "---\n\n"
        "# G2 (합성 픽스처)\n",
    )
    return {"google_verdict": g_verdict, "naver_verdict": n_verdict, "final": final,
            "google_enterable": g_ent, "naver_enterable": n_ent, "union": union,
            "measured": measured, "naver_blocked": sorted(naver_blocked),
            "keywords": keywords}


ALL_CHECKS = [
    "keywords", "volume", "serp", "capture-integrity",
    "difficulty", "control", "blocked-cap", "blocked", "verdict",
]


# ══════════════════════════════════════════════════════════════════════════════
# 위반 픽스처 (00-valid 오버레이)
# ══════════════════════════════════════════════════════════════════════════════


def build_violations(meta: dict) -> None:
    measured = meta["measured"]
    keywords = meta["keywords"]

    # ① FORBID-1 — min_independent_domains = 1
    fx = HERE / "01-forbid1-min-independent-domains-1"
    shutil.rmtree(fx, ignore_errors=True)
    rule_text = (D2 / "difficulty_rule.md").read_text(encoding="utf-8")
    rule_text = rule_text.replace("min_independent_domains: 3", "min_independent_domains: 1", 1)
    write(fx / "tree" / "D2" / "difficulty_rule.md", rule_text)
    write(
        fx / "case.json",
        json.dumps(
            {
                "id": "01-forbid1-min-independent-domains-1",
                "why": "difficulty_rule 의 min_independent_domains 를 K-1 하한(3) 아래인 1 로 낮춘 트리. "
                       "'비-포털 도메인 1개면 enterable' 로 잠그면 전 키워드가 enterable 이 되어 G2 가 거짓 통과한다.",
                "base": "00-valid",
                "checks": ["difficulty"],
                "expect": "fail",
                "expect_rule": "FORBID-1",
                "env": {"D2_CONTROL_KEY": CONTROL_KEY},
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
    )

    # ② FORBID-2 — volume 합 12 인 키워드가 실측·분자에 포함
    fx = HERE / "02-forbid2-low-volume-in-numerator"
    shutil.rmtree(fx, ignore_errors=True)
    src = HERE / "00-valid" / "tree" / "D2" / "keyword_metrics.csv"
    with src.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    victim = measured[0]
    for r in rows:
        if r["keyword"] == victim:
            r["google_volume"], r["naver_volume"] = "6", "6"   # 합 12 < 30
    write_csv(fx / "tree" / "D2" / "keyword_metrics.csv", METRICS_COLS, rows)
    write(
        fx / "case.json",
        json.dumps(
            {
                "id": "02-forbid2-low-volume-in-numerator",
                "why": f"'{victim}' 의 검색량 합을 12 로 내렸는데도 serp csv 와 enterable 집계에 그대로 남아 있는 트리. "
                       "검색량 하한 없이 초장문 조합으로 상위 100 을 경쟁 없는 구간으로 옮기는 경로.",
                "base": "00-valid",
                "checks": ["serp"],
                "expect": "fail",
                "expect_rule": "FORBID-2",
                "env": {"D2_CONTROL_KEY": CONTROL_KEY},
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
    )

    # ③ FORBID-3 — 로그인 흔적이 있는 스냅샷
    fx = HERE / "03-forbid3-logged-in-snapshot"
    shutil.rmtree(fx, ignore_errors=True)
    victim = measured[0]
    rel = f"snapshots/google/{keyword_hash(victim)}.html"
    html = snapshot_html(victim, "google", ENTERABLE_URLS, login_marker=True)
    write(fx / "tree" / "D2" / rel, html)
    write(
        fx / "case.json",
        json.dumps(
            {
                "id": "03-forbid3-logged-in-snapshot",
                "why": f"'{victim}' 구글 스냅샷에 accounts.google.com/SignOutOptions 노드가 들어 있는 트리. "
                       "개인화 SERP 는 신규 방문자가 보는 결과와 다르므로 enterable 이 부풀려진다. "
                       "capture_mode 컬럼은 'clean_profile' 로 자기신고되어 있으며, 그 자기신고는 근거가 되지 못한다.",
                "base": "00-valid",
                "checks": ["capture-integrity"],
                "expect": "fail",
                "expect_rule": "FORBID-3",
                "env": {"D2_CONTROL_KEY": CONTROL_KEY},
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
    )

    # ④ FORBID-4 — blocked 45건인데 verdict = pass
    fx = HERE / "04-forbid4-blocked-45-verdict-pass"
    shutil.rmtree(fx, ignore_errors=True)
    src = HERE / "00-valid" / "tree" / "D2" / "collection_log.csv"
    with src.open(encoding="utf-8", newline="") as fh:
        log_rows = list(csv.DictReader(fh))
    extra = [kw for kw in keywords if kw not in measured][:45]
    for kw in extra:
        log_rows.append(dict(zip(LOG_COLS, [kw, "naver", "2026-08-03T02:00:00Z", "429", "blocked", "", "rate limited"])))
    write_csv(fx / "tree" / "D2" / "collection_log.csv", LOG_COLS, log_rows)
    report = (HERE / "00-valid" / "tree" / "D2" / "report.md").read_text(encoding="utf-8")
    report = report.replace(f"naver_verdict: {meta['naver_verdict']}", "naver_verdict: pass", 1)
    report = report.replace(f"naver_blocked: {NAVER_BLOCKED_N}", f"naver_blocked: {45 + NAVER_BLOCKED_N}", 1)
    write(fx / "tree" / "D2" / "report.md", report)
    write(
        fx / "case.json",
        json.dumps(
            {
                "id": "04-forbid4-blocked-45-verdict-pass",
                "why": "네이버 blocked 를 47건(> 상한 20)으로 신고하고도 naver_verdict=pass 를 유지한 트리. "
                       "캡처가 까다로운 네이버를 대량 blocked 로 신고하면 G2 가 사실상 구글 단독 판정이 된다.",
                "base": "00-valid",
                "checks": ["blocked-cap"],
                "expect": "fail",
                "expect_rule": "FORBID-4",
                "env": {"D2_CONTROL_KEY": CONTROL_KEY},
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
    )

    # ⑤ FORBID-5 — naver 가 pass 가 아닌데 final = pass
    fx = HERE / "05-forbid5-naver-fail-final-pass"
    shutil.rmtree(fx, ignore_errors=True)
    gate = (HERE / "00-valid" / "tree" / "G2.md").read_text(encoding="utf-8")
    gate = gate.replace(f"final: {meta['final']}", "final: pass", 1)
    write(fx / "tree" / "G2.md", gate)
    write(
        fx / "case.json",
        json.dumps(
            {
                "id": "05-forbid5-naver-fail-final-pass",
                "why": "naver_verdict=fail 인데 docs/gates/G2.md 의 final 을 pass 로 기록한 트리. "
                       "결합 규칙이 집행되지 않으면 '구글에서는 되니까 진행'이 네이버 트래픽 부재를 은폐한다.",
                "base": "00-valid",
                "checks": ["verdict"],
                "expect": "fail",
                "expect_rule": "FORBID-5",
                "env": {"D2_CONTROL_KEY": CONTROL_KEY},
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
    )

    # ⑥ FORBID-6 — blocked 조합에 재캡처 근거 없는 serp 행
    fx = HERE / "06-forbid6-blocked-pair-has-serp-row"
    shutil.rmtree(fx, ignore_errors=True)
    src = HERE / "00-valid" / "tree" / "D2" / "collection_log.csv"
    with src.open(encoding="utf-8", newline="") as fh:
        log_rows = list(csv.DictReader(fh))
    victim = measured[0]     # naver 로 실측된 키워드
    for r in log_rows:
        if r["keyword"] == victim and r["engine"] == "naver":
            r["status"], r["http_status"], r["note"] = "blocked", "403", "captcha"
    write_csv(fx / "tree" / "D2" / "collection_log.csv", LOG_COLS, log_rows)
    write(
        fx / "case.json",
        json.dumps(
            {
                "id": "06-forbid6-blocked-pair-has-serp-row",
                "why": f"'{victim}'/naver 가 403 캡차로 차단됐다고 기록되어 있는데 serp_naver.csv 에 그 조합의 행이 "
                       "manual_recheck 표기도 차단 이후 재캡처 스냅샷도 없이 존재하는 트리 — 프록시·캡차 우회 수집의 흔적.",
                "base": "00-valid",
                "checks": ["blocked"],
                "expect": "fail",
                "expect_rule": "FORBID-6",
                "env": {"D2_CONTROL_KEY": CONTROL_KEY},
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
    )


    # ⑦ FORBID-3 (두 번째 갈래) — csv domain 목록이 스냅샷 파싱 결과와 다르다
    fx = HERE / "07-forbid3-csv-domain-mismatch"
    shutil.rmtree(fx, ignore_errors=True)
    src = HERE / "00-valid" / "tree" / "D2" / "serp_google.csv"
    with src.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    victim = measured[0]
    for r in rows:
        if r["keyword"] == victim and r["rank"] == "1":
            r["domain"] = "independent-looking-domain.co.kr"
    write_csv(fx / "tree" / "D2" / "serp_google.csv", SERP_COLS, rows)
    write(
        fx / "case.json",
        json.dumps(
            {
                "id": "07-forbid3-csv-domain-mismatch",
                "why": f"'{victim}'/google rank 1 의 domain 을 스냅샷에 없는 독립 도메인으로 바꿔 적은 트리. "
                       "스냅샷은 그대로 두고 csv 만 고치면 대형 플랫폼 결과가 독립 도메인으로 둔갑해 "
                       "independent_domains 가 부풀려진다. 자기신고 컬럼이 아니라 원본 파싱과 대조해야 잡힌다.",
                "base": "00-valid",
                "checks": ["capture-integrity"],
                "expect": "fail",
                "expect_rule": "FORBID-3",
                "env": {"D2_CONTROL_KEY": CONTROL_KEY},
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
    )

    # ⑧ FORBID-2 (두 번째 갈래) — 차단/미측정 조합이 enterable 분자에 포함
    fx = HERE / "08-forbid2-enterable-with-blocked-status"
    shutil.rmtree(fx, ignore_errors=True)
    src = HERE / "00-valid" / "tree" / "D2" / "labels.csv"
    with src.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    patched = False
    for r in rows:
        if r["label"] == "enterable" and not patched:
            r["status"] = "no_volume_data"
            patched = True
    assert patched, "enterable 라벨 행을 찾지 못했다"
    write_csv(fx / "tree" / "D2" / "labels.csv", LABEL_COLS, rows)
    write(
        fx / "case.json",
        json.dumps(
            {
                "id": "08-forbid2-enterable-with-blocked-status",
                "why": "status=no_volume_data 인 행이 enterable 라벨로 집계에 들어간 트리. "
                       "검색량을 측정하지 못한 키워드를 분자에 넣으면 100건 달성이 자명해진다.",
                "base": "00-valid",
                "checks": ["verdict"],
                "expect": "fail",
                "expect_rule": "FORBID-2",
                "env": {"D2_CONTROL_KEY": CONTROL_KEY},
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
    )


def main() -> int:
    valid = HERE / "00-valid"
    shutil.rmtree(valid, ignore_errors=True)
    meta = build_valid(valid / "tree")
    write(
        valid / "case.json",
        json.dumps(
            {
                "id": "00-valid",
                "why": "위반이 없는 합성 트리. 전 검사가 exit 0 이어야 한다 — "
                       "무조건 실패하는 검사기는 위반과 정상을 구분하지 못하므로 검사기가 아니다(원칙 2.5).",
                "checks": ALL_CHECKS,
                "expect": "pass",
                "expect_rule": None,
                "env": {"D2_CONTROL_KEY": CONTROL_KEY},
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
    )
    build_violations(meta)
    print(
        f"00-valid: google_enterable={meta['google_enterable']} naver_enterable={meta['naver_enterable']} "
        f"union={meta['union']} → {meta['google_verdict']}/{meta['naver_verdict']} → final={meta['final']}"
    )
    print("위반 픽스처 8종 생성 완료 (FORBID-1~6 · FORBID-2/3 은 두 갈래씩)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
