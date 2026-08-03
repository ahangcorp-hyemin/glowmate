#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""D2-SEO-SERP-FEASIBILITY 증거 검증기.

계약: docs/tasks/D2.md
집행 대상: REQ-1 ~ REQ-7 · FORBID-1 ~ FORBID-6

설계 원칙 (docs/02-task-contract-spec.md · CLAUDE.md):

  1. **판정 불가는 통과가 아니다.** 입력 파일 부재 · 0행 · 키 부재는 전부 exit 1 이다.
     "검사 대상 0건" 을 통과로 처리하는 순간 이 검증기는 영구 초록이 된다.
  2. **임계는 계약이 고정한다.** K-1 · K-2 · K-4 상수는 이 파일에 하드코딩되어 있고
     조사자 산출물(difficulty_rule.md)이 그보다 느슨하면 FORBID-1 로 실패한다.
     조사자는 **더 엄격하게만** 정의할 수 있다.
  3. **자기신고를 근거로 쓰지 않는다.** capture_mode 컬럼 같은 자기신고 대신
     스냅샷 원본 HTML 을 직접 파싱해 csv 와 대조한다 (FORBID-3).
  4. **인자·입력과 무관하게 exit 0 인 경로가 없다** (F1 FORBID-6 (b) 비스텁 요구).
     인자 없이 실행하면 argparse 가 exit 2, 결손 입력이면 exit 1 이다.

사용:
    python scripts/discovery/validate_d2.py --check keywords
    python scripts/discovery/validate_d2.py --all
    python scripts/discovery/validate_d2.py --check control        # D2_CONTROL_KEY 필요
    python scripts/discovery/validate_d2.py --seal-control in.csv --out control_set.enc

종료 코드:
    0  검사 통과
    1  검사 실패 (계약 위반 또는 판정 불가)
    2  사용법 오류 · 입출력 오류
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

# ══════════════════════════════════════════════════════════════════════════════
# 계약 고정 상수 — 조사자가 선택할 수 없는 값 (docs/tasks/D2.md "계약 고정 상수")
# ══════════════════════════════════════════════════════════════════════════════

# K-1. enterable 판정 하한. difficulty_rule.md 는 이 값 **이상**만 선언할 수 있다.
K1_MIN_INDEPENDENT_DOMAINS = 3
K1_MIN_UGC_RATIO = 0.5

# K-1. "대형 플랫폼" 최소 제외 목록. 조사자는 추가만 가능, 제거 불가.
K1_REQUIRED_EXCLUDED_DOMAINS = frozenset(
    {
        "blog.naver.com",
        "cafe.naver.com",
        "m.place.naver.com",
        "kin.naver.com",
        "post.naver.com",
        "map.kakao.com",
        "place.map.kakao.com",
        "search.daum.net",
        "google.com/maps",
        "youtube.com",
        "instagram.com",
        "namu.wiki",
        "ko.wikipedia.org",
        "tistory.com",
    }
)

# K-2. SERP 실측 대상 자격.
K2_MIN_VOLUME_SUM = 30
K2_TOP_N = 100

# K-3. 검색량 도구 enum. 엔진별로 서로 달라야 한다.
K3_TOOLS = {
    "google": frozenset({"google_keyword_planner", "ahrefs", "semrush"}),
    "naver": frozenset({"naver_searchad_keywordtool", "blackkiwi"}),
}

# K-4. 상한·결합 규칙.
K4_G2_ENTERABLE_THRESHOLD = 100
K4_BLOCKED_CAP = 20

# REQ-1. 후보 키워드 하한.
REQ1_MIN_KEYWORDS = 600

# REQ-5. 대조군 구성.
CONTROL_TOTAL = 20
CONTROL_EXPECTED_ENTERABLE = 10
CONTROL_EXPECTED_HARD = 10

ENGINES = ("google", "naver")
LABELS = ("enterable", "hard", "blocked", "no_volume_data")
VERDICTS = ("pass", "fail", "inconclusive")
FINALS = ("pass", "channel_redesign", "inconclusive")

# FORBID-3. 로그인 상태 지표. 스냅샷 원본에서 하나라도 검출되면 그 캡처는 근거가 될 수 없다.
LOGIN_MARKER_PATTERNS = (
    (r"accounts\.google\.com/SignOutOptions", "google-signout-menu"),
    (r'\bclass="[^"]*\bgb_[A-Za-z0-9_]*\b[^"]*"[^>]*\baria-label="[^"]*(계정|Account)', "google-gb-avatar"),
    (r'\bid="gb_71"', "google-gb-avatar-node"),
    (r'data-logged-in="true"', "generic-logged-in-attr"),
    (r"MyView", "naver-myview-login-area"),
    (r'\bclass="[^"]*\blogin_area\b', "naver-login-area"),
    (r"nid\.naver\.com/user2/help/myInfo", "naver-my-info"),
)

# 등록가능 도메인 산출용 다단계 접미사 (PSL 전체를 싣지 않는다 — 한국어 SERP 범위에 한정).
_MULTI_LABEL_SUFFIXES = frozenset(
    {
        "co.kr", "or.kr", "ne.kr", "go.kr", "re.kr", "pe.kr", "ac.kr",
        "hs.kr", "ms.kr", "es.kr", "sc.kr", "seoul.kr",
        "co.uk", "org.uk", "com.au", "co.jp", "com.br", "co.nz", "com.cn",
    }
)


# ══════════════════════════════════════════════════════════════════════════════
# 지역 사전 — REQ-1 "region 이 강남3구 및 하위 행정동/역명 사전 내 값"
#
# 이 사전을 **검증기 안에** 둔다. 조사자 산출물(keyword_rule.md)에 두면 지역을 넓혀
# 후보 풀을 늘리는 경로가 검사 밖에서 열린다. 넓히려면 이 파일을 고쳐야 하고,
# 그 diff 는 리뷰에 노출된다.
# ══════════════════════════════════════════════════════════════════════════════

REGION_GU = ("강남구", "서초구", "송파구")

REGION_DONG = (
    # 강남구 법정동·행정동
    "신사동", "논현동", "논현1동", "논현2동", "압구정동", "청담동",
    "삼성동", "삼성1동", "삼성2동", "대치동", "대치1동", "대치2동", "대치4동",
    "역삼동", "역삼1동", "역삼2동", "도곡동", "도곡1동", "도곡2동",
    "개포동", "개포1동", "개포2동", "개포3동", "개포4동",
    "세곡동", "자곡동", "율현동", "일원동", "일원본동", "일원1동", "일원2동", "수서동",
    # 서초구
    "서초동", "서초1동", "서초2동", "서초3동", "서초4동",
    "잠원동", "반포동", "반포1동", "반포2동", "반포3동", "반포4동", "반포본동",
    "방배동", "방배1동", "방배2동", "방배3동", "방배4동", "방배본동",
    "양재동", "양재1동", "양재2동", "우면동", "내곡동", "염곡동", "신원동", "원지동",
    # 송파구
    "잠실동", "잠실본동", "잠실2동", "잠실3동", "잠실4동", "잠실6동", "잠실7동",
    "신천동", "풍납동", "풍납1동", "풍납2동", "송파동", "송파1동", "송파2동",
    "석촌동", "삼전동", "가락동", "가락본동", "가락1동", "가락2동",
    "문정동", "문정1동", "문정2동", "장지동", "위례동",
    "방이동", "방이1동", "방이2동", "오금동", "거여동", "거여1동", "거여2동",
    "마천동", "마천1동", "마천2동",
)

REGION_STATION = (
    # 2호선·신분당선·수인분당선·3호선·7호선·8호선·9호선 중 강남3구 구간
    "강남역", "역삼역", "선릉역", "삼성역", "삼성중앙역", "봉은사역", "종합운동장역",
    "신논현역", "논현역", "언주역", "학동역", "강남구청역", "청담역", "압구정역",
    "압구정로데오역", "신사역", "잠원역", "고속터미널역", "반포역", "구반포역", "신반포역",
    "교대역", "서초역", "방배역", "내방역", "이수역", "남부터미널역", "양재역", "양재시민의숲역",
    "매봉역", "도곡역", "대치역", "학여울역", "한티역", "선정릉역", "대청역", "일원역",
    "수서역", "가락시장역", "개포동역", "구룡역",
    "잠실역", "잠실새내역", "잠실나루역", "몽촌토성역", "석촌역", "석촌고분역", "송파역",
    "문정역", "장지역", "복정역", "방이역", "오금역", "개롱역", "거여역", "마천역",
    "올림픽공원역", "한성백제역", "둔촌오륜역", "삼전역", "가락시장역",
)

REGION_DICT = frozenset(REGION_GU) | frozenset(REGION_DONG) | frozenset(REGION_STATION)


# ══════════════════════════════════════════════════════════════════════════════
# 리포트
# ══════════════════════════════════════════════════════════════════════════════


class Report:
    """검사 결과 수집기. 실패가 1건이라도 있으면 exit 1."""

    def __init__(self, title: str) -> None:
        self.title = title
        self.lines: list[str] = []
        self.failures = 0
        self.passes = 0

    def info(self, msg: str) -> None:
        self.lines.append(f"  ·  {msg}")

    def ok(self, rule: str, msg: str) -> None:
        self.passes += 1
        self.lines.append(f"  ✓  [{rule}] {msg}")

    def fail(self, rule: str, msg: str, detail: str = "") -> None:
        self.failures += 1
        self.lines.append(f"  ✗  [{rule}] {msg}")
        if detail:
            for ln in str(detail).splitlines():
                self.lines.append(f"        {ln}")

    def print_and_code(self) -> int:
        print(f"\n=== {self.title} ===")
        for ln in self.lines:
            print(ln)
        print(
            f"--- {self.title}: pass={self.passes} fail={self.failures} "
            f"→ {'OK' if self.failures == 0 else 'FAILED'}"
        )
        return 0 if self.failures == 0 else 1


# ══════════════════════════════════════════════════════════════════════════════
# 공통 유틸
# ══════════════════════════════════════════════════════════════════════════════


class MissingInput(Exception):
    """입력 부재. 판정 불가이므로 통과가 아니다."""


def read_csv(path: Path, required_cols: tuple[str, ...]) -> list[dict[str, str]]:
    if not path.exists():
        raise MissingInput(f"{path} 가 없다")
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        cols = reader.fieldnames or []
        missing = [c for c in required_cols if c not in cols]
        if missing:
            raise MissingInput(f"{path} 에 필수 컬럼 없음: {missing} (실제 컬럼 {cols})")
        rows = [{(k or ""): (v if v is not None else "") for k, v in r.items()} for r in reader]
    if not rows:
        raise MissingInput(f"{path} 에 데이터 행이 0건이다 — 0건은 통과가 아니다")
    return rows


def read_yaml_block(path: Path, marker: str) -> dict:
    """md 파일 안의 ```yaml 펜스 블록 중 marker 키를 포함하는 첫 블록을 파싱한다.

    yaml 라이브러리 의존을 두지 않기 위해 이 프로젝트가 쓰는 부분집합만 지원한다:
    `key: scalar` · `key:` + `  - item` 리스트 · `#` 주석 · 중첩 1단계.
    """
    if not path.exists():
        raise MissingInput(f"{path} 가 없다")
    text = path.read_text(encoding="utf-8")
    blocks = re.findall(r"```ya?ml\s*\n(.*?)```", text, re.S)
    for block in blocks:
        data = parse_simple_yaml(block)
        if marker in data:
            return data
    raise MissingInput(f"{path} 에 '{marker}' 키를 담은 ```yaml 블록이 없다")


def parse_simple_yaml(text: str) -> dict:
    """YAML 부분집합 파서.

    이 프로젝트의 md 산출물이 쓰는 형태만 지원한다:
      key: scalar            · key: [a, b]
      key:                   + 들여쓴 `- item` 목록
      key:                   + 들여쓴 `sub: v` 맵 (중첩 제한 없음)
    PyYAML 의존을 두지 않는 이유: 이 검증기는 F1 의 discovery job 이
    `pip install` 없이 그대로 실행하는 경로에 있다.
    """
    root: dict = {}
    # (indent, container). container 는 dict 또는 list.
    stack: list[tuple[int, object]] = [(-1, root)]
    # 값이 비어 있는 key 를 만나면 컨테이너 종류가 미정이므로 보류한다.
    pending: tuple[int, dict, str] | None = None

    for raw in text.splitlines():
        if not raw.strip() or raw.strip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())
        stripped = raw.strip()

        if pending is not None:
            p_indent, p_parent, p_key = pending
            if indent > p_indent:
                container: object = [] if stripped.startswith("- ") else {}
                p_parent[p_key] = container
                stack.append((indent, container))
                pending = None
            else:
                p_parent[p_key] = None
                pending = None

        while len(stack) > 1 and indent < stack[-1][0]:
            stack.pop()

        top = stack[-1][1]

        if stripped.startswith("- "):
            item = re.sub(r"\s+#.*$", "", stripped[2:]).strip()
            if isinstance(top, list):
                top.append(_scalar(item))
            continue

        if ":" not in stripped:
            continue
        key, _, val = stripped.partition(":")
        key = key.strip()
        val = re.sub(r"\s+#.*$", "", val).strip()
        if not isinstance(top, dict):
            # 리스트 컨텍스트에서 `key: v` 는 지원하지 않는다 (사용처 없음)
            continue
        if val == "":
            pending = (indent, top, key)
        else:
            top[key] = _scalar(val)

    if pending is not None:
        _, p_parent, p_key = pending
        p_parent[p_key] = None
    return root


def _scalar(v: str):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        if not inner:
            return []
        return [_scalar(x) for x in inner.split(",")]
    low = v.lower()
    if low in ("true", "false"):
        return low == "true"
    if low in ("null", "~", ""):
        return None
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v)
    except ValueError:
        pass
    return v


def read_front_matter(path: Path) -> dict:
    if not path.exists():
        raise MissingInput(f"{path} 가 없다")
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*(\n|$)", text, re.S)
    if not m:
        raise MissingInput(f"{path} 에 YAML front-matter(--- 로 감싼 블록)가 없다")
    return parse_simple_yaml(m.group(1))


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def registrable_domain(host: str) -> str:
    host = (host or "").lower().strip().strip(".")
    host = host.split("@")[-1].split(":")[0]
    if not host:
        return ""
    parts = host.split(".")
    if len(parts) <= 2:
        return host
    if ".".join(parts[-2:]) in _MULTI_LABEL_SUFFIXES:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def url_host_path(url: str) -> tuple[str, str]:
    p = urlparse(url)
    return (p.netloc.lower().split(":")[0], p.path or "/")


def matches_excluded(url: str, excluded: set[str]) -> str | None:
    """대형 플랫폼 제외 목록 매칭. 호스트 동일·서브도메인·`domain/path` 접두 전부 매칭한다.

    서브도메인까지 제외하는 것은 **더 엄격한** 방향이다 (독립 도메인 수가 줄어
    enterable 이 어려워진다). 느슨한 방향의 해석은 채택하지 않는다.
    """
    host, path = url_host_path(url)
    if not host:
        return None
    for entry in excluded:
        e = entry.lower().strip()
        if "/" in e:
            ehost, _, epath = e.partition("/")
            if (host == ehost or host.endswith("." + ehost)) and path.lstrip("/").startswith(epath):
                return entry
        else:
            if host == e or host.endswith("." + e):
                return entry
    return None


# ══════════════════════════════════════════════════════════════════════════════
# 스냅샷 파서 — FORBID-3 (csv ↔ 스냅샷 도메인 목록 대조)
# ══════════════════════════════════════════════════════════════════════════════


class AnchorCollector(HTMLParser):
    """문서 순서대로 <a> 의 href 와 광고 표지 속성을 수집한다."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.anchors: list[tuple[str, str]] = []  # (href, 속성 전체 문자열)

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        d = {k: (v or "") for k, v in attrs}
        href = d.get("href", "")
        if not href:
            return
        self.anchors.append((href, " ".join(f'{k}="{v}"' for k, v in d.items())))


# 엔진별 "검색엔진 자체 UI · 광고 · 트래커" 호스트. 유기적 결과가 아니다.
ENGINE_CHROME_HOSTS = {
    # 주의: 여기에 `naver.com` 을 넣으면 안 된다. 매칭이 서브도메인까지 미치므로
    # blog.naver.com · cafe.naver.com 같은 **유기적 결과**까지 파싱에서 사라지고,
    # 그러면 K-1 의 "대형 플랫폼 제외" 가 애초에 셀 것이 없어 공허해진다.
    "naver": (
        "search.naver.com", "m.search.naver.com", "www.naver.com", "m.naver.com",
        "ader.naver.com", "adcr.naver.com", "ad.search.naver.com", "ads.naver.com",
        "help.naver.com", "policy.naver.com", "mkt.naver.com", "keep.naver.com",
        "dict.naver.com", "papago.naver.com", "navercorp.com", "pstatic.net",
        "nid.naver.com", "siape.veta.naver.com", "veta.naver.com", "cr.naver.com",
        "saedu.naver.com", "weather.naver.com", "notice.naver.com", "clip.naver.com",
        # 통합검색 상단의 자체 버티컬 탭(쇼핑·지도). 유기적 결과가 아니라 네이버 UI 다.
        # 실측 확인: 8개 키워드 전건에서 rank 1·2 를 고정 점유했다 (feasibility_probe).
        "search.shopping.naver.com", "shopping.naver.com", "map.naver.com", "m.map.naver.com",
    ),
    "google": (
        "google.com", "www.google.com", "accounts.google.com", "support.google.com",
        "policies.google.com", "maps.google.com", "news.google.com", "translate.google.com",
        "gstatic.com", "googleusercontent.com", "googleadservices.com", "doubleclick.net",
    ),
}

# 엔진별 광고 표지. anchor 속성에 이 패턴이 있으면 광고다.
ENGINE_AD_MARKERS = {
    "naver": (r"nad-a\d", r"powerlink", r"plsearch", r"/adcr\.naver", r"ader\.naver\.com"),
    "google": (r"googleadservices\.com", r"/aclk\?", r"doubleclick\.net"),
}


def _unwrap_redirect(href: str) -> str:
    """검색엔진 리다이렉트 래퍼를 원본 URL 로 되돌린다."""
    p = urlparse(href)
    if p.netloc.endswith("google.com") and p.path in ("/url", "/imgres"):
        q = parse_qs(p.query)
        for key in ("q", "url", "imgrefurl"):
            if q.get(key):
                return unquote(q[key][0])
    return href


def parse_snapshot_results(html: str, engine: str, limit: int = 10) -> list[tuple[str, str]]:
    """스냅샷 HTML 에서 유기적 결과 (호스트, URL) 목록을 문서 순서대로 산출한다.

    규칙 (docs/discovery/D2/difficulty_rule.md §4 와 동일해야 한다):
      1. <a href> 를 문서 순서대로 수집
      2. 검색엔진 리다이렉트 래퍼(`google.com/url?q=`)는 원본 URL 로 되돌린다
      3. http(s) 절대 URL 만 남긴다
      4. 엔진 chrome 호스트(검색 UI · 트래커 · 정책 페이지) 제외
      5. 광고 표지가 붙은 anchor 제외
      6. **정규화 URL**(scheme+host+path) 기준으로 중복 제거 — 도메인 기준으로 제거하면
         같은 플랫폼의 서로 다른 게시물 N건이 1건으로 합쳐져 상위 10개 구성이 왜곡된다
      7. 앞에서 limit 개
    """
    collector = AnchorCollector()
    collector.feed(html)
    chrome = ENGINE_CHROME_HOSTS.get(engine, ())
    ad_markers = [re.compile(p, re.I) for p in ENGINE_AD_MARKERS.get(engine, ())]
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for href, attrs in collector.anchors:
        if any(m.search(attrs) or m.search(href) for m in ad_markers):
            continue
        url = _unwrap_redirect(href)
        if not url.startswith(("http://", "https://")):
            continue
        host, path = url_host_path(url)
        if not host:
            continue
        if any(host == c or host.endswith("." + c) for c in chrome):
            continue
        norm = f"{host}{path.rstrip('/')}"
        if norm in seen:
            continue
        seen.add(norm)
        out.append((host, url))
        if len(out) >= limit:
            break
    return out


def parse_snapshot_domains(html: str, engine: str, limit: int = 10) -> list[str]:
    """`parse_snapshot_results` 의 호스트만 문서 순서대로."""
    return [host for host, _ in parse_snapshot_results(html, engine, limit)]


def detect_login_markers(html: str) -> list[str]:
    hits = []
    for pattern, name in LOGIN_MARKER_PATTERNS:
        if re.search(pattern, html):
            hits.append(name)
    return hits


# ══════════════════════════════════════════════════════════════════════════════
# 대조군 봉인 — REQ-5
# ══════════════════════════════════════════════════════════════════════════════

SEAL_SCHEME = "pbkdf2-hmac-sha256-ctr-v1"
SEAL_ITERATIONS = 200_000


def _seal_keys(passphrase: str, salt: bytes) -> tuple[bytes, bytes]:
    material = hashlib.pbkdf2_hmac("sha256", passphrase.encode("utf-8"), salt, SEAL_ITERATIONS, 64)
    return material[:32], material[32:]


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        out += hmac.new(key, nonce + counter.to_bytes(8, "big"), hashlib.sha256).digest()
        counter += 1
    return bytes(out[:length])


def seal_control_set(plaintext: bytes, passphrase: str) -> str:
    salt = os.urandom(16)
    nonce = os.urandom(16)
    enc_key, mac_key = _seal_keys(passphrase, salt)
    ct = bytes(a ^ b for a, b in zip(plaintext, _keystream(enc_key, nonce, len(plaintext))))
    mac = hmac.new(mac_key, salt + nonce + ct, hashlib.sha256).hexdigest()
    return json.dumps(
        {
            "scheme": SEAL_SCHEME,
            "iterations": SEAL_ITERATIONS,
            "salt": salt.hex(),
            "nonce": nonce.hex(),
            "ciphertext": base64.b64encode(ct).decode("ascii"),
            "mac": mac,
        },
        indent=2,
    )


def unseal_control_set(blob: str, passphrase: str) -> bytes:
    data = json.loads(blob)
    if data.get("scheme") != SEAL_SCHEME:
        raise ValueError(f"알 수 없는 봉인 스킴: {data.get('scheme')}")
    salt = bytes.fromhex(data["salt"])
    nonce = bytes.fromhex(data["nonce"])
    ct = base64.b64decode(data["ciphertext"])
    enc_key, mac_key = _seal_keys(passphrase, salt)
    expect = hmac.new(mac_key, salt + nonce + ct, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expect, data["mac"]):
        raise ValueError("MAC 불일치 — 키가 틀렸거나 봉인이 변조되었다")
    return bytes(a ^ b for a, b in zip(ct, _keystream(enc_key, nonce, len(ct))))


# ══════════════════════════════════════════════════════════════════════════════
# 데이터 로딩
# ══════════════════════════════════════════════════════════════════════════════


class Dataset:
    """D2 산출물 묶음. 파일 부재는 예외로 올린다 (판정 불가 ≠ 통과)."""

    def __init__(self, root: Path, gate_file: Path) -> None:
        self.root = root
        self.gate_file = gate_file

    # ── 산출물 경로 ────────────────────────────────────────────────
    @property
    def keyword_rule(self) -> Path:
        return self.root / "keyword_rule.md"

    @property
    def difficulty_rule(self) -> Path:
        return self.root / "difficulty_rule.md"

    @property
    def keywords_csv(self) -> Path:
        return self.root / "keywords.csv"

    @property
    def metrics_csv(self) -> Path:
        return self.root / "keyword_metrics.csv"

    @property
    def labels_csv(self) -> Path:
        return self.root / "labels.csv"

    @property
    def collection_log(self) -> Path:
        return self.root / "collection_log.csv"

    @property
    def control_enc(self) -> Path:
        return self.root / "control_set.enc"

    @property
    def report_md(self) -> Path:
        return self.root / "report.md"

    def serp_csv(self, engine: str) -> Path:
        return self.root / f"serp_{engine}.csv"

    # ── 로더 ───────────────────────────────────────────────────────
    def load_keywords(self) -> list[dict[str, str]]:
        return read_csv(self.keywords_csv, ("keyword", "region", "axis", "need", "intent"))

    def load_metrics(self) -> list[dict[str, str]]:
        return read_csv(
            self.metrics_csv,
            (
                "keyword",
                "google_volume",
                "naver_volume",
                "google_source_tool",
                "naver_source_tool",
                "measured_on",
                "status",
            ),
        )

    def load_serp(self, engine: str) -> list[dict[str, str]]:
        return read_csv(
            self.serp_csv(engine),
            (
                "keyword",
                "engine",
                "rank",
                "url",
                "domain",
                "snapshot_path",
                "snapshot_sha256",
                "captured_on",
                "capture_mode",
                "collection_note",
            ),
        )

    def load_labels(self) -> list[dict[str, str]]:
        return read_csv(
            self.labels_csv,
            ("keyword", "engine", "label", "independent_domains", "ugc_ratio", "status"),
        )

    def load_collection_log(self) -> list[dict[str, str]]:
        return read_csv(
            self.collection_log,
            ("keyword", "engine", "attempted_at", "http_status", "status", "evidence_path", "note"),
        )

    def load_difficulty_rule(self) -> dict:
        return read_yaml_block(self.difficulty_rule, "min_independent_domains")

    def load_keyword_rule(self) -> dict:
        return read_yaml_block(self.keyword_rule, "template")

    def load_report(self) -> dict:
        return read_yaml_block(self.report_md, "google_enterable")

    def load_gate(self) -> dict:
        return read_front_matter(self.gate_file)


# ══════════════════════════════════════════════════════════════════════════════
# 파생 계산
# ══════════════════════════════════════════════════════════════════════════════


def parse_volume(raw: str) -> int | None:
    raw = (raw or "").strip()
    if raw == "":
        return None
    return int(raw)


def qualified_keywords(metrics: list[dict[str, str]]) -> list[tuple[str, int]]:
    """K-2 자격(검색량 합 ≥ 30)을 만족하는 키워드를 합계 내림차순으로 반환."""
    out = []
    for row in metrics:
        if (row.get("status") or "").strip() == "no_volume_data":
            continue
        g = parse_volume(row["google_volume"])
        n = parse_volume(row["naver_volume"])
        if g is None or n is None:
            continue
        total = g + n
        if total >= K2_MIN_VOLUME_SUM:
            out.append((row["keyword"], total))
    out.sort(key=lambda kv: (-kv[1], kv[0]))
    return out


def serp_target_set(metrics: list[dict[str, str]]) -> list[str]:
    """실측 대상 = 자격 키워드 중 검색량 합 상위 K2_TOP_N 개."""
    return [k for k, _ in qualified_keywords(metrics)[:K2_TOP_N]]


class DifficultyRule:
    def __init__(self, data: dict) -> None:
        self.min_domains = data.get("min_independent_domains")
        self.min_ugc_ratio = data.get("min_ugc_ratio")
        self.excluded = {str(x).strip().lower() for x in (data.get("excluded_platform_domains") or [])}
        self.ugc_domains = {str(x).strip().lower() for x in (data.get("ugc_domains") or [])}
        self.ugc_path_patterns = [str(x) for x in (data.get("ugc_path_patterns") or [])]

    def is_ugc(self, url: str) -> bool:
        host, path = url_host_path(url)
        for d in self.ugc_domains:
            if host == d or host.endswith("." + d):
                return True
        for pat in self.ugc_path_patterns:
            if re.search(pat, path):
                return True
        return False

    def evaluate(self, rows: list[dict[str, str]]) -> tuple[int, float, str]:
        """(독립 도메인 수, UGC 비중, 라벨) 을 산출한다.

        K-1 문언: "대형 플랫폼 제외 후 남는 개별 서비스 도메인 수 ≥ 3" ·
        "**그 중** UGC 비중 ≥ 0.5" → UGC 비중의 분모는 제외 후 남은 독립 도메인이다.
        분모를 상위 10개 전체로 넓히면 UGC 비중이 구조적으로 커져 enterable 이
        느슨해진다 — 분모를 바꾸는 것이 임계를 바꾸는 것보다 쉽다(CLAUDE.md).
        따라서 분모는 계약 문언대로 **제외 후 독립 도메인 집합**으로 고정한다.
        """
        kept: list[str] = []
        kept_urls: dict[str, str] = {}
        for r in sorted(rows, key=lambda r: int(r["rank"])):
            url = r["url"]
            if matches_excluded(url, self.excluded):
                continue
            dom = registrable_domain(url_host_path(url)[0])
            if not dom or dom in kept_urls:
                continue
            kept.append(dom)
            kept_urls[dom] = url
        n = len(kept)
        if n == 0:
            return 0, 0.0, "hard"
        ugc = sum(1 for d in kept if self.is_ugc(kept_urls[d]))
        ratio = ugc / n
        enterable = n >= int(self.min_domains) and ratio >= float(self.min_ugc_ratio)
        return n, ratio, ("enterable" if enterable else "hard")


def engine_verdict(enterable_count: int, blocked_count: int) -> str:
    """K-4 엔진별 verdict."""
    if blocked_count > K4_BLOCKED_CAP:
        return "inconclusive"
    return "pass" if enterable_count >= K4_G2_ENTERABLE_THRESHOLD else "fail"


def combine_verdicts(google: str, naver: str) -> str:
    """K-4 결합 규칙.

    - 어느 한쪽 inconclusive → inconclusive   (측정 실패는 전략 판단으로 승격되지 않는다)
    - 양쪽 pass → pass
    - 그 외 (naver != pass 이거나 google != pass) → channel_redesign
    """
    if google == "inconclusive" or naver == "inconclusive":
        return "inconclusive"
    if google == "pass" and naver == "pass":
        return "pass"
    return "channel_redesign"


# ══════════════════════════════════════════════════════════════════════════════
# 검사 구현
# ══════════════════════════════════════════════════════════════════════════════


def check_keywords(ds: Dataset, rep: Report) -> None:
    rule = ds.load_keyword_rule()
    rows = ds.load_keywords()

    template = str(rule.get("template") or "")
    if "{region}" not in template or "{axis}" not in template or "{need}" not in template or "{intent}" not in template:
        rep.fail("REQ-1", f"keyword_rule.md 의 template 에 4개 슬롯이 전부 없다: {template!r}")
        return
    slots = {k: [str(x) for x in (rule.get(k) or [])] for k in ("regions", "axes", "needs", "intents")}
    for name, values in slots.items():
        if not values:
            rep.fail("REQ-1", f"keyword_rule.md 의 {name} 목록이 비었다")
    if rep.failures:
        return

    if len(rows) < REQ1_MIN_KEYWORDS:
        rep.fail("REQ-1", f"keywords.csv 행 수 {len(rows)} < 하한 {REQ1_MIN_KEYWORDS}")
    else:
        rep.ok("REQ-1", f"keywords.csv {len(rows)}행 ≥ {REQ1_MIN_KEYWORDS}")

    seen: dict[str, int] = {}
    dups = []
    empty_slots = []
    bad_region = []
    off_rule = []
    mismatch = []
    for i, r in enumerate(rows, start=2):
        kw = (r["keyword"] or "").strip()
        if kw in seen:
            dups.append(f"{kw} (행 {seen[kw]} · {i})")
        seen[kw] = i
        vals = {k: (r[k] or "").strip() for k in ("region", "axis", "need", "intent")}
        for k, v in vals.items():
            if not v:
                empty_slots.append(f"행 {i} {k}")
        if vals["region"] and vals["region"] not in REGION_DICT:
            bad_region.append(f"행 {i} region={vals['region']}")
        for k, name in (("region", "regions"), ("axis", "axes"), ("need", "needs"), ("intent", "intents")):
            if vals[k] and vals[k] not in slots[name]:
                off_rule.append(f"행 {i} {k}={vals[k]} 가 keyword_rule.md {name} 밖")
        try:
            expect = template.format(**vals)
        except (KeyError, IndexError):
            expect = None
        if expect is not None and kw != expect:
            mismatch.append(f"행 {i} keyword={kw!r} != template 적용 {expect!r}")

    for label, items, rule_id in (
        ("keyword 중복", dups, "REQ-1"),
        ("슬롯 컬럼 빈 값", empty_slots, "REQ-1"),
        ("지역 사전 밖 region", bad_region, "REQ-1"),
        ("keyword_rule.md 슬롯 목록 밖 값", off_rule, "REQ-1"),
        ("keyword 가 template 적용 결과와 불일치", mismatch, "REQ-1"),
    ):
        if items:
            rep.fail(rule_id, f"{label} {len(items)}건", "\n".join(items[:10]))
        else:
            rep.ok(rule_id, f"{label} 0건")

    rep.info(
        f"지역 사전 크기 {len(REGION_DICT)} (구 {len(REGION_GU)} · 행정/법정동 {len(set(REGION_DONG))} · 역 {len(set(REGION_STATION))})"
    )


def check_volume(ds: Dataset, rep: Report) -> None:
    kws = {r["keyword"].strip() for r in ds.load_keywords()}
    metrics = ds.load_metrics()

    mk = {r["keyword"].strip() for r in metrics}
    missing = sorted(kws - mk)
    if missing:
        rep.fail("REQ-2", f"keywords.csv 에 있으나 keyword_metrics.csv 에 없는 키워드 {len(missing)}건", "\n".join(missing[:10]))
    else:
        rep.ok("REQ-2", f"keywords 전 {len(kws)}행이 metrics 에 존재")

    g_tools = {(r["google_source_tool"] or "").strip() for r in metrics}
    n_tools = {(r["naver_source_tool"] or "").strip() for r in metrics}
    bad_g = sorted(t for t in g_tools if t not in K3_TOOLS["google"])
    bad_n = sorted(t for t in n_tools if t not in K3_TOOLS["naver"])
    if bad_g:
        rep.fail("REQ-2", f"google_source_tool 이 K-3 enum 밖: {bad_g} (허용 {sorted(K3_TOOLS['google'])})")
    else:
        rep.ok("REQ-2", f"google_source_tool ∈ K-3.google {sorted(g_tools)}")
    if bad_n:
        rep.fail("REQ-2", f"naver_source_tool 이 K-3 enum 밖: {bad_n} (허용 {sorted(K3_TOOLS['naver'])})")
    else:
        rep.ok("REQ-2", f"naver_source_tool ∈ K-3.naver {sorted(n_tools)}")

    same = sorted(g_tools & n_tools)
    if same:
        rep.fail("REQ-2", f"엔진별 source_tool 이 동일 문자열이다: {same} — 분리 측정이 아니다")
    else:
        rep.ok("REQ-2", "google/naver source_tool 이 서로 다른 값")

    bad_int, bad_status, no_date = [], [], []
    for i, r in enumerate(metrics, start=2):
        status = (r["status"] or "").strip()
        blanks = 0
        for col in ("google_volume", "naver_volume"):
            raw = (r[col] or "").strip()
            if raw == "":
                blanks += 1
                continue
            if not re.fullmatch(r"\d+", raw):
                bad_int.append(f"행 {i} {col}={raw!r} — 정수 또는 빈칸이어야 한다")
        if blanks > 0 and status != "no_volume_data":
            bad_status.append(f"행 {i} keyword={r['keyword']} 빈칸 {blanks}개인데 status={status!r} (기대 'no_volume_data')")
        if blanks == 0 and not (r["measured_on"] or "").strip():
            no_date.append(f"행 {i} keyword={r['keyword']} measured_on 없음")

    for label, items in (
        ("volume 컬럼이 정수/빈칸이 아닌 행", bad_int),
        ("빈칸인데 status != 'no_volume_data' 인 행", bad_status),
        ("측정값이 있는데 measured_on 이 없는 행", no_date),
    ):
        if items:
            rep.fail("REQ-2", f"{label} {len(items)}건", "\n".join(items[:10]))
        else:
            rep.ok("REQ-2", f"{label} 0건")

    q = qualified_keywords(metrics)
    rep.info(f"K-2 자격(volume 합 ≥ {K2_MIN_VOLUME_SUM}) 키워드 {len(q)}건 / 전체 {len(metrics)}건")


def _snapshot_key(row: dict[str, str]) -> tuple[str, str]:
    return (row["keyword"].strip(), row["engine"].strip())


def check_serp(ds: Dataset, rep: Report) -> None:
    metrics = ds.load_metrics()
    volume_sum = {}
    for r in metrics:
        g = parse_volume(r["google_volume"])
        n = parse_volume(r["naver_volume"])
        volume_sum[r["keyword"].strip()] = None if (g is None or n is None) else g + n
    target = set(serp_target_set(metrics))
    qualified = {k for k, _ in qualified_keywords(metrics)}
    expected_n = min(K2_TOP_N, len(qualified))
    if expected_n == 0:
        rep.fail(
            "REQ-3",
            f"K-2 자격(volume 합 ≥ {K2_MIN_VOLUME_SUM}) 키워드가 0건이다 — 실측 대상 집합을 확정할 수 없다",
        )
        return
    rep.info(f"실측 대상 = 자격 {len(qualified)}건 중 상위 {expected_n}건 (K-2 · 상한 {K2_TOP_N})")

    try:
        log_rows = ds.load_collection_log()
    except MissingInput as exc:
        log_rows = []
        rep.fail("REQ-3", f"collection_log.csv 를 읽을 수 없다 — blocked 면제를 판정할 수 없다: {exc}")
    blocked_pairs = {
        (r["keyword"].strip(), r["engine"].strip())
        for r in log_rows
        if (r["status"] or "").strip() == "blocked"
    }

    for engine in ENGINES:
        rows = ds.load_serp(engine)
        by_kw: dict[str, list[dict[str, str]]] = {}
        for r in rows:
            if (r["engine"] or "").strip() != engine:
                rep.fail("REQ-3", f"serp_{engine}.csv 에 engine={r['engine']!r} 행이 섞여 있다")
                return
            by_kw.setdefault(r["keyword"].strip(), []).append(r)

        # (1) FORBID-2 — 실측 대상에 volume 하한 미달 키워드가 섞이면 안 된다
        low = sorted(k for k in by_kw if volume_sum.get(k) is None or volume_sum[k] < K2_MIN_VOLUME_SUM)
        if low:
            rep.fail(
                "FORBID-2",
                f"serp_{engine}.csv 에 volume 합 < {K2_MIN_VOLUME_SUM} (또는 미측정) 키워드 {len(low)}건이 포함됐다",
                "\n".join(f"{k} (합={volume_sum.get(k)})" for k in low[:10]),
            )
        else:
            rep.ok("FORBID-2", f"serp_{engine}.csv 전 키워드가 volume 합 ≥ {K2_MIN_VOLUME_SUM}")

        # (2) 상위 N 커버리지 — blocked 조합은 면제
        covered = set(by_kw)
        exempt = {k for k in target if (k, engine) in blocked_pairs}
        missing = sorted(target - covered - exempt)
        if missing:
            rep.fail(
                "REQ-3",
                f"{engine}: 실측 대상 상위 {expected_n}건 중 {len(missing)}건에 SERP 행도 blocked 기록도 없다",
                "\n".join(missing[:10]),
            )
        else:
            rep.ok("REQ-3", f"{engine}: 상위 {expected_n}건 커버 (실측 {len(covered & target)} · blocked 면제 {len(exempt)})")

        extra = sorted(covered - target)
        if extra:
            rep.fail(
                "FORBID-2",
                f"{engine}: 실측 대상(상위 {expected_n}) 밖 키워드가 serp csv 에 있다 {len(extra)}건 — 분모 교체 경로",
                "\n".join(extra[:10]),
            )
        else:
            rep.ok("FORBID-2", f"{engine}: 실측 대상 밖 키워드 0건")

        # (3) rank 1~10 · 중복 없음
        bad_rank = []
        for kw, rs in by_kw.items():
            ranks = []
            for r in rs:
                try:
                    ranks.append(int(r["rank"]))
                except ValueError:
                    bad_rank.append(f"{kw}: rank={r['rank']!r} 가 정수가 아니다")
            if sorted(ranks) != sorted(set(ranks)):
                bad_rank.append(f"{kw}: rank 중복 {sorted(ranks)}")
            off = [x for x in ranks if not 1 <= x <= 10]
            if off:
                bad_rank.append(f"{kw}: rank 범위 밖 {off}")
        if bad_rank:
            rep.fail("REQ-3", f"{engine}: rank 검사 위반 {len(bad_rank)}건", "\n".join(bad_rank[:10]))
        else:
            rep.ok("REQ-3", f"{engine}: 전 키워드 rank 1~10 · 중복 0")

        # (4) 스냅샷 존재 + sha256 일치
        bad_snap = []
        for kw, rs in by_kw.items():
            paths = {(r["snapshot_path"] or "").strip() for r in rs}
            if len(paths) != 1:
                bad_snap.append(f"{kw}: snapshot_path 가 행마다 다르다 {sorted(paths)}")
                continue
            rel = paths.pop()
            if not rel:
                bad_snap.append(f"{kw}: snapshot_path 가 비었다")
                continue
            p = (ds.root / rel).resolve()
            if not p.exists():
                bad_snap.append(f"{kw}: 스냅샷 파일 없음 {rel}")
                continue
            actual = sha256_file(p)
            declared = {(r["snapshot_sha256"] or "").strip().lower() for r in rs}
            if declared != {actual}:
                bad_snap.append(f"{kw}: sha256 불일치 declared={sorted(declared)} actual={actual}")
        if bad_snap:
            rep.fail("REQ-3", f"{engine}: 스냅샷 검사 위반 {len(bad_snap)}건", "\n".join(bad_snap[:10]))
        else:
            rep.ok("REQ-3", f"{engine}: 전 키워드 스냅샷 존재 + sha256 일치 ({len(by_kw)}건)")


def check_capture_integrity(ds: Dataset, rep: Report) -> None:
    """FORBID-3 — 로그인 흔적 스캔 + csv↔스냅샷 도메인 목록 대조."""
    checked = 0
    for engine in ENGINES:
        rows = ds.load_serp(engine)
        by_kw: dict[str, list[dict[str, str]]] = {}
        for r in rows:
            by_kw.setdefault(r["keyword"].strip(), []).append(r)
        login_hits, domain_mismatch, unreadable = [], [], []
        for kw, rs in sorted(by_kw.items()):
            rel = (rs[0]["snapshot_path"] or "").strip()
            p = (ds.root / rel).resolve() if rel else None
            if p is None or not p.exists():
                unreadable.append(f"{kw}: 스냅샷 없음 ({rel!r}) — 자기신고 capture_mode 로 대체하지 않는다")
                continue
            html = p.read_text(encoding="utf-8", errors="replace")
            hits = detect_login_markers(html)
            if hits:
                login_hits.append(f"{kw} ({rel}): {hits}")
            parsed = parse_snapshot_domains(html, engine, limit=10)
            declared = [
                (r["domain"] or "").strip().lower()
                for r in sorted(rs, key=lambda r: int(r["rank"]) if r["rank"].isdigit() else 999)
            ]
            if declared != parsed[: len(declared)] or len(parsed) < len(declared):
                domain_mismatch.append(
                    f"{kw}: csv={declared} != 스냅샷 파싱={parsed}"
                )
            checked += 1
        for label, items in (
            ("로그인 상태 지표가 검출된 스냅샷", login_hits),
            ("csv domain 목록이 스냅샷 파싱 결과와 불일치", domain_mismatch),
            ("스냅샷을 읽을 수 없는 키워드", unreadable),
        ):
            if items:
                rep.fail("FORBID-3", f"{engine}: {label} {len(items)}건", "\n".join(items[:10]))
            else:
                rep.ok("FORBID-3", f"{engine}: {label} 0건")
    if checked == 0:
        rep.fail("FORBID-3", "검사한 스냅샷이 0건이다 — 대상 0건을 통과로 처리하지 않는다")
    else:
        rep.info(f"스냅샷 {checked}건 정규식 스캔 + 도메인 대조 완료")


def check_difficulty(ds: Dataset, rep: Report) -> None:
    data = ds.load_difficulty_rule()
    rule = DifficultyRule(data)

    # (1) K-1 하한 비교 — FORBID-1
    if rule.min_domains is None or not isinstance(rule.min_domains, int):
        rep.fail("FORBID-1", f"difficulty_rule.md 의 min_independent_domains 가 정수가 아니다: {rule.min_domains!r}")
    elif rule.min_domains < K1_MIN_INDEPENDENT_DOMAINS:
        rep.fail(
            "FORBID-1",
            f"min_independent_domains={rule.min_domains} < K-1 하한 {K1_MIN_INDEPENDENT_DOMAINS} — 이 룰로 산출한 라벨은 G2 판정 근거가 될 수 없다",
        )
    else:
        rep.ok("FORBID-1", f"min_independent_domains={rule.min_domains} ≥ {K1_MIN_INDEPENDENT_DOMAINS}")

    if rule.min_ugc_ratio is None or not isinstance(rule.min_ugc_ratio, (int, float)):
        rep.fail("FORBID-1", f"difficulty_rule.md 의 min_ugc_ratio 가 수치가 아니다: {rule.min_ugc_ratio!r}")
    elif float(rule.min_ugc_ratio) < K1_MIN_UGC_RATIO:
        rep.fail(
            "FORBID-1",
            f"min_ugc_ratio={rule.min_ugc_ratio} < K-1 하한 {K1_MIN_UGC_RATIO} — 이 룰로 산출한 라벨은 G2 판정 근거가 될 수 없다",
        )
    else:
        rep.ok("FORBID-1", f"min_ugc_ratio={rule.min_ugc_ratio} ≥ {K1_MIN_UGC_RATIO}")

    missing_ex = sorted(d for d in K1_REQUIRED_EXCLUDED_DOMAINS if d.lower() not in rule.excluded)
    if missing_ex:
        rep.fail(
            "FORBID-1",
            f"excluded_platform_domains 가 K-1 최소 제외 목록의 상위집합이 아니다 — 누락 {len(missing_ex)}건",
            "\n".join(missing_ex),
        )
    else:
        rep.ok(
            "FORBID-1",
            f"excluded_platform_domains ⊇ K-1 최소 제외 목록 ({len(K1_REQUIRED_EXCLUDED_DOMAINS)}건 전부 포함 · 총 {len(rule.excluded)}건)",
        )

    if rep.failures:
        rep.fail("REQ-4", "룰이 K-1 하한을 만족하지 못해 라벨 재적용 대조를 수행하지 않는다")
        return

    # (2) 라벨 재적용 대조 — REQ-4
    labels = ds.load_labels()
    metrics = ds.load_metrics()
    volume_sum = {}
    for r in metrics:
        g = parse_volume(r["google_volume"])
        n = parse_volume(r["naver_volume"])
        volume_sum[r["keyword"].strip()] = None if (g is None or n is None) else g + n
    log_rows = ds.load_collection_log()
    blocked_pairs = {
        (r["keyword"].strip(), r["engine"].strip())
        for r in log_rows
        if (r["status"] or "").strip() == "blocked"
    }

    serp_by: dict[tuple[str, str], list[dict[str, str]]] = {}
    for engine in ENGINES:
        for r in ds.load_serp(engine):
            serp_by.setdefault((r["keyword"].strip(), engine), []).append(r)

    mismatches = []
    counts = {lbl: 0 for lbl in LABELS}
    for row in labels:
        kw = row["keyword"].strip()
        engine = row["engine"].strip()
        declared = (row["label"] or "").strip()
        if declared not in LABELS:
            mismatches.append(f"{kw}/{engine}: label={declared!r} 가 허용 집합 {LABELS} 밖")
            continue
        counts[declared] += 1
        vs = volume_sum.get(kw)
        if vs is None or vs < K2_MIN_VOLUME_SUM:
            expect_label, n, ratio = "no_volume_data", 0, 0.0
        elif (kw, engine) in blocked_pairs:
            expect_label, n, ratio = "blocked", 0, 0.0
        else:
            rows = serp_by.get((kw, engine))
            if not rows:
                mismatches.append(f"{kw}/{engine}: serp 행도 blocked 기록도 없는데 label={declared}")
                continue
            n, ratio, expect_label = rule.evaluate(rows)
        if declared != expect_label:
            mismatches.append(f"{kw}/{engine}: label={declared} != 룰 재적용 {expect_label} (독립도메인={n} ugc={ratio:.4f})")
            continue
        try:
            dn = int(row["independent_domains"])
            dr = float(row["ugc_ratio"])
        except ValueError:
            mismatches.append(f"{kw}/{engine}: independent_domains/ugc_ratio 가 수치가 아니다")
            continue
        if dn != n or abs(dr - ratio) > 1e-4:
            mismatches.append(
                f"{kw}/{engine}: 기록된 (독립도메인={dn}, ugc={dr}) != 재계산 ({n}, {ratio:.4f})"
            )

    if mismatches:
        rep.fail("REQ-4", f"라벨 재적용 불일치 {len(mismatches)}건", "\n".join(mismatches[:10]))
    else:
        rep.ok("REQ-4", f"labels.csv {len(labels)}행이 룰 재적용 결과와 100% 일치 {counts}")


def check_control(ds: Dataset, rep: Report) -> None:
    """REQ-5 — 대조군 20건 개봉·대조. 키가 없으면 판정 불가이므로 실패다."""
    key = os.environ.get("D2_CONTROL_KEY", "")
    if not key:
        rep.fail(
            "REQ-5",
            "환경변수 D2_CONTROL_KEY 가 없어 control_set.enc 를 개봉할 수 없다 — 판정 불가는 통과가 아니다",
        )
        return
    if not ds.control_enc.exists():
        rep.fail("REQ-5", f"{ds.control_enc} 가 없다")
        return
    try:
        plain = unseal_control_set(ds.control_enc.read_text(encoding="utf-8"), key).decode("utf-8")
    except Exception as exc:  # noqa: BLE001 — 복호화 실패 원인을 그대로 노출한다
        rep.fail("REQ-5", f"control_set.enc 개봉 실패: {exc}")
        return

    reader = csv.DictReader(plain.splitlines())
    required = ("keyword", "engine", "expected_label", "visual_domains", "snapshot_path", "snapshot_sha256")
    if not reader.fieldnames or any(c not in reader.fieldnames for c in required):
        rep.fail("REQ-5", f"대조군 CSV 컬럼 부족: {reader.fieldnames} (필요 {required})")
        return
    entries = list(reader)

    if len(entries) != CONTROL_TOTAL:
        rep.fail("REQ-5", f"대조군 {len(entries)}건 != {CONTROL_TOTAL}건")
    else:
        rep.ok("REQ-5", f"대조군 {CONTROL_TOTAL}건 개봉")

    n_ent = sum(1 for e in entries if e["expected_label"].strip() == "enterable")
    n_hard = sum(1 for e in entries if e["expected_label"].strip() == "hard")
    if n_ent != CONTROL_EXPECTED_ENTERABLE or n_hard != CONTROL_EXPECTED_HARD:
        rep.fail(
            "REQ-5",
            f"대조군 구성 enterable={n_ent}/{CONTROL_EXPECTED_ENTERABLE} hard={n_hard}/{CONTROL_EXPECTED_HARD} — "
            "한쪽으로 치우친 대조군은 룰의 양방향 이탈을 검출하지 못한다",
        )
    else:
        rep.ok("REQ-5", f"대조군 구성 enterable {n_ent} / hard {n_hard} (양방향 검출)")

    # 실측 100건과 교집합 0
    measured = set()
    for engine in ENGINES:
        for r in ds.load_serp(engine):
            measured.add(r["keyword"].strip())
    overlap = sorted({e["keyword"].strip() for e in entries} & measured)
    if overlap:
        rep.fail("REQ-5", f"대조군이 실측 집합과 겹친다 {len(overlap)}건 — 홀드아웃이 아니다", "\n".join(overlap[:10]))
    else:
        rep.ok("REQ-5", "대조군 ∩ 실측 집합 = ∅ (홀드아웃 분리)")

    rule = DifficultyRule(ds.load_difficulty_rule())
    disagree, no_evidence = [], []
    for e in entries:
        kw, engine = e["keyword"].strip(), e["engine"].strip()
        rel = e["snapshot_path"].strip()
        visual = [d.strip().lower() for d in e["visual_domains"].split("|") if d.strip()]
        if not visual:
            no_evidence.append(f"{kw}/{engine}: 육안 라벨 근거(1페이지 도메인 목록)가 비었다")
        p = (ds.root / rel).resolve() if rel else None
        if p is None or not p.exists():
            no_evidence.append(f"{kw}/{engine}: 스냅샷 없음 {rel!r}")
            continue
        actual_sha = sha256_file(p)
        if actual_sha != e["snapshot_sha256"].strip().lower():
            no_evidence.append(f"{kw}/{engine}: 스냅샷 sha256 불일치")
            continue
        html = p.read_text(encoding="utf-8", errors="replace")
        results = parse_snapshot_results(html, engine, limit=10)
        parsed = [h for h, _ in results]
        if visual and parsed[: len(visual)] != visual:
            no_evidence.append(f"{kw}/{engine}: 육안 근거 도메인 목록 != 스냅샷 파싱 {parsed}")
            continue
        rows = [{"rank": str(i + 1), "url": url} for i, (_, url) in enumerate(results)]
        _, _, got = rule.evaluate(rows)
        if got != e["expected_label"].strip():
            disagree.append(f"{kw}/{engine}: 기대={e['expected_label'].strip()} 룰적용={got} (도메인 {parsed})")

    if no_evidence:
        rep.fail("REQ-5", f"대조군 근거 결손 {len(no_evidence)}건", "\n".join(no_evidence[:10]))
    else:
        rep.ok("REQ-5", "대조군 전건에 스냅샷 + 육안 근거 도메인 목록 존재")

    if disagree:
        rep.fail(
            "REQ-5",
            f"룰 적용 라벨 != 기대 라벨 {len(disagree)}건 / {len(entries)}건 — 20/20 일치가 아니면 룰이 확정되지 않는다",
            "\n".join(disagree[:20]),
        )
    else:
        rep.ok("REQ-5", f"룰 적용 라벨 == 기대 라벨 {len(entries)}/{len(entries)}")


def _blocked_counts(ds: Dataset) -> dict[str, int]:
    log_rows = ds.load_collection_log()
    counts = {e: 0 for e in ENGINES}
    for r in log_rows:
        if (r["status"] or "").strip() != "blocked":
            continue
        eng = (r["engine"] or "").strip()
        if eng in counts:
            counts[eng] += 1
    return counts


def check_blocked_cap(ds: Dataset, rep: Report) -> None:
    """REQ-6 / FORBID-4."""
    counts = _blocked_counts(ds)
    report = ds.load_report()
    for engine in ENGINES:
        c = counts[engine]
        v = str(report.get(f"{engine}_verdict") or "").strip()
        if v not in VERDICTS:
            rep.fail("REQ-6", f"report.md 의 {engine}_verdict={v!r} 가 허용 집합 {VERDICTS} 밖")
            continue
        if c > K4_BLOCKED_CAP:
            if v != "inconclusive":
                rep.fail(
                    "FORBID-4",
                    f"{engine}: blocked {c}건 > 상한 {K4_BLOCKED_CAP} 인데 verdict={v!r} — 확정 verdict 를 부여할 수 없다",
                )
            else:
                rep.ok("FORBID-4", f"{engine}: blocked {c}건 > {K4_BLOCKED_CAP} → verdict=inconclusive 기록됨")
        else:
            rep.ok("REQ-6", f"{engine}: blocked {c}건 ≤ 상한 {K4_BLOCKED_CAP} (verdict={v})")

    # blocked 행마다 HTTP 상태코드 또는 캡차 스크린샷 경로
    bad = []
    for r in ds.load_collection_log():
        if (r["status"] or "").strip() != "blocked":
            continue
        http = (r["http_status"] or "").strip()
        ev = (r["evidence_path"] or "").strip()
        has_http = bool(re.fullmatch(r"\d{3}", http))
        has_ev = bool(ev) and (ds.root / ev).exists()
        if not (has_http or has_ev):
            bad.append(f"{r['keyword']}/{r['engine']}: http_status={http!r} evidence_path={ev!r} — 둘 다 근거가 되지 못한다")
    if bad:
        rep.fail("REQ-6", f"blocked 행 근거 결손 {len(bad)}건", "\n".join(bad[:10]))
    else:
        rep.ok("REQ-6", f"blocked 행 전건에 HTTP 상태코드 또는 캡차 스크린샷 경로 존재 (blocked 총 {sum(counts.values())}건)")


def check_blocked(ds: Dataset, rep: Report) -> None:
    """FORBID-6 — 차단된 조합을 우회 수집해 serp 에 기록하지 않았는가."""
    log_rows = ds.load_collection_log()
    blocked_pairs = {
        (r["keyword"].strip(), r["engine"].strip())
        for r in log_rows
        if (r["status"] or "").strip() == "blocked"
    }
    if not blocked_pairs:
        rep.ok("FORBID-6", "collection_log 에 status=blocked 조합이 0건 — 우회 수집 대상이 없다")

    serp_rows: dict[tuple[str, str], list[dict[str, str]]] = {}
    for engine in ENGINES:
        for r in ds.load_serp(engine):
            serp_rows.setdefault((r["keyword"].strip(), engine), []).append(r)

    violations = []
    ok_recheck = 0
    for pair in sorted(blocked_pairs):
        rows = serp_rows.get(pair)
        if not rows:
            continue  # 차단된 채로 두었다 — 정상
        notes = {(r["collection_note"] or "").strip() for r in rows}
        has_manual = any("manual_recheck" in n for n in notes)
        rel = (rows[0]["snapshot_path"] or "").strip()
        snap_ok = bool(rel) and (ds.root / rel).exists()
        recapture_after_block = False
        if snap_ok:
            # 재캡처 스냅샷은 차단 기록보다 뒤여야 한다.
            blocked_at = max(
                (r["attempted_at"] or "")
                for r in log_rows
                if (r["keyword"].strip(), r["engine"].strip()) == pair and (r["status"] or "").strip() == "blocked"
            )
            captured = max((r["captured_on"] or "") for r in rows)
            recapture_after_block = bool(captured) and captured >= blocked_at
        if has_manual and snap_ok and recapture_after_block:
            ok_recheck += 1
        else:
            violations.append(
                f"{pair[0]}/{pair[1]}: blocked 인데 serp 행 존재. "
                f"manual_recheck={has_manual} 재캡처스냅샷={snap_ok} 차단이후캡처={recapture_after_block}"
            )
    if violations:
        rep.fail(
            "FORBID-6",
            f"차단 조합에 근거 없는 serp 행 {len(violations)}건 — 프록시·캡차 우회·자동 재시도 수집의 흔적",
            "\n".join(violations[:10]),
        )
    else:
        rep.ok(
            "FORBID-6",
            f"차단 조합 {len(blocked_pairs)}건 중 serp 행이 있는 것은 전부 manual_recheck + 차단 이후 재캡처 스냅샷을 갖는다 ({ok_recheck}건)",
        )


def check_verdict(ds: Dataset, rep: Report) -> None:
    """REQ-7 / FORBID-5."""
    labels = ds.load_labels()
    report = ds.load_report()
    gate = ds.load_gate()

    # (1) enterable 라벨 행에 status ∈ {no_volume_data, blocked} 가 섞이면 안 된다
    contaminated = [
        f"{r['keyword']}/{r['engine']} status={r['status']!r}"
        for r in labels
        if (r["label"] or "").strip() == "enterable"
        and (r["status"] or "").strip() in ("no_volume_data", "blocked")
    ]
    if contaminated:
        rep.fail("REQ-7", f"enterable 라벨 행 중 status ∈ {{no_volume_data, blocked}} 인 행 {len(contaminated)}건", "\n".join(contaminated[:10]))
        # FORBID-2 detect 의 "--check verdict 의 volume 하한 필터" 갈래.
        # 검색량 하한 미달·차단 조합이 enterable 분자에 들어가는 경로다.
        rep.fail(
            "FORBID-2",
            f"검색량 하한 미달 또는 차단 조합 {len(contaminated)}건이 enterable 분자에 포함됐다 — 분모/분자 교체 경로",
            "\n".join(contaminated[:10]),
        )
    else:
        rep.ok("REQ-7", "enterable 라벨 행 중 status ∈ {no_volume_data, blocked} 인 행 0건")

    # (2) 재집계 3수치
    per_engine = {e: {kw["keyword"].strip() for kw in labels if kw["engine"].strip() == e and kw["label"].strip() == "enterable"} for e in ENGINES}
    recomputed = {f"{e}_enterable": len(per_engine[e]) for e in ENGINES}
    recomputed["union_enterable"] = len(per_engine["google"] | per_engine["naver"])
    for key, val in recomputed.items():
        declared = report.get(key)
        if declared is None:
            rep.fail("REQ-7", f"report.md 에 {key} 가 없다")
        elif int(declared) != val:
            rep.fail("REQ-7", f"report.md {key}={declared} != csv 재집계 {val}")
        else:
            rep.ok("REQ-7", f"report.md {key}={val} 이 csv 재집계값과 일치")

    # (3) 엔진별 verdict 재적용
    counts = _blocked_counts(ds)
    recomputed_verdicts = {}
    for e in ENGINES:
        rv = engine_verdict(recomputed[f"{e}_enterable"], counts[e])
        recomputed_verdicts[e] = rv
        declared = str(report.get(f"{e}_verdict") or "").strip()
        if declared not in VERDICTS:
            rep.fail("REQ-7", f"report.md 에 {e}_verdict 필드가 없거나 허용 집합 밖: {declared!r}")
        elif declared != rv:
            rep.fail(
                "REQ-7",
                f"{e}_verdict={declared} != K-4 재적용 {rv} (enterable={recomputed[f'{e}_enterable']} · 임계 {K4_G2_ENTERABLE_THRESHOLD} · blocked={counts[e]} · 상한 {K4_BLOCKED_CAP})",
            )
        else:
            rep.ok("REQ-7", f"{e}_verdict={rv} 이 K-4 재적용 결과와 일치")

    # (4) G2.md front-matter
    for field in ("gate", "status", "decided_at", "source_pr"):
        if not str(gate.get(field) or "").strip():
            rep.fail("REQ-7", f"docs/gates/G2.md front-matter 에 {field} 필드가 없다")
        else:
            rep.ok("REQ-7", f"G2.md front-matter {field}={gate.get(field)!r}")
    if str(gate.get("gate") or "").strip() != "G2":
        rep.fail("REQ-7", f"G2.md front-matter gate={gate.get('gate')!r} != 'G2'")

    # (5) FORBID-5 — 결합 규칙 재적용
    expected_final = combine_verdicts(recomputed_verdicts["google"], recomputed_verdicts["naver"])
    declared_final = str(gate.get("final") or "").strip()
    if declared_final not in FINALS:
        rep.fail("FORBID-5", f"G2.md 의 final={declared_final!r} 이 허용 집합 {FINALS} 밖")
    elif declared_final != expected_final:
        rep.fail(
            "FORBID-5",
            f"G2.md final={declared_final} != K-4 결합 규칙 재적용 {expected_final} "
            f"(google={recomputed_verdicts['google']} naver={recomputed_verdicts['naver']})",
        )
    else:
        rep.ok(
            "FORBID-5",
            f"G2.md final={declared_final} 이 K-4 결합 규칙 재적용 결과와 일치 (google={recomputed_verdicts['google']} naver={recomputed_verdicts['naver']})",
        )

    for e in ENGINES:
        gv = str(gate.get(f"{e}_verdict") or "").strip()
        if gv != recomputed_verdicts[e]:
            rep.fail("FORBID-5", f"G2.md {e}_verdict={gv!r} != 재적용 {recomputed_verdicts[e]}")
        else:
            rep.ok("FORBID-5", f"G2.md {e}_verdict={gv}")


# ══════════════════════════════════════════════════════════════════════════════
# 메타테스트 — 위반 픽스처로 검사기 자신의 탐지력을 검증한다
# ══════════════════════════════════════════════════════════════════════════════

FIXTURE_DIRNAME = "fixtures"
REQUIRED_FIXTURE_RULES = ("FORBID-1", "FORBID-2", "FORBID-3", "FORBID-4", "FORBID-5", "FORBID-6")


def _materialize_fixture(fx_dir: Path, fixtures_root: Path, dest: Path) -> tuple[Path, Path]:
    case = json.loads((fx_dir / "case.json").read_text(encoding="utf-8"))
    base = case.get("base")
    if base:
        shutil.copytree(fixtures_root / base / "tree", dest, dirs_exist_ok=True)
    if (fx_dir / "tree").exists():
        shutil.copytree(fx_dir / "tree", dest, dirs_exist_ok=True)
    for rel in case.get("delete", []):
        target = dest / rel
        if target.exists():
            target.unlink()
    return dest / "D2", dest / "G2.md"


def check_fixtures(ds: Dataset, rep: Report) -> None:
    fixtures_root = ds.root / FIXTURE_DIRNAME
    if not fixtures_root.is_dir():
        rep.fail("META", f"{fixtures_root} 가 없다 — 위반 픽스처 없이는 검사기의 탐지력이 입증되지 않는다")
        return
    fx_dirs = sorted(d for d in fixtures_root.iterdir() if d.is_dir() and not d.name.startswith("_"))
    if not fx_dirs:
        rep.fail("META", "픽스처가 0건이다 — 대상 0건을 통과로 처리하지 않는다")
        return

    seen_rules: set[str] = set()
    saw_positive = False
    for fx in fx_dirs:
        case_file = fx / "case.json"
        if not case_file.exists():
            rep.fail("META", f"{fx.name}: case.json 이 없다")
            continue
        case = json.loads(case_file.read_text(encoding="utf-8"))
        expect = case.get("expect")
        checks = case.get("checks") or []
        rule_id = case.get("expect_rule")
        if expect not in ("pass", "fail") or not checks:
            rep.fail("META", f"{fx.name}: case.json 의 expect/checks 가 올바르지 않다 ({expect!r}, {checks!r})")
            continue
        with tempfile.TemporaryDirectory(prefix="d2-fixture-") as tmp:
            data_root, gate_file = _materialize_fixture(fx, fixtures_root, Path(tmp))
            env = dict(os.environ)
            env.update(case.get("env") or {})
            for chk in checks:
                proc = subprocess.run(
                    [
                        sys.executable,
                        str(Path(__file__).resolve()),
                        "--check",
                        chk,
                        "--data-root",
                        str(data_root),
                        "--gate-file",
                        str(gate_file),
                    ],
                    capture_output=True,
                    text=True,
                    env=env,
                    timeout=300,
                )
                out = proc.stdout + proc.stderr
                if expect == "fail":
                    if proc.returncode == 0:
                        rep.fail(
                            "META",
                            f"{fx.name} --check {chk}: 위반 픽스처인데 exit 0 — 검사기가 위반을 놓친다",
                            out[-2000:],
                        )
                        continue
                    if rule_id and f"[{rule_id}]" not in out:
                        rep.fail(
                            "META",
                            f"{fx.name} --check {chk}: exit {proc.returncode} 이지만 실패 사유가 {rule_id} 로 귀속되지 않는다",
                            out[-2000:],
                        )
                        continue
                    rep.ok("META", f"{fx.name} --check {chk} → exit {proc.returncode} · 사유 {rule_id}")
                    if rule_id:
                        seen_rules.add(rule_id)
                else:
                    if proc.returncode != 0:
                        rep.fail(
                            "META",
                            f"{fx.name} --check {chk}: 정상 픽스처인데 exit {proc.returncode} — "
                            "전부 실패시키는 검사기는 아무것도 판정하지 못한다 (원칙 2.5)",
                            out[-3000:],
                        )
                        continue
                    rep.ok("META", f"{fx.name} --check {chk} → exit 0 (정상 경로 존재)")
                    saw_positive = True

    missing_rules = [r for r in REQUIRED_FIXTURE_RULES if r not in seen_rules]
    if missing_rules:
        rep.fail("META", f"위반 픽스처가 커버하지 못한 FORBID: {missing_rules}")
    else:
        rep.ok("META", f"FORBID-1~6 전건이 위반 픽스처로 탐지 확인됨")
    if not saw_positive:
        rep.fail(
            "META",
            "exit 0 을 내는 정상 픽스처가 없다 — 무조건 실패하는 검사기는 위반과 정상을 구분하지 못한다",
        )
    else:
        rep.ok("META", "정상 픽스처가 exit 0 (검사기가 위반만 잡는다)")


# ══════════════════════════════════════════════════════════════════════════════
# 진입점
# ══════════════════════════════════════════════════════════════════════════════

CHECKS = {
    "keywords": ("REQ-1", check_keywords),
    "volume": ("REQ-2", check_volume),
    "serp": ("REQ-3", check_serp),
    "capture-integrity": ("FORBID-3", check_capture_integrity),
    "difficulty": ("REQ-4/FORBID-1", check_difficulty),
    "control": ("REQ-5", check_control),
    "blocked-cap": ("REQ-6/FORBID-4", check_blocked_cap),
    "blocked": ("FORBID-6", check_blocked),
    "verdict": ("REQ-7/FORBID-5", check_verdict),
    "fixtures": ("META", check_fixtures),
}

ALL_ORDER = (
    "keywords",
    "volume",
    "serp",
    "capture-integrity",
    "difficulty",
    "control",
    "blocked-cap",
    "blocked",
    "verdict",
    "fixtures",
)


def default_repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="validate_d2.py",
        description="D2-SEO-SERP-FEASIBILITY 증거 검증기 (docs/tasks/D2.md)",
    )
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", choices=sorted(CHECKS), help="단일 검사 실행")
    g.add_argument("--all", action="store_true", help="전 검사 실행")
    g.add_argument("--seal-control", metavar="CSV", help="대조군 CSV 를 봉인해 control_set.enc 생성")
    p.add_argument("--out", metavar="PATH", help="--seal-control 출력 경로")
    p.add_argument("--data-root", metavar="DIR", help="D2 산출물 디렉터리 (기본 docs/discovery/D2)")
    p.add_argument("--gate-file", metavar="FILE", help="G2 게이트 파일 (기본 docs/gates/G2.md)")
    return p


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    repo = default_repo_root()
    data_root = Path(args.data_root).resolve() if args.data_root else (repo / "docs" / "discovery" / "D2")
    gate_file = Path(args.gate_file).resolve() if args.gate_file else (repo / "docs" / "gates" / "G2.md")

    if args.seal_control:
        key = os.environ.get("D2_CONTROL_KEY", "")
        if not key:
            print("환경변수 D2_CONTROL_KEY 가 필요하다", file=sys.stderr)
            return 2
        src = Path(args.seal_control)
        if not src.exists():
            print(f"입력 파일이 없다: {src}", file=sys.stderr)
            return 2
        if not args.out:
            print("--out 이 필요하다", file=sys.stderr)
            return 2
        blob = seal_control_set(src.read_bytes(), key)
        Path(args.out).write_text(blob, encoding="utf-8")
        print(f"봉인 완료: {args.out} ({SEAL_SCHEME})")
        return 0

    ds = Dataset(data_root, gate_file)
    names = ALL_ORDER if args.all else (args.check,)

    overall = 0
    for name in names:
        rule, fn = CHECKS[name]
        rep = Report(f"D2 --check {name} [{rule}] · data_root={data_root}")
        try:
            fn(ds, rep)
        except MissingInput as exc:
            rep.fail(rule, f"입력 결손: {exc}", "판정 불가는 통과가 아니다")
        except Exception as exc:  # noqa: BLE001 — 예외를 통과로 삼키지 않는다
            rep.fail(rule, f"검사 중 예외: {type(exc).__name__}: {exc}")
        overall |= rep.print_and_code()
    return overall


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        sys.exit(130)
