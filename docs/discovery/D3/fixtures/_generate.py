#!/usr/bin/env python3
"""D3 위반 픽스처 생성기 (메타테스트용).

`scripts/discovery/validate_d3.py --check selftest` 는 여기서 생성된
`docs/discovery/D3/fixtures/<case>/tree/` 를 `--root` 로 삼아 검증기를 재실행하고,
**각 픽스처가 non-zero 로 끝나며 기대 규칙 ID 로 귀속되는지**를 확인한다.
탐지기가 무력화되면(예: 임계값을 낮추거나 검사를 지우면) 이 메타테스트가 먼저 red 가 된다.

재생성:
    python3 docs/discovery/D3/fixtures/_generate.py

생성물은 커밋한다 — CI 에서 생성 스크립트를 신뢰하지 않고 결과물을 직접 검사하기 위해서다.

⚠ 계약 `done_when` 은 픽스처 위치로 `scripts/discovery/fixtures/d3/` 를 적고 있으나,
  `deliverable.touches` 에는 해당 경로가 없다. touches 밖을 수정하지 않기 위해
  `docs/discovery/D3/fixtures/` 에 두었다 (report.md §5-3).
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCES = ["naver_place", "kakao_map", "official_website", "alt_one", "alt_two", "alt_three"]
COND = ["official_website", "alt_one"]
HOSTS = {
    "naver_place": "map.fixture-naver.example",
    "kakao_map": "map.fixture-kakao.example",
    "official_website": "www.fixture-a.example",
    "alt_one": "www.fixture-b.example",
    "alt_two": "www.fixture-c.example",
    "alt_three": "www.fixture-d.example",
}
UA = "glowmate-crawler/0.1 (+fixture)"
T0 = datetime(2026, 8, 3, 0, 0, 0, tzinfo=timezone.utc)

SECTIONS = ["robots", "tos", "official_api", "access_method", "rate_limit", "risk_note"]


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def write(p: Path, text: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def csv_text(fields: list[str], rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def probe_urls(source: str) -> list[str]:
    host = HOSTS[source]
    urls = [f"https://{host}/venue/{i:03d}" for i in range(1, 11)]
    urls += [f"https://{host}/list?page={i}" for i in range(1, 10)]
    urls += [f"https://{host}/robots.txt"]
    return urls


def build_base(root: Path) -> None:
    d3 = root / "docs/discovery/D3"
    if root.exists():
        shutil.rmtree(root)

    # ── robots 스냅샷 ───────────────────────────────────────────────────────
    robots_rows = []
    for s in SOURCES:
        host = HOSTS[s]
        if s in COND:
            body = "User-agent: *\nAllow: /\nDisallow: /admin/\n"
        else:
            body = "User-agent: *\nDisallow: /\nAllow: /$\n"
        rel = f"docs/discovery/D3/snapshots/robots/{s}.txt"
        write(root / rel, body)
        robots_rows.append(
            {
                "source": s,
                "host": host,
                "url": f"https://{host}/robots.txt",
                "fetched_at_utc": "2026-08-03T00:00:00Z",
                "http_status": "200",
                "sha256": sha(body.encode()),
                "path": rel,
                "bytes": str(len(body.encode())),
            }
        )
    write(
        d3 / "snapshots/robots/index.csv",
        csv_text(
            ["source", "host", "url", "fetched_at_utc", "http_status", "sha256", "path", "bytes"],
            robots_rows,
        ),
    )

    # ── ToS 스냅샷 ──────────────────────────────────────────────────────────
    for s in COND:
        write(
            d3 / f"snapshots/tos/{s}.html",
            "<html><body><h2>제1조(목적)</h2><p>픽스처용 합성 약관.</p></body></html>\n",
        )

    # ── verdict_rule.md ────────────────────────────────────────────────────
    write(
        d3 / "verdict_rule.md",
        "# 픽스처 판정 룰\n\n"
        "| rule_id | 적용 조건 | 산출 verdict |\n|---|---|---|\n"
        "| `R-ROBOTS-DISALLOW` | robots Disallow | forbidden |\n"
        "| `R-ROBOTS-UNKNOWN` | robots 취득 실패 | forbidden |\n"
        "| `R-TOS-PROHIBIT` | ToS 명시 금지 | forbidden |\n"
        "| `R-RPS-FLOOR` | 요청률 하한 미달 | forbidden |\n"
        "| `R-PENDING-NO-TOS` | ToS 미확보 | pending |\n"
        "| `R-COND-ATTRIB` | 출처표시 조건부 | conditional |\n"
        "| `R-COND-RATE` | 요청률 조건부 | conditional |\n"
        "| `R-ALLOWED-OPEN` | 조건 없음 | allowed |\n",
    )

    # ── sources/*.md ───────────────────────────────────────────────────────
    for s in SOURCES:
        body = [f"# {s} (픽스처)", ""]
        for sec in SECTIONS:
            body += [f"## {sec}", "", "픽스처용 합성 내용.", ""]
        write(d3 / f"sources/{s}.md", "\n".join(body))

    # ── verdicts.csv ───────────────────────────────────────────────────────
    vrows = []
    for s in SOURCES:
        if s in COND:
            vrows.append(
                {
                    "source": s,
                    "verdict": "conditional",
                    "rule_id": "R-COND-ATTRIB",
                    "tos_ref": f"docs/discovery/D3/snapshots/tos/{s}.html",
                    "tos_clause": "제1조",
                    "robots_ref": f"docs/discovery/D3/snapshots/robots/{s}.txt",
                    "decided_at_utc": "2026-08-03",
                    "note": "fixture",
                }
            )
        else:
            vrows.append(
                {
                    "source": s,
                    "verdict": "forbidden",
                    "rule_id": "R-ROBOTS-DISALLOW",
                    "tos_ref": "",
                    "tos_clause": "",
                    "robots_ref": f"docs/discovery/D3/snapshots/robots/{s}.txt",
                    "decided_at_utc": "2026-08-03",
                    "note": "fixture",
                }
            )
    write(
        d3 / "verdicts.csv",
        csv_text(
            ["source", "verdict", "rule_id", "tos_ref", "tos_clause", "robots_ref", "decided_at_utc", "note"],
            vrows,
        ),
    )

    # ── crawl_policy.yaml ──────────────────────────────────────────────────
    lines = []
    for s in COND:
        host = HOSTS[s]
        lines += [
            f"{s}:",
            "  max_requests_per_min: 6",
            "  max_concurrency: 1",
            f'  user_agent: "{UA}"',
            "  retry_backoff_sec: 30",
            "  raw_retention_days: 90",
            "  expiry_action: tombstone_payload",
            "  allowed_path_globs:",
            f'    - "https://{host}/venue/*"',
            f'    - "https://{host}/list?page=*"',
            f'    - "https://{host}/robots.txt"',
        ]
    write(d3 / "crawl_policy.yaml", "\n".join(lines) + "\n")

    # ── republish_policy.md ────────────────────────────────────────────────
    rp = ["# 픽스처 재공개 정책", ""]
    for s in COND:
        rp += [
            f"## source: {s}",
            "- allow_fields: venue_name, road_address",
            "- deny_fields: 리뷰 작성자 닉네임, 개인 휴대전화번호",
            '- attribution_text: "출처: 픽스처"',
            "",
            "### allow_field: venue_name",
            '- sample_values: "픽스처짐 강남1호점" | "픽스처요가 서초점" | "픽스처스파 송파점"',
            "- pii_assessment: 상호이며 K-5 값 패턴 미매칭",
            "",
            "### allow_field: road_address",
            '- sample_values: "서울 강남구 테스트로 1" | "서울 서초구 테스트로 2" | "서울 송파구 테스트로 3"',
            "- pii_assessment: 사업장 소재지이며 K-5 값 패턴 미매칭",
            "",
        ]
    write(d3 / "republish_policy.md", "\n".join(rp))

    # ── probe HAR + rate_probe_log + reachability ──────────────────────────
    log_rows = []
    for s in COND:
        entries = []
        urls = probe_urls(s)
        reach_rows = []
        for i, u in enumerate(urls, start=1):
            t = T0 + timedelta(seconds=12 * (i - 1))
            body = f"<html><title>{s} fixture {i}</title></html>".encode()
            entries.append(
                {
                    "startedDateTime": iso(t),
                    "time": 100.0,
                    "request": {"method": "GET", "url": u, "headers": [{"name": "User-Agent", "value": UA}]},
                    "response": {
                        "status": 200,
                        "statusText": "OK",
                        "content": {"size": len(body), "mimeType": "text/html"},
                        "bodySize": len(body),
                    },
                    "cache": {},
                    "timings": {"send": 0, "wait": 100.0, "receive": 0},
                }
            )
            log_rows.append(
                {
                    "source": s,
                    "seq": i,
                    "requested_at": iso(t),
                    "url": u,
                    "http_status": 200,
                    "elapsed_ms": 100,
                    "body_sha256": sha(body),
                }
            )
            if i <= 10:
                rel = f"docs/discovery/D3/reachability/snapshots/{s}.{i:02d}.html"
                write(root / rel, body.decode())
                reach_rows.append(
                    {
                        "source": s,
                        "seq": i,
                        "url": u,
                        "http_status": 200,
                        "fetched_at_utc": iso(t),
                        "snapshot_path": rel,
                        "snapshot_sha256": sha(body),
                        "business_name": f"픽스처업체{i:02d}",
                        "extracted_title": f"{s} fixture {i}",
                        "extracted_site_name": s,
                        "extracted_address": "서울 강남구 테스트로 1",
                        "district": ["강남구", "서초구", "송파구"][i % 3],
                    }
                )
        write(
            d3 / f"probe/{s}.har",
            json.dumps(
                {"log": {"version": "1.2", "creator": {"name": "fixture", "version": "0"}, "entries": entries}},
                ensure_ascii=False,
                indent=1,
            ),
        )
        write(
            d3 / f"reachability/{s}.csv",
            csv_text(list(reach_rows[0].keys()), reach_rows),
        )
    write(
        d3 / "rate_probe_log.csv",
        csv_text(["source", "seq", "requested_at", "url", "http_status", "elapsed_ms", "body_sha256"], log_rows),
    )

    # ── report.md / G3.md ──────────────────────────────────────────────────
    excluded = [s for s in SOURCES if s not in COND]
    write(
        d3 / "report.md",
        "# 픽스처 실사 보고서\n\n"
        "## 제외 소스\n\n"
        + "".join(f"- `{s}` — forbidden\n" for s in excluded)
        + "\n## 커버리지 손실\n\n"
        "제외로 인한 업체 커버리지 손실 구간 **10~20%**.\n"
        "산출 근거: `docs/discovery/D3/verdicts.csv`\n"
        "\n## 대안 소스 실사\n\n"
        + "".join(f"- `{s}`\n" for s in excluded[:3])
        + "\n",
    )
    write(
        root / "docs/gates/G3.md",
        "---\n"
        "gate: G3\n"
        "status: fixture\n"
        "decided_at: 2026-08-03\n"
        "source_pr: fixture\n"
        f"adapter_targets: [{', '.join(sorted(COND))}]\n"
        "---\n\n# G3 픽스처\n",
    )


# ──────────────────────────────────────────────────────────────────────────────
# 위반 주입
# ──────────────────────────────────────────────────────────────────────────────
def mutate_robots_disallow(root: Path) -> None:
    """① allowed_path_globs 에 robots Disallow 경로가 포함되도록 robots 를 바꾼다."""
    s = COND[0]
    rel = root / f"docs/discovery/D3/snapshots/robots/{s}.txt"
    body = "User-agent: *\nAllow: /\nDisallow: /venue/\n"
    rel.write_text(body, encoding="utf-8")
    idx = root / "docs/discovery/D3/snapshots/robots/index.csv"
    rows = list(csv.DictReader(idx.open(encoding="utf-8")))
    for r in rows:
        if r["source"] == s:
            r["sha256"] = sha(body.encode())
            r["bytes"] = str(len(body.encode()))
    idx.write_text(csv_text(list(rows[0].keys()), rows), encoding="utf-8")


def mutate_tos_missing(root: Path) -> None:
    """② ToS 스냅샷이 없는 소스에 conditional 을 부여한다."""
    p = root / "docs/discovery/D3/verdicts.csv"
    rows = list(csv.DictReader(p.open(encoding="utf-8")))
    for r in rows:
        if r["source"] == COND[1]:
            r["tos_ref"] = ""
            r["tos_clause"] = ""
    p.write_text(csv_text(list(rows[0].keys()), rows), encoding="utf-8")
    (root / f"docs/discovery/D3/snapshots/tos/{COND[1]}.html").unlink()


def mutate_har_burst(root: Path) -> None:
    """③ HAR 이 60초 안에 20요청(=버스트)을 담도록 타임스탬프를 압축한다."""
    s = COND[0]
    hp = root / f"docs/discovery/D3/probe/{s}.har"
    har = json.loads(hp.read_text(encoding="utf-8"))
    remap = {}
    for i, e in enumerate(har["log"]["entries"]):
        t = T0 + timedelta(seconds=2 * i)
        remap[e["startedDateTime"]] = iso(t)
        e["startedDateTime"] = iso(t)
    hp.write_text(json.dumps(har, ensure_ascii=False, indent=1), encoding="utf-8")

    lp = root / "docs/discovery/D3/rate_probe_log.csv"
    rows = list(csv.DictReader(lp.open(encoding="utf-8")))
    for r in rows:
        if r["source"] == s and r["requested_at"] in remap:
            r["requested_at"] = remap[r["requested_at"]]
    lp.write_text(csv_text(list(rows[0].keys()), rows), encoding="utf-8")

    rp = root / f"docs/discovery/D3/reachability/{s}.csv"
    rrows = list(csv.DictReader(rp.open(encoding="utf-8")))
    for r in rrows:
        if r["fetched_at_utc"] in remap:
            r["fetched_at_utc"] = remap[r["fetched_at_utc"]]
    rp.write_text(csv_text(list(rrows[0].keys()), rrows), encoding="utf-8")


def mutate_rps_floor(root: Path) -> None:
    """④ conditional 소스의 max_requests_per_min 을 2 로 낮춘다."""
    p = root / "docs/discovery/D3/crawl_policy.yaml"
    text = p.read_text(encoding="utf-8")
    text = text.replace("  max_requests_per_min: 6", "  max_requests_per_min: 2", 1)
    p.write_text(text, encoding="utf-8")


def mutate_pii_sample(root: Path) -> None:
    """⑤ allow_field 샘플값에 개인 휴대전화번호를 넣는다."""
    p = root / "docs/discovery/D3/republish_policy.md"
    text = p.read_text(encoding="utf-8")
    text = text.replace(
        '- sample_values: "서울 강남구 테스트로 1" | "서울 서초구 테스트로 2" | "서울 송파구 테스트로 3"',
        '- sample_values: "서울 강남구 테스트로 1" | "010-1234-5678" | "서울 송파구 테스트로 3"',
        1,
    )
    p.write_text(text, encoding="utf-8")


def mutate_glob_mismatch(root: Path) -> None:
    """⑥ probe URL 하나를 allowed_path_globs 밖 경로로 바꾼다."""
    s = COND[0]
    host = HOSTS[s]
    bad = f"https://{host}/secret/outside-glob"
    hp = root / f"docs/discovery/D3/probe/{s}.har"
    har = json.loads(hp.read_text(encoding="utf-8"))
    old = har["log"]["entries"][0]["request"]["url"]
    har["log"]["entries"][0]["request"]["url"] = bad
    hp.write_text(json.dumps(har, ensure_ascii=False, indent=1), encoding="utf-8")

    lp = root / "docs/discovery/D3/rate_probe_log.csv"
    rows = list(csv.DictReader(lp.open(encoding="utf-8")))
    for r in rows:
        if r["source"] == s and r["url"] == old:
            r["url"] = bad
    lp.write_text(csv_text(list(rows[0].keys()), rows), encoding="utf-8")

    rp = root / f"docs/discovery/D3/reachability/{s}.csv"
    rrows = list(csv.DictReader(rp.open(encoding="utf-8")))
    for r in rrows:
        if r["url"] == old:
            r["url"] = bad
    rp.write_text(csv_text(list(rrows[0].keys()), rrows), encoding="utf-8")


CASES = [
    ("01-robots-disallow-in-globs", "① Disallow 경로를 allowed_path_globs 에 포함", "FORBID-1", mutate_robots_disallow),
    ("02-conditional-without-tos", "② ToS 없는 소스에 conditional", "FORBID-2", mutate_tos_missing),
    ("03-har-burst-30-per-min", "③ HAR 이 60초에 20요청(정책 6 초과)", "FORBID-3", mutate_har_burst),
    ("04-rps-floor-2-but-conditional", "④ max_requests_per_min=2 인데 conditional", "FORBID-4", mutate_rps_floor),
    ("05-pii-mobile-in-sample", "⑤ allow_field 샘플값에 휴대전화번호", "FORBID-5", mutate_pii_sample),
    ("06-probe-url-outside-glob", "⑥ probe URL 이 글롭 밖", "FORBID-6", mutate_glob_mismatch),
]


def main() -> int:
    for name, label, expect, mutate in CASES:
        case_dir = HERE / name
        tree = case_dir / "tree"
        build_base(tree)
        mutate(tree)
        write(
            case_dir / "fixture.json",
            json.dumps(
                {"case": name, "label": label, "expect": expect, "tree": "tree/"},
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
        )
        print(f"generated {name} (expect {expect})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
