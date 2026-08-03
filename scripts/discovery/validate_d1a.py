#!/usr/bin/env python3
"""D1a-PROTOCOL 사전등록 검증기 (계약 v1.2.1 — 4축 12칸).

    python scripts/discovery/validate_d1a.py --check <name>
    python scripts/discovery/validate_d1a.py --all

CI job `discovery` (F1-REPO-SCAFFOLD) 가 실행한다. F1 FORBID-6 (b) 에 따라
**인자·입력과 무관하게 항상 exit 0 을 반환하면 그 job 이 red** 가 되므로,
결손 입력·잘못된 인자·판정 불가는 전부 non-zero 로 끝난다.

판정 불가(파일 부재·파싱 실패·git 부재)를 통과로 처리하지 않는다.
검사 대상 0건도 통과로 처리하지 않는다 — 대상이 0건이면 그 자체가 실패다.

의존: Python 표준 라이브러리만 사용한다 (discovery job 은 pip install 을 하지 않는다).
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import hmac
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════════
# 계약 고정 상수 — docs/tasks/D1a.md §K-1~K-11.
# 이 값들은 protocol.md 도 frame_build.md 도 **선택할 수 없다.**
# 검증기가 계약을 대리한다.
# ═══════════════════════════════════════════════════════════════════════════

K1_ALLOWED_CHANNELS = ('website', 'naver_place', 'kakao_map',
                       'instagram_public', 'official_blog')

# K-2 금지 증거 취득 경로 토큰 — protocol.md 전문에서 0건이어야 한다.
# (K-8 단서: frame_build.md·population.csv·ledger_schema.json 은 대상이 아니다)
K2_FORBIDDEN_TOKENS = ('전화', '통화', '카톡', 'DM', '방문문의',
                       '체험단', '카페글', '소셜커머스', '추정')

K3_REQUIRED_CONDITIONS = {
    'posted_on_allowed_channel_now': ('게시', '스냅샷'),
    'amount_and_service_on_same_page': ('금액', '서비스', '동일'),
    'inquiry_only_is_false': ('안내', 'false'),
}

K4_PROCEED_THRESHOLD = 0.40
K4_EXCLUDE_THRESHOLD = 0.25
K4_BETWEEN_VERDICT = 'editor_augment'

K5_FRAME_SOURCES = ('map_category_enumeration', 'public_license_registry')
K5_FORBIDDEN_FILTER_TOKENS = (
    '가격', '요금', '이용권', '예약', '결제', '광고', '상위노출', '상위 노출',
    '평점', '리뷰', '검색결과 상위', '검색 결과 상위', '상위 N', '상위N',
    'price', 'fee', 'booking', 'reservation', 'payment', 'rating', 'review',
    'ranking', 'top_n', 'topn', 'ad_product',
)
K5_ALLOWED_HOSTS = ('file.localdata.go.kr', 'datafile.seoul.go.kr')
# 2026-04-16 정식 폐쇄된 포털 호스트. 문서·코드 전문에서 0건이어야 한다.
K5_DEAD_HOST_TOKEN = 'www.' + 'localdata.go.kr'
K5_SLUGS = ('fitness_centers', 'public_baths', 'clinics',
            'beauty_salons', 'medical_related_businesses')
# T-6 — 미용업·의료유사업은 자치구별로 ID 가 분리돼 있다. 9종 집합 동등.
K5_DATASET_IDS = ('OA-16142', 'OA-16146', 'OA-16480',
                  'OA-17923', 'OA-17924', 'OA-17925',
                  'OA-16379', 'OA-16380', 'OA-16381')
K5_MIN_REQUEST_GAP_SEC = 1.0

# K-6 수치 8종.
K6_PRIMARY_N = 100
K6_AXIS_ALLOCATION = {'exercise_body': 25, 'relax_recovery': 25,
                      'medical_wellness': 25, 'beauty_care': 25}
K6_GU_ALLOCATION = {'강남구': 9, '서초구': 8, '송파구': 8}
K6_MIN_CELL = 8
K6_CELLS = 12
K6_HOLDOUT_N = 25
K6_HOLDOUT_AXIS_ALLOCATION = {'exercise_body': 7, 'relax_recovery': 6,
                              'medical_wellness': 6, 'beauty_care': 6}
K6_REPLACEMENT_CAP = 5
K6_BLOCKED_CAP = 5
K6_N_DEFINITION = '100 - blocked - unreplaceable'
K6_DOUBLE_CHECK_N = 20
K6_DISAGREEMENT_RESOLUTION = 'false'
K6_HOLDOUT_DRIFT_LIMIT_PP = 15.0
K6_RESERVE_N = 20

# K-7 축 정본 구성. 각 집합은 **집합 동등**으로 검사한다.
AXES = ('exercise_body', 'relax_recovery', 'medical_wellness', 'beauty_care')
GUS = ('강남구', '서초구', '송파구')
K7_MEDICAL_SUBJECTS = ('재활의학과', '정형외과', '피부과', '성형외과', '마취통증의학과')
K7_BEAUTY_BUSINESS_TYPES = ('피부미용업', '네일미용업', '종합미용업')
K7_ANMA_BUSINESS_TYPES = ('안마시술소', '안마원')
K7_FITNESS_LICENSE_CATEGORY = ('체력단련장업',)
# §헤어 결정 — 편입 집합에 들어와서는 안 되는 업태.
K7_EXCLUDED_BEAUTY_TOKENS = ('일반미용업', '화장ㆍ분장')
K7_AXIS_MIN_ROWS = {'medical_wellness': 3000, 'beauty_care': 2500,
                    'relax_recovery': 150, 'exercise_body': 1000}
K7_POPULATION_MIN_ROWS = 300
K7_CELL_MIN_ROWS = 20
LICENSE_STATUS_ACTIVE = '영업/정상'

# K-8 population.csv 필수 스키마. 계약 K-8 표에 열거된 컬럼 전부.
# (계약 REQ-6 ① 의 "20종" 은 K-8 표의 항목 수와 1 어긋난다 — 표를 정본으로 보고
#  표에 열거된 21종을 전부 요구한다. 표보다 적게 요구하면 "전부 존재"가 성립하지 않는다.)
K8_COLUMNS = (
    'venue_id', 'name', 'gu', 'axis', 'frame_source', 'dataset_id',
    'license_category', 'medical_subjects', 'org_code', 'license_no',
    'road_address', 'jibun_address', 'license_status',
    'business_type', 'lat', 'lon', 'source_epsg', 'phone',
    'homepage_url', 'open_hours', 'enrich_match',
)
K8_BBOX = {'lat': (37.42, 37.58), 'lon': (126.96, 127.18)}
K8_GU_CENTERS = {'강남구': (37.4959, 127.0664), '서초구': (37.4837, 127.0324),
                 '송파구': (37.5145, 127.1059)}
K8_GU_CENTER_TOLERANCE_M = 1500.0
K8_COORD_FILL_RANGE = (0.90, 0.999)
K8_PHONE_FILL_RANGE = {'beauty_care': (0.10, 0.40)}
K8_PHONE_FILL_DEFAULT = (0.60, 0.95)
K8_MOBILE_BAND_RE = re.compile(r'^0(1[016789])')
K8_ENRICH_VALUES = ('matched', 'no_match', 'ambiguous')
# FORBID-6(a) sentinel 사전 — 원본 결측 자리에 들어가서는 안 되는 값.
K8_SENTINELS = ('0', '0.0', '-', 'N/A', 'n/a', '없음', 'null', 'NULL', 'None',
                'nan', 'NaN', '#N/A', '000-0000-0000')
K8_MAX_COORD_PAIR_SHARE = 0.03

# K-9 알려진 프레임 한계 키 9종.
K9_GAP_KEYS = ('beauty_waxing_no_code', 'beauty_hair_excluded',
               'beauty_phone_fill_21pct', 'free_business_absent',
               'medical_subject_proxy', 'license_bias_direction',
               'map_enumeration_unused', 'epsg5174_offset',
               'axis_n25_precision')
K9_GAP_MIN_CHARS = 40

# K-10 보강 — 프레임 소스가 아니다.
K10_MIN_MATCHED_ROWS = 100
K10_DISTANCE_MEDIAN_MAX_M = 300.0
K10_DISTANCE_P95_MAX_M = 1000.0

# K-5 경로 교차검증 허용 편차.
CROSSCHECK_MAX_DELTA_PCT = 2.0

INCONCLUSIVE_REQUIRED = ('n_below_90', 'replacement_above_5', 'holdout_drift_ge_15pp')

# 홀드아웃 봉인 포맷.
ENC_MAGIC = b'GMHO1\n'
ENC_KDF_ITERS = 600_000
FINGERPRINT_SALT = b'glowmate-d1a-holdout-key-fingerprint'
FINGERPRINT_ITERS = 1_000

SAMPLE_COLUMNS = ['venue_id', 'name', 'gu', 'axis', 'status', 'reserve_rank']

LEDGER_REQUIRED_COLUMNS = [
    'venue_id', 'name', 'gu', 'axis', 'evidence_channel', 'source_url',
    'snapshot_path', 'access_method', 'checked_at', 'price_found',
    'price_evidence_snippet', 'price_structure_type', 'service_menu_raw',
    'absence_check', 'evaluator', 'cohort',
]

PRICE_PATTERN = re.compile(r'\d[\d,]*\s*원|\d+\s*만\s*원|\d+만원')
INQUIRY_PHRASES = ('문의', '상담')

D1A_DIR = os.path.join('docs', 'discovery', 'D1a')
FIXTURE_DIRS = (
    os.path.join('scripts', 'discovery', 'fixtures', 'd1a'),
    os.path.join(D1A_DIR, 'fixtures'),
)
LOCK_TARGETS = ('protocol.md', 'frame_build.md', 'population.csv',
                'sample.csv', 'ledger_schema.json')


# ═══════════════════════════════════════════════════════════════════════════
# 리포트
# ═══════════════════════════════════════════════════════════════════════════

class Report:
    def __init__(self, name: str) -> None:
        self.name = name
        self.failures: list[str] = []
        self.passes = 0

    def ok(self, msg: str) -> None:
        self.passes += 1
        print(f'  ✓ {msg}')

    def fail(self, msg: str, detail: str = '') -> None:
        self.failures.append(msg)
        print(f'  ✗ {msg}')
        if detail:
            for line in str(detail).splitlines():
                print(f'      {line}')

    def info(self, msg: str) -> None:
        print(f'  · {msg}')

    def finish(self) -> int:
        if self.failures:
            print(f'[FAIL] {self.name} — 위반 {len(self.failures)}건 / 통과 {self.passes}건')
            return 1
        if self.passes == 0:
            print(f'[FAIL] {self.name} — 통과 항목 0건. 검사 대상 0건을 통과로 처리하지 않는다')
            return 1
        print(f'[ OK ] {self.name} — 통과 {self.passes}건')
        return 0


class Ctx:
    def __init__(self, root: str) -> None:
        self.root = root

    def path(self, *parts: str) -> str:
        return os.path.join(self.root, *parts)

    def d1a(self, *parts: str) -> str:
        return os.path.join(self.root, D1A_DIR, *parts)


class CheckError(Exception):
    pass


# ═══════════════════════════════════════════════════════════════════════════
# 공통 로더 — 부재·파싱 실패는 예외로 올려 non-zero 로 끝낸다
# ═══════════════════════════════════════════════════════════════════════════

def read_text(path: str) -> str:
    if not os.path.exists(path):
        raise CheckError(f'필수 산출물 부재: {path}')
    return open(path, encoding='utf-8').read()


def read_bytes(path: str) -> bytes:
    if not os.path.exists(path):
        raise CheckError(f'필수 산출물 부재: {path}')
    return open(path, 'rb').read()


def read_json(path: str):
    try:
        return json.loads(read_text(path))
    except json.JSONDecodeError as exc:
        raise CheckError(f'{path} 가 JSON 으로 파싱되지 않는다: {exc}') from exc


def read_csv_rows(path: str) -> list[dict]:
    text = read_text(path)
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        raise CheckError(f'{path} 의 데이터 행이 0건이다 — 빈 입력을 통과로 처리하지 않는다')
    return rows


def sha256_file(path: str) -> str:
    return hashlib.sha256(read_bytes(path)).hexdigest()


def read_snapshot_bytes(path: str) -> bytes:
    raw = read_bytes(path)
    if path.endswith('.gz'):
        import gzip
        return gzip.decompress(raw)
    return raw


BLOCK_RE_TMPL = r'<!--\s*BEGIN {name}\s*-->(.*?)<!--\s*END {name}\s*-->'


def extract_block(text: str, name: str, source: str) -> str:
    m = re.search(BLOCK_RE_TMPL.format(name=re.escape(name)), text, re.S)
    if not m:
        raise CheckError(f'{source} 에 `{name}` 기계 판독 블록이 없다 — 판정 불가는 통과가 아니다')
    return m.group(1)


def extract_json_block(text: str, name: str, source: str):
    body = extract_block(text, name, source)
    fence = re.search(r'```json\s*(.*?)```', body, re.S)
    payload = fence.group(1) if fence else body
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise CheckError(f'{source} 의 `{name}` 블록이 JSON 으로 파싱되지 않는다: {exc}') from exc


def load_protocol(ctx: Ctx) -> dict:
    return extract_json_block(read_text(ctx.d1a('protocol.md')), 'protocol.json', 'protocol.md')


def load_frame(ctx: Ctx) -> dict:
    return read_json(ctx.d1a('frame.json'))


def git_tracked_files(root: str) -> list[str]:
    exe = shutil.which('git')
    if exe is None:
        raise CheckError('git 실행 파일이 없어 추적 대상 파일 목록을 확정할 수 없다')
    proc = subprocess.run([exe, 'ls-files', '-z'], cwd=root,
                          capture_output=True, text=True)
    if proc.returncode != 0:
        raise CheckError(f'git ls-files 실패 (exit {proc.returncode}): {proc.stderr.strip()}')
    files = [f for f in proc.stdout.split('\0') if f]
    if not files:
        raise CheckError('git 추적 파일이 0건이다 — 판정 원천이 비어 있다')
    return files


def set_equal(got, want) -> bool:
    return set(got or ()) == set(want)


def fmt(values) -> str:
    return '{' + ', '.join(sorted(str(v) for v in values)) + '}'


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


# ═══════════════════════════════════════════════════════════════════════════
# 표집 — protocol.md 의 고정 시드로 population.csv 에서 sample 을 재생성한다
# ═══════════════════════════════════════════════════════════════════════════

def sampling_key(seed: str, venue_id: str) -> str:
    return hashlib.sha256(f'{seed}|{venue_id}'.encode()).hexdigest()


def strata_order() -> list:
    return [(axis, gu) for axis in AXES for gu in GUS]


def derive_sample(population: list[dict], seed: str, reserve_n: int) -> list[dict]:
    """(axis, gu) 12칸 층별 고정 시드 추출. 결과는 venue_id 오름차순 정본 순서."""
    order = strata_order()
    primary_quota = {(axis, gu): K6_GU_ALLOCATION[gu] for axis in AXES for gu in GUS}
    for axis in AXES:
        got = sum(primary_quota[(axis, gu)] for gu in GUS)
        if got != K6_AXIS_ALLOCATION[axis]:
            raise CheckError(f'축 {axis} 의 구 배분 합 {got} 이 정원 '
                             f'{K6_AXIS_ALLOCATION[axis]} 과 다르다')

    base, rem = divmod(reserve_n, len(order))
    reserve_quota = {st: base + (1 if i < rem else 0) for i, st in enumerate(order)}

    by_stratum: dict[tuple, list[dict]] = {st: [] for st in order}
    for row in population:
        st = (row['axis'], row['gu'])
        if st in by_stratum:
            by_stratum[st].append(row)

    primary, reserve = [], []
    for st in order:
        pool = sorted(by_stratum[st], key=lambda r: sampling_key(seed, r['venue_id']))
        need = primary_quota[st] + reserve_quota[st]
        if len(pool) < need:
            raise CheckError(f'층 {st} 의 모집단 {len(pool)}건이 필요 표본 {need}건보다 적다')
        primary += pool[:primary_quota[st]]
        reserve += pool[primary_quota[st]:need]

    rows = [{'venue_id': r['venue_id'], 'name': r['name'], 'gu': r['gu'],
             'axis': r['axis'], 'status': 'primary', 'reserve_rank': ''}
            for r in primary]
    rank = 0
    for st in order:
        for r in [x for x in reserve if (x['axis'], x['gu']) == st]:
            rank += 1
            rows.append({'venue_id': r['venue_id'], 'name': r['name'], 'gu': r['gu'],
                         'axis': r['axis'], 'status': 'reserve',
                         'reserve_rank': str(rank)})
    rows.sort(key=lambda r: r['venue_id'])
    return rows


def derive_double_check(primary_ids: list[str], seed: str, n: int) -> list[str]:
    return sorted(sorted(primary_ids, key=lambda v: sampling_key(seed, v))[:n])


# ═══════════════════════════════════════════════════════════════════════════
# 홀드아웃 봉인 — 표준 라이브러리만으로 구성한 CTR(HMAC-SHA256) + Encrypt-then-MAC
# ═══════════════════════════════════════════════════════════════════════════

def _derive_keys(passphrase: str, salt: bytes, iters: int) -> tuple:
    dk = hashlib.pbkdf2_hmac('sha256', passphrase.encode(), salt, iters, dklen=64)
    return dk[:32], dk[32:]


def _keystream(enc_key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        out += hmac.new(enc_key, nonce + counter.to_bytes(4, 'big'), hashlib.sha256).digest()
        counter += 1
    return bytes(out[:length])


def seal(passphrase: str, plaintext: bytes, salt: bytes, nonce: bytes,
         iters: int = ENC_KDF_ITERS) -> bytes:
    enc_key, mac_key = _derive_keys(passphrase, salt, iters)
    ct = bytes(a ^ b for a, b in zip(plaintext, _keystream(enc_key, nonce, len(plaintext))))
    header = ENC_MAGIC + salt + nonce + iters.to_bytes(4, 'big')
    tag = hmac.new(mac_key, header + ct, hashlib.sha256).digest()
    return base64.b64encode(header + ct + tag) + b'\n'


def unseal(passphrase: str, blob: bytes) -> bytes:
    raw = base64.b64decode(blob.strip())
    if not raw.startswith(ENC_MAGIC):
        raise CheckError('holdout.enc 매직 헤더 불일치 — 봉인 포맷이 아니다')
    off = len(ENC_MAGIC)
    salt, nonce = raw[off:off + 16], raw[off + 16:off + 32]
    iters = int.from_bytes(raw[off + 32:off + 36], 'big')
    body = raw[off + 36:]
    ct, tag = body[:-32], body[-32:]
    enc_key, mac_key = _derive_keys(passphrase, salt, iters)
    expect = hmac.new(mac_key, raw[:off + 36] + ct, hashlib.sha256).digest()
    if not hmac.compare_digest(expect, tag):
        raise CheckError('holdout.enc 인증 태그 불일치 — 키가 틀렸거나 봉인이 훼손되었다')
    return bytes(a ^ b for a, b in zip(ct, _keystream(enc_key, nonce, len(ct))))


def key_fingerprint(passphrase: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', passphrase.encode(), FINGERPRINT_SALT,
                               FINGERPRINT_ITERS, dklen=32).hex()


def max_consecutive_run(flags: list) -> int:
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best


# ═══════════════════════════════════════════════════════════════════════════
# 스냅샷 → 텍스트 추출 (definition_examples · D1b 가 공유하는 정본 절차)
# ═══════════════════════════════════════════════════════════════════════════

REPRODUCIBLE_EXTRACTION = 'html_strip'
EXTRACTION_METHODS = ('html_strip', 'macos_vision_ocr', 'pdf_text_layer')

_BLOCK_CLOSE = re.compile(
    r'(?i)</(p|div|tr|li|h[1-6]|td|th|table|section|article|ul|ol|dl|dd|dt|blockquote)\s*>')


def decode_html_bytes(raw: bytes) -> str:
    m = re.search(rb'charset=["\']?([\w\-]+)', raw[:4096], re.I)
    encodings = ([m.group(1).decode('ascii', 'ignore')] if m else []) + \
        ['utf-8', 'cp949', 'euc-kr']
    for enc in encodings:
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode('utf-8', 'replace')


def extract_html_text(raw: bytes) -> str:
    import html as _html
    doc = decode_html_bytes(raw)
    doc = re.sub(r'(?is)<(script|style|noscript|template)[^>]*>.*?</\1\s*>', ' ', doc)
    doc = re.sub(r'(?s)<!--.*?-->', ' ', doc)
    doc = re.sub(r'(?i)<br\s*/?>', '\n', doc)
    doc = _BLOCK_CLOSE.sub('\n', doc)
    doc = re.sub(r'<[^>]+>', '', doc)
    doc = _html.unescape(doc)
    lines = []
    for line in doc.split('\n'):
        line = re.sub(r'[ \t\xa0​]+', ' ', line).strip()
        if line:
            lines.append(line)
    return '\n'.join(lines) + '\n'


# ═══════════════════════════════════════════════════════════════════════════
# price_found 판정 트리 — protocol.md §4 의 분기와 id 가 1:1 대응해야 한다
# ═══════════════════════════════════════════════════════════════════════════

DECISION_BRANCHES = (
    'B1_channel_not_allowed', 'B2_not_currently_posted', 'B3_no_amount_on_page',
    'B4_amount_without_service_name', 'B5_inquiry_only', 'B6_ended_event_only',
    'B7_amount_and_service_same_page',
)

DECISION_ORDER = (
    'B1_channel_not_allowed', 'B2_not_currently_posted', 'B5_inquiry_only',
    'B3_no_amount_on_page', 'B6_ended_event_only',
    'B4_amount_without_service_name', 'B7_amount_and_service_same_page',
)


def decide_price_found(channel: str, obs: dict, allowed_channels) -> tuple:
    if channel not in allowed_channels:
        return False, 'B1_channel_not_allowed'
    if not obs.get('currently_posted'):
        return False, 'B2_not_currently_posted'
    if obs.get('inquiry_only'):
        return False, 'B5_inquiry_only'
    if not obs.get('amount_present'):
        return False, 'B3_no_amount_on_page'
    if obs.get('ended_event_only'):
        return False, 'B6_ended_event_only'
    if not (obs.get('service_name_present') and obs.get('amount_service_same_page')):
        return False, 'B4_amount_without_service_name'
    return True, 'B7_amount_and_service_same_page'


# ═══════════════════════════════════════════════════════════════════════════
# JSON Schema draft 2020-12 — 표준 라이브러리만으로 구현한 부분집합 검증기
# ═══════════════════════════════════════════════════════════════════════════

DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema'

KNOWN_KEYWORDS = {
    '$schema', '$id', '$ref', '$defs', '$comment', '$anchor',
    'title', 'description', 'default', 'examples', 'deprecated',
    'type', 'enum', 'const', 'format',
    'properties', 'patternProperties', 'additionalProperties', 'required',
    'propertyNames', 'minProperties', 'maxProperties', 'dependentRequired',
    'items', 'prefixItems', 'minItems', 'maxItems', 'uniqueItems', 'contains',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
    'minLength', 'maxLength', 'pattern',
    'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else',
}

JSON_TYPES = {'null': type(None), 'boolean': bool, 'object': dict, 'array': list,
              'number': (int, float), 'integer': int, 'string': str}


def check_schema_shape(schema, path: str, errors: list) -> None:
    if isinstance(schema, bool):
        return
    if not isinstance(schema, dict):
        errors.append(f'{path}: 스키마가 객체도 불리언도 아니다')
        return
    for key, value in schema.items():
        here = f'{path}/{key}'
        if key not in KNOWN_KEYWORDS:
            errors.append(f'{here}: draft 2020-12 어휘에 없는 키워드 `{key}`')
            continue
        if key in ('properties', 'patternProperties', '$defs'):
            if not isinstance(value, dict):
                errors.append(f'{here}: 객체여야 한다')
                continue
            for k, v in value.items():
                check_schema_shape(v, f'{here}/{k}', errors)
        elif key in ('allOf', 'anyOf', 'oneOf', 'prefixItems'):
            if not isinstance(value, list) or not value:
                errors.append(f'{here}: 비어 있지 않은 배열이어야 한다')
                continue
            for i, v in enumerate(value):
                check_schema_shape(v, f'{here}/{i}', errors)
        elif key in ('items', 'not', 'if', 'then', 'else', 'contains',
                     'additionalProperties', 'propertyNames'):
            check_schema_shape(value, here, errors)
        elif key == 'required':
            if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
                errors.append(f'{here}: 문자열 배열이어야 한다')
        elif key == 'type':
            for v in (value if isinstance(value, list) else [value]):
                if v not in JSON_TYPES:
                    errors.append(f'{here}: 알 수 없는 타입 `{v}`')
        elif key == 'enum':
            if not isinstance(value, list) or not value:
                errors.append(f'{here}: 비어 있지 않은 배열이어야 한다')
        elif key in ('minItems', 'maxItems', 'minLength', 'maxLength',
                     'minProperties', 'maxProperties'):
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                errors.append(f'{here}: 0 이상의 정수여야 한다')
        elif key == 'pattern':
            try:
                re.compile(value)
            except (re.error, TypeError) as exc:
                errors.append(f'{here}: 정규식이 아니다 ({exc})')


def resolve_ref(root, ref: str):
    if not ref.startswith('#/'):
        raise CheckError(f'지원하지 않는 $ref: {ref} (로컬 포인터만 허용)')
    node = root
    for part in ref[2:].split('/'):
        part = part.replace('~1', '/').replace('~0', '~')
        if not isinstance(node, dict) or part not in node:
            raise CheckError(f'$ref 해석 실패: {ref}')
        node = node[part]
    return node


def validate_instance(schema, instance, root=None, path='') -> list:
    root = schema if root is None else root
    errs: list = []
    if schema is True or schema == {}:
        return errs
    if schema is False:
        return [f'{path or "/"}: false 스키마 — 어떤 값도 허용되지 않는다']
    if '$ref' in schema:
        return validate_instance(resolve_ref(root, schema['$ref']), instance, root, path)

    if 'type' in schema:
        types = schema['type'] if isinstance(schema['type'], list) else [schema['type']]
        ok = False
        for t in types:
            py = JSON_TYPES[t]
            if t == 'integer':
                ok = isinstance(instance, int) and not isinstance(instance, bool)
            elif t == 'number':
                ok = isinstance(instance, (int, float)) and not isinstance(instance, bool)
            elif t == 'boolean':
                ok = isinstance(instance, bool)
            else:
                ok = isinstance(instance, py) and not (t != 'boolean' and isinstance(instance, bool))
            if ok:
                break
        if not ok:
            errs.append(f'{path or "/"}: 타입 불일치 (기대 {types}, 실제 {type(instance).__name__})')
            return errs

    if 'enum' in schema and instance not in schema['enum']:
        errs.append(f'{path or "/"}: enum 위반 ({instance!r})')
    if 'const' in schema and instance != schema['const']:
        errs.append(f'{path or "/"}: const 위반 ({instance!r})')

    if isinstance(instance, str):
        if 'minLength' in schema and len(instance) < schema['minLength']:
            errs.append(f'{path}: minLength 위반')
        if 'maxLength' in schema and len(instance) > schema['maxLength']:
            errs.append(f'{path}: maxLength 위반')
        if 'pattern' in schema and not re.search(schema['pattern'], instance):
            errs.append(f'{path}: pattern 위반 ({instance!r})')

    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if 'minimum' in schema and instance < schema['minimum']:
            errs.append(f'{path}: minimum 위반')
        if 'maximum' in schema and instance > schema['maximum']:
            errs.append(f'{path}: maximum 위반')

    if isinstance(instance, list):
        if 'minItems' in schema and len(instance) < schema['minItems']:
            errs.append(f'{path}: minItems 위반')
        if 'maxItems' in schema and len(instance) > schema['maxItems']:
            errs.append(f'{path}: maxItems 위반')
        if schema.get('uniqueItems') and len(
                {json.dumps(i, sort_keys=True) for i in instance}) != len(instance):
            errs.append(f'{path}: uniqueItems 위반')
        if 'items' in schema:
            for i, item in enumerate(instance):
                errs += validate_instance(schema['items'], item, root, f'{path}/{i}')

    if isinstance(instance, dict):
        for key in schema.get('required', []):
            if key not in instance:
                errs.append(f'{path}/{key}: 필수 속성 누락')
        props = schema.get('properties', {})
        pats = schema.get('patternProperties', {})
        for key, value in instance.items():
            handled = False
            if key in props:
                errs += validate_instance(props[key], value, root, f'{path}/{key}')
                handled = True
            for pat, sub in pats.items():
                if re.search(pat, key):
                    errs += validate_instance(sub, value, root, f'{path}/{key}')
                    handled = True
            if not handled and 'additionalProperties' in schema:
                ap = schema['additionalProperties']
                if ap is False:
                    errs.append(f'{path}/{key}: additionalProperties=false 위반')
                else:
                    errs += validate_instance(ap, value, root, f'{path}/{key}')

    for sub in schema.get('allOf', []):
        errs += validate_instance(sub, instance, root, path)
    if 'anyOf' in schema:
        if not any(not validate_instance(s, instance, root, path) for s in schema['anyOf']):
            errs.append(f'{path or "/"}: anyOf 위반')
    if 'oneOf' in schema:
        hits = sum(1 for s in schema['oneOf'] if not validate_instance(s, instance, root, path))
        if hits != 1:
            errs.append(f'{path or "/"}: oneOf 위반 (일치 {hits}건)')
    if 'not' in schema and not validate_instance(schema['not'], instance, root, path):
        errs.append(f'{path or "/"}: not 위반')
    return errs


# ═══════════════════════════════════════════════════════════════════════════
# 축 결정표 재적용 — frame.json 의 선언형 규칙을 frame_build.py 와 독립 경로로 돈다
# ═══════════════════════════════════════════════════════════════════════════

def split_tokens(value: str) -> set:
    return {t.strip() for t in (value or '').split(',') if t.strip()}


def apply_axis_table(table: list, slug: str, row: dict):
    for rule in table:
        cond = rule.get('when', {})
        if cond.get('slug') != slug:
            continue
        if 'license_category_equals' in cond and \
                (row.get('license_category') or '').strip() != cond['license_category_equals']:
            continue
        if cond.get('license_category_not_empty') and not (row.get('license_category') or '').strip():
            continue
        want = cond.get('business_type_any')
        if want and not (split_tokens(row.get('business_type')) & set(want)):
            continue
        want = cond.get('medical_subjects_any')
        if want and not (split_tokens(row.get('medical_subjects')) & set(want)):
            continue
        return rule.get('axis')
    return None


# ═══════════════════════════════════════════════════════════════════════════
# REQ-1 · FORBID-1 — 프레임
# ═══════════════════════════════════════════════════════════════════════════

def check_frame(ctx: Ctx, rep: Report) -> None:
    md = read_text(ctx.d1a('frame_build.md'))
    meta = load_frame(ctx)
    pop = read_csv_rows(ctx.d1a('population.csv'))

    # ── ② frame_source · 취득 호스트 · 폐쇄 호스트 토큰 ──────────────────
    sources = meta.get('frame_sources')
    if not isinstance(sources, list) or not sources:
        rep.fail('frame.json frame_sources 가 비어 있다')
    elif not set(sources) <= set(K5_FRAME_SOURCES):
        rep.fail(f'FORBID-1(a) — frame_sources 가 K-5 enum 밖이다: '
                 f'{sorted(set(sources) - set(K5_FRAME_SOURCES))}')
    else:
        rep.ok(f'frame_sources ⊆ K-5 enum ({sources})')

    bad_src = sorted({r['frame_source'] for r in pop} - set(K5_FRAME_SOURCES))
    if bad_src:
        rep.fail(f'FORBID-1(a) — population.csv 의 frame_source 가 K-5 밖이다: {bad_src}')
    else:
        rep.ok('population.csv 전 행의 frame_source 가 K-5 enum 안에 있다')

    datasets = meta.get('datasets') or []
    if not datasets:
        rep.fail('frame.json datasets 가 비어 있다 — 취득 원본 기록이 없다')
    missing_meta = [d for d in datasets if not (d.get('url') and d.get('sha256')
                                                and d.get('retrieved_at'))]
    if missing_meta:
        rep.fail(f'취득 원본 {len(missing_meta)}건에 url/sha256/retrieved_at 이 없다')
    elif datasets:
        rep.ok(f'취득 원본 {len(datasets)}종의 URL·sha256·취득 시각 기록 확인')

    log = read_json(ctx.d1a('download_log.json'))
    frame_log = [e for e in log if e.get('role') in ('primary', 'backup')]
    if not frame_log:
        rep.fail('download_log.json 에 프레임 취득 요청 기록이 0건이다')
    hosts = sorted({e.get('host') for e in frame_log})
    if not set(hosts) <= set(K5_ALLOWED_HOSTS):
        rep.fail(f'FORBID-1(a) — 프레임 취득 URL 호스트가 K-5 밖이다: '
                 f'{sorted(set(hosts) - set(K5_ALLOWED_HOSTS))}')
    else:
        rep.ok(f'프레임 취득 호스트 ⊆ {fmt(K5_ALLOWED_HOSTS)} (실측 {fmt(hosts)})')
    enrich_hosts = sorted({e.get('host') for e in log if e.get('role') == 'enrichment'})
    if set(enrich_hosts) & set(K5_ALLOWED_HOSTS):
        rep.fail('K-10 보강 소스가 프레임 취득 호스트로 기록되어 있다 — '
                 '보강 소스는 프레임 소스가 아니다')
    else:
        rep.ok(f'K-10 보강 요청은 프레임 취득 호스트와 분리 기록 ({fmt(enrich_hosts) or "없음"})')

    dead = _scan_dead_host_token(ctx)
    if dead:
        rep.fail(f'FORBID-1(a) — 2026-04-16 폐쇄된 포털 호스트 토큰이 {len(dead)}개 파일에 있다',
                 '\n'.join(dead[:5]))
    else:
        rep.ok('문서·코드 전문에 폐쇄 포털 호스트 토큰 0건')

    # T-5 — 연속 요청 간격 ≥ 1초
    stamps = []
    for e in log:
        try:
            stamps.append(datetime.fromisoformat(e['requested_at']))
        except (KeyError, TypeError, ValueError):
            rep.fail(f'download_log.json 항목에 판독 가능한 requested_at 이 없다: {e.get("label")}')
            stamps = []
            break
    if stamps:
        stamps.sort()
        gaps = [(stamps[i + 1] - stamps[i]).total_seconds() for i in range(len(stamps) - 1)]
        tight = [g for g in gaps if g < K5_MIN_REQUEST_GAP_SEC]
        if tight:
            rep.fail(f'T-5 위반 — 연속 요청 간격이 1초 미만인 구간 {len(tight)}건 '
                     f'(최소 {min(gaps):.3f}s). 직렬 다운로드가 아니다')
        else:
            rep.ok(f'다운로드 요청 {len(stamps)}건의 연속 간격 전부 ≥ 1초 '
                   f'(최소 {min(gaps):.3f}s)')

    # slug · dataset_id 집합 동등
    if not set_equal(meta.get('slugs'), K5_SLUGS):
        rep.fail(f'FORBID-1(a) — slug 집합이 K-7 5종과 다르다: {meta.get("slugs")}')
    else:
        rep.ok(f'slug 집합 == K-7 5종 {fmt(K5_SLUGS)}')

    declared_ids = meta.get('dataset_ids')
    if not set_equal(declared_ids, K5_DATASET_IDS):
        rep.fail(f'T-6 — frame.json dataset_id 집합이 9종과 다르다 '
                 f'(누락 {fmt(set(K5_DATASET_IDS) - set(declared_ids or ()))} · '
                 f'초과 {fmt(set(declared_ids or ()) - set(K5_DATASET_IDS))})')
    else:
        rep.ok(f'frame.json dataset_id 집합 == 9종 (자치구 분리 ID 포함)')

    pop_ids = {r['dataset_id'] for r in pop}
    if not set_equal(pop_ids, K5_DATASET_IDS):
        rep.fail(f'T-6 — population.csv 의 dataset_id 집합이 9종과 다르다 '
                 f'(누락 {fmt(set(K5_DATASET_IDS) - pop_ids)} · '
                 f'초과 {fmt(pop_ids - set(K5_DATASET_IDS))}) — '
                 f'자치구 하나가 빠져도 총계로는 잡히지 않는다')
    else:
        rep.ok('population.csv dataset_id 집합 == 9종 (집합 동등)')

    # ── ③ 필터 전문 · 금지 속성 토큰 ────────────────────────────────────
    filters = meta.get('filter_expressions')
    if not isinstance(filters, list) or not filters:
        rep.fail('frame.json filter_expressions 가 비어 있다')
        filters = []
    literal = extract_block(md, 'filter-expressions', 'frame_build.md')
    literal_lines = [ln.strip() for ln in literal.splitlines()
                     if ln.strip() and not ln.strip().startswith('```')]
    if literal_lines != [f.strip() for f in filters]:
        rep.fail('frame_build.md 의 필터 전문 블록과 frame.json filter_expressions 가 다르다',
                 f'블록: {literal_lines}\n배열: {filters}')
    else:
        rep.ok(f'필터 전문 블록 == filter_expressions 배열 ({len(filters)}건)')

    for label, blob in (('filter_expressions', '\n'.join(filters)),
                        ('frame_build.py', read_text(ctx.d1a('frame_build.py')))):
        hits = sorted({t for t in K5_FORBIDDEN_FILTER_TOKENS if t.lower() in blob.lower()})
        if hits:
            rep.fail(f'FORBID-1(b) — {label} 에 K-5 금지 속성 토큰 {hits} 이(가) 있다')
        else:
            rep.ok(f'{label} — K-5 금지 속성 토큰 {len(K5_FORBIDDEN_FILTER_TOKENS)}종 0건 매칭')

    # ── ④ 축 결정표 4개 집합 · 재적용 ───────────────────────────────────
    sets_ = meta.get('axis_sets') or {}
    for key, want, label in (
            ('medical_subjects', K7_MEDICAL_SUBJECTS, '진료과목 5종'),
            ('beauty_business_types', K7_BEAUTY_BUSINESS_TYPES, '위생업태 3종'),
            ('anma_business_types', K7_ANMA_BUSINESS_TYPES, '안마 업태 2종'),
            ('fitness_license_category', K7_FITNESS_LICENSE_CATEGORY, '체력단련장업')):
        got = sets_.get(key)
        if not set_equal(got, want):
            rep.fail(f'FORBID-1(c) — 축 결정표 `{key}` 가 K-7 과 집합 동등이 아니다 '
                     f'(누락 {fmt(set(want) - set(got or ()))} · '
                     f'초과 {fmt(set(got or ()) - set(want))})')
        else:
            rep.ok(f'축 결정표 `{key}` == K-7 {label} (집합 동등)')

    included = set(sets_.get('beauty_business_types') or ()) | \
        set(sets_.get('anma_business_types') or ()) | \
        set(sets_.get('fitness_license_category') or ())
    leaked = sorted({t for t in K7_EXCLUDED_BEAUTY_TOKENS
                     for v in included if t in v})
    if leaked:
        rep.fail(f'FORBID-1(c) — §헤어 결정으로 제외 확정된 업태가 편입 집합에 있다: {leaked}')
    else:
        rep.ok('`일반미용업`·`화장ㆍ분장업` 이 편입 집합에 부재 (K-7 §헤어 결정)')

    table = meta.get('axis_decision_table')
    id_to_slug = _dataset_id_to_slug(meta)
    if not isinstance(table, list) or not table:
        rep.fail('frame.json 에 axis_decision_table 이 없다')
    elif not id_to_slug:
        rep.fail('frame.json dataset_id_map 으로 dataset_id → slug 를 확정할 수 없다')
    else:
        mismatched = []
        for r in pop:
            slug = id_to_slug.get(r['dataset_id'])
            if slug is None or apply_axis_table(table, slug, r) != r['axis']:
                mismatched.append(r['venue_id'])
        if mismatched:
            rep.fail(f'FORBID-1(c) — 축 결정표 재적용 결과가 axis 컬럼과 다른 행 '
                     f'{len(mismatched)}건', ', '.join(mismatched[:5]))
        else:
            rep.ok(f'축 결정표 {len(table)}개 규칙 재적용 결과가 전 {len(pop)}행의 '
                   f'axis 와 100% 일치')

    # frame_build.md 의 규칙 문면과 frame.json 이 글자 단위로 같은지
    rule_doc = extract_block(md, 'axis-rule-text', 'frame_build.md').strip()
    rule_doc = '\n'.join(ln.strip() for ln in rule_doc.splitlines()
                         if ln.strip() and not ln.strip().startswith('```'))
    rule_json = (meta.get('axis_rule_text') or '').strip()
    if rule_doc != rule_json:
        rep.fail('축 결정 규칙 문면이 frame_build.md 와 frame.json 사이에서 다르다',
                 f'md:   {rule_doc}\njson: {rule_json}')
    else:
        rep.ok('축 결정 규칙 문면이 frame_build.md == frame.json (글자 단위)')

    # ── ① 행 수 · 12칸 · axis enum ──────────────────────────────────────
    if len(pop) < K7_POPULATION_MIN_ROWS:
        rep.fail(f'population.csv 가 {len(pop)}행으로 {K7_POPULATION_MIN_ROWS}행 미만이다')
    else:
        rep.ok(f'population.csv {len(pop)}행 (≥ {K7_POPULATION_MIN_ROWS})')

    if not set_equal({r['axis'] for r in pop}, AXES):
        rep.fail(f'population.csv 의 axis enum 이 K-7 4축과 다르다: '
                 f'{fmt({r["axis"] for r in pop})}')
    else:
        rep.ok(f'axis enum == K-7 4축 {fmt(AXES)}')

    if len({r['venue_id'] for r in pop}) != len(pop):
        rep.fail('population.csv 에 venue_id 중복이 있다')
    else:
        rep.ok('population.csv venue_id 중복 0')

    cells = {(a, g): 0 for a in AXES for g in GUS}
    unknown = 0
    for r in pop:
        key = (r['axis'], r['gu'])
        if key in cells:
            cells[key] += 1
        else:
            unknown += 1
    if unknown:
        rep.fail(f'population.csv 에 정의 밖 (축,구) 조합 {unknown}행이 있다')
    if len(cells) != K6_CELLS:
        rep.fail(f'(축,구) 칸이 {len(cells)}개다 (12칸이어야 한다)')
    short = {f'{a}|{g}': v for (a, g), v in cells.items() if v < K7_CELL_MIN_ROWS}
    if short:
        rep.fail(f'(축,구) 12칸 중 {K7_CELL_MIN_ROWS}행 미만인 칸: {short}')
    else:
        rep.ok(f'(축,구) 12칸 각각 ≥ {K7_CELL_MIN_ROWS} (최소 {min(cells.values())})')

    # ── ⑤ 축별 행 수 하한 ───────────────────────────────────────────────
    axis_counts = {a: sum(1 for r in pop if r['axis'] == a) for a in AXES}
    for axis, floor in K7_AXIS_MIN_ROWS.items():
        got = axis_counts.get(axis, 0)
        if got < floor:
            rep.fail(f'축 `{axis}` 가 {got}행으로 하한 {floor} 미만이다')
        else:
            rep.ok(f'축 `{axis}` {got}행 (≥ {floor})')
    if meta.get('row_counts', {}).get('by_axis') != axis_counts:
        rep.fail('frame.json row_counts.by_axis 가 population.csv 실측과 다르다',
                 f'기재 {meta.get("row_counts", {}).get("by_axis")}\n실측 {axis_counts}')
    else:
        rep.ok('frame.json row_counts.by_axis == population.csv 실측')

    # ── ⑥ 폐업 행 (T-4) ────────────────────────────────────────────────
    dead_rows = [r['venue_id'] for r in pop if r['license_status'] != LICENSE_STATUS_ACTIVE]
    if dead_rows:
        rep.fail(f'FORBID-1(d) — `license_status != {LICENSE_STATUS_ACTIVE}` 행 '
                 f'{len(dead_rows)}건 (T-4: 분모가 2배 이상 부푼다)',
                 ', '.join(dead_rows[:5]))
    else:
        rep.ok(f'`license_status != {LICENSE_STATUS_ACTIVE}` 행 0건 (T-4)')

    # ── FORBID-1(e) — K-10 보강이 멤버십을 바꾸지 않았는가 ───────────────
    stats = (meta.get('enrichment') or {}).get('stats') or {}
    total = sum(stats.get(k, 0) for k in K8_ENRICH_VALUES)
    if total != len(pop):
        rep.fail(f'FORBID-1(e) — 보강 결과 합계 {total} 이 population.csv {len(pop)}행과 다르다')
    else:
        rep.ok(f'보강 결과 합계 {total} == population.csv 행 수 (행 제거 0건)')
    med_unmatched = sum(1 for r in pop if r['axis'] == 'medical_wellness'
                        and r['enrich_match'] != 'matched')
    if med_unmatched == 0:
        rep.fail('FORBID-1(e) — `medical_wellness` 축에 보강 미매칭 행이 0건이다. '
                 'left join 이면 미매칭 행이 남아야 한다 — inner join 흔적이다')
    else:
        rep.ok(f'`medical_wellness` 축 보강 미매칭 행 {med_unmatched}건 존재 (left join 성립)')

    # ── ⑦ K-9 한계 9종 · 경로 교차검증 ──────────────────────────────────
    gaps = extract_json_block(md, 'known_gaps', 'frame_build.md')
    if not isinstance(gaps, dict):
        rep.fail('frame_build.md known_gaps 블록이 객체가 아니다')
        gaps = {}
    missing = [k for k in K9_GAP_KEYS if k not in gaps]
    if missing:
        rep.fail(f'K-9 한계 키 누락 {len(missing)}종: {missing}')
    else:
        rep.ok(f'K-9 한계 키 {len(K9_GAP_KEYS)}종 전부 존재')
    extra = sorted(set(gaps) - set(K9_GAP_KEYS))
    if extra:
        rep.fail(f'known_gaps 에 K-9 밖 키가 있다: {extra}')
    thin = {k: len(str(gaps.get(k, ''))) for k in K9_GAP_KEYS
            if len(str(gaps.get(k, ''))) < K9_GAP_MIN_CHARS}
    if thin:
        rep.fail(f'K-9 한계 기재가 {K9_GAP_MIN_CHARS}자 미만인 키: {thin}')
    elif not missing:
        rep.ok(f'K-9 한계 9종 각각 {K9_GAP_MIN_CHARS}자 이상')

    cross = extract_json_block(md, 'path_crosscheck', 'frame_build.md')
    if not isinstance(cross, list) or len(cross) != len(AXES):
        rep.fail(f'frame_build.md path_crosscheck 가 4축 전부를 담고 있지 않다: {cross}')
    else:
        if cross != (meta.get('path_crosscheck') or []):
            rep.fail('frame_build.md path_crosscheck 가 frame.json 산출과 다르다',
                     f'md:   {cross}\njson: {meta.get("path_crosscheck")}')
        else:
            rep.ok('path_crosscheck 블록 == frame.json 산출')
        over = [c for c in cross if abs(float(c.get('delta_pct', 999))) > CROSSCHECK_MAX_DELTA_PCT]
        if over:
            rep.fail(f'1순위/백업 경로 축별 행 수 차이가 ±{CROSSCHECK_MAX_DELTA_PCT}% 를 넘는다: {over}')
        else:
            rep.ok('1순위(file.localdata) vs 백업(datafile.seoul) 축별 행 수 차이 전부 ±2% 이내 '
                   + ', '.join(f'{c["axis"]} {c["primary_rows"]}/{c["backup_rows"]} '
                               f'({c["delta_pct"]:+.2f}%)' for c in cross))

    # ── ⑧ K-11 라이선스 스냅샷 ──────────────────────────────────────────
    snap_dir = ctx.d1a('license_snapshot')
    manifest = read_json(os.path.join(snap_dir, 'manifest.json'))
    if not isinstance(manifest, list) or not manifest:
        rep.fail('license_snapshot/manifest.json 이 비어 있다')
        manifest = []
    bad = []
    for e in manifest:
        for field in ('key', 'url', 'sha256', 'stored_sha256', 'retrieved_at',
                      'snapshot_path', 'http_status'):
            if e.get(field) in (None, ''):
                bad.append(f'{e.get("key")}: `{field}` 누락')
        p = os.path.join(snap_dir, e.get('snapshot_path', ''))
        if not os.path.exists(p):
            bad.append(f'{e.get("key")}: 스냅샷 파일 부재')
            continue
        if sha256_file(p) != e.get('stored_sha256'):
            bad.append(f'{e.get("key")}: 저장 파일 sha256 불일치')
            continue
        if hashlib.sha256(read_snapshot_bytes(p)).hexdigest() != e.get('sha256'):
            bad.append(f'{e.get("key")}: 원본 바이트 sha256 불일치')
    if bad:
        rep.fail(f'K-11 라이선스 스냅샷 결함 {len(bad)}건', '\n'.join(bad[:8]))
    elif manifest:
        rep.ok(f'K-11 라이선스 스냅샷 {len(manifest)}종 — 파일·URL·sha256·취득 시각 확인')


def _dataset_id_to_slug(meta: dict) -> dict:
    out = {}
    for slug, spec in (meta.get('dataset_id_map') or {}).items():
        if 'citywide' in spec:
            out[spec['citywide']] = slug
        for ds in (spec.get('per_gu') or {}).values():
            out[ds] = slug
    return out


TEXT_EXT = ('.md', '.py', '.json', '.csv', '.txt', '.yml', '.yaml', '.lock')


def _scan_dead_host_token(ctx: Ctx) -> list:
    hits = []
    for base in (ctx.d1a(), ctx.path('scripts', 'discovery')):
        if not os.path.isdir(base):
            continue
        for root, _dirs, files in os.walk(base):
            for fn in files:
                if not fn.endswith(TEXT_EXT):
                    continue
                p = os.path.join(root, fn)
                if os.path.getsize(p) > 8_388_608:
                    continue
                try:
                    body = open(p, encoding='utf-8').read()
                except (UnicodeDecodeError, OSError):
                    continue
                if K5_DEAD_HOST_TOKEN in body:
                    hits.append(os.path.relpath(p, ctx.root))
    return sorted(hits)


# ═══════════════════════════════════════════════════════════════════════════
# REQ-6 · FORBID-6 — 모집단 데이터 품질
# ═══════════════════════════════════════════════════════════════════════════

def check_population_quality(ctx: Ctx, rep: Report) -> None:
    pop = read_csv_rows(ctx.d1a('population.csv'))
    md = read_text(ctx.d1a('frame_build.md'))

    # ① K-8 컬럼
    cols = list(pop[0].keys())
    missing = [c for c in K8_COLUMNS if c not in cols]
    if missing:
        rep.fail(f'K-8 필수 컬럼 누락 {len(missing)}종: {missing}')
    else:
        rep.ok(f'K-8 컬럼 {len(K8_COLUMNS)}종 전부 존재')

    # ② T-2 인코딩 무결성
    mojibake = [r['venue_id'] for r in pop
                if '�' in (r['name'] + r['road_address'])]
    if mojibake:
        rep.fail(f'T-2 — `name`/`road_address` 에 U+FFFD 치환문자가 있는 행 {len(mojibake)}건 '
                 f'(CP949 원본을 UTF-8 로 읽은 흔적)', ', '.join(mojibake[:5]))
    else:
        rep.ok('`name`·`road_address` U+FFFD 0건 (CP949 강제 디코드 성립)')
    empty_name = [r['venue_id'] for r in pop if not r['name'].strip()]
    if empty_name:
        rep.fail(f'`name` 이 빈 문자열인 행 {len(empty_name)}건')
    else:
        rep.ok('`name` 빈 문자열 0건')

    # ③ 좌표
    coords = [(float(r['lat']), float(r['lon']), r['gu'], r['venue_id'])
              for r in pop if r['lat'] and r['lon']]
    outside = [c[3] for c in coords
               if not (K8_BBOX['lat'][0] <= c[0] <= K8_BBOX['lat'][1]
                       and K8_BBOX['lon'][0] <= c[1] <= K8_BBOX['lon'][1])]
    if outside:
        rep.fail(f'T-3 — 강남3구 bbox 밖 좌표 {len(outside)}건 '
                 f'(EPSG:5174 → WGS84 변환 누락 또는 오류)', ', '.join(outside[:5]))
    else:
        rep.ok(f'채워진 좌표 {len(coords)}건 전부 강남3구 bbox 안 '
               f'(lat {K8_BBOX["lat"]} / lon {K8_BBOX["lon"]})')

    # 중심점 — 업체 밀도에 좌우되지 않는 좌표 범위 중점으로 판정한다.
    # (밀도 가중 평균은 상업 집적지 쪽으로 끌려가므로 변환 정합성 지표가 되지 못한다.
    #  둘 다 출력하되 판정은 범위 중점으로 하고, 잔차의 정밀 판정은 ⑥ K-10 대조가 맡는다.)
    for gu, center in K8_GU_CENTERS.items():
        lats = sorted(c[0] for c in coords if c[2] == gu)
        lons = sorted(c[1] for c in coords if c[2] == gu)
        if not lats:
            rep.fail(f'{gu} 의 채워진 좌표가 0건이다')
            continue
        mid = ((lats[0] + lats[-1]) / 2, (lons[0] + lons[-1]) / 2)
        mean = (sum(lats) / len(lats), sum(lons) / len(lons))
        d_mid = haversine_m(mid[0], mid[1], center[0], center[1])
        d_mean = haversine_m(mean[0], mean[1], center[0], center[1])
        rep.info(f'{gu} 밀도 가중 평균 중심 {mean[0]:.5f},{mean[1]:.5f} '
                 f'(기준 중심 대비 {d_mean:.0f}m — 업체 집적 방향)')
        if d_mid > K8_GU_CENTER_TOLERANCE_M:
            rep.fail(f'{gu} 좌표 범위 중점이 기준 중심에서 {d_mid:.0f}m 떨어져 있다 '
                     f'(허용 {K8_GU_CENTER_TOLERANCE_M:.0f}m)')
        else:
            rep.ok(f'{gu} 좌표 범위 중점 편차 {d_mid:.0f}m (≤ {K8_GU_CENTER_TOLERANCE_M:.0f}m)')

    fill = len(coords) / len(pop)
    lo, hi = K8_COORD_FILL_RANGE
    if not (lo <= fill <= hi):
        rep.fail(f'FORBID-6(b) — `lat`/`lon` 채움률 {fill:.4f} 가 [{lo}, {hi}] 밖이다 '
                 f'(상한 초과는 결측 채움, 하한 미달은 변환 실패다)')
    else:
        rep.ok(f'`lat`/`lon` 채움률 {fill:.4f} ∈ [{lo}, {hi}]')
    for axis in AXES:
        sub = [r for r in pop if r['axis'] == axis]
        f = sum(1 for r in sub if r['lat']) / len(sub)
        rep.info(f'  축별 좌표 채움률 {axis}: {f:.4f} (n={len(sub)})')

    # FORBID-6(c) 최빈 좌표쌍 점유율
    tally: dict = {}
    for c in coords:
        tally[(c[0], c[1])] = tally.get((c[0], c[1]), 0) + 1
    if tally:
        top, cnt = max(tally.items(), key=lambda kv: kv[1])
        share = cnt / len(pop)
        if share > K8_MAX_COORD_PAIR_SHARE:
            rep.fail(f'FORBID-6(c) — 단일 좌표쌍 {top} 이 전체의 {share:.3%} 를 점유한다 '
                     f'(허용 {K8_MAX_COORD_PAIR_SHARE:.0%}) — 대표좌표 채움 흔적')
        else:
            rep.ok(f'최빈 좌표쌍 점유율 {share:.3%} (≤ {K8_MAX_COORD_PAIR_SHARE:.0%})')

    # FORBID-6(a) sentinel
    sentinel_hits = []
    for col in ('lat', 'lon', 'phone', 'homepage_url', 'open_hours'):
        n = sum(1 for r in pop if r[col].strip() in K8_SENTINELS)
        if n:
            sentinel_hits.append(f'{col}: {n}건')
    if sentinel_hits:
        rep.fail(f'FORBID-6(a) — 결측 자리에 sentinel 값이 들어간 셀이 있다: {sentinel_hits}')
    else:
        rep.ok(f'FORBID-6(a) — sentinel 사전 {len(K8_SENTINELS)}종 0건 (결측은 결측으로 남아 있다)')

    # ④ 전화
    for axis in AXES:
        sub = [r for r in pop if r['axis'] == axis]
        lo, hi = K8_PHONE_FILL_RANGE.get(axis, K8_PHONE_FILL_DEFAULT)
        f = sum(1 for r in sub if r['phone'].strip()) / len(sub)
        if not (lo <= f <= hi):
            rep.fail(f'축 `{axis}` 의 `phone` 채움률 {f:.4f} 가 K-8 대역 [{lo}, {hi}] 밖이다 '
                     f'(n={len(sub)})')
        else:
            rep.ok(f'축 `{axis}` `phone` 채움률 {f:.4f} ∈ [{lo}, {hi}]')
    mobile = [r['venue_id'] for r in pop
              if K8_MOBILE_BAND_RE.match(re.sub(r'[^0-9]', '', r['phone']))
              or K8_MOBILE_BAND_RE.match(r['phone'].strip())]
    if mobile:
        rep.fail(f'FORBID-6 — 휴대전화 대역 번호가 저장된 행 {len(mobile)}건 '
                 f'(개인 식별 정보. 값 패턴으로 걸러야 한다)', ', '.join(mobile[:5]))
    else:
        rep.ok('휴대전화 대역(`^0(1[016789])`) 매칭 0건')

    # ⑤ K-10 보강 정합
    bad_enum = sorted({r['enrich_match'] for r in pop} - set(K8_ENRICH_VALUES))
    if bad_enum:
        rep.fail(f'`enrich_match` 에 규정 밖 값이 있다: {bad_enum}')
    else:
        rep.ok(f'`enrich_match` ⊆ {fmt(K8_ENRICH_VALUES)}')
    matched = [r for r in pop if r['enrich_match'] == 'matched']
    if len(matched) < K10_MIN_MATCHED_ROWS:
        rep.fail(f'`enrich_match == matched` 행이 {len(matched)}건으로 '
                 f'하한 {K10_MIN_MATCHED_ROWS} 미만이다 — 보강을 수행하지 않은 것과 구분되지 않는다')
    else:
        rep.ok(f'`enrich_match == matched` {len(matched)}행 (≥ {K10_MIN_MATCHED_ROWS})')
    non_med = [r['venue_id'] for r in pop if r['axis'] != 'medical_wellness'
               and (r['homepage_url'].strip() or r['open_hours'].strip())]
    if non_med:
        rep.fail(f'`medical_wellness` 외 축에 보강 컬럼이 채워진 행 {len(non_med)}건 '
                 f'(K-10 경로가 존재하지 않는 축이다)', ', '.join(non_med[:5]))
    else:
        rep.ok('`medical_wellness` 외 축의 `homepage_url`·`open_hours` 전 행 빈 값')
    leak = [r['venue_id'] for r in pop if r['enrich_match'] != 'matched'
            and (r['homepage_url'].strip() or r['open_hours'].strip())]
    if leak:
        rep.fail(f'FORBID-6(d) — 매칭 미성립 행에 보강 값이 있다 {len(leak)}건 '
                 f'(추정 결합)', ', '.join(leak[:5]))
    else:
        rep.ok('FORBID-6(d) — `enrich_match != matched` 행의 보강 컬럼 전부 빈 값')

    # ⑥ 좌표 변환 잔차 실측 (K-10 독립 대조)
    resid = extract_json_block(md, 'coord_residual', 'frame_build.md')
    for field in ('matched_rows', 'distance_median_m', 'distance_p95_m'):
        if resid.get(field) is None:
            rep.fail(f'frame_build.md coord_residual 블록에 `{field}` 가 없다')
            return
    if resid['distance_median_m'] > K10_DISTANCE_MEDIAN_MAX_M:
        rep.fail(f'좌표 변환 잔차 중앙값 {resid["distance_median_m"]}m 가 '
                 f'{K10_DISTANCE_MEDIAN_MAX_M:.0f}m 를 넘는다')
    else:
        rep.ok(f'좌표 변환 잔차 중앙값 {resid["distance_median_m"]}m '
               f'(≤ {K10_DISTANCE_MEDIAN_MAX_M:.0f}m, 대조 {resid["matched_rows"]}행)')
    if resid['distance_p95_m'] > K10_DISTANCE_P95_MAX_M:
        rep.fail(f'좌표 변환 잔차 95분위 {resid["distance_p95_m"]}m 가 '
                 f'{K10_DISTANCE_P95_MAX_M:.0f}m 를 넘는다')
    else:
        rep.ok(f'좌표 변환 잔차 95분위 {resid["distance_p95_m"]}m '
               f'(≤ {K10_DISTANCE_P95_MAX_M:.0f}m)')
    frame_stats = (load_frame(ctx).get('enrichment') or {}).get('stats') or {}
    for k, doc_k in (('distance_median_m', 'distance_median_m'),
                     ('distance_p95_m', 'distance_p95_m')):
        if frame_stats.get(k) != resid.get(doc_k):
            rep.fail(f'frame_build.md 의 `{doc_k}` 가 frame.json 산출과 다르다 '
                     f'({resid.get(doc_k)} vs {frame_stats.get(k)})')
            return
    rep.ok('coord_residual 기재값 == frame.json 산출값')


# ═══════════════════════════════════════════════════════════════════════════
# REQ-2 · FORBID-2 — 정의
# ═══════════════════════════════════════════════════════════════════════════

def check_definition(ctx: Ctx, rep: Report) -> None:
    text = read_text(ctx.d1a('protocol.md'))
    proto = extract_json_block(text, 'protocol.json', 'protocol.md')

    channels = proto.get('allowed_channels')
    if not isinstance(channels, list) or not channels:
        rep.fail('protocol.md allowed_channels 가 비어 있다')
    elif not set(channels) <= set(K1_ALLOWED_CHANNELS):
        rep.fail(f'FORBID-2 — allowed_channels 가 K-1 부분집합이 아니다: '
                 f'{sorted(set(channels) - set(K1_ALLOWED_CHANNELS))}')
    else:
        rep.ok(f'allowed_channels ⊆ K-1 ({channels})')

    hits = sorted({t for t in K2_FORBIDDEN_TOKENS if t in text})
    if hits:
        rep.fail(f'FORBID-2 — protocol.md 전문에 K-2 금지 취득 경로 토큰 {hits} 이(가) 있다')
    else:
        rep.ok(f'protocol.md 전문 — K-2 금지 토큰 {len(K2_FORBIDDEN_TOKENS)}종 0건 매칭')

    if proto.get('axes') != list(AXES):
        rep.fail(f'protocol.md axes 가 K-7 4축과 다르다: {proto.get("axes")}')
    else:
        rep.ok(f'protocol.md axes == K-7 4축')

    conds = proto.get('required_conditions')
    if not isinstance(conds, list):
        rep.fail('protocol.md required_conditions 가 배열이 아니다')
        conds = []
    got = {c.get('id'): (c.get('text') or '') for c in conds if isinstance(c, dict)}
    for cid, tokens in K3_REQUIRED_CONDITIONS.items():
        if cid not in got:
            rep.fail(f'FORBID-2 — K-3 성립 요건 `{cid}` 이 required_conditions 에 없다')
            continue
        missing = [t for t in tokens if t not in got[cid]]
        if missing:
            rep.fail(f'K-3 요건 `{cid}` 의 본문에 필수 토큰 {missing} 이(가) 없다', got[cid])
        else:
            rep.ok(f'K-3 요건 `{cid}` 확인')

    tree = proto.get('decision_tree')
    if not isinstance(tree, list) or len(tree) < 5:
        rep.fail(f'판정 트리 분기가 {len(tree) if isinstance(tree, list) else 0}개다 (5개 이상 필요)')
        return
    rep.ok(f'판정 트리 분기 {len(tree)}개 (≥ 5)')
    doc_ids = [b.get('id') for b in tree]
    if sorted(doc_ids) != sorted(DECISION_BRANCHES):
        rep.fail('protocol.md 의 판정 트리 분기 id 집합이 검증기 구현과 다르다',
                 f'문서: {sorted(doc_ids)}\n구현: {sorted(DECISION_BRANCHES)}')
    else:
        rep.ok('판정 트리 분기 id 가 검증기 구현과 1:1 대응')
    if doc_ids != list(DECISION_ORDER):
        rep.fail('protocol.md 의 분기 적용 순서가 검증기 구현과 다르다 — '
                 '순서가 다르면 같은 관측이 다른 판정을 낳는다',
                 f'문서: {doc_ids}\n구현: {list(DECISION_ORDER)}')
    else:
        rep.ok('판정 트리 적용 순서가 검증기 구현과 동일')


# ═══════════════════════════════════════════════════════════════════════════
# REQ-3 · FORBID-5 — 정의 재현율
# ═══════════════════════════════════════════════════════════════════════════

def check_definition_recall(ctx: Ctx, rep: Report) -> None:
    proto = load_protocol(ctx)
    allowed = proto.get('allowed_channels') or []
    examples = read_json(ctx.d1a('definition_examples', 'examples.json'))
    if not isinstance(examples, list):
        raise CheckError('examples.json 이 배열이 아니다')
    if len(examples) != 20:
        rep.fail(f'definition_examples 가 {len(examples)}건이다 (20건 필요)')
    else:
        rep.ok('definition_examples 20건')

    pos = [e for e in examples if e.get('expected_price_found') is True]
    neg = [e for e in examples if e.get('expected_price_found') is False]
    if len(pos) != 10 or len(neg) != 10:
        rep.fail(f'양성 {len(pos)}건 / 음성 {len(neg)}건 — 각 10건이어야 한다')
    else:
        rep.ok('양성 10건 / 음성 10건')

    forms = {e.get('display_form') for e in pos}
    if len(forms) < 5:
        rep.fail(f'FORBID-5 — 양성 예시 display_form distinct {len(forms)}종 '
                 f'(5종 이상 필요): {sorted(forms)}')
    else:
        rep.ok(f'양성 예시 display_form distinct {len(forms)}종: {sorted(forms)}')

    ids = [e.get('example_id') for e in examples]
    if len(set(ids)) != len(ids):
        rep.fail('example_id 중복이 있다')

    mismatch, reproduced = [], []
    for e in examples:
        eid = e.get('example_id', '?')
        for field in ('source_url', 'snapshot_path', 'snapshot_sha256',
                      'snapshot_stored_sha256', 'extracted_text_path',
                      'display_form', 'channel', 'retrieved_at', 'gu',
                      'venue_name', 'price_evidence_snippet'):
            if not e.get(field):
                rep.fail(f'{eid}: 필수 필드 `{field}` 가 비어 있다')
        if e.get('gu') not in GUS:
            rep.fail(f'{eid}: gu 가 강남3구가 아니다 ({e.get("gu")})')
        if not str(e.get('source_url', '')).startswith(('http://', 'https://')):
            rep.fail(f'{eid}: source_url 이 URL 형식이 아니다')

        snap = ctx.d1a('definition_examples', e.get('snapshot_path', ''))
        if not os.path.exists(snap):
            rep.fail(f'FORBID-5 — {eid}: 스냅샷 파일이 없다 ({e.get("snapshot_path")})')
            continue
        if sha256_file(snap) != e.get('snapshot_stored_sha256'):
            rep.fail(f'FORBID-5 — {eid}: 저장 스냅샷 파일 sha256 불일치')
            continue
        try:
            snap_bytes = read_snapshot_bytes(snap)
        except (OSError, EOFError, ValueError) as exc:
            rep.fail(f'FORBID-5 — {eid}: 스냅샷을 읽을 수 없다 ({exc})')
            continue
        if hashlib.sha256(snap_bytes).hexdigest() != e.get('snapshot_sha256'):
            rep.fail(f'FORBID-5 — {eid}: 스냅샷 원본 sha256 불일치')
            continue

        txt_path = ctx.d1a('definition_examples', e.get('extracted_text_path', ''))
        if not os.path.exists(txt_path):
            rep.fail(f'FORBID-5 — {eid}: 스냅샷 추출 텍스트 파일이 없다')
            continue
        extracted = read_text(txt_path)
        if e.get('extracted_text_sha256') and \
                sha256_file(txt_path) != e['extracted_text_sha256']:
            rep.fail(f'{eid}: 추출 텍스트 sha256 불일치')
            continue

        method = e.get('extraction_method')
        if method not in EXTRACTION_METHODS:
            rep.fail(f'{eid}: extraction_method 가 규정 밖이다 ({method})')
            continue
        if method == REPRODUCIBLE_EXTRACTION:
            if extract_html_text(snap_bytes) != extracted:
                rep.fail(f'FORBID-5 — {eid}: 스냅샷을 정본 절차로 재추출한 결과가 '
                         f'커밋된 추출 텍스트와 다르다')
                continue
            reproduced.append(eid)

        snippet = e.get('price_evidence_snippet', '')
        if snippet not in extracted:
            rep.fail(f'FORBID-5 — {eid}: snippet 이 스냅샷 추출 텍스트의 부분문자열이 아니다',
                     f'snippet: {snippet[:120]}')
            continue

        has_price = bool(PRICE_PATTERN.search(extracted))
        snippet_price = bool(PRICE_PATTERN.search(snippet))
        if e.get('expected_price_found'):
            if not (has_price and snippet_price):
                rep.fail(f'FORBID-5 — {eid}: 양성인데 추출 텍스트/스니펫에 금액 표기가 없다')
                continue
        else:
            reason = e.get('negative_reason')
            if reason == 'no_amount':
                if has_price:
                    rep.fail(f'{eid}: no_amount 인데 추출 텍스트에 금액 표기가 있다')
                    continue
            elif reason == 'inquiry_only':
                if has_price:
                    rep.fail(f'{eid}: inquiry_only 인데 추출 텍스트에 금액 표기가 있다')
                    continue
                if not any(p in extracted for p in INQUIRY_PHRASES) or \
                        not any(p in snippet for p in INQUIRY_PHRASES):
                    rep.fail(f'{eid}: inquiry_only 인데 본문 또는 스니펫에 안내 요청 표기가 없다')
                    continue
            elif reason == 'ended_event_only':
                if not has_price:
                    rep.fail(f'{eid}: ended_event_only 인데 금액 표기가 없다')
                    continue
            elif reason == 'not_currently_posted':
                if e.get('http_status') == 200:
                    rep.fail(f'{eid}: not_currently_posted 인데 http_status 가 200 이다')
                    continue
            elif reason == 'amount_without_service_name':
                if not has_price:
                    rep.fail(f'{eid}: amount_without_service_name 인데 금액 표기가 없다')
                    continue
            else:
                rep.fail(f'{eid}: negative_reason 값이 규정 밖이다 ({reason})')
                continue

        got, branch = decide_price_found(e.get('channel'), e.get('observations') or {}, allowed)
        if got != e.get('expected_price_found'):
            mismatch.append(f'{eid}: 트리 판정 {got} ({branch}) ≠ 기대 {e.get("expected_price_found")}')
        e['_branch'] = branch

    if mismatch:
        rep.fail(f'판정 트리 적용 결과가 기대 라벨과 다른 예시 {len(mismatch)}건',
                 '\n'.join(mismatch))
    elif not rep.failures:
        rep.ok(f'판정 트리 적용 결과가 기대 라벨과 {len(examples)}/{len(examples)} 일치')

    if not reproduced:
        rep.fail(f'재현 가능한 추출(`{REPRODUCIBLE_EXTRACTION}`) 예시가 0건이다 — '
                 f'추출 텍스트 재현 검사가 공허해진다')
    else:
        rep.ok(f'스냅샷 재추출 일치 {len(reproduced)}건')

    used = {e.get('_branch') for e in examples if e.get('_branch')}
    rep.info(f'예시가 실제로 밟은 분기: {sorted(used)}')
    if len(used) < 3:
        rep.fail(f'예시 20건이 밟은 분기가 {len(used)}종뿐이다 (3종 이상 필요)')
    else:
        rep.ok(f'예시가 밟은 분기 {len(used)}종 (≥ 3)')

    bad_channels = sorted({e.get('channel') for e in examples} - set(K1_ALLOWED_CHANNELS))
    if bad_channels:
        rep.fail(f'예시에 K-1 밖 채널이 있다: {bad_channels}')
    else:
        rep.ok('예시 채널 전건이 K-1 안에 있다')


# ═══════════════════════════════════════════════════════════════════════════
# REQ-4 — 표집
# ═══════════════════════════════════════════════════════════════════════════

def check_sampling(ctx: Ctx, rep: Report) -> None:
    proto = load_protocol(ctx)
    sampling = proto.get('sampling') or {}
    seed = sampling.get('seed')
    if not seed:
        raise CheckError('protocol.md sampling.seed 가 없다')
    reserve_n = sampling.get('reserve_n')
    if reserve_n != K6_RESERVE_N:
        rep.fail(f'예비표본 정원이 {reserve_n} 이다 ({K6_RESERVE_N} 이어야 한다)')

    if sampling.get('axis_allocation') != K6_AXIS_ALLOCATION:
        rep.fail(f'축 배분이 K-6 과 다르다: {sampling.get("axis_allocation")}')
    else:
        rep.ok(f'축 배분 {K6_AXIS_ALLOCATION} (K-6 25×4)')
    if sampling.get('gu_allocation') != K6_GU_ALLOCATION:
        rep.fail(f'구 배분이 K-6 과 다르다: {sampling.get("gu_allocation")}')
    else:
        rep.ok(f'구 배분 {K6_GU_ALLOCATION} (9/8/8)')

    pop = read_csv_rows(ctx.d1a('population.csv'))
    sample = read_csv_rows(ctx.d1a('sample.csv'))

    header = list(sample[0].keys())
    if header != SAMPLE_COLUMNS:
        rep.fail(f'sample.csv 컬럼이 정본과 다르다: {header}', f'정본: {SAMPLE_COLUMNS}')
    else:
        rep.ok(f'sample.csv 컬럼 == 정본 {SAMPLE_COLUMNS}')

    primary = [r for r in sample if r['status'] == 'primary']
    reserve = [r for r in sample if r['status'] == 'reserve']
    if len(primary) != K6_PRIMARY_N:
        rep.fail(f'status=primary 가 {len(primary)}행이다 (100행 필요)')
    else:
        rep.ok('status=primary 100행')
    if len(reserve) != K6_RESERVE_N:
        rep.fail(f'status=reserve 가 {len(reserve)}행이다 (20행 필요)')
    else:
        rep.ok('status=reserve 20행')

    axis_counts = {a: sum(1 for r in primary if r['axis'] == a) for a in AXES}
    if axis_counts != K6_AXIS_ALLOCATION:
        rep.fail(f'확정 표본 축 카운트가 {axis_counts} 이다 (기대 {K6_AXIS_ALLOCATION})')
    else:
        rep.ok(f'확정 표본 축 카운트 {axis_counts}')

    cells = {(a, g): sum(1 for r in primary if r['axis'] == a and r['gu'] == g)
             for a in AXES for g in GUS}
    if len(cells) != K6_CELLS:
        rep.fail(f'층이 {len(cells)}칸이다 (12칸이어야 한다)')
    short = {f'{a}|{g}': v for (a, g), v in cells.items() if v < K6_MIN_CELL}
    if short:
        rep.fail(f'(축,구) 12칸 중 {K6_MIN_CELL} 미만인 칸: {short}')
    else:
        rep.ok(f'(축,구) 12칸 각각 ≥ {K6_MIN_CELL} (최소 {min(cells.values())})')

    ids = [r['venue_id'] for r in sample]
    if len(set(ids)) != len(ids):
        rep.fail('sample.csv 에 venue_id 중복이 있다')
    else:
        rep.ok('sample.csv venue_id 중복 0')

    pop_ids = {r['venue_id'] for r in pop}
    missing = [i for i in ids if i not in pop_ids]
    if missing:
        rep.fail(f'population 에 없는 표본 행 {len(missing)}건', ', '.join(missing[:5]))
    else:
        rep.ok('전 표본 행이 population.csv 에 존재')

    if ids != sorted(ids):
        rep.fail('FORBID-4 — sample.csv 가 venue_id 오름차순 정본 순서가 아니다')
    else:
        rep.ok('sample.csv 가 venue_id 오름차순 (행 순서 ⟂ 홀드아웃 배정)')

    regen = derive_sample(pop, seed, reserve_n if isinstance(reserve_n, int) else K6_RESERVE_N)
    want = [(r['venue_id'], r['status'], r['reserve_rank']) for r in regen]
    got = [(r['venue_id'], r['status'], r['reserve_rank']) for r in sample]
    if want != got:
        diff = [f'{w} != {g}' for w, g in zip(want, got) if w != g][:5]
        rep.fail(f'고정 시드 재실행 결과가 sample.csv 와 다르다', '\n'.join(diff))
    else:
        rep.ok(f'시드 `{seed}` 재실행 결과가 sample.csv 와 완전 일치')

    name_of = {r['venue_id']: r['name'] for r in pop}
    where_of = {r['venue_id']: (r['axis'], r['gu']) for r in pop}
    bad = [r['venue_id'] for r in sample
           if r['name'] != name_of.get(r['venue_id'])
           or (r['axis'], r['gu']) != where_of.get(r['venue_id'])]
    if bad:
        rep.fail(f'표본 행의 name/axis/gu 가 population 과 다른 행 {len(bad)}건',
                 ', '.join(bad[:5]))
    else:
        rep.ok('표본 행의 name·axis·gu 가 population 과 동일 (축 재배정 0건)')

    lock = _parse_lock(ctx)
    want_digest = lock.get(f'{D1A_DIR}/population.csv')
    actual = sha256_file(ctx.d1a('population.csv'))
    if want_digest is None:
        rep.fail('protocol.lock 에 population.csv 항목이 없다 — 분모가 잠기지 않았다')
    elif want_digest != actual:
        rep.fail('protocol.lock 의 population.csv sha256 이 현 파일과 다르다')
    else:
        rep.ok('protocol.lock population.csv sha256 == 현 population.csv sha256')


def _parse_lock(ctx: Ctx) -> dict:
    out = {}
    for line in read_text(ctx.d1a('protocol.lock')).splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        if len(parts) == 2:
            out[parts[1]] = parts[0]
    return out


# ═══════════════════════════════════════════════════════════════════════════
# REQ-5 · FORBID-4 — 홀드아웃 봉인
# ═══════════════════════════════════════════════════════════════════════════

def check_holdout_sealed(ctx: Ctx, rep: Report) -> None:
    blob = read_bytes(ctx.d1a('holdout.enc'))
    manifest = read_json(ctx.d1a('holdout_manifest.json'))

    try:
        raw = base64.b64decode(blob.strip(), validate=True)
    except Exception as exc:  # noqa: BLE001
        raise CheckError(f'holdout.enc 가 base64 봉인 포맷이 아니다: {exc}') from exc
    if not raw.startswith(ENC_MAGIC):
        rep.fail('holdout.enc 매직 헤더가 없다 — 봉인 포맷이 아니다')
    else:
        rep.ok(f'holdout.enc 봉인 포맷 확인 ({len(raw)} bytes)')

    if manifest.get('record_count') != K6_HOLDOUT_N:
        rep.fail(f'봉인 매니페스트 record_count 가 {manifest.get("record_count")} 이다 (25 필요)')
    else:
        rep.ok('봉인 매니페스트 record_count = 25')
    if manifest.get('axis_allocation') != K6_HOLDOUT_AXIS_ALLOCATION:
        rep.fail(f'홀드아웃 축별 배분이 {manifest.get("axis_allocation")} 이다 '
                 f'(기대 {K6_HOLDOUT_AXIS_ALLOCATION})')
    else:
        rep.ok(f'홀드아웃 축별 배분 {K6_HOLDOUT_AXIS_ALLOCATION} (7/6/6/6)')

    for field in ('enc_sha256', 'plaintext_sha256', 'key_fingerprint',
                  'superseded_key_fingerprint', 'superseded_population_sha256',
                  'sample_index_max_run', 'sealed_at', 'custodian'):
        if not manifest.get(field) and manifest.get(field) != 0:
            rep.fail(f'봉인 매니페스트에 `{field}` 가 없다')
    if manifest.get('enc_sha256') == hashlib.sha256(blob).hexdigest():
        rep.ok('매니페스트 enc_sha256 == holdout.enc 실측 sha256')
    else:
        rep.fail('매니페스트 enc_sha256 이 holdout.enc 실측값과 다르다')
    if isinstance(manifest.get('plaintext_sha256'), str) and \
            len(manifest['plaintext_sha256']) == 64:
        rep.ok('매니페스트에 평문 sha256 기록 확인 (키 보유자 대조용)')

    fp = manifest.get('key_fingerprint')
    sup = manifest.get('superseded_key_fingerprint')
    if fp and sup and fp == sup:
        rep.fail('FORBID-4(b) — `key_fingerprint == superseded_key_fingerprint` 다. '
                 '개정 전 키로 새 봉인을 열 수 있다')
    elif fp and sup:
        rep.ok('FORBID-4(b) — `key_fingerprint != superseded_key_fingerprint` '
               '(개정 전 키 재사용 차단)')
    if manifest.get('superseded_population_sha256') == sha256_file(ctx.d1a('population.csv')):
        rep.fail('`superseded_population_sha256` 가 현 population.csv 와 같다 — '
                 '모집단이 재구축되지 않았다')
    else:
        rep.ok('`superseded_population_sha256` != 현 population.csv sha256 (모집단 재구축 확인)')

    run = manifest.get('sample_index_max_run')
    if not isinstance(run, int):
        rep.fail('sample_index_max_run 이 정수가 아니다')
    elif run >= 5:
        rep.fail(f'FORBID-4(a) — 홀드아웃 행이 sample.csv 에서 연속 {run}행 배치되어 있다')
    else:
        rep.ok(f'홀드아웃 행 최대 연속 배치 {run}행 (< 5)')

    tracked = git_tracked_files(ctx.root)
    candidates: set = set()
    for rel in tracked:
        p = ctx.path(rel)
        if not os.path.isfile(p) or os.path.getsize(p) > 262_144:
            continue
        try:
            body = open(p, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            continue
        candidates.add(body.strip())
        for line in body.splitlines():
            line = line.strip()
            if 8 <= len(line) <= 200:
                candidates.add(line)
                m = re.search(r'[=:]\s*["\']?([^\s"\']{8,200})["\']?$', line)
                if m:
                    candidates.add(m.group(1))
    leaked = [c for c in candidates if key_fingerprint(c) == fp]
    if leaked:
        rep.fail('REQ-5 — 복호화 키가 리포지토리 추적 파일 안에 있다 (봉인 무효)')
    else:
        rep.ok(f'복호화 키 리포 내 부재 확인 (후보 {len(candidates)}건 전수 대조)')

    key_files = [f for f in tracked
                 if re.search(r'(holdout).*(key|secret|pass)|\.key$|\.pem$', f, re.I)]
    if key_files:
        rep.fail(f'키로 보이는 추적 파일이 있다: {key_files}')
    else:
        rep.ok('키 파일명 패턴 추적 파일 0건')

    sample = read_csv_rows(ctx.d1a('sample.csv'))
    primary_ids = [r['venue_id'] for r in sample if r['status'] == 'primary']
    proto = load_protocol(ctx)
    dc_seed = (proto.get('aggregation') or {}).get('double_check_seed')
    allowed_ids = set(derive_double_check(primary_ids, dc_seed, K6_DOUBLE_CHECK_N)) \
        if dc_seed else set()
    id_re = re.compile(r'\bV[0-9A-F]{12}\b')
    sample_id_set = {r['venue_id'] for r in sample}
    exempt = {f'{D1A_DIR}/population.csv', f'{D1A_DIR}/sample.csv'}
    leaks = []
    for rel in tracked:
        norm = rel.replace(os.sep, '/')
        if norm in exempt:
            continue
        p = ctx.path(rel)
        if not os.path.isfile(p) or os.path.getsize(p) > 4_194_304:
            continue
        try:
            body = open(p, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            continue
        found = {m for m in id_re.findall(body) if m in sample_id_set}
        if norm == f'{D1A_DIR}/protocol.md':
            found -= allowed_ids
        if found:
            leaks.append(f'{norm}: {len(found)}건 ({sorted(found)[:3]})')
    if leaks:
        rep.fail('FORBID-4(a) — 표본 venue_id 가 허용 위치 밖 추적 파일에 평문으로 있다',
                 '\n'.join(leaks[:10]))
    else:
        rep.ok(f'표본 venue_id 평문 노출 0건 (추적 파일 {len(tracked)}건 스캔)')

    _selftest_holdout_detectors(rep)

    passphrase = _holdout_key_from_env()
    if passphrase is None:
        rep.info('HOLDOUT_KEY_ABSENT — 복호화 대조 3종은 키 보유자 경로에서만 수행된다')
        return
    payload = json.loads(unseal(passphrase, blob).decode())
    ids = payload.get('holdout_venue_ids') or []
    if sorted(ids) != sorted(set(ids)) or len(ids) != K6_HOLDOUT_N:
        rep.fail(f'복호화 결과가 25건 고유 집합이 아니다 ({len(ids)}건)')
    elif not set(ids) <= set(primary_ids):
        rep.fail('복호화 결과에 확정 표본 밖 venue_id 가 있다')
    else:
        rep.ok('복호화 결과 25건이 확정 표본 100건의 부분집합')
    axis_of = {r['venue_id']: r['axis'] for r in sample}
    counts = {a: sum(1 for i in ids if axis_of.get(i) == a) for a in AXES}
    if counts != K6_HOLDOUT_AXIS_ALLOCATION:
        rep.fail(f'복호화 결과 축별 배분 실측 {counts} ≠ {K6_HOLDOUT_AXIS_ALLOCATION}')
    else:
        rep.ok(f'복호화 결과 축별 배분 실측 {counts}')
    order = [r['venue_id'] for r in sample]
    actual_run = max_consecutive_run([v in set(ids) for v in order])
    if actual_run != manifest.get('sample_index_max_run'):
        rep.fail(f'런 길이 실측 {actual_run} ≠ 매니페스트 기재 '
                 f'{manifest.get("sample_index_max_run")}')
    elif actual_run >= 5:
        rep.fail(f'FORBID-4(a) — 홀드아웃 행이 연속 {actual_run}행 배치되어 있다')
    else:
        rep.ok(f'런 길이 실측 {actual_run} (< 5, 매니페스트 기재값과 일치)')


def _holdout_key_from_env():
    key = os.environ.get('GLOWMATE_HOLDOUT_KEY')
    if key:
        return key.strip()
    path = os.environ.get('GLOWMATE_HOLDOUT_KEY_FILE')
    if path and os.path.exists(path):
        return open(path, encoding='utf-8').read().strip()
    return None


def _selftest_holdout_detectors(rep: Report) -> None:
    if max_consecutive_run([True, True, False, True, False, True, True]) != 2:
        rep.fail('자기검사 실패 — 런 길이 계산기가 오작동한다')
        return
    if max_consecutive_run([False] + [True] * 5 + [False]) != 5:
        rep.fail('자기검사 실패 — 런 길이 5를 5로 세지 못한다')
        return
    probe = 'glowmate-selftest-passphrase-0000'
    if key_fingerprint(probe) != key_fingerprint(probe) or \
            key_fingerprint(probe) == key_fingerprint(probe + 'x'):
        rep.fail('자기검사 실패 — 키 지문 함수가 오작동한다')
        return
    salt, nonce = b'0' * 16, b'1' * 16
    blob = seal(probe, b'{"holdout_venue_ids":["VAAAAAAAAAAA"]}', salt, nonce, iters=1000)
    try:
        back = unseal(probe, blob)
    except CheckError as exc:
        rep.fail(f'자기검사 실패 — 봉인/복호 왕복이 깨졌다: {exc}')
        return
    if back != b'{"holdout_venue_ids":["VAAAAAAAAAAA"]}':
        rep.fail('자기검사 실패 — 복호 결과가 원문과 다르다')
        return
    try:
        unseal(probe + 'wrong', blob)
    except CheckError:
        rep.ok('탐지기 자기검사 통과 — 런 길이·키 지문·봉인 인증 3종 모두 살아 있다')
        return
    rep.fail('자기검사 실패 — 틀린 키로도 복호가 성공한다 (인증 태그 미검증)')


# ═══════════════════════════════════════════════════════════════════════════
# REQ-7 — 집계 규칙 · 판정 임계 (FORBID-3)
# ═══════════════════════════════════════════════════════════════════════════

def check_aggregation(ctx: Ctx, rep: Report) -> None:
    proto = load_protocol(ctx)
    agg = proto.get('aggregation') or {}

    if agg.get('n_definition') != K6_N_DEFINITION:
        rep.fail(f'n_definition 이 `{agg.get("n_definition")}` 이다 (정본 `{K6_N_DEFINITION}`)')
    else:
        rep.ok(f'n_definition == `{K6_N_DEFINITION}`')

    for field, want in (('blocked_cap', K6_BLOCKED_CAP),
                        ('replacement_cap', K6_REPLACEMENT_CAP),
                        ('double_check_n', K6_DOUBLE_CHECK_N)):
        if agg.get(field) != want:
            rep.fail(f'FORBID-3 — {field} 이 {agg.get(field)} 이다 (K-6: {want})')
        else:
            rep.ok(f'{field} == {want}')

    if agg.get('disagreement_resolution') != K6_DISAGREEMENT_RESOLUTION:
        rep.fail(f'disagreement_resolution 이 {agg.get("disagreement_resolution")!r} 이다 '
                 f'(K-6: {K6_DISAGREEMENT_RESOLUTION!r})')
    else:
        rep.ok(f'disagreement_resolution == {K6_DISAGREEMENT_RESOLUTION!r} (보수적 확정)')

    if agg.get('wilson_z') != 1.96:
        rep.fail(f'wilson_z 가 {agg.get("wilson_z")} 이다 (95% 구간은 1.96)')
    else:
        rep.ok('wilson_z == 1.96 (95% 구간)')
    formula = agg.get('wilson_formula') or ''
    for token in ('p̂', 'z', 'n'):
        if token not in formula:
            rep.fail(f'wilson_formula 에 `{token}` 가 없다', formula)
            break
    else:
        rep.ok('wilson_formula 기재 확인')
    if agg.get('axis_interval_required') is not True:
        rep.fail('axis_interval_required 가 true 가 아니다 — '
                 'axis_n25_precision 은 구간 병기로만 다룰 수 있다')
    else:
        rep.ok('axis_interval_required == true (축별 Wilson 구간 병기 강제)')

    seed = agg.get('double_check_seed')
    if not seed:
        rep.fail('double_check_seed 가 없다')
        return
    sample = read_csv_rows(ctx.d1a('sample.csv'))
    primary_ids = [r['venue_id'] for r in sample if r['status'] == 'primary']
    want_list = derive_double_check(primary_ids, seed, K6_DOUBLE_CHECK_N)
    doc_list = agg.get('double_check_venue_ids')
    if not isinstance(doc_list, list):
        rep.fail('protocol.md 에 이중판정 20건 목록(double_check_venue_ids)이 없다')
    elif sorted(doc_list) != want_list:
        rep.fail('이중판정 시드 재실행 결과가 protocol.md 기재 목록과 다르다',
                 f'재산출 {want_list[:3]}...\n기재 {sorted(doc_list)[:3]}...')
    else:
        rep.ok(f'이중판정 20건이 시드 `{seed}` 재실행 결과와 일치')
    if isinstance(doc_list, list) and len(doc_list) != K6_DOUBLE_CHECK_N:
        rep.fail(f'이중판정 목록이 {len(doc_list)}건이다 (20건 필요)')


def check_thresholds(ctx: Ctx, rep: Report) -> None:
    proto = load_protocol(ctx)
    th = proto.get('thresholds') or {}

    if th.get('proceed_threshold') != K4_PROCEED_THRESHOLD:
        rep.fail(f'FORBID-3 — proceed_threshold 가 {th.get("proceed_threshold")} 이다 '
                 f'(K-4: {K4_PROCEED_THRESHOLD})')
    else:
        rep.ok(f'proceed_threshold == {K4_PROCEED_THRESHOLD}')
    if th.get('exclude_threshold') != K4_EXCLUDE_THRESHOLD:
        rep.fail(f'FORBID-3 — exclude_threshold 가 {th.get("exclude_threshold")} 이다 '
                 f'(K-4: {K4_EXCLUDE_THRESHOLD})')
    else:
        rep.ok(f'exclude_threshold == {K4_EXCLUDE_THRESHOLD}')
    if th.get('between_verdict') != K4_BETWEEN_VERDICT:
        rep.fail(f'between_verdict 가 {th.get("between_verdict")!r} 이다 '
                 f'(K-4: {K4_BETWEEN_VERDICT!r})')
    else:
        rep.ok(f'between_verdict == {K4_BETWEEN_VERDICT!r}')

    over = []
    for key, value in th.items():
        if isinstance(value, float):
            frac = repr(value).split('.')[-1] if '.' in repr(value) else ''
            if len(frac) > 3:
                over.append(f'{key}={value}')
    if over:
        rep.fail(f'임계 필드에 소수점 3자리를 초과하는 값이 있다: {over}')
    else:
        rep.ok('임계 필드에 소수점 3자리 초과 값 부재')

    # K-6 수치 8종 — FORBID-3 이 지목한 값 전부를 하드코딩 비교한다.
    sampling = proto.get('sampling') or {}
    holdout = proto.get('holdout') or {}
    agg = proto.get('aggregation') or {}
    conds = {c.get('id'): c for c in (proto.get('inconclusive_conditions') or [])
             if isinstance(c, dict)}
    k6 = [
        ('primary_n', sampling.get('primary_n'), K6_PRIMARY_N),
        ('axis_allocation', sampling.get('axis_allocation'), K6_AXIS_ALLOCATION),
        ('min_cell', sampling.get('min_cell'), K6_MIN_CELL),
        ('cells', sampling.get('cells'), K6_CELLS),
        ('holdout_n', holdout.get('n'), K6_HOLDOUT_N),
        ('holdout_allocation', holdout.get('axis_allocation'), K6_HOLDOUT_AXIS_ALLOCATION),
        ('double_check_n', agg.get('double_check_n'), K6_DOUBLE_CHECK_N),
        ('drift_pp', conds.get('holdout_drift_ge_15pp', {}).get('threshold'),
         K6_HOLDOUT_DRIFT_LIMIT_PP),
    ]
    bad = [(k, got, want) for k, got, want in k6 if got != want]
    if bad:
        for k, got, want in bad:
            rep.fail(f'FORBID-3 — K-6 수치 `{k}` 가 {got} 이다 (계약: {want})')
    else:
        rep.ok(f'K-6 수치 8종 전부 계약 표와 동일 '
               f'(100 · 25×4 · 8 · 12 · 25 · 7/6/6/6 · 20 · 15.0)')

    for cid in INCONCLUSIVE_REQUIRED:
        if cid not in conds:
            rep.fail(f'inconclusive 강제 조건 `{cid}` 이 없다')
        else:
            rep.ok(f'inconclusive 강제 조건 `{cid}` 확인')
    if conds.get('n_below_90', {}).get('threshold') != 90:
        rep.fail('FORBID-3 — n_below_90 의 임계가 90 이 아니다')
    if conds.get('replacement_above_5', {}).get('threshold') != K6_REPLACEMENT_CAP:
        rep.fail('FORBID-3 — replacement_above_5 의 임계가 5 가 아니다')


# ═══════════════════════════════════════════════════════════════════════════
# REQ-8 — 원장 스키마
# ═══════════════════════════════════════════════════════════════════════════

def check_ledger_schema(ctx: Ctx, rep: Report) -> None:
    schema = read_json(ctx.d1a('ledger_schema.json'))

    if schema.get('$schema') != DRAFT_2020_12:
        rep.fail(f'$schema 가 draft 2020-12 가 아니다: {schema.get("$schema")}')
    else:
        rep.ok('$schema == draft 2020-12')

    errors: list = []
    check_schema_shape(schema, '#', errors)
    if errors:
        rep.fail(f'스키마 구조 위반 {len(errors)}건', '\n'.join(errors[:10]))
    else:
        rep.ok('스키마가 draft 2020-12 어휘로만 구성 (미지 키워드 0건)')

    row = schema.get('properties', {}).get('rows', {}).get('items', schema)
    props = row.get('properties', {})
    required = set(row.get('required', []))
    missing = [c for c in LEDGER_REQUIRED_COLUMNS if c not in props]
    if missing:
        rep.fail(f'필수 컬럼 정의 누락 {len(missing)}건: {missing}')
    else:
        rep.ok(f'필수 컬럼 {len(LEDGER_REQUIRED_COLUMNS)}종 전부 정의')
    not_required = [c for c in LEDGER_REQUIRED_COLUMNS if c not in required]
    if not_required:
        rep.fail(f'필수(required)로 선언되지 않은 컬럼: {not_required}')
    else:
        rep.ok(f'필수 컬럼 {len(LEDGER_REQUIRED_COLUMNS)}종 전부 required')

    for col in LEDGER_REQUIRED_COLUMNS:
        spec = props.get(col)
        if isinstance(spec, dict) and not (spec.get('type') or spec.get('$ref')
                                           or spec.get('enum') or spec.get('oneOf')):
            rep.fail(f'컬럼 `{col}` 에 타입/enum 정의가 없다')

    axis_enum = (props.get('axis') or {}).get('enum')
    if not set_equal(axis_enum, AXES):
        rep.fail(f'`axis` enum 이 K-7 4축과 집합 동등이 아니다: {axis_enum}')
    else:
        rep.ok(f'`axis` enum == K-7 4축 (집합 동등)')

    smr = props.get('service_menu_raw') or {}
    if 'service_menu_raw' not in required:
        rep.fail('service_menu_raw 가 필수가 아니다')
    if 'NONE_LISTED' not in json.dumps(smr, ensure_ascii=False):
        rep.fail('service_menu_raw 에 fallback `NONE_LISTED` 규정이 없다')
    else:
        rep.ok('service_menu_raw 필수 + fallback `NONE_LISTED`')

    ab = props.get('absence_check') or {}
    ab_resolved = resolve_ref(schema, ab['$ref']) if '$ref' in ab else ab
    if ab_resolved.get('type') != 'object':
        rep.fail('absence_check 가 객체 타입이 아니다')
    else:
        keys = set((ab_resolved.get('properties') or {}).keys())
        miss = [c for c in K1_ALLOWED_CHANNELS if c not in keys]
        if miss:
            rep.fail(f'absence_check 에 K-1 채널 키 누락: {miss}')
        elif set(ab_resolved.get('required', [])) < set(K1_ALLOWED_CHANNELS):
            rep.fail('absence_check 의 5개 채널 키가 전부 required 가 아니다')
        else:
            rep.ok('absence_check 가 K-1 5개 채널 각각을 required 객체 속성으로 보유')

    ec_enum = (props.get('evidence_channel') or {}).get('enum') or []
    if set(ec_enum) - set(K1_ALLOWED_CHANNELS) - {'none'}:
        rep.fail(f'evidence_channel enum 에 K-1 밖 값이 있다: {ec_enum}')
    else:
        rep.ok('evidence_channel enum ⊆ K-1 ∪ {none}')

    samples = read_json(ctx.d1a('ledger_schema_samples.json'))
    valid_n = invalid_n = 0
    for case in samples.get('valid', []):
        errs = validate_instance(row, case['row'])
        if errs:
            rep.fail(f'적합 표본 `{case["id"]}` 가 스키마를 통과하지 못한다', '\n'.join(errs[:6]))
        else:
            valid_n += 1
    for case in samples.get('invalid', []):
        if not validate_instance(row, case['row']):
            rep.fail(f'위반 표본 `{case["id"]}` 가 스키마를 통과한다 — 스키마가 아무것도 막지 않는다')
        else:
            invalid_n += 1
    if valid_n == 0 or invalid_n == 0:
        rep.fail(f'적합성 표본이 부족하다 (적합 {valid_n}건 / 위반 {invalid_n}건)')
    else:
        rep.ok(f'적합성 표본 통과 — 적합 {valid_n}건 전부 통과 · 위반 {invalid_n}건 전부 거부')

    try:
        import jsonschema  # type: ignore  # noqa: F401
    except ImportError:
        rep.info('jsonschema 미설치 — 내장 검증기 단독 판정 (discovery job 의 정상 상태)')
        return
    from jsonschema import Draft202012Validator
    Draft202012Validator.check_schema(schema)
    for case in samples.get('valid', []):
        if list(Draft202012Validator(row).iter_errors(case['row'])):
            rep.fail(f'교차검증 불일치 — 적합 표본 `{case["id"]}` 를 jsonschema 가 거부한다')
    for case in samples.get('invalid', []):
        if not list(Draft202012Validator(row).iter_errors(case['row'])):
            rep.fail(f'교차검증 불일치 — 위반 표본 `{case["id"]}` 를 jsonschema 가 통과시킨다')
    rep.ok('jsonschema(draft 2020-12) 교차검증 일치')


# ═══════════════════════════════════════════════════════════════════════════
# protocol.lock
# ═══════════════════════════════════════════════════════════════════════════

def check_lock(ctx: Ctx, rep: Report) -> None:
    entries = _parse_lock(ctx)
    if not entries:
        rep.fail('protocol.lock 에 항목이 0건이다')
        return
    required = {f'{D1A_DIR}/{name}' for name in LOCK_TARGETS}
    missing = sorted(required - set(entries))
    if missing:
        rep.fail(f'protocol.lock 에 필수 항목이 없다: {missing}')
    else:
        rep.ok(f'protocol.lock 필수 {len(LOCK_TARGETS)}종 포함 (총 {len(entries)}종)')
    for rel, digest in sorted(entries.items()):
        actual = sha256_file(ctx.path(rel))
        if actual != digest:
            rep.fail(f'protocol.lock 불일치 — {rel}', f'기재 {digest}\n실제 {actual}')
        else:
            rep.ok(f'lock 일치: {rel}')


# ═══════════════════════════════════════════════════════════════════════════
# 메타테스트 — 위반 픽스처가 실제로 non-zero 를 내는지 확인한다
# ═══════════════════════════════════════════════════════════════════════════

REQUIRED_FIXTURE_COUNT = 12


def find_fixture_root(ctx: Ctx) -> str:
    for rel in FIXTURE_DIRS:
        p = ctx.path(rel)
        if os.path.isdir(p):
            return p
    raise CheckError(f'위반 픽스처 디렉터리가 없다 (찾은 위치: {list(FIXTURE_DIRS)})')


def check_meta(ctx: Ctx, rep: Report) -> None:
    froot = find_fixture_root(ctx)
    names = sorted(d for d in os.listdir(froot) if os.path.isdir(os.path.join(froot, d)))
    if len(names) < REQUIRED_FIXTURE_COUNT:
        rep.fail(f'위반 픽스처가 {len(names)}종이다 ({REQUIRED_FIXTURE_COUNT}종 필요): {names}')
    else:
        rep.ok(f'위반 픽스처 {len(names)}종')

    sample = read_csv_rows(ctx.d1a('sample.csv'))
    primary_ids = [r['venue_id'] for r in sample if r['status'] == 'primary']

    specs = {}
    for name in names:
        spec_path = os.path.join(froot, name, 'expect.json')
        if not os.path.exists(spec_path):
            rep.fail(f'픽스처 `{name}` 에 expect.json 이 없다')
            continue
        specs[name] = read_json(spec_path)

    baseline_checks = sorted({c for s in specs.values() for c in (s.get('must_fail_checks') or [])})
    if not baseline_checks:
        rep.fail('픽스처의 must_fail_checks 가 전부 비어 있다 — 메타테스트가 아무것도 검사하지 않는다')
        return
    baseline_out = {}
    with tempfile.TemporaryDirectory() as tmp:
        tree = os.path.join(tmp, 'tree')
        _materialize(ctx, tree, None, None, primary_ids)
        for check in baseline_checks:
            code, out = _run_self(ctx, tree, check)
            baseline_out[check] = out
            if code != 0:
                rep.fail(f'메타테스트 기준선 실패 — 오버레이 없는 트리에서 '
                         f'`--check {check}` 가 exit {code} 다. 픽스처의 red 를 위반 탓으로 '
                         f'귀속하려면 기준선이 green 이어야 한다',
                         '\n'.join(ln for ln in out.splitlines() if ln.lstrip().startswith('✗')))
            else:
                rep.ok(f'기준선(오버레이 없음) → `--check {check}` exit 0')

    for name in sorted(specs):
        spec = specs[name]
        checks = spec.get('must_fail_checks') or []
        if not checks:
            rep.fail(f'픽스처 `{name}` 의 must_fail_checks 가 비어 있다')
            continue
        expect_token = spec.get('rule')
        if not expect_token:
            rep.fail(f'픽스처 `{name}` 에 귀속 대상 rule 이 없다')
            continue
        # 기준선에 이미 그 사유가 있으면 픽스처가 아무것도 입증하지 못한다.
        contaminated = [c for c in checks if expect_token in baseline_out.get(c, '')]
        if contaminated:
            rep.fail(f'픽스처 `{name}` 의 귀속 토큰이 기준선 출력에 이미 있다 '
                     f'({contaminated}) — 이 픽스처는 탐지력을 입증하지 못한다')
            continue
        fdir = os.path.join(froot, name)
        with tempfile.TemporaryDirectory() as tmp:
            tree = os.path.join(tmp, 'tree')
            _materialize(ctx, tree, os.path.join(fdir, 'overlay'),
                         os.path.join(fdir, 'patch.py'), primary_ids)
            for check in checks:
                code, out = _run_self(ctx, tree, check)
                if code == 0:
                    rep.fail(f'메타테스트 실패 — 픽스처 `{name}` 에서 '
                             f'`--check {check}` 가 exit 0 이다 (위반을 잡지 못했다)',
                             out[-1500:])
                elif expect_token not in out:
                    rep.fail(f'메타테스트 귀속 실패 — 픽스처 `{name}` 의 실패 사유에 '
                             f'`{expect_token}` 이 없다 (다른 이유로 red 가 된 것)',
                             out[-1800:])
                else:
                    rep.ok(f'픽스처 `{name}` → `--check {check}` exit {code} · '
                           f'사유 `{expect_token}` 귀속 (기준선에는 부재)')


def _materialize(ctx: Ctx, tree: str, overlay, patch, primary_ids: list) -> None:
    """검사 대상 트리를 임시 디렉터리에 재구성한다.

    `overlay/` 는 파일 단위 덮어쓰기, `patch.py` 는 트리 루트에서 실행하는 제자리 변형이다.
    후자는 8,895행짜리 population.csv 를 통째로 복제하지 않고 한 행만 바꾸기 위한 것이며,
    변형 스크립트 자체가 리뷰 대상으로 리포지토리에 남는다.
    """
    os.makedirs(tree)
    shutil.copytree(ctx.d1a(), os.path.join(tree, D1A_DIR))
    shutil.rmtree(os.path.join(tree, D1A_DIR, 'fixtures'), ignore_errors=True)
    os.makedirs(os.path.join(tree, 'scripts', 'discovery'), exist_ok=True)
    shutil.copy2(os.path.abspath(__file__),
                 os.path.join(tree, 'scripts', 'discovery', 'validate_d1a.py'))
    subprocess.run([shutil.which('git') or 'git', 'init', '-q'], cwd=tree, check=True)
    if overlay and os.path.isdir(overlay):
        for base, _dirs, files in os.walk(overlay):
            for fn in files:
                src = os.path.join(base, fn)
                rel = os.path.relpath(src, overlay)
                dst = os.path.join(tree, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                body = open(src, encoding='utf-8').read()
                body = re.sub(r'\{\{SAMPLE_ID_(\d+)\}\}',
                              lambda m: primary_ids[int(m.group(1)) % len(primary_ids)], body)
                open(dst, 'w', encoding='utf-8').write(body)
    if patch and os.path.isfile(patch):
        proc = subprocess.run([sys.executable, os.path.abspath(patch)], cwd=tree,
                              capture_output=True, text=True)
        if proc.returncode != 0:
            raise CheckError(f'픽스처 패치 실패: {patch}\n{proc.stdout}\n{proc.stderr}')
    subprocess.run([shutil.which('git') or 'git', 'add', '-A'], cwd=tree, check=True)


def _run_self(ctx: Ctx, tree: str, check: str) -> tuple:
    proc = subprocess.run(
        [sys.executable, os.path.join(tree, 'scripts', 'discovery', 'validate_d1a.py'),
         '--check', check, '--root', tree],
        capture_output=True, text=True, cwd=tree)
    return proc.returncode, proc.stdout + proc.stderr


# ═══════════════════════════════════════════════════════════════════════════
# 생성 모드 (CI 미사용) — sample.csv · holdout.enc · protocol.lock
# ═══════════════════════════════════════════════════════════════════════════

def emit_sample(ctx: Ctx) -> None:
    proto = load_protocol(ctx)
    sampling = proto['sampling']
    pop = read_csv_rows(ctx.d1a('population.csv'))
    rows = derive_sample(pop, sampling['seed'], sampling['reserve_n'])
    with open(ctx.d1a('sample.csv'), 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=SAMPLE_COLUMNS, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    print(f'sample.csv {len(rows)}행 생성', file=sys.stderr)


def emit_double_check(ctx: Ctx) -> None:
    proto = load_protocol(ctx)
    sample = read_csv_rows(ctx.d1a('sample.csv'))
    primary_ids = [r['venue_id'] for r in sample if r['status'] == 'primary']
    ids = derive_double_check(primary_ids, proto['aggregation']['double_check_seed'],
                              K6_DOUBLE_CHECK_N)
    print(json.dumps(ids, ensure_ascii=False))


def emit_holdout(ctx: Ctx, passphrase: str, custodian: str,
                 superseded_fp: str, superseded_pop: str) -> None:
    import secrets
    sample = read_csv_rows(ctx.d1a('sample.csv'))
    primary = [r for r in sample if r['status'] == 'primary']
    rng = secrets.SystemRandom()
    chosen: list = []
    for axis, n in K6_HOLDOUT_AXIS_ALLOCATION.items():
        pool = [r['venue_id'] for r in primary if r['axis'] == axis]
        chosen += rng.sample(pool, n)
    order = [r['venue_id'] for r in sample]
    run = max_consecutive_run([v in set(chosen) for v in order])
    payload = json.dumps({'schema': 'glowmate/d1a/holdout/2',
                          'holdout_venue_ids': sorted(chosen)},
                         ensure_ascii=False, sort_keys=True).encode()
    blob = seal(passphrase, payload, secrets.token_bytes(16), secrets.token_bytes(16))
    open(ctx.d1a('holdout.enc'), 'wb').write(blob)
    manifest = {
        'schema': 'glowmate/d1a/holdout-manifest/2',
        'record_count': K6_HOLDOUT_N,
        'axis_allocation': K6_HOLDOUT_AXIS_ALLOCATION,
        'enc_sha256': hashlib.sha256(blob).hexdigest(),
        'plaintext_sha256': hashlib.sha256(payload).hexdigest(),
        'key_fingerprint': key_fingerprint(passphrase),
        'superseded_key_fingerprint': superseded_fp,
        'superseded_population_sha256': superseded_pop,
        'kdf': {'name': 'pbkdf2-hmac-sha256', 'iterations': ENC_KDF_ITERS, 'dklen': 64},
        'cipher': 'hmac-sha256-ctr + encrypt-then-mac(hmac-sha256)',
        'sample_index_max_run': run,
        'sealed_at': os.environ.get('GLOWMATE_SEALED_AT', ''),
        'custodian': custodian,
    }
    open(ctx.d1a('holdout_manifest.json'), 'w', encoding='utf-8').write(
        _annotate_fingerprints(json.dumps(manifest, ensure_ascii=False, indent=2)) + '\n')
    print(f'holdout.enc 생성 — 25건 봉인, 최대 연속 배치 {run}행', file=sys.stderr)


# 비밀값 스캐너(F1 CI job `secret-scan`)의 generic-api-key 규칙은 필드명에 `key` 가 들어간
# 64자 hex 를 자격증명으로 판정한다. 키 지문은 PBKDF2 단방향 산출물이고 **공개가 목적**이며
# (REQ-5 가 기록을 요구한다), 필드명은 계약이 `key_fingerprint` 로 고정했다.
# 값을 지우면 REQ-5 위반, 필드명을 바꾸면 FORBID-4(b) 검사 불가이므로
# 스캐너 표준 인라인 예외를 같은 줄에 남긴다.
_FP_NOTE = ('PBKDF2-HMAC-SHA256(passphrase) 지문이며 복호화 키가 아니다 — '
            '지문에서 키를 역산할 수 없고, 공개가 이 필드의 목적이다. gitleaks' + ':allow')


def _annotate_fingerprints(text: str) -> str:
    for field in ('key_fingerprint', 'superseded_key_fingerprint'):
        text = re.sub(rf'("{field}": "[0-9a-f]{{64}}",)',
                      lambda m: f'{m.group(1)} "{field}_note": "{_FP_NOTE}",', text)
    return text


def emit_lock(ctx: Ctx) -> None:
    lines = ['# D1a-PROTOCOL 사전등록 잠금 — 이 파일이 origin/main 에 있어야 D1b 를 열 수 있다',
             '# 형식: <sha256>  <repo 상대 경로>']
    for name in LOCK_TARGETS:
        rel = f'{D1A_DIR}/{name}'
        lines.append(f'{sha256_file(ctx.path(rel))}  {rel}')
    open(ctx.d1a('protocol.lock'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('protocol.lock 생성', file=sys.stderr)


# ═══════════════════════════════════════════════════════════════════════════

CHECKS = {
    'frame': check_frame,
    'definition': check_definition,
    'definition-recall': check_definition_recall,
    'sampling': check_sampling,
    'holdout-sealed': check_holdout_sealed,
    'population-quality': check_population_quality,
    'aggregation': check_aggregation,
    'thresholds': check_thresholds,
    'ledger-schema': check_ledger_schema,
    'lock': check_lock,
    'meta': check_meta,
}

ALL_ORDER = ['frame', 'population-quality', 'definition', 'definition-recall',
             'sampling', 'holdout-sealed', 'aggregation', 'thresholds',
             'ledger-schema', 'lock', 'meta']


def default_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_one(ctx: Ctx, name: str) -> int:
    rep = Report(f'--check {name}')
    print(f'== {name} ==')
    try:
        CHECKS[name](ctx, rep)
    except CheckError as exc:
        rep.fail(str(exc))
    except Exception as exc:  # noqa: BLE001
        import traceback
        rep.fail(f'검사가 완료되지 못했다 (판정 불가는 통과가 아니다): {exc}',
                 traceback.format_exc())
    return rep.finish()


def main(argv: list) -> int:
    parser = argparse.ArgumentParser(
        prog='validate_d1a.py',
        description='D1a-PROTOCOL 사전등록 검증기 (F1 CI job `discovery`)')
    parser.add_argument('--check', choices=sorted(CHECKS))
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--root', default=None)
    parser.add_argument('--emit', choices=('sample', 'holdout', 'lock', 'double-check'))
    parser.add_argument('--key-file')
    parser.add_argument('--custodian', default='team-lead')
    parser.add_argument('--superseded-key-fingerprint', default='')
    parser.add_argument('--superseded-population-sha256', default='')
    args = parser.parse_args(argv)

    root = os.path.abspath(args.root) if args.root else default_root()
    ctx = Ctx(root)

    if args.emit:
        if args.emit == 'sample':
            emit_sample(ctx)
        elif args.emit == 'lock':
            emit_lock(ctx)
        elif args.emit == 'double-check':
            emit_double_check(ctx)
        else:
            if not args.key_file:
                print('--emit holdout 에는 --key-file 이 필요하다', file=sys.stderr)
                return 2
            emit_holdout(ctx, open(args.key_file, encoding='utf-8').read().strip(),
                         args.custodian, args.superseded_key_fingerprint,
                         args.superseded_population_sha256)
        return 0

    if not args.check and not args.all:
        parser.print_usage(sys.stderr)
        print('오류: --check <name> 또는 --all 중 하나가 필요하다. '
              '인자 없이 실행하는 것은 통과가 아니다.', file=sys.stderr)
        return 2

    print(f'validate_d1a.py — root={root}')
    if not os.path.isdir(os.path.join(root, D1A_DIR)):
        print(f'[FAIL] {D1A_DIR} 디렉터리가 없다 — 검사 대상 부재는 통과가 아니다', file=sys.stderr)
        return 2

    names = ALL_ORDER if args.all else [args.check]
    worst = 0
    for name in names:
        worst = max(worst, run_one(ctx, name))
    print(f'== 종합: {"FAIL" if worst else "OK"} ({len(names)}개 검사) ==')
    return worst


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
