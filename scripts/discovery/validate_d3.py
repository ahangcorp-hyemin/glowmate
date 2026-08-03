#!/usr/bin/env python3
"""D3-SOURCE-DUE-DILIGENCE 증거 검증기.

계약: docs/tasks/D3.md
CI: F1 의 `discovery` job (`pnpm test:discovery` -> tools/ci-meta/discovery.mjs 가 본 파일을
    비스텁 프로브로 검사하고, 워크플로가 직접 `--all` 을 호출한다)

설계 원칙
---------
* **판정 불가는 통과가 아니다.** 입력 파일이 없거나 파싱에 실패하면 FAIL 이다.
* **검사 대상 0건을 통과로 처리하지 않는다.** verdict ∈ {allowed, conditional} 집합이 비면
  REQ-3/4/5 는 "대상 없음"이 아니라 FAIL 로 처리하고, REQ-6 은 계약이 명시한
  data_acquisition_blocked 경로(대안 소스 3건 실사표)를 요구한다.
* **자기신고보다 물증.** 요청률 판정의 1차 증거는 rate_probe_log.csv 가 아니라 HAR 이다.
* **인자·입력과 무관하게 exit 0 이 되지 않는다.** 인자 없음/미지의 check/결손 입력은 non-zero 다.

exit code
---------
0  전 검사 통과
1  규칙 위반(FAIL) 1건 이상
2  사용법 오류 / 입력 결손 / 내부 오류
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

# ──────────────────────────────────────────────────────────────────────────────
# 계약 고정 상수 (K-1 ~ K-6). **여기의 값을 낮춰서 통과시키는 것은 계약 위반이다.**
# ──────────────────────────────────────────────────────────────────────────────
VERDICT_ENUM = ("allowed", "conditional", "pending", "forbidden")  # K-1
ADAPTER_VERDICTS = ("allowed", "conditional")
MIN_REQUESTS_PER_MIN = 6  # K-2 하한
MANDATORY_SOURCES = ("naver_place", "kakao_map", "official_website")  # K-3
MIN_SOURCE_COUNT = 6  # K-3
EXPIRY_ACTION = "tombstone_payload"  # K-4
MIN_ADAPTER_SOURCES = 2  # K-6
MIN_ALT_SOURCES_WHEN_BLOCKED = 3  # K-6
REACHABILITY_ROWS = 10  # REQ-6
PROBE_ROWS = 20  # REQ-4
SLIDING_WINDOW_SEC = 60  # REQ-4 / FORBID-3
REQUIRED_SOURCE_SECTIONS = (
    "robots",
    "tos",
    "official_api",
    "access_method",
    "rate_limit",
    "risk_note",
)  # REQ-1
POLICY_FIELDS = (
    "max_requests_per_min",
    "max_concurrency",
    "user_agent",
    "allowed_path_globs",
    "retry_backoff_sec",
    "raw_retention_days",
    "expiry_action",
)  # REQ-3
TOS_CLAUSE_RE = re.compile(r"제\s*\d+\s*조|Section\s*\d+|§\s*\d+")  # REQ-2
COVERAGE_LOSS_RE = re.compile(r"\d+(?:\.\d+)?\s*~\s*\d+(?:\.\d+)?\s*%")  # REQ-7
G3_FRONTMATTER_FIELDS = ("gate", "status", "decided_at", "source_pr")  # REQ-7
BLOCKED_TOKEN = "data_acquisition_blocked"  # K-6

D3 = "docs/discovery/D3"
G3_PATH = "docs/gates/G3.md"

CHECKS = (
    "sources",
    "verdicts",
    "policy",
    "rate-probe",
    "republish",
    "reachability",
    "report",
    "robots-conflict",
    "rps-floor",
    "pii",
    "glob-probe-consistency",
    "selftest",
)


# ──────────────────────────────────────────────────────────────────────────────
# 리포트
# ──────────────────────────────────────────────────────────────────────────────
@dataclass
class Report:
    title: str
    failures: list[tuple[str, str]] = field(default_factory=list)
    passes: list[tuple[str, str]] = field(default_factory=list)
    infos: list[tuple[str, str]] = field(default_factory=list)

    def fail(self, rule: str, msg: str, detail: str = "") -> None:
        self.failures.append((rule, msg + (f"\n      {detail}" if detail else "")))

    def ok(self, rule: str, msg: str) -> None:
        self.passes.append((rule, msg))

    def info(self, rule: str, msg: str) -> None:
        self.infos.append((rule, msg))

    def rule_ids(self) -> set[str]:
        return {r for r, _ in self.failures}

    def print(self) -> int:
        print(f"── {self.title} " + "─" * max(0, 60 - len(self.title)))
        for rule, msg in self.infos:
            print(f"  ·  [{rule}] {msg}")
        for rule, msg in self.passes:
            print(f"  ✓  [{rule}] {msg}")
        for rule, msg in self.failures:
            print(f"  ✗  [{rule}] {msg}")
        if self.failures:
            print(f"\nFAIL — 위반 {len(self.failures)}건")
            return 1
        print(f"\nPASS — 검사 {len(self.passes)}건 통과")
        return 0


class InputError(Exception):
    """입력 결손 — 판정 불가는 통과가 아니므로 exit 2 로 끝난다."""


# ──────────────────────────────────────────────────────────────────────────────
# crawl_policy.yaml 전용 축소 리더 (외부 의존 없이 CI 에서 돈다)
# ──────────────────────────────────────────────────────────────────────────────
def _scalar(v: str) -> Any:
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    if re.fullmatch(r"-?\d+\.\d+", v):
        return float(v)
    if v.lower() in ("true", "false"):
        return v.lower() == "true"
    return v


def load_policy(path: Path) -> dict[str, dict[str, Any]]:
    """crawl_policy.yaml 을 (source -> field -> value) 로 읽는다."""
    if not path.exists():
        raise InputError(f"필수 입력 부재: {path}")
    text = path.read_text(encoding="utf-8")
    out: dict[str, dict[str, Any]] = {}
    src: str | None = None
    key: str | None = None
    for lineno, raw in enumerate(text.splitlines(), start=1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        line = raw.strip()
        if line.startswith("- "):
            if src is None or key is None:
                raise InputError(f"crawl_policy.yaml:{lineno} 소속 없는 리스트 항목")
            cur = out[src].get(key)
            if not isinstance(cur, list):
                out[src][key] = []
            out[src][key].append(_scalar(line[2:]))
            continue
        if ":" not in line:
            raise InputError(f"crawl_policy.yaml:{lineno} 매핑이 아닌 줄: {line!r}")
        k, _, rest = line.partition(":")
        k = k.strip()
        rest = rest.strip()
        if indent == 0:
            src = k
            key = None
            out.setdefault(src, {})
            if rest:
                raise InputError(f"crawl_policy.yaml:{lineno} 소스 키에 인라인 값 금지")
        else:
            if src is None:
                raise InputError(f"crawl_policy.yaml:{lineno} 소스 밖의 키: {k}")
            key = k
            out[src][k] = _scalar(rest) if rest else []
    if not out:
        raise InputError("crawl_policy.yaml 이 비어 있다 — 대상 0건은 통과가 아니다")
    return out


# ──────────────────────────────────────────────────────────────────────────────
# robots.txt 파서 (RFC 9309 축약 구현)
# ──────────────────────────────────────────────────────────────────────────────
@dataclass
class RobotsGroup:
    agents: list[str]
    rules: list[tuple[str, str]]  # (allow|disallow, pattern)


class Robots:
    def __init__(self, text: str, source_label: str = ""):
        self.groups: list[RobotsGroup] = []
        self.source_label = source_label
        cur: RobotsGroup | None = None
        expecting_agent = False
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line or ":" not in line:
                continue
            field_name, _, value = line.partition(":")
            field_name = field_name.strip().lower()
            value = value.strip()
            if field_name == "user-agent":
                if cur is None or not expecting_agent:
                    cur = RobotsGroup(agents=[], rules=[])
                    self.groups.append(cur)
                    expecting_agent = True
                cur.agents.append(value.lower())
            elif field_name in ("allow", "disallow"):
                if cur is None:
                    continue
                expecting_agent = False
                cur.rules.append((field_name, value))
            else:
                expecting_agent = False

    def _group_for(self, ua: str) -> RobotsGroup | None:
        ua_l = ua.lower()
        best: RobotsGroup | None = None
        best_len = -1
        star: RobotsGroup | None = None
        for g in self.groups:
            for a in g.agents:
                if a == "*":
                    if star is None:
                        star = g
                    continue
                if a and a in ua_l and len(a) > best_len:
                    best, best_len = g, len(a)
        return best or star

    @staticmethod
    def _match(pattern: str, path: str) -> int:
        """robots 패턴 매칭. 매칭되면 패턴 길이, 아니면 -1."""
        if pattern == "":
            return -1
        anchored_end = pattern.endswith("$")
        pat = pattern[:-1] if anchored_end else pattern
        rx = ""
        for ch in pat:
            if ch == "*":
                rx += ".*"
            else:
                rx += re.escape(ch)
        rx = "^" + rx + ("$" if anchored_end else "")
        return len(pattern) if re.search(rx, path) else -1

    def allows(self, url_path: str, ua: str) -> tuple[bool, str]:
        """(허용 여부, 판정 근거 규칙)"""
        g = self._group_for(ua)
        if g is None:
            return True, "적용 그룹 없음 → 제한 없음"
        best_rule: tuple[str, str] | None = None
        best_len = -1
        for kind, pattern in g.rules:
            ln = self._match(pattern, url_path)
            if ln > best_len or (ln == best_len and ln >= 0 and kind == "allow"):
                if ln >= 0:
                    best_len = ln
                    best_rule = (kind, pattern)
        if best_rule is None:
            return True, f"매칭 규칙 없음 (그룹 {g.agents})"
        kind, pattern = best_rule
        return kind == "allow", f"{kind.capitalize()}: {pattern} (그룹 {g.agents})"


# ──────────────────────────────────────────────────────────────────────────────
# 유틸
# ──────────────────────────────────────────────────────────────────────────────
def read_csv(path: Path, required_cols: Iterable[str]) -> list[dict[str, str]]:
    if not path.exists():
        raise InputError(f"필수 입력 부재: {path}")
    with path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    if not rows:
        raise InputError(f"{path} 에 데이터 행이 0건이다 — 0건은 통과가 아니다")
    missing = [c for c in required_cols if c not in rows[0]]
    if missing:
        raise InputError(f"{path} 컬럼 누락: {missing}")
    return rows


def read_text(path: Path) -> str:
    if not path.exists():
        raise InputError(f"필수 입력 부재: {path}")
    return path.read_text(encoding="utf-8")


def url_path(url: str) -> str:
    m = re.match(r"^[a-zA-Z][\w+.-]*://[^/]+(/.*)?$", url)
    if not m:
        return url if url.startswith("/") else "/" + url
    return m.group(1) or "/"


def url_host(url: str) -> str:
    m = re.match(r"^[a-zA-Z][\w+.-]*://([^/]+)", url)
    return m.group(1).lower() if m else ""


def glob_to_regex(glob: str) -> re.Pattern[str]:
    """URL 글롭 -> 정규식. `**` 와 `*` 모두 임의 문자열에 대응한다(경로+쿼리 대상)."""
    out = ""
    i = 0
    while i < len(glob):
        ch = glob[i]
        if ch == "*":
            if glob[i : i + 2] == "**":
                out += ".*"
                i += 2
                continue
            out += ".*"
            i += 1
            continue
        out += re.escape(ch)
        i += 1
    return re.compile("^" + out + "$")


def glob_samples(glob: str) -> list[str]:
    """글롭에서 robots 대조용 표본 URL 을 만든다 (와일드카드 제거·치환)."""
    return sorted(
        {
            glob.replace("**", "").replace("*", ""),
            glob.replace("**", "x").replace("*", "x"),
            glob.replace("**", "sample/path").replace("*", "sample"),
        }
    )


def parse_har(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise InputError(f"필수 입력 부재: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise InputError(f"{path} 는 유효한 HAR(JSON)이 아니다: {exc}") from exc
    entries = data.get("log", {}).get("entries")
    if not isinstance(entries, list) or not entries:
        raise InputError(f"{path} 에 HAR 엔트리가 없다 — 물증 없는 probe 는 통과가 아니다")
    return entries


def har_time(entry: dict[str, Any]) -> datetime:
    ts = entry.get("startedDateTime")
    if not isinstance(ts, str):
        raise InputError("HAR 엔트리에 startedDateTime 이 없다")
    ts = ts.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(ts).astimezone(timezone.utc)
    except ValueError as exc:
        raise InputError(f"HAR startedDateTime 파싱 실패: {ts}") from exc


# ──────────────────────────────────────────────────────────────────────────────
# 컨텍스트 — 전 검사가 공유하는 입력
# ──────────────────────────────────────────────────────────────────────────────
class Ctx:
    def __init__(self, root: Path):
        self.root = root
        self.d3 = root / D3
        if not self.d3.is_dir():
            raise InputError(f"{self.d3} 가 없다 — D3 산출물 트리를 찾을 수 없다")

    # -- verdicts -------------------------------------------------------------
    def verdicts(self) -> list[dict[str, str]]:
        return read_csv(
            self.d3 / "verdicts.csv",
            ("source", "verdict", "rule_id", "tos_ref", "tos_clause"),
        )

    def adapter_sources(self) -> list[str]:
        return [r["source"] for r in self.verdicts() if r["verdict"] in ADAPTER_VERDICTS]

    # -- policy ---------------------------------------------------------------
    def policy(self) -> dict[str, dict[str, Any]]:
        return load_policy(self.d3 / "crawl_policy.yaml")

    # -- robots ---------------------------------------------------------------
    def robots_index(self) -> list[dict[str, str]]:
        return read_csv(
            self.d3 / "snapshots/robots/index.csv",
            ("source", "host", "url", "fetched_at_utc", "http_status", "sha256", "path"),
        )

    def robots_by_host(self) -> dict[str, Robots]:
        out: dict[str, Robots] = {}
        for row in self.robots_index():
            p = self.root / row["path"]
            if not p.exists():
                raise InputError(f"robots 스냅샷 파일 부재: {row['path']}")
            if row["http_status"] != "200":
                # 200 이 아닌 스냅샷은 robots 원문이 아니다 → 그 호스트는 '확인 불가'.
                continue
            out[row["host"].lower()] = Robots(p.read_text(encoding="utf-8", errors="replace"), row["host"])
        return out

    def robots_status(self) -> dict[str, str]:
        return {r["host"].lower(): r["http_status"] for r in self.robots_index()}

    # -- probe / reachability -------------------------------------------------
    def probe_log(self) -> list[dict[str, str]]:
        return read_csv(
            self.d3 / "rate_probe_log.csv",
            ("source", "seq", "requested_at", "url", "http_status"),
        )

    def reachability(self, source: str) -> list[dict[str, str]]:
        return read_csv(
            self.d3 / f"reachability/{source}.csv",
            ("source", "url", "http_status", "snapshot_path", "snapshot_sha256", "business_name"),
        )

    def har(self, source: str) -> list[dict[str, Any]]:
        return parse_har(self.d3 / f"probe/{source}.har")

    # -- text -----------------------------------------------------------------
    def report_md(self) -> str:
        return read_text(self.d3 / "report.md")

    def g3_md(self) -> str:
        return read_text(self.root / G3_PATH)

    def republish_md(self) -> str:
        return read_text(self.d3 / "republish_policy.md")

    def verdict_rule_md(self) -> str:
        return read_text(self.d3 / "verdict_rule.md")


# ──────────────────────────────────────────────────────────────────────────────
# REQ-1 — 소스 실사표
# ──────────────────────────────────────────────────────────────────────────────
def check_sources(ctx: Ctx, rep: Report) -> None:
    rule = "REQ-1"
    src_dir = ctx.d3 / "sources"
    if not src_dir.is_dir():
        raise InputError(f"{src_dir} 부재")
    files = sorted(p for p in src_dir.glob("*.md") if not p.name.startswith("_"))
    names = {p.stem for p in files}
    rep.info(rule, f"실사표 {len(files)}건: {sorted(names)}")

    if len(files) < MIN_SOURCE_COUNT:
        rep.fail(rule, f"실사표가 {len(files)}건으로 K-3 하한 {MIN_SOURCE_COUNT}건 미달")
    else:
        rep.ok(rule, f"실사표 {len(files)}건 ≥ {MIN_SOURCE_COUNT}")

    for m in MANDATORY_SOURCES:
        if m in names:
            rep.ok(rule, f"K-3 필수 소스 실사표 존재: {m}.md")
        else:
            rep.fail(rule, f"K-3 필수 소스 실사표 부재: sources/{m}.md")

    robots_rows = {r["source"]: r for r in ctx.robots_index()}
    for p in files:
        text = p.read_text(encoding="utf-8")
        heads = {
            h.strip().lower()
            for h in re.findall(r"^#{2,4}\s*([A-Za-z_]+)\b", text, flags=re.M)
        }
        missing = [s for s in REQUIRED_SOURCE_SECTIONS if s not in heads]
        if missing:
            rep.fail(rule, f"{p.name}: 필수 섹션 누락 {missing} (발견: {sorted(heads)})")
        else:
            rep.ok(rule, f"{p.name}: 필수 섹션 6개 충족")

        if p.stem not in robots_rows:
            rep.fail(
                rule,
                f"{p.name}: robots 스냅샷 인덱스에 소스 {p.stem} 항목이 없다 "
                f"(취득 URL·취득일시·sha256 기록 부재)",
            )
            continue
        row = robots_rows[p.stem]
        snap = ctx.root / row["path"]
        problems = []
        if not snap.exists():
            problems.append(f"스냅샷 파일 부재({row['path']})")
        else:
            digest = hashlib.sha256(snap.read_bytes()).hexdigest()
            if digest != row["sha256"]:
                problems.append(f"sha256 불일치(기록 {row['sha256'][:12]} / 실제 {digest[:12]})")
        if not row["url"].startswith("http"):
            problems.append(f"취득 URL 형식 오류({row['url']})")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", row["fetched_at_utc"]):
            problems.append(f"취득일시(UTC) 형식 오류({row['fetched_at_utc']})")
        if problems:
            rep.fail(rule, f"{p.name}: robots 스냅샷 기록 결함 — {'; '.join(problems)}")
        else:
            rep.ok(rule, f"{p.name}: robots 스냅샷 + URL + 취득일시 + sha256 정합")


# ──────────────────────────────────────────────────────────────────────────────
# REQ-2 / FORBID-2 — verdict
# ──────────────────────────────────────────────────────────────────────────────
def check_verdicts(ctx: Ctx, rep: Report) -> None:
    rows = ctx.verdicts()
    rule_text = ctx.verdict_rule_md()
    defined_rules = set(re.findall(r"^\|\s*`(R-[A-Z0-9-]+)`", rule_text, flags=re.M))
    if not defined_rules:
        rep.fail("REQ-2", "verdict_rule.md 에서 rule_id 정의 집합을 추출하지 못했다")
        return
    rep.info("REQ-2", f"verdict_rule.md 정의 rule_id {len(defined_rules)}건: {sorted(defined_rules)}")

    src_dir = ctx.d3 / "sources"
    table_sources = {p.stem for p in src_dir.glob("*.md") if not p.name.startswith("_")}
    csv_sources = {r["source"] for r in rows}
    if table_sources != csv_sources:
        rep.fail(
            "REQ-2",
            "verdicts.csv 소스 집합과 sources/*.md 집합 불일치",
            f"csv-only={sorted(csv_sources - table_sources)} md-only={sorted(table_sources - csv_sources)}",
        )
    else:
        rep.ok("REQ-2", f"verdicts.csv 소스 집합 == 실사표 집합 ({len(csv_sources)}건)")

    for r in rows:
        s = r["source"]
        v = r["verdict"].strip()
        if v not in VERDICT_ENUM:
            rep.fail("REQ-2", f"{s}: verdict '{v}' 가 K-1 4-enum {VERDICT_ENUM} 밖")
            continue
        if r["rule_id"].strip() not in defined_rules:
            rep.fail("REQ-2", f"{s}: rule_id '{r['rule_id']}' 가 verdict_rule.md 정의 집합에 없다")
        if v in ADAPTER_VERDICTS:
            ref = r["tos_ref"].strip()
            clause = r["tos_clause"].strip()
            if not ref:
                rep.fail("FORBID-2", f"{s}: verdict={v} 인데 tos_ref 가 비어 있다 (반드시 pending)")
            elif not (ctx.root / ref).exists():
                rep.fail(
                    "FORBID-2",
                    f"{s}: verdict={v} 의 tos_ref 가 실재하지 않는다 → {ref} (ToS 미확보는 pending)",
                )
            else:
                rep.ok("FORBID-2", f"{s}: ToS 원문 스냅샷 실재 확인 ({ref})")
            if not clause:
                rep.fail("FORBID-2", f"{s}: verdict={v} 인데 tos_clause 가 비어 있다")
            elif not TOS_CLAUSE_RE.search(clause):
                rep.fail(
                    "FORBID-2",
                    f"{s}: tos_clause '{clause}' 가 조항 정규식(제N조|Section N|§N)에 매칭되지 않는다",
                )
            else:
                rep.ok("FORBID-2", f"{s}: tos_clause 조항 특정 확인 ({clause})")
        else:
            rep.ok("REQ-2", f"{s}: verdict={v} (어댑터 제외)")

    adapters = [r["source"] for r in rows if r["verdict"] in ADAPTER_VERDICTS]
    rep.info("REQ-2", f"어댑터 대상 후보 {len(adapters)}건: {adapters}")


# ──────────────────────────────────────────────────────────────────────────────
# REQ-3 — crawl_policy
# ──────────────────────────────────────────────────────────────────────────────
def check_policy(ctx: Ctx, rep: Report) -> None:
    rule = "REQ-3"
    targets = set(ctx.adapter_sources())
    policy = ctx.policy()
    if not targets:
        rep.fail(
            rule,
            "verdict ∈ {allowed, conditional} 소스가 0건이다 — 대상 0건을 통과로 처리하지 않는다 "
            "(K-6: 2건 미만이면 report.md 의 data_acquisition_blocked 경로를 밟되, "
            "crawl_policy 검사는 대상 부재를 성공으로 보고하지 않는다)",
        )
        return
    if targets != set(policy):
        rep.fail(
            rule,
            "crawl_policy.yaml 키 집합 != verdict ∈ {allowed, conditional} 집합",
            f"policy-only={sorted(set(policy) - targets)} verdict-only={sorted(targets - set(policy))}",
        )
    else:
        rep.ok(rule, f"crawl_policy 키 집합 == 어댑터 대상 집합 ({sorted(targets)})")

    for s in sorted(targets & set(policy)):
        p = policy[s]
        missing = [f for f in POLICY_FIELDS if f not in p]
        if missing:
            rep.fail(rule, f"{s}: 준수 파라미터 누락 {missing}")
            continue
        rep.ok(rule, f"{s}: 준수 파라미터 7개 전부 존재")

        rpm = p["max_requests_per_min"]
        if not isinstance(rpm, int):
            rep.fail(rule, f"{s}: max_requests_per_min 이 정수가 아니다 ({rpm!r})")
        elif rpm < MIN_REQUESTS_PER_MIN:
            rep.fail(
                "FORBID-4",
                f"{s}: max_requests_per_min={rpm} 이 K-2 하한 {MIN_REQUESTS_PER_MIN} 미만",
            )
        else:
            rep.ok(rule, f"{s}: max_requests_per_min={rpm} ≥ {MIN_REQUESTS_PER_MIN}")

        globs = p["allowed_path_globs"]
        if not isinstance(globs, list) or len(globs) < 1:
            rep.fail(rule, f"{s}: allowed_path_globs 가 배열이 아니거나 비었다 ({globs!r})")
        else:
            rep.ok(rule, f"{s}: allowed_path_globs {len(globs)}건")

        if p["expiry_action"] != EXPIRY_ACTION:
            rep.fail(
                rule,
                f"{s}: expiry_action='{p['expiry_action']}' — K-4 는 '{EXPIRY_ACTION}' 만 허용한다 "
                "(F2 source_record 는 DELETE 를 DB 레벨에서 거부한다)",
            )
        else:
            rep.ok("K-4", f"{s}: expiry_action={EXPIRY_ACTION}")

        for f in ("max_concurrency", "retry_backoff_sec", "raw_retention_days"):
            if not isinstance(p[f], int) or p[f] <= 0:
                rep.fail(rule, f"{s}: {f} 는 양의 정수여야 한다 ({p[f]!r})")
        if not str(p["user_agent"]).strip():
            rep.fail(rule, f"{s}: user_agent 가 비어 있다")


# ──────────────────────────────────────────────────────────────────────────────
# FORBID-4 — 요청률 하한 우회 차단
# ──────────────────────────────────────────────────────────────────────────────
def check_rps_floor(ctx: Ctx, rep: Report) -> None:
    rule = "FORBID-4"
    policy = ctx.policy()
    verdicts = {r["source"]: r["verdict"] for r in ctx.verdicts()}
    g3 = ""
    try:
        g3 = ctx.g3_md()
    except InputError:
        rep.fail(rule, f"{G3_PATH} 부재 — 어댑터 대상 목록을 대조할 수 없다")
    checked = 0
    for s, p in policy.items():
        rpm = p.get("max_requests_per_min")
        if not isinstance(rpm, int):
            rep.fail(rule, f"{s}: max_requests_per_min 이 정수가 아니어서 하한 판정 불가 ({rpm!r})")
            continue
        if rpm >= MIN_REQUESTS_PER_MIN:
            continue
        checked += 1
        v = verdicts.get(s, "<verdicts.csv 에 없음>")
        if v != "forbidden":
            rep.fail(
                rule,
                f"{s}: max_requests_per_min={rpm} (<{MIN_REQUESTS_PER_MIN}) 인데 verdict='{v}' — "
                "하한 미달 소스는 forbidden 으로 판정하고 커버리지 손실로 계상해야 한다",
            )
        if s in g3:
            rep.fail(
                rule,
                f"{s}: max_requests_per_min={rpm} (<{MIN_REQUESTS_PER_MIN}) 인데 "
                f"{G3_PATH} 의 어댑터 대상 목록에 등장한다",
            )
    rep.ok(rule, f"하한 미달({MIN_REQUESTS_PER_MIN} 미만) 소스 {checked}건에 대한 우회 검사 완료")
    for s, p in policy.items():
        rpm = p.get("max_requests_per_min")
        if isinstance(rpm, int) and rpm >= MIN_REQUESTS_PER_MIN:
            rep.ok(rule, f"{s}: max_requests_per_min={rpm} — 하한 준수")


# ──────────────────────────────────────────────────────────────────────────────
# REQ-4 / FORBID-3 — rate probe
# ──────────────────────────────────────────────────────────────────────────────
def check_rate_probe(ctx: Ctx, rep: Report) -> None:
    rule = "REQ-4"
    targets = ctx.adapter_sources()
    if not targets:
        rep.fail(rule, "어댑터 대상 소스가 0건 — probe 대상 0건을 통과로 처리하지 않는다")
        return
    policy = ctx.policy()
    log_all = ctx.probe_log()

    for s in targets:
        log = [r for r in log_all if r["source"] == s]
        if len(log) != PROBE_ROWS:
            rep.fail(rule, f"{s}: rate_probe_log.csv 행 수 {len(log)} != {PROBE_ROWS}")
        else:
            rep.ok(rule, f"{s}: rate_probe_log.csv {PROBE_ROWS}행")

        entries = ctx.har(s)
        if len(entries) != PROBE_ROWS:
            rep.fail(rule, f"{s}: HAR 엔트리 {len(entries)}건 != {PROBE_ROWS}")

        # 로그 <-> HAR 20/20 대응
        har_pairs = []
        for e in entries:
            har_pairs.append((e["startedDateTime"], int(e["response"]["status"]), e["request"]["url"]))
        log_pairs = [(r["requested_at"], int(r["http_status"]), r["url"]) for r in log]
        if sorted(har_pairs) != sorted(log_pairs):
            only_log = sorted(set(log_pairs) - set(har_pairs))[:3]
            only_har = sorted(set(har_pairs) - set(log_pairs))[:3]
            rep.fail(
                rule,
                f"{s}: (requested_at, http_status, url) 이 HAR 엔트리와 {PROBE_ROWS}/{PROBE_ROWS} 대응하지 않는다",
                f"log-only={only_log} har-only={only_har}",
            )
        else:
            rep.ok(rule, f"{s}: 로그 ↔ HAR {PROBE_ROWS}/{PROBE_ROWS} 대응")

        bad = [(e["request"]["url"], e["response"]["status"]) for e in entries if int(e["response"]["status"]) in (403, 429)]
        if bad:
            rep.fail(rule, f"{s}: HAR 기준 429/403 {len(bad)}건 발생", str(bad[:3]))
        else:
            rep.ok(rule, f"{s}: HAR 기준 429·403 0건")

        rpm = policy.get(s, {}).get("max_requests_per_min")
        if not isinstance(rpm, int):
            rep.fail("FORBID-3", f"{s}: crawl_policy 에 정수 max_requests_per_min 이 없어 윈도우 판정 불가")
            continue
        times = sorted(har_time(e) for e in entries)
        worst = 0
        worst_at = None
        for i, t0 in enumerate(times):
            cnt = sum(1 for t in times[i:] if t < t0 + timedelta(seconds=SLIDING_WINDOW_SEC))
            if cnt > worst:
                worst, worst_at = cnt, t0
        if worst > rpm:
            rep.fail(
                "FORBID-3",
                f"{s}: HAR 타임스탬프 기준 60초 슬라이딩 윈도우 최대 요청 수 {worst} > "
                f"max_requests_per_min={rpm} (구간 시작 {worst_at.isoformat() if worst_at else '?'})",
            )
        else:
            rep.ok("FORBID-3", f"{s}: 60초 윈도우 최대 {worst} ≤ {rpm}")


# ──────────────────────────────────────────────────────────────────────────────
# REQ-5 / FORBID-5 — republish policy & PII
# ──────────────────────────────────────────────────────────────────────────────
MOBILE_RE = re.compile(r"(?<!\d)01[016789][-. ]?\d{3,4}[-. ]?\d{4}(?!\d)")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
SNS_RE = re.compile(
    r"(?:instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|threads\.net)/"
    r"(?!p/|explore/|reel/)[A-Za-z0-9._]{2,}|(?<![A-Za-z0-9._])@[A-Za-z0-9._]{3,}"
)
SURNAMES = (
    "김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구민진지엄"
    "채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용봉갈"
)
PERSON_STANDALONE_RE = re.compile(rf"^[{SURNAMES}][가-힣]{{1,2}}$")
PERSON_HONORIFIC_RE = re.compile(rf"[{SURNAMES}][가-힣]{{1,2}}\s*(?:님|씨|강사|트레이너|원장|선생님|실장|디자이너)")
PII_FIELD_NAMES = (
    "author",
    "nickname",
    "reviewer",
    "writer",
    "profile_url",
    "mobile",
    "email",
    "sns",
    "instagram",
    "face",
    "portrait",
)


def pii_hits(value: str) -> list[str]:
    hits = []
    v = value.strip()
    if MOBILE_RE.search(v):
        hits.append("휴대전화번호")
    if EMAIL_RE.search(v):
        hits.append("이메일")
    if SNS_RE.search(v):
        hits.append("개인 SNS 핸들")
    if PERSON_STANDALONE_RE.fullmatch(v) or PERSON_HONORIFIC_RE.search(v):
        hits.append("인명")
    return hits


def parse_republish(text: str) -> dict[str, dict[str, Any]]:
    """republish_policy.md 의 소스별 블록을 파싱한다.

    형식(고정):
        ## source: <name>
        - allow_fields: a, b, c
        - deny_fields: x, y
        - attribution_text: "..."
        ### allow_field: <field>
        - sample_values: "v1" | "v2" | "v3"
        - pii_assessment: <문장>
    """
    out: dict[str, dict[str, Any]] = {}
    cur_src: str | None = None
    cur_field: str | None = None
    for raw in text.splitlines():
        line = raw.strip()
        m = re.match(r"^##\s+source:\s*(\S+)", line)
        if m:
            cur_src = m.group(1)
            out[cur_src] = {"allow_fields": [], "deny_fields": [], "attribution_text": "", "fields": {}}
            cur_field = None
            continue
        m = re.match(r"^###\s+allow_field:\s*(\S+)", line)
        if m and cur_src:
            cur_field = m.group(1)
            out[cur_src]["fields"][cur_field] = {"sample_values": [], "pii_assessment": ""}
            continue
        if not cur_src:
            continue
        m = re.match(r"^-\s*allow_fields:\s*(.*)$", line)
        if m:
            out[cur_src]["allow_fields"] = [x.strip() for x in m.group(1).split(",") if x.strip()]
            continue
        m = re.match(r"^-\s*deny_fields:\s*(.*)$", line)
        if m:
            out[cur_src]["deny_fields"] = [x.strip() for x in m.group(1).split(",") if x.strip()]
            continue
        m = re.match(r"^-\s*attribution_text:\s*(.*)$", line)
        if m:
            out[cur_src]["attribution_text"] = m.group(1).strip().strip('"')
            continue
        m = re.match(r"^-\s*sample_values:\s*(.*)$", line)
        if m and cur_field:
            vals = [v.strip().strip('"') for v in m.group(1).split("|")]
            out[cur_src]["fields"][cur_field]["sample_values"] = [v for v in vals if v]
            continue
        m = re.match(r"^-\s*pii_assessment:\s*(.*)$", line)
        if m and cur_field:
            out[cur_src]["fields"][cur_field]["pii_assessment"] = m.group(1).strip()
            continue
    return out


def check_republish(ctx: Ctx, rep: Report) -> None:
    rule = "REQ-5"
    targets = set(ctx.adapter_sources())
    if not targets:
        rep.fail(rule, "어댑터 대상 소스가 0건 — republish 대상 0건을 통과로 처리하지 않는다")
        return
    data = parse_republish(ctx.republish_md())
    if set(data) != targets:
        rep.fail(
            rule,
            "republish_policy.md 소스 집합 != verdict ∈ {allowed, conditional} 집합",
            f"md-only={sorted(set(data) - targets)} verdict-only={sorted(targets - set(data))}",
        )
    for s in sorted(targets & set(data)):
        d = data[s]
        for cell in ("allow_fields", "deny_fields", "attribution_text"):
            if not d[cell]:
                rep.fail(rule, f"{s}: {cell} 이 비어 있다")
        if d["allow_fields"] and d["deny_fields"] and d["attribution_text"]:
            rep.ok(rule, f"{s}: allow/deny/attribution 3셀 채워짐")
        for f in d["allow_fields"]:
            fd = d["fields"].get(f)
            if fd is None:
                rep.fail(rule, f"{s}.{f}: allow_field 상세 블록(### allow_field: {f}) 이 없다")
                continue
            if len(fd["sample_values"]) != 3:
                rep.fail(
                    rule,
                    f"{s}.{f}: sample_values 가 {len(fd['sample_values'])}건 — 정확히 3건이어야 한다",
                )
            if not fd["pii_assessment"]:
                rep.fail(rule, f"{s}.{f}: pii_assessment 문자열이 없다")
            if len(fd["sample_values"]) == 3 and fd["pii_assessment"]:
                rep.ok(rule, f"{s}.{f}: 샘플값 3건 + pii_assessment 존재")
        extra = set(d["fields"]) - set(d["allow_fields"])
        if extra:
            rep.fail(rule, f"{s}: allow_fields 에 없는 allow_field 블록 {sorted(extra)}")


def check_pii(ctx: Ctx, rep: Report) -> None:
    rule = "FORBID-5"
    targets = set(ctx.adapter_sources())
    if not targets:
        rep.fail(rule, "어댑터 대상 소스가 0건 — PII 검사 대상 0건을 통과로 처리하지 않는다")
        return
    data = parse_republish(ctx.republish_md())
    total = 0
    for s in sorted(targets & set(data)):
        d = data[s]
        for f, fd in d["fields"].items():
            for v in fd["sample_values"]:
                total += 1
                hits = pii_hits(v)
                if hits:
                    rep.fail(
                        rule,
                        f"{s}.{f}: 샘플값이 K-5 값 패턴에 매칭 — {hits} / 값={v!r}. "
                        "해당 필드는 재공개 allow 목록에 유지할 수 없다",
                    )
        # 보조 수단: 필드명 사전 (1차 판정은 값 기준이다)
        for f in d["allow_fields"]:
            low = f.lower()
            if any(k in low for k in PII_FIELD_NAMES):
                rep.fail(rule, f"{s}: allow_field 이름 '{f}' 가 PII 필드명 사전에 매칭 (보조 판정)")
    if total == 0:
        rep.fail(rule, "검사한 샘플값이 0건 — 대상 0건을 통과로 처리하지 않는다")
    else:
        rep.ok(rule, f"샘플값 {total}건을 K-5 값 패턴(휴대전화·이메일·SNS 핸들·인명)과 대조 완료")


# ──────────────────────────────────────────────────────────────────────────────
# REQ-6 — reachability + K-6
# ──────────────────────────────────────────────────────────────────────────────
def check_reachability(ctx: Ctx, rep: Report) -> None:
    rule = "REQ-6"
    targets = ctx.adapter_sources()
    rep.info(rule, f"verdict ∈ {ADAPTER_VERDICTS} 소스 {len(targets)}건: {targets}")

    if len(targets) < MIN_ADAPTER_SOURCES:
        report = ctx.report_md()
        if BLOCKED_TOKEN not in report:
            rep.fail(
                rule,
                f"어댑터 대상 {len(targets)}건 < K-6 하한 {MIN_ADAPTER_SOURCES}건 인데 "
                f"report.md 에 `{BLOCKED_TOKEN}` 판정이 없다",
            )
        else:
            rep.ok(rule, f"K-6 미달({len(targets)}건) → report.md 에 {BLOCKED_TOKEN} 판정 존재")
        alts = re.findall(r"^\|\s*`?([a-z0-9_]+)`?\s*\|.*대안", report, flags=re.M)
        alt_block = re.search(
            r"^#{2,4}[^\n]*대안 소스 실사[^\n]*\n(.*?)(?=\n#{2,4}\s|\Z)",
            report,
            flags=re.S | re.M,
        )
        alt_names: set[str] = set()
        if alt_block:
            alt_names = set(re.findall(r"`([a-z0-9_]+)`", alt_block.group(1)))
        alt_names |= set(alts)
        src_dir = ctx.d3 / "sources"
        have_tables = {n for n in alt_names if (src_dir / f"{n}.md").exists()}
        if len(have_tables) < MIN_ALT_SOURCES_WHEN_BLOCKED:
            rep.fail(
                rule,
                f"K-6 미달 시 요구되는 대안 소스 실사표가 {len(have_tables)}건 "
                f"(< {MIN_ALT_SOURCES_WHEN_BLOCKED}) — report.md '대안 소스 실사' 절에서 인식된 소스: "
                f"{sorted(alt_names)}, 실사표 존재: {sorted(have_tables)}",
            )
        else:
            rep.ok(rule, f"대안 소스 실사표 {len(have_tables)}건 ≥ {MIN_ALT_SOURCES_WHEN_BLOCKED}: {sorted(have_tables)}")
    else:
        rep.ok(rule, f"어댑터 대상 {len(targets)}건 ≥ K-6 하한 {MIN_ADAPTER_SOURCES}건")

    if not targets:
        rep.fail(rule, "어댑터 대상 0건 — reachability 대상 0건을 통과로 처리하지 않는다")
        return

    for s in targets:
        rows = ctx.reachability(s)
        if len(rows) < REACHABILITY_ROWS:
            rep.fail(rule, f"{s}: reachability {len(rows)}행 < {REACHABILITY_ROWS}행")
        else:
            rep.ok(rule, f"{s}: reachability {len(rows)}행 ≥ {REACHABILITY_ROWS}")
        for r in rows:
            tag = f"{s}#{r.get('seq', '?')}"
            if r["http_status"].strip() != "200":
                rep.fail(rule, f"{tag}: HTTP {r['http_status']} — 200 응답 실증이 아니다 ({r['url']})")
            snap = ctx.root / r["snapshot_path"]
            if not snap.exists():
                rep.fail(rule, f"{tag}: 응답 스냅샷 파일 부재 ({r['snapshot_path']})")
            else:
                digest = hashlib.sha256(snap.read_bytes()).hexdigest()
                if digest != r["snapshot_sha256"]:
                    rep.fail(rule, f"{tag}: 스냅샷 sha256 불일치")
            if not r["business_name"].strip():
                rep.fail(rule, f"{tag}: 상호명 추출값이 비어 있다")
            district = (r.get("district") or "").strip()
            if district not in ("강남구", "서초구", "송파구"):
                rep.fail(
                    rule,
                    f"{tag}: district='{district}' — 강남3구(강남구·서초구·송파구) 실증이 아니다",
                )


# ──────────────────────────────────────────────────────────────────────────────
# REQ-7 — report / G3
# ──────────────────────────────────────────────────────────────────────────────
def check_report(ctx: Ctx, rep: Report) -> None:
    rule = "REQ-7"
    report = ctx.report_md()
    g3 = ctx.g3_md()
    verdicts = ctx.verdicts()
    adapters = sorted(r["source"] for r in verdicts if r["verdict"] in ADAPTER_VERDICTS)
    excluded = sorted(r["source"] for r in verdicts if r["verdict"] in ("forbidden", "pending"))

    fm = re.match(r"^---\n(.*?)\n---\n", g3, flags=re.S)
    if not fm:
        rep.fail(rule, f"{G3_PATH} 에 YAML front-matter 가 없다")
    else:
        body = fm.group(1)
        for f in G3_FRONTMATTER_FIELDS:
            if not re.search(rf"^{f}\s*:", body, flags=re.M):
                rep.fail(rule, f"{G3_PATH} front-matter 필드 누락: {f}")
        rep.ok(rule, f"{G3_PATH} front-matter 필드 {list(G3_FRONTMATTER_FIELDS)} 확인")

    m = re.search(r"adapter_targets:\s*\[(.*?)\]", g3, flags=re.S)
    if not m:
        rep.fail(
            rule,
            f"{G3_PATH} 에 `adapter_targets: [ ... ]` 형식의 어댑터 대상 목록이 없다",
        )
    else:
        listed = sorted(x.strip().strip("\"'`") for x in m.group(1).split(",") if x.strip())
        if listed != adapters:
            rep.fail(
                rule,
                "G3.md 어댑터 대상 목록 != verdicts.csv 의 allowed·conditional 집합",
                f"G3={listed} verdicts={adapters}",
            )
        else:
            rep.ok(rule, f"G3.md 어댑터 대상 == verdicts allowed·conditional ({adapters})")

    for s in excluded:
        if s not in report:
            rep.fail(rule, f"report.md 에 제외 소스 '{s}' 가 기록되어 있지 않다")
    if excluded:
        rep.ok(rule, f"forbidden·pending 소스 {len(excluded)}건이 report.md 에 기록됨")
    else:
        rep.fail(rule, "forbidden·pending 소스가 0건 — 전 소스 통과는 실사 결과로 성립하지 않는다")

    losses = COVERAGE_LOSS_RE.findall(report)
    if not losses:
        rep.fail(rule, "report.md 에 커버리지 손실 구간이 `숫자~숫자%` 형식으로 없다")
    else:
        rep.ok(rule, f"커버리지 손실 구간 {len(losses)}건: {losses[:5]}")

    refs = re.findall(r"docs/discovery/D3/[\w./-]+", report)
    existing = [r for r in refs if (ctx.root / r).exists()]
    if not existing:
        rep.fail(rule, "report.md 의 커버리지 손실 산출 근거로 참조된 실재 파일 경로가 없다")
    else:
        rep.ok(rule, f"산출 근거 파일 경로 참조 {len(existing)}건 실재 확인")
    broken = [r for r in refs if not (ctx.root / r).exists()]
    if broken:
        rep.fail(rule, f"report.md 가 실재하지 않는 경로를 참조한다: {sorted(set(broken))[:5]}")


# ──────────────────────────────────────────────────────────────────────────────
# FORBID-1 — robots Disallow 경로 수집 차단
# ──────────────────────────────────────────────────────────────────────────────
def _all_probe_urls(ctx: Ctx, source: str) -> list[str]:
    urls = [e["request"]["url"] for e in ctx.har(source)]
    urls += [r["url"] for r in ctx.reachability(source)]
    return urls


def check_robots_conflict(ctx: Ctx, rep: Report) -> None:
    rule = "FORBID-1"
    targets = ctx.adapter_sources()
    if not targets:
        rep.fail(rule, "어댑터 대상 0건 — robots 대조 대상 0건을 통과로 처리하지 않는다")
        return
    policy = ctx.policy()
    robots = ctx.robots_by_host()
    status = ctx.robots_status()
    checked = 0

    for s in targets:
        ua = str(policy.get(s, {}).get("user_agent", "")).strip()
        if not ua:
            rep.fail(rule, f"{s}: user_agent 가 없어 robots 그룹을 특정할 수 없다")
            continue
        candidates = list(policy.get(s, {}).get("allowed_path_globs") or [])
        samples: list[str] = []
        for g in candidates:
            samples.extend(glob_samples(g))
        samples.extend(_all_probe_urls(ctx, s))

        for u in samples:
            host = url_host(u)
            if not host:
                rep.fail(rule, f"{s}: 호스트를 추출할 수 없는 URL/글롭 — {u}")
                continue
            r = robots.get(host)
            if r is None:
                st = status.get(host)
                rep.fail(
                    rule,
                    f"{s}: {host} 의 robots.txt 스냅샷(HTTP 200)이 없어 Disallow 판정이 불가하다 "
                    f"(index.csv http_status={st!r}) — 판정 불가는 통과가 아니다. "
                    "확인 불가 호스트는 allowed_path_globs 및 probe 대상에서 제외해야 한다",
                )
                continue
            checked += 1
            ok, why = r.allows(url_path(u), ua)
            if not ok:
                rep.fail(
                    rule,
                    f"{s}: robots Disallow 경로가 정책/실증에 포함되어 있다 — {u} ({why}, UA={ua})",
                )
    if checked == 0:
        rep.fail(rule, "robots 대조 건수가 0 — 검사 대상 0건을 통과로 처리하지 않는다")
    else:
        rep.ok(rule, f"robots 대조 {checked}건 — Disallow 매칭 0건")


# ──────────────────────────────────────────────────────────────────────────────
# FORBID-6 — 글롭 ↔ 실증 URL 정합
# ──────────────────────────────────────────────────────────────────────────────
def check_glob_probe_consistency(ctx: Ctx, rep: Report) -> None:
    rule = "FORBID-6"
    targets = ctx.adapter_sources()
    if not targets:
        rep.fail(rule, "어댑터 대상 0건 — 글롭 정합 대상 0건을 통과로 처리하지 않는다")
        return
    policy = ctx.policy()
    total = 0
    for s in targets:
        globs = list(policy.get(s, {}).get("allowed_path_globs") or [])
        if not globs:
            rep.fail(rule, f"{s}: allowed_path_globs 가 비어 있어 정합 판정이 불가하다")
            continue
        pats = [(g, glob_to_regex(g)) for g in globs]
        urls = _all_probe_urls(ctx, s)
        if not urls:
            rep.fail(rule, f"{s}: probe/reachability URL 이 0건")
            continue
        unmatched = []
        used: set[str] = set()
        for u in urls:
            total += 1
            hit = next((g for g, p in pats if p.match(u)), None)
            if hit is None:
                unmatched.append(u)
            else:
                used.add(hit)
        if unmatched:
            rep.fail(
                rule,
                f"{s}: allowed_path_globs 에 매칭되지 않는 실증 URL {len(unmatched)}건",
                "; ".join(sorted(set(unmatched))[:5]),
            )
        else:
            rep.ok(rule, f"{s}: 실증 URL {len(urls)}건 전부 글롭 매칭")
        unused = [g for g in globs if g not in used]
        if unused:
            rep.fail(
                rule,
                f"{s}: 실증되지 않은 allowed_path_glob {len(unused)}건 — "
                "검증하지 않은 경로를 C1 allowlist 로 전사할 수 없다",
                "; ".join(unused[:5]),
            )
    if total == 0:
        rep.fail(rule, "대조한 URL 이 0건 — 0건을 통과로 처리하지 않는다")


# ──────────────────────────────────────────────────────────────────────────────
# 메타테스트 — 위반 픽스처가 실제로 잡히는지 (탐지 허구 방지)
# ──────────────────────────────────────────────────────────────────────────────
def check_selftest(ctx: Ctx, rep: Report) -> None:
    rule = "META"
    fx_root = ctx.d3 / "fixtures"
    if not fx_root.is_dir():
        rep.fail(rule, f"위반 픽스처 디렉터리 부재: {fx_root}")
        return
    cases = sorted(p for p in fx_root.iterdir() if p.is_dir() and (p / "fixture.json").exists())
    if len(cases) < 6:
        rep.fail(rule, f"위반 픽스처가 {len(cases)}종 — 계약 done_when 은 6종을 요구한다")
    if not cases:
        return
    for c in cases:
        meta = json.loads((c / "fixture.json").read_text(encoding="utf-8"))
        expect = meta.get("expect")
        tree = c / "tree"
        if not tree.is_dir():
            rep.fail(rule, f"{c.name}: tree/ 가 없다")
            continue
        proc = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), "--root", str(tree), "--all", "--no-selftest"],
            capture_output=True,
            text=True,
            timeout=180,
        )
        if proc.returncode == 0:
            rep.fail(
                rule,
                f"{c.name} ({meta.get('label','')}) 위반 픽스처가 exit 0 — 탐지 실패",
                (proc.stdout or "")[-600:],
            )
            continue
        if expect and f"[{expect}]" not in proc.stdout:
            rep.fail(
                rule,
                f"{c.name}: exit {proc.returncode} 이지만 기대 규칙 {expect} 로 귀속되지 않았다",
                (proc.stdout or "")[-600:],
            )
            continue
        rep.ok(rule, f"{c.name} ({meta.get('label','')}) → exit {proc.returncode}, 규칙 {expect} 귀속")


# ──────────────────────────────────────────────────────────────────────────────
# 실행
# ──────────────────────────────────────────────────────────────────────────────
CHECK_FUNCS = {
    "sources": check_sources,
    "verdicts": check_verdicts,
    "policy": check_policy,
    "rate-probe": check_rate_probe,
    "republish": check_republish,
    "reachability": check_reachability,
    "report": check_report,
    "robots-conflict": check_robots_conflict,
    "rps-floor": check_rps_floor,
    "pii": check_pii,
    "glob-probe-consistency": check_glob_probe_consistency,
    "selftest": check_selftest,
}


def default_root() -> Path:
    return Path(__file__).resolve().parents[2]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="validate_d3.py",
        description="D3 소스 실사 증거 검증기 (계약 docs/tasks/D3.md)",
        add_help=True,
    )
    parser.add_argument("--check", choices=CHECKS, help="단일 검사 실행")
    parser.add_argument("--all", action="store_true", help="전 검사 실행")
    parser.add_argument("--root", default=None, help="리포 루트 (기본: 스크립트 기준)")
    parser.add_argument(
        "--no-selftest",
        action="store_true",
        help="--all 에서 메타테스트를 제외한다 (픽스처 재귀 실행 방지 전용)",
    )
    args = parser.parse_args(argv)

    if not args.check and not args.all:
        parser.error("--check <name> 또는 --all 중 하나가 필요하다")  # exit 2

    root = Path(args.root).resolve() if args.root else default_root()
    names = list(CHECKS) if args.all else [args.check]
    if args.all and args.no_selftest:
        names = [n for n in names if n != "selftest"]

    try:
        ctx = Ctx(root)
    except InputError as exc:
        print(f"INPUT-ERROR: {exc}", file=sys.stderr)
        return 2

    rep = Report(f"validate_d3 [{', '.join(names)}] root={root}")
    for n in names:
        try:
            CHECK_FUNCS[n](ctx, rep)
        except InputError as exc:
            rep.fail(n.upper(), f"입력 결손 — 판정 불가는 통과가 아니다: {exc}")
        except Exception as exc:  # noqa: BLE001
            rep.fail(n.upper(), f"검사 중 예외: {type(exc).__name__}: {exc}")
    return rep.print()


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except InputError as exc:
        print(f"INPUT-ERROR: {exc}", file=sys.stderr)
        sys.exit(2)
