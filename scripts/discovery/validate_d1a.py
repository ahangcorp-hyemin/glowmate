#!/usr/bin/env python3
"""D1a-PROTOCOL 사전등록 검증기.

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
import os
import re
import shutil
import subprocess
import sys
import tempfile

# ═══════════════════════════════════════════════════════════════════════════
# 계약 고정 상수 — docs/tasks/D1a.md §K-1~K-6.
# 이 값들은 protocol.md 가 **선택할 수 없다.** 검증기가 계약을 대리한다.
# ═══════════════════════════════════════════════════════════════════════════

K1_ALLOWED_CHANNELS = ('website', 'naver_place', 'kakao_map',
                       'instagram_public', 'official_blog')

# K-2 금지 증거 취득 경로 토큰 — protocol.md 전문에서 0건이어야 한다.
K2_FORBIDDEN_TOKENS = ('전화', '통화', '카톡', 'DM', '방문문의',
                       '체험단', '카페글', '소셜커머스', '추정')

# K-3 성립 요건 3종 — id 와 각 항목이 반드시 포함해야 하는 토큰.
K3_REQUIRED_CONDITIONS = {
    'posted_on_allowed_channel_now': ('게시', '스냅샷'),
    'amount_and_service_on_same_page': ('금액', '서비스', '동일'),
    'inquiry_only_is_false': ('문의', 'false'),
}

# K-4 판정 임계 — PRD §4 G1 전사.
K4_PROCEED_THRESHOLD = 0.40
K4_EXCLUDE_THRESHOLD = 0.25
K4_BETWEEN_VERDICT = 'editor_augment'

# K-5 표본 프레임 허용 소스 + 프레임 구축 필터 금지 속성 토큰.
K5_FRAME_SOURCES = ('map_category_enumeration', 'public_license_registry')
K5_FORBIDDEN_FILTER_TOKENS = (
    '가격', '요금', '이용권', '예약', '결제', '광고', '상위노출', '상위 노출',
    '평점', '리뷰', '검색결과 상위', '검색 결과 상위', '상위 N', '상위N',
    'price', 'fee', 'booking', 'reservation', 'payment', 'rating', 'review',
    'ranking', 'top_n', 'topn', 'ad_product',
)

# K-6 수치 상한·하한.
K6_PRIMARY_N = 100
K6_AXIS_ALLOCATION = {'exercise_body': 34, 'relax_recovery': 33, 'medical_wellness': 33}
K6_MIN_CELL = 8
K6_HOLDOUT_N = 25
K6_HOLDOUT_AXIS_ALLOCATION = {'exercise_body': 9, 'relax_recovery': 8, 'medical_wellness': 8}
K6_REPLACEMENT_CAP = 5
K6_BLOCKED_CAP = 5
K6_N_DEFINITION = '100 - blocked - unreplaceable'
K6_DOUBLE_CHECK_N = 20
K6_DISAGREEMENT_RESOLUTION = 'false'
K6_HOLDOUT_DRIFT_LIMIT_PP = 15.0

AXES = ('exercise_body', 'relax_recovery', 'medical_wellness')
GUS = ('강남구', '서초구', '송파구')

INCONCLUSIVE_REQUIRED = ('n_below_90', 'replacement_above_5', 'holdout_drift_ge_15pp')

# 홀드아웃 봉인 포맷.
ENC_MAGIC = b'GMHO1\n'
ENC_KDF_ITERS = 600_000
FINGERPRINT_SALT = b'glowmate-d1a-holdout-key-fingerprint'
FINGERPRINT_ITERS = 1_000

# sample.csv 가 가질 수 있는 컬럼 — 홀드아웃 표식 컬럼 신설을 구조적으로 차단한다.
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
    # 계약 done_when 이 지정한 경로. 계약 touches 에 포함되면 여기로 이동한다.
    os.path.join('scripts', 'discovery', 'fixtures', 'd1a'),
    # 현재 touches(`docs/discovery/D1a/**`) 안의 위치.
    os.path.join(D1A_DIR, 'fixtures'),
)


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


# ═══════════════════════════════════════════════════════════════════════════
# 공통 로더 — 부재·파싱 실패는 예외로 올려 non-zero 로 끝낸다
# ═══════════════════════════════════════════════════════════════════════════

class CheckError(Exception):
    pass


def read_text(path: str) -> str:
    if not os.path.exists(path):
        raise CheckError(f'필수 산출물 부재: {path}')
    return open(path, encoding='utf-8').read()


def read_bytes(path: str) -> bytes:
    if not os.path.exists(path):
        raise CheckError(f'필수 산출물 부재: {path}')
    return open(path, 'rb').read()


def read_csv_rows(path: str) -> list[dict]:
    text = read_text(path)
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        raise CheckError(f'{path} 의 데이터 행이 0건이다 — 빈 입력을 통과로 처리하지 않는다')
    return rows


def sha256_file(path: str) -> str:
    return hashlib.sha256(read_bytes(path)).hexdigest()


def read_snapshot_bytes(path: str) -> bytes:
    """스냅샷 원본 바이트. `.gz` 로 저장된 것은 투명하게 푼다.

    스냅샷을 gzip 으로 저장하는 이유는 `definition_examples/README.md` §저장 형식 참조 —
    타사 공개 페이지 원본에 그 사이트의 공개 토큰이 섞여 있어 리포 전역 비밀값 스캐너가
    오탐을 내고, 그 오탐이 secret-scan job 을 red 로 만들기 때문이다.
    """
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
    text = read_text(ctx.d1a('protocol.md'))
    return extract_json_block(text, 'protocol.json', 'protocol.md')


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


# ═══════════════════════════════════════════════════════════════════════════
# 표집 — protocol.md 의 고정 시드로 population.csv 에서 sample 을 재생성한다
# ═══════════════════════════════════════════════════════════════════════════

def sampling_key(seed: str, venue_id: str) -> str:
    return hashlib.sha256(f'{seed}|{venue_id}'.encode()).hexdigest()


def gu_allocation(total: int) -> dict:
    """축 정원을 구 3개에 배분한다. 나머지는 강남구·서초구·송파구 순으로."""
    base, rem = divmod(total, len(GUS))
    return {gu: base + (1 if i < rem else 0) for i, gu in enumerate(GUS)}


def derive_sample(population: list[dict], seed: str, reserve_n: int) -> list[dict]:
    """(axis, gu) 층별 고정 시드 추출. 결과는 venue_id 오름차순 정본 순서로 반환."""
    strata_order = [(axis, gu) for axis in AXES for gu in GUS]
    primary_quota = {}
    for axis in AXES:
        for gu, n in gu_allocation(K6_AXIS_ALLOCATION[axis]).items():
            primary_quota[(axis, gu)] = n

    base, rem = divmod(reserve_n, len(strata_order))
    reserve_quota = {st: base + (1 if i < rem else 0)
                     for i, st in enumerate(strata_order)}

    by_stratum: dict[tuple, list[dict]] = {st: [] for st in strata_order}
    for row in population:
        st = (row['axis'], row['gu'])
        if st in by_stratum:
            by_stratum[st].append(row)

    primary, reserve = [], []
    for st in strata_order:
        pool = sorted(by_stratum[st], key=lambda r: sampling_key(seed, r['venue_id']))
        need = primary_quota[st] + reserve_quota[st]
        if len(pool) < need:
            raise CheckError(
                f'층 {st} 의 모집단 {len(pool)}건이 필요 표본 {need}건보다 적다')
        for r in pool[:primary_quota[st]]:
            primary.append(r)
        for r in pool[primary_quota[st]:need]:
            reserve.append(r)

    rows = []
    for r in primary:
        rows.append({'venue_id': r['venue_id'], 'name': r['name'], 'gu': r['gu'],
                     'axis': r['axis'], 'status': 'primary', 'reserve_rank': ''})
    rank = 0
    for st in strata_order:
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

def _derive_keys(passphrase: str, salt: bytes, iters: int) -> tuple[bytes, bytes]:
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


def max_consecutive_run(flags: list[bool]) -> int:
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best


# ═══════════════════════════════════════════════════════════════════════════
# 스냅샷 → 텍스트 추출 (definition_examples · D1b 가 공유하는 정본 절차)
#
#   extraction_method = 'html_strip'        → 아래 extract_html_text (검증기가 재현 검사)
#   extraction_method = 'macos_vision_ocr'  → 이미지 OCR (검증기가 재현하지 않는다)
#   extraction_method = 'pdf_text_layer'    → PDF 텍스트 레이어 (검증기가 재현하지 않는다)
#
# 재현 불가능한 두 방법은 스냅샷 파일 sha256 + 추출 텍스트 sha256 으로만 묶인다.
# 그래서 `html_strip` 예시가 0건이면 재현 검사가 공허해지므로, 그 경우 실패로 처리한다.
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
    'B1_channel_not_allowed',
    'B2_not_currently_posted',
    'B3_no_amount_on_page',
    'B4_amount_without_service_name',
    'B5_inquiry_only',
    'B6_ended_event_only',
    'B7_amount_and_service_same_page',
)

# protocol.md §4 표의 적용 순서. 문서와 구현이 갈라지면 --check definition 이 red 다.
DECISION_ORDER = (
    'B1_channel_not_allowed',
    'B2_not_currently_posted',
    'B5_inquiry_only',
    'B3_no_amount_on_page',
    'B6_ended_event_only',
    'B4_amount_without_service_name',
    'B7_amount_and_service_same_page',
)


def decide_price_found(channel: str, obs: dict, allowed_channels) -> tuple[bool, str]:
    if channel not in allowed_channels:
        return False, 'B1_channel_not_allowed'
    if not obs.get('currently_posted'):
        return False, 'B2_not_currently_posted'
    # 금액 자리에 안내 요청 표기만 있는 경우가 먼저다 — "금액이 없다"로 뭉뚱그리면
    # K-3 3항이 별도 요건으로 존재할 이유가 사라진다.
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


def check_schema_shape(schema, path: str, errors: list[str]) -> None:
    """미지 키워드·키워드 타입 위반을 잡는다 (오타 키워드는 조용히 무검증이 된다)."""
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
            vals = value if isinstance(value, list) else [value]
            for v in vals:
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


def validate_instance(schema, instance, root=None, path='') -> list[str]:
    root = schema if root is None else root
    errs: list[str] = []
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

    for key in ('allOf',):
        for i, sub in enumerate(schema.get(key, [])):
            errs += validate_instance(sub, instance, root, f'{path}')
    if 'anyOf' in schema:
        if not any(not validate_instance(s, instance, root, path) for s in schema['anyOf']):
            errs.append(f'{path or "/"}: anyOf 위반')
    if 'oneOf' in schema:
        hits = sum(1 for s in schema['oneOf']
                   if not validate_instance(s, instance, root, path))
        if hits != 1:
            errs.append(f'{path or "/"}: oneOf 위반 (일치 {hits}건)')
    if 'not' in schema and not validate_instance(schema['not'], instance, root, path):
        errs.append(f'{path or "/"}: not 위반')
    return errs


# ═══════════════════════════════════════════════════════════════════════════
# 검사 구현
# ═══════════════════════════════════════════════════════════════════════════

def check_frame(ctx: Ctx, rep: Report) -> None:
    """REQ-1 · FORBID-1."""
    md = read_text(ctx.d1a('frame_build.md'))
    meta = extract_json_block(md, 'frame.json', 'frame_build.md')

    sources = meta.get('frame_sources')
    if not isinstance(sources, list) or not sources:
        rep.fail('frame_build.md frame_sources 가 비어 있다')
    elif not set(sources) <= set(K5_FRAME_SOURCES):
        rep.fail(f'FORBID-1 — frame_sources 가 K-5 enum 밖이다: '
                 f'{sorted(set(sources) - set(K5_FRAME_SOURCES))}')
    else:
        rep.ok(f'frame_sources ⊆ K-5 enum ({sources})')

    for field in ('collected_at', 'reproduction_command', 'datasets'):
        if not meta.get(field):
            rep.fail(f'frame_build.md 에 `{field}` 기록이 없다')
    if meta.get('collected_at'):
        rep.ok(f"수집 일시 기록: {meta['collected_at']}")
    if meta.get('reproduction_command'):
        rep.ok('재현 절차(명령) 기록 확인')
    datasets = meta.get('datasets') or []
    if datasets and all(d.get('url') and d.get('sha256') for d in datasets):
        rep.ok(f'수집 원본 {len(datasets)}종의 URL·sha256 기록 확인')
    elif datasets:
        rep.fail('수집 원본 항목에 url 또는 sha256 이 없다')

    # 필터 전문 — 선언 배열과 문서 블록이 글자 단위로 같아야 한다.
    filters = meta.get('filter_expressions')
    if not isinstance(filters, list) or not filters:
        rep.fail('frame_build.md filter_expressions 가 비어 있다')
        filters = []
    literal = extract_block(md, 'filter-expressions', 'frame_build.md')
    literal_lines = [ln.strip() for ln in literal.splitlines()
                     if ln.strip() and not ln.strip().startswith('```')]
    if literal_lines != [f.strip() for f in filters]:
        rep.fail('frame_build.md 의 필터 전문 블록과 filter_expressions 배열이 다르다',
                 f'블록: {literal_lines}\n배열: {filters}')
    else:
        rep.ok(f'필터 전문 블록 == filter_expressions 배열 ({len(filters)}건)')

    # 집행 코드까지 같은 사전으로 훑는다 — 선언에 없는 필터를 코드에 숨기는 경로 차단.
    targets = [('filter_expressions', '\n'.join(filters)),
               ('frame_build.py', read_text(ctx.d1a('frame_build.py')))]
    for label, blob in targets:
        hits = sorted({t for t in K5_FORBIDDEN_FILTER_TOKENS if t.lower() in blob.lower()})
        if hits:
            rep.fail(f'FORBID-1 — {label} 에 K-5 금지 속성 토큰 {hits} 이(가) 있다')
        else:
            rep.ok(f'{label} — K-5 금지 속성 토큰 0건 매칭')

    pop = read_csv_rows(ctx.d1a('population.csv'))
    if len(pop) < 300:
        rep.fail(f'population.csv 가 {len(pop)}행으로 300행 미만이다')
    else:
        rep.ok(f'population.csv {len(pop)}행 (≥ 300)')

    bad_src = sorted({r['frame_source'] for r in pop} - set(K5_FRAME_SOURCES))
    if bad_src:
        rep.fail(f'FORBID-1 — population.csv 의 frame_source 가 K-5 밖이다: {bad_src}')
    else:
        rep.ok('population.csv 전 행의 frame_source 가 K-5 enum 안에 있다')

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
    short = {k: v for k, v in cells.items() if v < 20}
    if short:
        rep.fail(f'(축,구) 9칸 중 20행 미만인 칸: {short}')
    else:
        rep.ok(f'(축,구) 9칸 각각 ≥ 20 (최소 {min(cells.values())})')

    # 축 결정표 재적용 — 축을 손으로 옮기는 경로 차단.
    table = meta.get('axis_decision_table')
    if not isinstance(table, list) or not table:
        rep.fail('frame_build.md 에 axis_decision_table 이 없다')
    else:
        mismatched = [r['venue_id'] for r in pop
                      if apply_axis_table(table, r) != r['axis']]
        if mismatched:
            rep.fail(f'축 결정표 재적용 결과가 population.csv 와 다른 행 {len(mismatched)}건',
                     ', '.join(mismatched[:5]))
        else:
            rep.ok(f'축 결정표 {len(table)}개 규칙 재적용 결과가 전 {len(pop)}행과 일치')


def apply_axis_table(table: list, row: dict):
    """축 결정표를 데이터 주도로 재적용한다 (frame_build.py 와 독립 경로)."""
    for rule in table:
        cond = rule.get('when', {})
        if 'dataset_id' in cond and row.get('dataset_id') != cond['dataset_id']:
            continue
        if 'license_category' in cond and row.get('license_category') != cond['license_category']:
            continue
        if 'license_category_not_empty' in cond and not (row.get('license_category') or '').strip():
            continue
        subs = cond.get('medical_subjects_any')
        if subs and not any(s in (row.get('medical_subjects') or '') for s in subs):
            continue
        return rule.get('axis')
    return None


def check_definition(ctx: Ctx, rep: Report) -> None:
    """REQ-2 · FORBID-2."""
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
            rep.fail(f'K-3 요건 `{cid}` 의 본문에 필수 토큰 {missing} 이(가) 없다',
                     got[cid])
        else:
            rep.ok(f'K-3 요건 `{cid}` 확인')

    tree = proto.get('decision_tree')
    if not isinstance(tree, list) or len(tree) < 5:
        rep.fail(f'판정 트리 분기가 {len(tree) if isinstance(tree, list) else 0}개다 (5개 이상 필요)')
    else:
        rep.ok(f'판정 트리 분기 {len(tree)}개 (≥ 5)')
    doc_ids = [b.get('id') for b in tree] if isinstance(tree, list) else []
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


def check_definition_recall(ctx: Ctx, rep: Report) -> None:
    """REQ-3 · FORBID-5."""
    proto = load_protocol(ctx)
    allowed = proto.get('allowed_channels') or []
    ex_path = ctx.d1a('definition_examples', 'examples.json')
    examples = json.loads(read_text(ex_path))
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
        rep.fail(f'FORBID-5 — 양성 예시 display_form distinct {len(forms)}종 (5종 이상 필요): '
                 f'{sorted(forms)}')
    else:
        rep.ok(f'양성 예시 display_form distinct {len(forms)}종: {sorted(forms)}')

    ids = [e.get('example_id') for e in examples]
    if len(set(ids)) != len(ids):
        rep.fail('example_id 중복이 있다')

    mismatch: list[str] = []
    reproduced: list[str] = []
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
        stored = sha256_file(snap)
        if stored != e.get('snapshot_stored_sha256'):
            rep.fail(f'FORBID-5 — {eid}: 저장 스냅샷 파일 sha256 불일치',
                     f'기록 {e.get("snapshot_stored_sha256")} / 실제 {stored}')
            continue
        try:
            snap_bytes = read_snapshot_bytes(snap)
        except (OSError, EOFError, ValueError) as exc:
            rep.fail(f'FORBID-5 — {eid}: 스냅샷을 읽을 수 없다 ({exc})')
            continue
        digest = hashlib.sha256(snap_bytes).hexdigest()
        if digest != e.get('snapshot_sha256'):
            rep.fail(f'FORBID-5 — {eid}: 스냅샷 원본 sha256 불일치',
                     f'기록 {e.get("snapshot_sha256")} / 실제 {digest}')
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
            regen = extract_html_text(snap_bytes)
            if regen != extracted:
                rep.fail(f'FORBID-5 — {eid}: 스냅샷을 정본 절차로 재추출한 결과가 '
                         f'커밋된 추출 텍스트와 다르다 (추출 텍스트를 손으로 쓴 경로)',
                         f'재추출 {len(regen)}자 / 커밋 {len(extracted)}자')
                continue
            reproduced.append(eid)

        snippet = e.get('price_evidence_snippet', '')
        if snippet not in extracted:
            rep.fail(f'FORBID-5 — {eid}: snippet 이 스냅샷 추출 텍스트의 부분문자열이 아니다',
                     f'snippet: {snippet[:120]}')
            continue

        # 신고값이 아니라 추출 텍스트 자체를 근거로 한 독립 확인.
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
                    rep.fail(f'{eid}: negative_reason=no_amount 인데 추출 텍스트에 금액 표기가 있다')
                    continue
            elif reason == 'inquiry_only':
                # 금액 자리에 안내 요청 표기만 있는 상태 = 페이지 전체에 금액 표기가 0건이고
                # 안내 요청 표기가 스니펫과 본문에 모두 존재해야 한다.
                if has_price:
                    rep.fail(f'{eid}: inquiry_only 인데 추출 텍스트에 금액 표기가 있다 — '
                             f'"금액 자리에 안내 요청만"이 성립하지 않는다')
                    continue
                if not any(p in extracted for p in INQUIRY_PHRASES) or \
                        not any(p in snippet for p in INQUIRY_PHRASES):
                    rep.fail(f'{eid}: inquiry_only 인데 본문 또는 스니펫에 안내 요청 표기가 없다')
                    continue
            elif reason == 'ended_event_only':
                if not has_price:
                    rep.fail(f'{eid}: ended_event_only 인데 추출 텍스트에 금액 표기가 없다')
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
        rep.ok(f'스냅샷 재추출 일치 {len(reproduced)}건 '
               f'(추출 텍스트를 손으로 쓴 경로가 닫혀 있다)')

    used = {e.get('_branch') for e in examples if e.get('_branch')}
    rep.info(f'예시가 실제로 밟은 분기: {sorted(used)}')
    if len(used) < 3:
        rep.fail(f'예시 20건이 밟은 분기가 {len(used)}종뿐이다 (3종 이상 필요) — '
                 f'참 경로 1종 + 거짓 경로 2종은 최소한 실측으로 검증되어야 한다')
    else:
        rep.ok(f'예시가 밟은 분기 {len(used)}종 (≥ 3)')

    bad_channels = sorted({e.get('channel') for e in examples} - set(K1_ALLOWED_CHANNELS))
    if bad_channels:
        rep.fail(f'예시에 K-1 밖 채널이 있다: {bad_channels}')
    else:
        rep.ok('예시 채널 전건이 K-1 안에 있다')


def check_sampling(ctx: Ctx, rep: Report) -> None:
    """REQ-4."""
    proto = load_protocol(ctx)
    sampling = proto.get('sampling') or {}
    seed = sampling.get('seed')
    if not seed:
        raise CheckError('protocol.md sampling.seed 가 없다')
    reserve_n = sampling.get('reserve_n')
    if reserve_n != 20:
        rep.fail(f'예비표본 정원이 {reserve_n} 이다 (20이어야 한다)')

    if sampling.get('axis_allocation') != K6_AXIS_ALLOCATION:
        rep.fail(f'축 배분이 K-6 과 다르다: {sampling.get("axis_allocation")}')
    else:
        rep.ok(f'축 배분 {K6_AXIS_ALLOCATION} (K-6 일치)')

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
    if len(reserve) != 20:
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
    short = {k: v for k, v in cells.items() if v < K6_MIN_CELL}
    if short:
        rep.fail(f'(축,구) 9칸 중 {K6_MIN_CELL} 미만인 칸: {short}')
    else:
        rep.ok(f'(축,구) 9칸 각각 ≥ {K6_MIN_CELL} (최소 {min(cells.values())})')

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
        rep.fail('FORBID-4 — sample.csv 가 venue_id 오름차순 정본 순서가 아니다 '
                 '(행 순서가 홀드아웃 배정과 독립임을 구조적으로 보증할 수 없다)')
    else:
        rep.ok('sample.csv 가 venue_id 오름차순 (행 순서 ⟂ 홀드아웃 배정)')

    regen = derive_sample(pop, seed, reserve_n if isinstance(reserve_n, int) else 20)
    want = [(r['venue_id'], r['status'], r['reserve_rank']) for r in regen]
    got = [(r['venue_id'], r['status'], r['reserve_rank']) for r in sample]
    if want != got:
        diff = [f'{w} != {g}' for w, g in zip(want, got) if w != g][:5]
        rep.fail(f'고정 시드 재실행 결과가 sample.csv 와 다르다 '
                 f'(불일치 {sum(1 for w, g in zip(want, got) if w != g)}행)',
                 '\n'.join(diff))
    else:
        rep.ok(f'시드 `{seed}` 재실행 결과가 sample.csv 와 완전 일치')

    name_of = {r['venue_id']: r['name'] for r in pop}
    axis_of_pop = {r['venue_id']: (r['axis'], r['gu']) for r in pop}
    bad = [r['venue_id'] for r in sample
           if r['name'] != name_of.get(r['venue_id'])
           or (r['axis'], r['gu']) != axis_of_pop.get(r['venue_id'])]
    if bad:
        rep.fail(f'표본 행의 name/axis/gu 가 population 과 다른 행 {len(bad)}건',
                 ', '.join(bad[:5]))
    else:
        rep.ok('표본 행의 name·axis·gu 가 population 과 동일 (축 재배정 0건)')


def check_holdout_sealed(ctx: Ctx, rep: Report) -> None:
    """REQ-5 · FORBID-4."""
    enc_path = ctx.d1a('holdout.enc')
    blob = read_bytes(enc_path)
    manifest = json.loads(read_text(ctx.d1a('holdout_manifest.json')))

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
        rep.ok(f'홀드아웃 축별 배분 {K6_HOLDOUT_AXIS_ALLOCATION} (9/8/8)')

    for field in ('enc_sha256', 'plaintext_sha256', 'unlock_fingerprint',
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

    run = manifest.get('sample_index_max_run')
    if not isinstance(run, int):
        rep.fail('sample_index_max_run 이 정수가 아니다')
    elif run >= 5:
        rep.fail(f'FORBID-4 — 홀드아웃 행이 sample.csv 에서 연속 {run}행 배치되어 있다 (런 길이 ≥ 5)')
    else:
        rep.ok(f'홀드아웃 행 최대 연속 배치 {run}행 (< 5)')

    # 키가 리포에 있으면 봉인이 아니다. 추적 파일 전체를 후보 패스프레이즈로 시험한다.
    fp = manifest.get('unlock_fingerprint')
    tracked = git_tracked_files(ctx.root)
    candidates: set[str] = set()
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

    # 표본 venue_id 평문 노출 — 허용 위치는 population.csv · sample.csv ·
    # protocol.md 의 (시드로 재산출 가능한) 이중판정 20건 목록뿐이다.
    sample = read_csv_rows(ctx.d1a('sample.csv'))
    primary_ids = [r['venue_id'] for r in sample if r['status'] == 'primary']
    proto = load_protocol(ctx)
    dc_seed = ((proto.get('aggregation') or {}).get('double_check_seed'))
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
        rep.fail('FORBID-4 — 표본 venue_id 가 허용 위치 밖 추적 파일에 평문으로 있다',
                 '\n'.join(leaks[:10]))
    else:
        rep.ok(f'표본 venue_id 평문 노출 0건 (추적 파일 {len(tracked)}건 스캔)')

    # 탐지기 자기검사 — 대상이 깨끗해도 탐지 코드가 살아 있음을 매 실행 증명한다.
    _selftest_holdout_detectors(rep)

    # 키가 주어지면(팀 리드·D1b 경로) 복호화 대조까지 수행한다.
    passphrase = _holdout_key_from_env()
    if passphrase is None:
        rep.info('HOLDOUT_KEY_ABSENT — 복호화 대조 3종(집합 포함·축 배분 실측·런 길이 실측)은 '
                 '키 보유자 경로에서만 수행된다. CI 는 구조적 대체 검사로 판정한다')
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
        rep.fail(f'복호화 결과 축별 배분 실측 {counts} ≠ 매니페스트 {K6_HOLDOUT_AXIS_ALLOCATION}')
    else:
        rep.ok(f'복호화 결과 축별 배분 실측 {counts}')
    order = [r['venue_id'] for r in sample]
    actual_run = max_consecutive_run([v in set(ids) for v in order])
    if actual_run != manifest.get('sample_index_max_run'):
        rep.fail(f'런 길이 실측 {actual_run} ≠ 매니페스트 기재 {manifest.get("sample_index_max_run")}')
    elif actual_run >= 5:
        rep.fail(f'FORBID-4 — 홀드아웃 행이 연속 {actual_run}행 배치되어 있다')
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


def check_aggregation(ctx: Ctx, rep: Report) -> None:
    """REQ-6."""
    proto = load_protocol(ctx)
    agg = proto.get('aggregation') or {}

    if agg.get('n_definition') != K6_N_DEFINITION:
        rep.fail(f'n_definition 이 `{agg.get("n_definition")}` 이다 '
                 f'(정본 `{K6_N_DEFINITION}`)')
    else:
        rep.ok(f'n_definition == `{K6_N_DEFINITION}`')

    for field, want in (('blocked_cap', K6_BLOCKED_CAP),
                        ('replacement_cap', K6_REPLACEMENT_CAP),
                        ('double_check_n', K6_DOUBLE_CHECK_N)):
        if agg.get(field) != want:
            rep.fail(f'{field} 이 {agg.get(field)} 이다 (K-6: {want})')
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
    """REQ-7 · FORBID-3."""
    text = read_text(ctx.d1a('protocol.md'))
    proto = extract_json_block(text, 'protocol.json', 'protocol.md')
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

    conds = proto.get('inconclusive_conditions')
    if not isinstance(conds, list):
        rep.fail('inconclusive_conditions 가 배열이 아니다')
        return
    got = {c.get('id'): c for c in conds if isinstance(c, dict)}
    for cid in INCONCLUSIVE_REQUIRED:
        if cid not in got:
            rep.fail(f'inconclusive 강제 조건 `{cid}` 이 없다')
        else:
            rep.ok(f'inconclusive 강제 조건 `{cid}` 확인')
    if got.get('n_below_90', {}).get('threshold') != 90:
        rep.fail('n_below_90 의 임계가 90 이 아니다')
    if got.get('replacement_above_5', {}).get('threshold') != K6_REPLACEMENT_CAP:
        rep.fail('replacement_above_5 의 임계가 5 가 아니다')
    if got.get('holdout_drift_ge_15pp', {}).get('threshold') != K6_HOLDOUT_DRIFT_LIMIT_PP:
        rep.fail('holdout_drift_ge_15pp 의 임계가 15.0 (%p) 이 아니다')


def check_ledger_schema(ctx: Ctx, rep: Report) -> None:
    """REQ-8."""
    schema = json.loads(read_text(ctx.d1a('ledger_schema.json')))

    if schema.get('$schema') != DRAFT_2020_12:
        rep.fail(f'$schema 가 draft 2020-12 가 아니다: {schema.get("$schema")}')
    else:
        rep.ok('$schema == draft 2020-12')

    errors: list[str] = []
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

    ec = props.get('evidence_channel') or {}
    ec_enum = ec.get('enum') or []
    if set(ec_enum) - set(K1_ALLOWED_CHANNELS) - {'none'}:
        rep.fail(f'evidence_channel enum 에 K-1 밖 값이 있다: {ec_enum}')
    else:
        rep.ok(f'evidence_channel enum ⊆ K-1 ∪ {{none}}')

    # 적합성 표본으로 스키마가 실제로 판별하는지 확인한다 (통과 표본 · 위반 표본).
    samples = json.loads(read_text(ctx.d1a('ledger_schema_samples.json')))
    valid_n = invalid_n = 0
    for case in samples.get('valid', []):
        errs = validate_instance(row, case['row'])
        if errs:
            rep.fail(f'적합 표본 `{case["id"]}` 가 스키마를 통과하지 못한다',
                     '\n'.join(errs[:6]))
        else:
            valid_n += 1
    for case in samples.get('invalid', []):
        errs = validate_instance(row, case['row'])
        if not errs:
            rep.fail(f'위반 표본 `{case["id"]}` 가 스키마를 통과한다 — 스키마가 아무것도 막지 않는다')
        else:
            invalid_n += 1
    if valid_n == 0 or invalid_n == 0:
        rep.fail(f'적합성 표본이 부족하다 (적합 {valid_n}건 / 위반 {invalid_n}건) — '
                 f'검사 대상 0건을 통과로 처리하지 않는다')
    else:
        rep.ok(f'적합성 표본 통과 — 적합 {valid_n}건 전부 통과 · 위반 {invalid_n}건 전부 거부')

    try:
        import jsonschema  # type: ignore
    except ImportError:
        rep.info('jsonschema 미설치 — 내장 검증기 단독 판정 (CI discovery job 의 정상 상태)')
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


def check_lock(ctx: Ctx, rep: Report) -> None:
    """protocol.lock — D1b FORBID-1 이 이 값으로 사전등록 분리를 판정한다."""
    lock = read_text(ctx.d1a('protocol.lock'))
    entries = []
    for line in lock.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        if len(parts) != 2:
            rep.fail(f'protocol.lock 행 형식 오류: {line}')
            continue
        entries.append((parts[0], parts[1]))
    if not entries:
        rep.fail('protocol.lock 에 항목이 0건이다')
        return
    required = {f'{D1A_DIR}/protocol.md', f'{D1A_DIR}/sample.csv',
                f'{D1A_DIR}/ledger_schema.json'}
    listed = {p for _, p in entries}
    missing = sorted(required - listed)
    if missing:
        rep.fail(f'protocol.lock 에 필수 항목이 없다: {missing}')
    else:
        rep.ok(f'protocol.lock 필수 3종 포함 (총 {len(entries)}종)')
    for digest, rel in entries:
        actual = sha256_file(ctx.path(rel))
        if actual != digest:
            rep.fail(f'protocol.lock 불일치 — {rel}', f'기재 {digest}\n실제 {actual}')
        else:
            rep.ok(f'lock 일치: {rel}')


# ═══════════════════════════════════════════════════════════════════════════
# 메타테스트 — 위반 픽스처가 실제로 non-zero 를 내는지 확인한다
# ═══════════════════════════════════════════════════════════════════════════

def find_fixture_root(ctx: Ctx) -> str:
    for rel in FIXTURE_DIRS:
        p = ctx.path(rel)
        if os.path.isdir(p):
            return p
    raise CheckError(f'위반 픽스처 디렉터리가 없다 (찾은 위치: {list(FIXTURE_DIRS)})')


def check_meta(ctx: Ctx, rep: Report) -> None:
    froot = find_fixture_root(ctx)
    names = sorted(d for d in os.listdir(froot)
                   if os.path.isdir(os.path.join(froot, d)))
    if len(names) < 5:
        rep.fail(f'위반 픽스처가 {len(names)}종이다 (5종 필요): {names}')
    else:
        rep.ok(f'위반 픽스처 {len(names)}종: {names}')

    sample = read_csv_rows(ctx.d1a('sample.csv'))
    primary_ids = [r['venue_id'] for r in sample if r['status'] == 'primary']

    specs = {}
    for name in names:
        spec_path = os.path.join(froot, name, 'expect.json')
        if not os.path.exists(spec_path):
            rep.fail(f'픽스처 `{name}` 에 expect.json 이 없다')
            continue
        specs[name] = json.loads(open(spec_path, encoding='utf-8').read())

    # 기준선 — 오버레이가 없는 동일 트리에서는 전 검사가 통과해야 한다.
    # 이것이 없으면 "픽스처가 red 다"는 관찰이 위반 때문인지 트리 구성 때문인지 구분되지 않는다.
    baseline_checks = sorted({c for s in specs.values() for c in (s.get('must_fail_checks') or [])})
    if not baseline_checks:
        rep.fail('픽스처의 must_fail_checks 가 전부 비어 있다 — 메타테스트가 아무것도 검사하지 않는다')
        return
    with tempfile.TemporaryDirectory() as tmp:
        tree = os.path.join(tmp, 'tree')
        _materialize(ctx, tree, None, primary_ids)
        for check in baseline_checks:
            code, out = _run_self(ctx, tree, check)
            if code != 0:
                rep.fail(f'메타테스트 기준선 실패 — 오버레이 없는 트리에서 '
                         f'`--check {check}` 가 exit {code} 다. 픽스처의 red 를 위반 탓으로 귀속할 수 없다',
                         out[-1200:])
            else:
                rep.ok(f'기준선(오버레이 없음) → `--check {check}` exit 0')

    for name, spec in specs.items():
        checks = spec.get('must_fail_checks') or []
        if not checks:
            rep.fail(f'픽스처 `{name}` 의 must_fail_checks 가 비어 있다')
            continue
        expect_token = spec.get('rule')
        if not expect_token:
            rep.fail(f'픽스처 `{name}` 에 귀속 대상 rule 이 없다')
            continue
        fdir = os.path.join(froot, name)
        with tempfile.TemporaryDirectory() as tmp:
            tree = os.path.join(tmp, 'tree')
            _materialize(ctx, tree, os.path.join(fdir, 'overlay'), primary_ids)
            for check in checks:
                code, out = _run_self(ctx, tree, check)
                if code == 0:
                    rep.fail(f'메타테스트 실패 — 픽스처 `{name}` 에서 '
                             f'`--check {check}` 가 exit 0 이다 (위반을 잡지 못했다)',
                             out[-1200:])
                elif expect_token not in out:
                    rep.fail(f'메타테스트 귀속 실패 — 픽스처 `{name}` 의 실패 사유에 '
                             f'`{expect_token}` 이 없다 (다른 이유로 red 가 된 것)',
                             out[-1500:])
                else:
                    rep.ok(f'픽스처 `{name}` → `--check {check}` exit {code} · 사유 {expect_token} 귀속')


def _materialize(ctx: Ctx, tree: str, overlay, primary_ids: list[str]) -> None:
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
    subprocess.run([shutil.which('git') or 'git', 'add', '-A'], cwd=tree, check=True)


def _run_self(ctx: Ctx, tree: str, check: str) -> tuple[int, str]:
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


def emit_holdout(ctx: Ctx, passphrase: str, custodian: str) -> None:
    import secrets
    sample = read_csv_rows(ctx.d1a('sample.csv'))
    primary = [r for r in sample if r['status'] == 'primary']
    rng = secrets.SystemRandom()
    chosen: list[str] = []
    for axis, n in K6_HOLDOUT_AXIS_ALLOCATION.items():
        pool = [r['venue_id'] for r in primary if r['axis'] == axis]
        chosen += rng.sample(pool, n)
    order = [r['venue_id'] for r in sample]
    run = max_consecutive_run([v in set(chosen) for v in order])
    payload = json.dumps({
        'schema': 'glowmate/d1a/holdout/1',
        'holdout_venue_ids': sorted(chosen),
    }, ensure_ascii=False, sort_keys=True).encode()
    blob = seal(passphrase, payload, secrets.token_bytes(16), secrets.token_bytes(16))
    open(ctx.d1a('holdout.enc'), 'wb').write(blob)
    manifest = {
        'schema': 'glowmate/d1a/holdout-manifest/1',
        'record_count': K6_HOLDOUT_N,
        'axis_allocation': K6_HOLDOUT_AXIS_ALLOCATION,
        'enc_sha256': hashlib.sha256(blob).hexdigest(),
        'plaintext_sha256': hashlib.sha256(payload).hexdigest(),
        'unlock_fingerprint': key_fingerprint(passphrase),
        'kdf': {'name': 'pbkdf2-hmac-sha256', 'iterations': ENC_KDF_ITERS, 'dklen': 64},
        'cipher': 'hmac-sha256-ctr + encrypt-then-mac(hmac-sha256)',
        'sample_index_max_run': run,
        'sealed_at': os.environ.get('GLOWMATE_SEALED_AT', ''),
        'custodian': custodian,
    }
    open(ctx.d1a('holdout_manifest.json'), 'w', encoding='utf-8').write(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'holdout.enc 생성 — 25건 봉인, 최대 연속 배치 {run}행', file=sys.stderr)


def emit_lock(ctx: Ctx) -> None:
    targets = [f'{D1A_DIR}/protocol.md', f'{D1A_DIR}/frame_build.md',
               f'{D1A_DIR}/population.csv', f'{D1A_DIR}/sample.csv',
               f'{D1A_DIR}/ledger_schema.json']
    lines = ['# D1a-PROTOCOL 사전등록 잠금 — 이 파일이 origin/main 에 있어야 D1b 를 열 수 있다',
             '# 형식: <sha256>  <repo 상대 경로>']
    for rel in targets:
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
    'aggregation': check_aggregation,
    'thresholds': check_thresholds,
    'ledger-schema': check_ledger_schema,
    'lock': check_lock,
    'meta': check_meta,
}

ALL_ORDER = ['frame', 'definition', 'definition-recall', 'sampling',
             'holdout-sealed', 'aggregation', 'thresholds', 'ledger-schema',
             'lock', 'meta']


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


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog='validate_d1a.py',
        description='D1a-PROTOCOL 사전등록 검증기 (F1 CI job `discovery`)')
    parser.add_argument('--check', choices=sorted(CHECKS))
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--root', default=None)
    parser.add_argument('--emit', choices=('sample', 'holdout', 'lock'))
    parser.add_argument('--key-file')
    parser.add_argument('--custodian', default='team-lead')
    args = parser.parse_args(argv)

    root = os.path.abspath(args.root) if args.root else default_root()
    ctx = Ctx(root)

    if args.emit:
        if args.emit == 'sample':
            emit_sample(ctx)
        elif args.emit == 'lock':
            emit_lock(ctx)
        else:
            if not args.key_file:
                print('--emit holdout 에는 --key-file 이 필요하다', file=sys.stderr)
                return 2
            emit_holdout(ctx, open(args.key_file, encoding='utf-8').read().strip(),
                         args.custodian)
        return 0

    if not args.check and not args.all:
        parser.print_usage(sys.stderr)
        print('오류: --check <name> 또는 --all 중 하나가 필요하다. '
              '인자 없이 실행하는 것은 통과가 아니다.', file=sys.stderr)
        return 2

    print(f'validate_d1a.py — root={root}')
    if not os.path.isdir(os.path.join(root, D1A_DIR)):
        print(f'[FAIL] {D1A_DIR} 디렉터리가 없다 — 검사 대상 부재는 통과가 아니다',
              file=sys.stderr)
        return 2

    names = ALL_ORDER if args.all else [args.check]
    worst = 0
    for name in names:
        worst = max(worst, run_one(ctx, name))
    print(f'== 종합: {"FAIL" if worst else "OK"} ({len(names)}개 검사) ==')
    return worst


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
