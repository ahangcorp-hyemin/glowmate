#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""D2 실환경 수집 가능성 실측 (feasibility probe).

**이것은 REQ-3 의 SERP 실측이 아니다.** REQ-3 의 실측 대상은 K-2(검색량 합 ≥ 30)로
정해지는 상위 100건이며, 검색량 도구 접근이 없어 그 집합을 확정할 수 없다
(report.md §2). 이 스크립트는 그 차단 사유를 **주장이 아니라 실측으로** 남긴다:

  - 네이버 SERP 를 로그인/프록시/재시도 없이 캡처할 수 있는가
  - 구글 SERP 를 같은 조건에서 캡처할 수 있는가
  - 캡처한 원본에서 `parse_snapshot_domains()` 가 유기적 결과 도메인을 뽑아내는가

표집 절차 (사후 선택 금지):
  keywords.csv 를 파일 순서 그대로 두고 **인덱스 0, 90, 180, …, 630** 의 8건.
  키워드를 보고 고른 것이 아니라 고정 간격이며, 재실행하면 같은 8건이 나온다.

수집 규약 (FORBID-6):
  - 조합당 **정확히 1회** 요청. 재시도 없음. 프록시 없음. 캡차 우회 없음.
  - 요청 간 4초 대기.
  - 응답이 무엇이든 그대로 collection_log 에 기록한다.

    python docs/discovery/D2/feasibility_probe/_probe.py
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import subprocess
import sys
import tempfile
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
D2 = HERE.parent
REPO = D2.parents[2]
VALIDATOR = REPO / "scripts" / "discovery" / "validate_d2.py"

SAMPLE_STRIDE = 90
SAMPLE_START = 0
REQUEST_INTERVAL_SEC = 4
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

ENDPOINTS = {
    "naver": "https://search.naver.com/search.naver?query={q}",
    "google": "https://www.google.com/search?q={q}&hl=ko&gl=kr&num=10",
}


def load_validator():
    spec = importlib.util.spec_from_file_location("validate_d2", VALIDATOR)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["validate_d2"] = mod
    spec.loader.exec_module(mod)
    return mod


def keyword_hash(keyword: str) -> str:
    return hashlib.sha256(keyword.encode("utf-8")).hexdigest()[:16]


def fetch(url: str) -> tuple[int | None, str, str]:
    """(http_status, body, note). 재시도하지 않는다.

    `curl` 을 쓰는 이유: 이 실행 환경은 TLS 를 가로채는 프록시 뒤에 있어
    Python 의 기본 신뢰 저장소로는 인증서 검증이 실패한다(실측). curl 은 시스템
    신뢰 저장소를 쓰므로 통과한다. `--retry` 는 주지 않는다 (FORBID-6).
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".html") as tmp:
        body_path = Path(tmp.name)
    try:
        proc = subprocess.run(
            [
                "curl", "-sS", "--max-time", "30",
                "-o", str(body_path),
                "-w", "%{http_code}",
                "-A", USER_AGENT,
                "-H", "Accept-Language: ko-KR,ko;q=0.9",
                url,
            ],
            capture_output=True,
            text=True,
        )
        raw = body_path.read_bytes()
        body = raw.decode("utf-8", errors="replace")
        code_txt = (proc.stdout or "").strip()
        status = int(code_txt) if code_txt.isdigit() and code_txt != "000" else None
        note = (proc.stderr or "").strip()
        return status, body, note
    finally:
        body_path.unlink(missing_ok=True)


def main() -> int:
    reparse = "--reparse" in sys.argv[1:]
    v = load_validator()
    with (D2 / "keywords.csv").open(encoding="utf-8", newline="") as fh:
        keywords = [r["keyword"] for r in csv.DictReader(fh)]
    sample = keywords[SAMPLE_START :: SAMPLE_STRIDE]
    print(f"표집: 인덱스 {SAMPLE_START} 부터 {SAMPLE_STRIDE} 간격 → {len(sample)}건"
          + (" · --reparse (네트워크 요청 없이 기존 스냅샷 재파싱)" if reparse else ""))

    prior = {}
    if reparse:
        with (D2 / "collection_log.csv").open(encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                prior[(r["keyword"], r["engine"])] = r

    log_rows = []
    parse_rows = []
    for keyword in sample:
        for engine, tpl in ENDPOINTS.items():
            url = tpl.format(q=urllib.parse.quote(keyword))
            khash = keyword_hash(keyword)
            if reparse:
                old = prior[(keyword, engine)]
                attempted_at = old["attempted_at"]
                status = int(old["http_status"]) if old["http_status"] else None
                body = (D2 / old["evidence_path"]).read_text(encoding="utf-8") if old["evidence_path"] else ""
                note = ""
            else:
                attempted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                status, body, note = fetch(url)
            snap_rel = f"feasibility_probe/snapshots/{engine}/{khash}.html"
            snap_path = D2 / snap_rel
            snap_path.parent.mkdir(parents=True, exist_ok=True)
            domains: list[str] = []
            login_hits: list[str] = []
            if body:
                snap_path.write_text(body, encoding="utf-8")
                domains = v.parse_snapshot_domains(body, engine, limit=10)
                login_hits = v.detect_login_markers(body)
                sha = v.sha256_file(snap_path)
            else:
                snap_rel, sha = "", ""

            if status in (403, 429) or "captcha" in body[:5000].lower() or "/sorry/" in body[:5000]:
                probe_status = "blocked"
            elif status == 200 and domains:
                probe_status = "probe_ok"
            elif status == 200:
                probe_status = "probe_no_organic_results"
            else:
                probe_status = "probe_error"

            log_rows.append(
                {
                    "keyword": keyword,
                    "engine": engine,
                    "attempted_at": attempted_at,
                    "http_status": "" if status is None else str(status),
                    "status": probe_status,
                    "evidence_path": snap_rel,
                    "note": note or f"bytes={len(body)} domains={len(domains)} login_markers={login_hits}",
                }
            )
            parse_rows.append(
                {
                    "keyword": keyword,
                    "engine": engine,
                    "http_status": status,
                    "bytes": len(body),
                    "sha256": sha,
                    "domains": domains,
                    "login_markers": login_hits,
                }
            )
            print(f"  {engine:6} {keyword:28} http={status} bytes={len(body):7} domains={len(domains)} {probe_status}")
            time.sleep(REQUEST_INTERVAL_SEC)

    out = D2 / "collection_log.csv"
    with out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(
            fh, fieldnames=["keyword", "engine", "attempted_at", "http_status", "status", "evidence_path", "note"]
        )
        w.writeheader()
        w.writerows(log_rows)
    print(f"\n{out} — {len(log_rows)}행")

    parsed_out = HERE / "parse_result.csv"
    with parsed_out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["keyword", "engine", "http_status", "bytes", "snapshot_sha256", "parsed_domain_count", "parsed_domains", "login_markers"])
        for r in parse_rows:
            w.writerow(
                [
                    r["keyword"], r["engine"], r["http_status"], r["bytes"], r["sha256"],
                    len(r["domains"]), "|".join(r["domains"]), "|".join(r["login_markers"]),
                ]
            )
    print(f"{parsed_out} — {len(parse_rows)}행")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
