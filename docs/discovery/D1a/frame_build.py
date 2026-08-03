#!/usr/bin/env python3
"""D1a 표본 프레임 구축기 — public_license_registry 5종 → population.csv (K-7 4축).

재현 절차 문서는 `frame_build.md` 이고, 이 스크립트는 그 절차의 **집행 코드**다.
D1a 계약 touches(`docs/discovery/D1a/**`) 안에 있다.

    # 1순위 — file.localdata.go.kr (자치구 단위 전수 파일 15종 = 슬러그 5 × 자치구 3)
    python3 docs/discovery/D1a/frame_build.py --download        <원본보관디렉터리>
    # 백업 — datafile.seoul.go.kr (데이터셋 9종. 경로 교차검증용)
    python3 docs/discovery/D1a/frame_build.py --download-backup <원본보관디렉터리>
    # K-10 보강 소스 — 심평원 분기 벌크 zip (프레임 소스가 아니다)
    python3 docs/discovery/D1a/frame_build.py --download-enrich <원본보관디렉터리>
    # 빌드 — population.csv + frame.json (네트워크 미사용)
    python3 docs/discovery/D1a/frame_build.py --build           <원본보관디렉터리>

계약이 소유한 구현 함정 T-1~T-6 의 대응 위치:
  T-1 UA/Referer 부재 시 302        → `_http_get()` 의 요청 헤더
  T-2 본문 CP949 / 헤더 charset 거짓 → `_read_registry_csv()` 가 응답 헤더를 무시하고 CP949 강제
  T-3 좌표계 EPSG:5174              → `tm_inverse()` + `bessel_to_wgs84()`
  T-4 폐업 57%                      → `LICENSE_STATUS_ACTIVE` 필터
  T-5 HTTP 429                      → `_http_get()` 의 직렬 실행 · 최소 간격 · 지수 백오프
  T-6 자치구별 분리 데이터셋 ID      → `DATASET_IDS` 의 per_gu 항목

의존: Python 표준 라이브러리만 사용한다 (새 런타임 의존성 없음).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

# ═══════════════════════════════════════════════════════════════════════════
# K-5 취득 경로 정본
# ═══════════════════════════════════════════════════════════════════════════

FRAME_SOURCE = 'public_license_registry'

PRIMARY_HOST = 'file.localdata.go.kr'
BACKUP_HOST = 'datafile.seoul.go.kr'

PRIMARY_URL = 'https://file.localdata.go.kr/file/download/{slug}/info?orgCode={org_code}'
PRIMARY_REFERER = 'https://file.localdata.go.kr/file/{slug}/info'
BACKUP_URL = ('https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do'
              '?infId={dataset_id}&seq=2&srvType=S')

USER_AGENT = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

# T-5 — 임계가 미공개이므로 병렬 탐색 자체를 하지 않는다. 직렬 + 최소 간격 + 지수 백오프.
MIN_REQUEST_INTERVAL_SEC = 1.5
BACKOFF_INITIAL_SEC = 2.0
BACKOFF_FACTOR = 2.0
BACKOFF_MAX_TRIES = 5

ORG_CODES = {'서초구': '3210000', '강남구': '3220000', '송파구': '3230000'}
GU_ORDER = ('강남구', '서초구', '송파구')

SLUGS = ('fitness_centers', 'public_baths', 'clinics',
         'beauty_salons', 'medical_related_businesses')

# T-6 — 기존 3종만 시 단위 통합이다. 미용업·의료유사업은 자치구별로 ID 가 분리돼 있다.
DATASET_IDS = {
    'fitness_centers': {'citywide': 'OA-16142'},
    'public_baths': {'citywide': 'OA-16146'},
    'clinics': {'citywide': 'OA-16480'},
    'beauty_salons': {'per_gu': {'서초구': 'OA-17923', '강남구': 'OA-17924',
                                 '송파구': 'OA-17925'}},
    'medical_related_businesses': {'per_gu': {'서초구': 'OA-16379', '강남구': 'OA-16380',
                                              '송파구': 'OA-16381'}},
}

# K-10 보강 소스 — 프레임 소스가 아니다. 멤버십에 영향을 주지 않는다(left join 전용).
ENRICH_LANDING = 'https://www.data.go.kr/data/15051059/fileData.do'
ENRICH_HOST_PAGE = 'https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925'
ENRICH_DOWNLOAD = ('https://opendata.hira.or.kr/dext5upload/handler/upload.dx'
                   '?callType=download&url=/op/opc/selectOpenData.do')
ENRICH_FILE = 'hira_bulk.zip'
ENRICH_SIDO_CODE = '110000'
ENRICH_SGGU_CODES = {'110001': '강남구', '110018': '송파구', '110021': '서초구'}
ENRICH_CL_CODES = ('31', '93')   # 31 의원 · 93 한의원

# ═══════════════════════════════════════════════════════════════════════════
# K-7 축 정본 구성 — 4축. 각 집합은 집합 동등으로 검사된다.
# ═══════════════════════════════════════════════════════════════════════════

LICENSE_STATUS_ACTIVE = '영업/정상'          # T-4
TARGET_GU = GU_ORDER

FITNESS_LICENSE_CATEGORY = '체력단련장업'
MEDICAL_SUBJECTS = ('재활의학과', '정형외과', '피부과', '성형외과', '마취통증의학과')
BEAUTY_BUSINESS_TYPES = ('피부미용업', '네일미용업', '종합미용업')
ANMA_BUSINESS_TYPES = ('안마시술소', '안마원')

AXES = ('exercise_body', 'relax_recovery', 'medical_wellness', 'beauty_care')

# 축 결정 규칙 문면 (정본). frame.json · frame_build.md §축 결정표와 글자 단위로 동일하다.
AXIS_RULE_TEXT = (
    '규칙은 위에서 아래로 처음 일치하는 것을 적용한다. 어느 규칙에도 걸리지 않으면 프레임 밖이다. '
    '각 집합은 부분집합도 상위집합도 위반이며, 검증기가 집합 동등으로 판정한다.'
)

# 원본 컬럼 매핑 — 슬러그마다 인허가 대장 컬럼명이 다르다.
SOURCE_COLUMNS = {
    'fitness_centers': {'license_category': '문화체육업종명',
                        'business_type': '문화체육업종명', 'medical_subjects': None},
    'public_baths': {'license_category': '위생업태명',
                     'business_type': '위생업태명', 'medical_subjects': None},
    'clinics': {'license_category': '업태구분명',
                'business_type': '업태구분명', 'medical_subjects': '진료과목내용명'},
    'beauty_salons': {'license_category': '업태구분명',
                      'business_type': '위생업태명', 'medical_subjects': None},
    'medical_related_businesses': {'license_category': '업태구분명',
                                   'business_type': '업태구분명', 'medical_subjects': None},
}

# 수집 필터 전문 (frame_build.md §필터 전문 블록과 글자 단위로 동일)
FILTER_EXPRESSIONS = [
    "영업상태명 == '영업/정상'",
    "address_gu(도로명주소, 지번주소) in ('강남구', '서초구', '송파구')",
    "address_prefix == '서울특별시 <자치구> '",
    "axis_of(slug, license_category, business_type, medical_subjects) is not None",
]

POPULATION_COLUMNS = [
    'venue_id', 'name', 'gu', 'axis', 'frame_source', 'dataset_id',
    'license_category', 'medical_subjects', 'org_code', 'license_no',
    'road_address', 'jibun_address', 'license_status',
    'business_type', 'lat', 'lon', 'source_epsg', 'phone',
    'homepage_url', 'open_hours', 'enrich_match',
]

SOURCE_EPSG = 'EPSG:5174'

# K-8 PII 단서 — 휴대전화 대역은 저장하지 않는다 (값 패턴으로 판정).
MOBILE_BAND_RE = re.compile(r'^0(1[016789])')


def split_tokens(value: str) -> set:
    return {t.strip() for t in (value or '').split(',') if t.strip()}


def axis_of(slug: str, license_category: str, business_type: str,
            medical_subjects: str):
    """축 결정표 R1~R7. 프레임 밖이면 None.

    validate_d1a.py 는 이 함수를 호출하지 않고, frame.json 의 선언형 규칙을
    독립 경로로 재적용해 population.csv 의 axis 컬럼과 대조한다.
    """
    cat = (license_category or '').strip()
    btypes = split_tokens(business_type)
    subjects = split_tokens(medical_subjects)
    if slug == 'fitness_centers' and cat == FITNESS_LICENSE_CATEGORY:            # R1
        return 'exercise_body'
    if slug == 'public_baths' and cat != '':                                     # R2
        return 'relax_recovery'
    if slug == 'medical_related_businesses' and btypes & set(ANMA_BUSINESS_TYPES):  # R3
        return 'relax_recovery'
    if slug == 'clinics' and cat == '한의원':                                     # R4
        return 'medical_wellness'
    if slug == 'clinics' and cat == '의원' and subjects & set(MEDICAL_SUBJECTS):   # R5
        return 'medical_wellness'
    if slug == 'beauty_salons' and btypes & set(BEAUTY_BUSINESS_TYPES):           # R6
        return 'beauty_care'
    return None                                                                   # R7


AXIS_DECISION_TABLE = [
    {'id': 'R1', 'axis': 'exercise_body',
     'when': {'slug': 'fitness_centers',
              'license_category_equals': FITNESS_LICENSE_CATEGORY}},
    {'id': 'R2', 'axis': 'relax_recovery',
     'when': {'slug': 'public_baths', 'license_category_not_empty': True}},
    {'id': 'R3', 'axis': 'relax_recovery',
     'when': {'slug': 'medical_related_businesses',
              'business_type_any': list(ANMA_BUSINESS_TYPES)}},
    {'id': 'R4', 'axis': 'medical_wellness',
     'when': {'slug': 'clinics', 'license_category_equals': '한의원'}},
    {'id': 'R5', 'axis': 'medical_wellness',
     'when': {'slug': 'clinics', 'license_category_equals': '의원',
              'medical_subjects_any': list(MEDICAL_SUBJECTS)}},
    {'id': 'R6', 'axis': 'beauty_care',
     'when': {'slug': 'beauty_salons',
              'business_type_any': list(BEAUTY_BUSINESS_TYPES)}},
]


# ═══════════════════════════════════════════════════════════════════════════
# T-3 좌표 변환 — EPSG:5174 (Bessel 1841 중부원점 TM) → WGS84
#
# 파라미터는 실측으로 확정했다. K-10 매칭 행에서 심평원 경위도와 대조한 결과가
# frame_build.md §좌표 변환 실측에 있다. 중부원점 경도를 127.0 으로 두면
# 중앙값 편차가 256m 로 뛴다 — 즉 10.405초 편차는 무시할 수 없다.
# ═══════════════════════════════════════════════════════════════════════════

BESSEL_A = 6377397.155
BESSEL_F = 1.0 / 299.1528128
BESSEL_E2 = 2 * BESSEL_F - BESSEL_F ** 2

TM_LAT0 = math.radians(38.0)
TM_LON0_DEG = 127.0028902777778      # 127°00'10.405"E
TM_K0 = 1.0
TM_FALSE_EASTING = 200000.0
TM_FALSE_NORTHING = 500000.0

WGS84_A = 6378137.0
WGS84_F = 1.0 / 298.257223563
WGS84_E2 = 2 * WGS84_F - WGS84_F ** 2

# Bessel 1841(한국) → WGS84 7-parameter (position vector). 단위: m, 초, ppm.
HELMERT_7P = (-115.80, 474.99, 674.11, 1.16, -2.31, -1.63, 6.43)
ARCSEC = math.pi / (180.0 * 3600.0)


def _meridional_arc(phi: float) -> float:
    e2 = BESSEL_E2
    return BESSEL_A * (
        (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
        - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * phi)
        + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * phi)
        - (35 * e2 ** 3 / 3072) * math.sin(6 * phi))


def tm_inverse(x: float, y: float) -> tuple:
    """TM 역투영 → Bessel 타원체 상의 (위도, 경도) 도 단위."""
    e2 = BESSEL_E2
    ep2 = e2 / (1 - e2)
    m = _meridional_arc(TM_LAT0) + (y - TM_FALSE_NORTHING) / TM_K0
    mu = m / (BESSEL_A * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu
            + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
            + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))
    c1 = ep2 * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = BESSEL_A / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    r1 = BESSEL_A * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = (x - TM_FALSE_EASTING) / (n1 * TM_K0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d ** 2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720)
    lon = math.radians(TM_LON0_DEG) + (
        d - (1 + 2 * t1 + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120
    ) / math.cos(phi1)
    return math.degrees(lat), math.degrees(lon)


def _geodetic_to_ecef(lat_deg: float, lon_deg: float, a: float, e2: float) -> tuple:
    p, l = math.radians(lat_deg), math.radians(lon_deg)
    n = a / math.sqrt(1 - e2 * math.sin(p) ** 2)
    return (n * math.cos(p) * math.cos(l),
            n * math.cos(p) * math.sin(l),
            n * (1 - e2) * math.sin(p))


def _ecef_to_geodetic(x: float, y: float, z: float, a: float, e2: float) -> tuple:
    lon = math.atan2(y, x)
    p = math.hypot(x, y)
    lat = math.atan2(z, p * (1 - e2))
    for _ in range(8):
        n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
        h = p / math.cos(lat) - n
        lat = math.atan2(z, p * (1 - e2 * n / (n + h)))
    return math.degrees(lat), math.degrees(lon)


def bessel_to_wgs84(lat_deg: float, lon_deg: float) -> tuple:
    dx, dy, dz, rx, ry, rz, s = HELMERT_7P
    rx, ry, rz = rx * ARCSEC, ry * ARCSEC, rz * ARCSEC
    m = 1 + s * 1e-6
    x, y, z = _geodetic_to_ecef(lat_deg, lon_deg, BESSEL_A, BESSEL_E2)
    x2 = dx + m * (x - rz * y + ry * z)
    y2 = dy + m * (rz * x + y - rx * z)
    z2 = dz + m * (-ry * x + rx * y + z)
    return _ecef_to_geodetic(x2, y2, z2, WGS84_A, WGS84_E2)


def tm5174_to_wgs84(x_raw: str, y_raw: str):
    """원본 좌표 문자열 → (lat, lon). 결측·비수치는 None 을 돌려준다.

    FORBID-6(a): 결측을 0 이나 자치구 대표점으로 채우지 않는다. 결측은 결측이다.
    """
    try:
        x = float((x_raw or '').strip())
        y = float((y_raw or '').strip())
    except ValueError:
        return None
    if x == 0.0 or y == 0.0:
        return None
    lat_b, lon_b = tm_inverse(x, y)
    return bessel_to_wgs84(lat_b, lon_b)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


# ═══════════════════════════════════════════════════════════════════════════
# HTTP — T-1 / T-5
# ═══════════════════════════════════════════════════════════════════════════

_LAST_REQUEST_AT = [0.0]
_LOG: list = []


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds')


def _http_get(url: str, referer: str, role: str, label: str, data=None) -> bytes:
    """직렬 GET/POST. UA/Referer 필수(T-1), 최소 간격·지수 백오프(T-5).

    전송은 `curl` 로 한다 — 사내 TLS 중계 환경에서 urllib 의 인증서 체인 검증이
    깨지는 반면 curl 은 OS 신뢰 저장소를 쓴다. curl 은 macOS·ubuntu-latest 기본 포함이다.
    실패를 조용히 삼키지 않는다 — 최종 실패는 SystemExit 로 올린다.
    """
    curl = shutil.which('curl')
    if curl is None:
        raise SystemExit('curl 실행 파일이 없다 — 다운로드를 수행할 수 없다')
    delay = BACKOFF_INITIAL_SEC
    last = ''
    for attempt in range(1, BACKOFF_MAX_TRIES + 1):
        gap = time.time() - _LAST_REQUEST_AT[0]
        if gap < MIN_REQUEST_INTERVAL_SEC:
            time.sleep(MIN_REQUEST_INTERVAL_SEC - gap)
        started = _now_iso()
        _LAST_REQUEST_AT[0] = time.time()
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            dest = tmp.name
        argv = [curl, '-sS', '-L', '-m', '900', '-o', dest,
                '-w', '%{http_code}\t%{content_type}',
                '-A', USER_AGENT, '-e', referer,
                '-H', 'Accept: */*', '-H', 'Accept-Language: ko-KR,ko;q=0.9']
        if data is not None:
            argv += ['--data-binary', '@-']
        argv.append(url)
        proc = subprocess.run(argv, input=data, capture_output=True)
        meta = proc.stdout.decode('utf-8', 'replace').strip().split('\t')
        status = int(meta[0]) if meta and meta[0].isdigit() else None
        ctype = meta[1] if len(meta) > 1 else ''
        body = open(dest, 'rb').read() if os.path.exists(dest) else b''
        os.path.exists(dest) and os.unlink(dest)
        _LOG.append({'label': label, 'role': role, 'url': url,
                     'host': urllib.parse.urlparse(url).netloc,
                     'requested_at': started, 'http_status': status,
                     'attempt': attempt, 'bytes': len(body),
                     'sha256': hashlib.sha256(body).hexdigest() if status == 200 else '',
                     'declared_content_type': ctype})
        if proc.returncode == 0 and status == 200 and body:
            print(f'  {label}: HTTP 200 {len(body)} bytes (시도 {attempt})', file=sys.stderr)
            return body
        last = (f'exit={proc.returncode} status={status} bytes={len(body)} '
                f'{proc.stderr.decode("utf-8", "replace").strip()[:200]}')
        print(f'  {label}: 실패 ({last}) — {delay}s 후 재시도', file=sys.stderr)
        time.sleep(delay)
        delay *= BACKOFF_FACTOR
    raise SystemExit(f'다운로드 실패 (시도 {BACKOFF_MAX_TRIES}회): {label} {url} — {last}')


def primary_files() -> list:
    out = []
    for slug in SLUGS:
        for gu in GU_ORDER:
            out.append({'slug': slug, 'gu': gu, 'org_code': ORG_CODES[gu],
                        'file': f'localdata_{slug}_{ORG_CODES[gu]}.csv',
                        'dataset_id': dataset_id_for(slug, gu)})
    return out


def backup_files() -> list:
    out = []
    seen = set()
    for slug in SLUGS:
        for gu in GU_ORDER:
            ds = dataset_id_for(slug, gu)
            if ds in seen:
                continue
            seen.add(ds)
            scope = 'citywide' if 'citywide' in DATASET_IDS[slug] else gu
            out.append({'slug': slug, 'scope': scope, 'dataset_id': ds,
                        'file': f'seoul_{ds}.csv'})
    return out


def dataset_id_for(slug: str, gu: str) -> str:
    spec = DATASET_IDS[slug]
    return spec['citywide'] if 'citywide' in spec else spec['per_gu'][gu]


# ═══════════════════════════════════════════════════════════════════════════
# 원본 읽기 — T-2 (응답 헤더 charset 을 신뢰하지 않는다)
# ═══════════════════════════════════════════════════════════════════════════

def _read_registry_csv(path: str) -> list:
    raw = open(path, 'rb').read()
    text = raw.decode('cp949', 'strict')
    return list(csv.DictReader(io.StringIO(text)))


def gu_of(road: str, jibun: str):
    for addr in (road or '', jibun or ''):
        for gu in TARGET_GU:
            if addr.startswith(f'서울특별시 {gu} '):
                return gu
    return None


def venue_id_of(slug: str, org_code: str, license_no: str) -> str:
    digest = hashlib.sha256(f'{slug}|{org_code}|{license_no}'.encode()).hexdigest()
    return 'V' + digest[:12].upper()


def clean_phone(value: str) -> str:
    """K-8 — 사업장 대표번호만 남긴다. 휴대전화 대역은 값 패턴으로 걸러 빈 값."""
    v = (value or '').strip()
    if not v:
        return ''
    digits = re.sub(r'[^0-9]', '', v)
    if not digits or MOBILE_BAND_RE.match(digits) or MOBILE_BAND_RE.match(v):
        return ''
    return v


def build_rows(rawdir: str) -> list:
    rows = []
    for spec in primary_files():
        path = os.path.join(rawdir, spec['file'])
        if not os.path.exists(path):
            raise SystemExit(f'원본 부재: {path} — 먼저 --download 를 실행하라')
        cols = SOURCE_COLUMNS[spec['slug']]
        for r in _read_registry_csv(path):
            if (r.get('영업상태명') or '').strip() != LICENSE_STATUS_ACTIVE:
                continue
            gu = gu_of(r.get('도로명주소', ''), r.get('지번주소', ''))
            if gu is None or gu != spec['gu']:
                continue
            cat = (r.get(cols['license_category']) or '').strip()
            btype = (r.get(cols['business_type']) or '').strip()
            subj = ((r.get(cols['medical_subjects']) or '').strip()
                    if cols['medical_subjects'] else '')
            axis = axis_of(spec['slug'], cat, btype, subj)
            if axis is None:
                continue
            org_code = (r.get('개방자치단체코드') or '').strip()
            license_no = (r.get('관리번호') or '').strip()
            coord = tm5174_to_wgs84(r.get('좌표정보(X)'), r.get('좌표정보(Y)'))
            rows.append({
                'venue_id': venue_id_of(spec['slug'], org_code, license_no),
                'name': (r.get('사업장명') or '').strip(),
                'gu': gu,
                'axis': axis,
                'frame_source': FRAME_SOURCE,
                'dataset_id': spec['dataset_id'],
                'license_category': cat,
                'medical_subjects': subj,
                'org_code': org_code,
                'license_no': license_no,
                'road_address': (r.get('도로명주소') or '').strip(),
                'jibun_address': (r.get('지번주소') or '').strip(),
                'license_status': LICENSE_STATUS_ACTIVE,
                'business_type': btype,
                'lat': f'{coord[0]:.6f}' if coord else '',
                'lon': f'{coord[1]:.6f}' if coord else '',
                'source_epsg': SOURCE_EPSG if coord else '',
                'phone': clean_phone(r.get('전화번호')),
                'homepage_url': '',
                'open_hours': '',
                'enrich_match': 'no_match',
            })
    seen, uniq = set(), []
    for r in rows:
        if r['venue_id'] in seen:
            continue
        seen.add(r['venue_id'])
        uniq.append(r)
    uniq.sort(key=lambda r: r['venue_id'])
    return uniq


# ═══════════════════════════════════════════════════════════════════════════
# xlsx 최소 판독기 — 표준 라이브러리만으로 K-10 벌크 파일을 읽는다
# ═══════════════════════════════════════════════════════════════════════════

XLNS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def _shared_strings(zf: zipfile.ZipFile) -> list:
    try:
        data = zf.read('xl/sharedStrings.xml')
    except KeyError:
        return []
    out, buf, inside = [], [], False
    for ev, el in ET.iterparse(io.BytesIO(data), events=('start', 'end')):
        if ev == 'start' and el.tag == XLNS + 'si':
            buf, inside = [], True
        elif ev == 'end':
            if el.tag == XLNS + 't' and inside:
                buf.append(el.text or '')
            elif el.tag == XLNS + 'si':
                out.append(''.join(buf))
                inside = False
                el.clear()
    return out


def _col_index(ref: str) -> int:
    m = re.match(r'([A-Z]+)', ref)
    n = 0
    for ch in m.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def xlsx_rows(zf: zipfile.ZipFile):
    strings = _shared_strings(zf)
    data = zf.read('xl/worksheets/sheet1.xml')
    cells = {}
    for ev, el in ET.iterparse(io.BytesIO(data), events=('start', 'end')):
        if ev == 'start' and el.tag == XLNS + 'row':
            cells = {}
        elif ev == 'end':
            if el.tag == XLNS + 'c':
                ref, kind = el.get('r') or '', el.get('t')
                v, inline = el.find(XLNS + 'v'), el.find(XLNS + 'is')
                if kind == 's' and v is not None:
                    val = strings[int(v.text)]
                elif kind == 'inlineStr' and inline is not None:
                    val = ''.join(x.text or '' for x in inline.iter(XLNS + 't'))
                else:
                    val = (v.text or '') if v is not None else ''
                if ref:
                    cells[_col_index(ref)] = val
                el.clear()
            elif el.tag == XLNS + 'row':
                width = max(cells) + 1 if cells else 0
                yield [cells.get(i, '') for i in range(width)]
                el.clear()


# ═══════════════════════════════════════════════════════════════════════════
# K-10 보강 — left join 전용. venue_id 집합을 바꾸지 않는다 (FORBID-1(e)).
# ═══════════════════════════════════════════════════════════════════════════

_NAME_STRIP = re.compile(r'[\s()（）·ㆍ.,\'"\-]')
WEEKDAYS = ('월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일')


def norm_name(value: str) -> str:
    return _NAME_STRIP.sub('', value or '').lower()


def norm_addr(value: str) -> str:
    s = re.sub(r'\(.*?\)', ' ', value or '')
    s = s.split(',')[0]
    return re.sub(r'\s+', ' ', s).strip()


def _hira_member(rawdir: str, prefix: str) -> zipfile.ZipFile:
    outer = zipfile.ZipFile(os.path.join(rawdir, ENRICH_FILE))
    names = [n for n in outer.namelist()
             if n.endswith('.xlsx') and n.split('/')[-1].startswith(prefix)]
    if not names:
        raise SystemExit(f'K-10 벌크 zip 에 `{prefix}` 로 시작하는 시트가 없다')
    return zipfile.ZipFile(io.BytesIO(outer.read(names[0])))


def load_enrich(rawdir: str) -> dict:
    """(정규화 상호명, 정규화 도로명주소) → [보강 레코드]."""
    hours = {}
    detail = _hira_member(rawdir, '4.')
    it = xlsx_rows(detail)
    hdr = next(it)
    hidx = {h: i for i, h in enumerate(hdr)}
    for r in it:
        key = r[hidx['암호화요양기호']] if hidx['암호화요양기호'] < len(r) else ''
        if not key:
            continue
        parts = []
        for day in WEEKDAYS:
            si, ei = hidx.get(f'진료시작시간_{day}'), hidx.get(f'진료종료시간_{day}')
            s = r[si].strip() if si is not None and si < len(r) else ''
            e = r[ei].strip() if ei is not None and ei < len(r) else ''
            if s and e:
                parts.append(f'{day[0]} {s.zfill(4)}-{e.zfill(4)}')
        if parts:
            hours[key] = '; '.join(parts)

    table = {}
    info = _hira_member(rawdir, '1.')
    it = xlsx_rows(info)
    hdr = next(it)
    idx = {h: i for i, h in enumerate(hdr)}

    def cell(row, name):
        i = idx.get(name)
        return row[i].strip() if i is not None and i < len(row) else ''

    for r in it:
        if cell(r, '시도코드') != ENRICH_SIDO_CODE:
            continue
        if cell(r, '시군구코드') not in ENRICH_SGGU_CODES:
            continue
        if cell(r, '종별코드') not in ENRICH_CL_CODES:
            continue
        key = (norm_name(cell(r, '요양기관명')), norm_addr(cell(r, '주소')))
        if not key[0] or not key[1]:
            continue
        code = cell(r, '암호화요양기호')
        try:
            lon = float(cell(r, '좌표(X)'))
            lat = float(cell(r, '좌표(Y)'))
        except ValueError:
            lat = lon = None
        table.setdefault(key, []).append({
            'homepage_url': cell(r, '병원홈페이지'),
            'open_hours': hours.get(code, ''),
            'lat': lat, 'lon': lon,
        })
    return table


def apply_enrich(rows: list, table: dict) -> dict:
    """left join. 반환값은 프레임 밖 통계(좌표 변환 실측 · 매칭 분포)."""
    before = {r['venue_id'] for r in rows}
    distances = []
    counts = {'matched': 0, 'ambiguous': 0, 'no_match': 0}
    for r in rows:
        if r['axis'] != 'medical_wellness':
            counts['no_match'] += 1
            continue
        key = (norm_name(r['name']), norm_addr(r['road_address']))
        hits = table.get(key) or []
        if len(hits) == 0:
            r['enrich_match'] = 'no_match'
            counts['no_match'] += 1
            continue
        if len(hits) > 1:
            # 1:다 매칭 — 추정 결합 금지(FORBID-6(d)). 보강 컬럼은 빈 값으로 둔다.
            r['enrich_match'] = 'ambiguous'
            counts['ambiguous'] += 1
            continue
        hit = hits[0]
        r['enrich_match'] = 'matched'
        r['homepage_url'] = hit['homepage_url']
        r['open_hours'] = hit['open_hours']
        counts['matched'] += 1
        if r['lat'] and r['lon'] and hit['lat'] and hit['lon']:
            distances.append(haversine_m(float(r['lat']), float(r['lon']),
                                         hit['lat'], hit['lon']))
    after = {r['venue_id'] for r in rows}
    if before != after:
        raise SystemExit('FORBID-1(e) — 보강 전후 venue_id 집합이 달라졌다')
    distances.sort()
    stats = {'matched': counts['matched'], 'ambiguous': counts['ambiguous'],
             'no_match': counts['no_match'], 'distance_n': len(distances)}
    if distances:
        stats['distance_median_m'] = round(_pct(distances, 0.50), 1)
        stats['distance_p95_m'] = round(_pct(distances, 0.95), 1)
        stats['distance_max_m'] = round(distances[-1], 1)
    return stats


def _pct(sorted_values: list, q: float) -> float:
    if not sorted_values:
        return 0.0
    i = min(len(sorted_values) - 1, int(round(q * (len(sorted_values) - 1))))
    return sorted_values[i]


# ═══════════════════════════════════════════════════════════════════════════
# 경로 교차검증 — 1순위(file.localdata) vs 백업(datafile.seoul) 축별 행 수
# ═══════════════════════════════════════════════════════════════════════════

def backup_axis_counts(rawdir: str) -> dict:
    counts = {a: 0 for a in AXES}
    seen = set()
    for spec in backup_files():
        path = os.path.join(rawdir, spec['file'])
        if not os.path.exists(path):
            return {}
        cols = SOURCE_COLUMNS[spec['slug']]
        for r in _read_registry_csv(path):
            if (r.get('영업상태명') or '').strip() != LICENSE_STATUS_ACTIVE:
                continue
            gu = gu_of(r.get('도로명주소', ''), r.get('지번주소', ''))
            if gu is None:
                continue
            if spec['scope'] != 'citywide' and gu != spec['scope']:
                continue
            cat = (r.get(cols['license_category']) or '').strip()
            btype = (r.get(cols['business_type']) or '').strip()
            subj = ((r.get(cols['medical_subjects']) or '').strip()
                    if cols['medical_subjects'] else '')
            axis = axis_of(spec['slug'], cat, btype, subj)
            if axis is None:
                continue
            key = (spec['slug'], (r.get('개방자치단체코드') or '').strip(),
                   (r.get('관리번호') or '').strip())
            if key in seen:
                continue
            seen.add(key)
            counts[axis] += 1
    return counts


# ═══════════════════════════════════════════════════════════════════════════
# 산출
# ═══════════════════════════════════════════════════════════════════════════

def sha256_of(path: str) -> str:
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def write_population(rows: list, out_path: str) -> None:
    with open(out_path, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=POPULATION_COLUMNS, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)


def cmd_download(rawdir: str) -> None:
    os.makedirs(rawdir, exist_ok=True)
    for spec in primary_files():
        url = PRIMARY_URL.format(slug=spec['slug'], org_code=spec['org_code'])
        body = _http_get(url, PRIMARY_REFERER.format(slug=spec['slug']),
                         'primary', f"{spec['slug']}/{spec['gu']}")
        body.decode('cp949', 'strict')          # T-2 — 여기서 깨지면 즉시 실패한다
        open(os.path.join(rawdir, spec['file']), 'wb').write(body)


def cmd_download_backup(rawdir: str) -> None:
    os.makedirs(rawdir, exist_ok=True)
    for spec in backup_files():
        url = BACKUP_URL.format(dataset_id=spec['dataset_id'])
        body = _http_get(url, 'https://data.seoul.go.kr/', 'backup',
                         f"{spec['dataset_id']} ({spec['slug']}/{spec['scope']})")
        body.decode('cp949', 'strict')
        open(os.path.join(rawdir, spec['file']), 'wb').write(body)


def cmd_download_enrich(rawdir: str) -> None:
    os.makedirs(rawdir, exist_ok=True)
    latest = _hira_latest_file()
    payload = urllib.parse.urlencode({
        'dext5CMD': 'downloadRequest',
        'fileVirtualPath': latest['path'],
        'fileOrgName': latest['name'],
        'resumeMode': '0',
        'fileNameRuleEx': '_',
    }).encode()
    body = _http_get(ENRICH_DOWNLOAD, ENRICH_HOST_PAGE, 'enrichment',
                     f"K-10 {latest['name']}", data=payload)
    open(os.path.join(rawdir, ENRICH_FILE), 'wb').write(body)


def _hira_latest_file() -> dict:
    page = _http_get(ENRICH_HOST_PAGE, ENRICH_LANDING, 'enrichment',
                     'K-10 배포 목록').decode('utf-8', 'replace')
    found = re.findall(
        r"AddUploadedFile\('(\d+)',\s*'([^']+\.zip)',\s*'([^']+)'", page)
    if not found:
        raise SystemExit('K-10 배포 목록에서 벌크 파일 항목을 찾지 못했다')
    sno, name, path = found[-1]
    return {'sno': sno, 'name': name, 'path': path}


def cmd_build(rawdir: str, out_dir: str) -> None:
    rows = build_rows(rawdir)
    stats = {}
    enrich_path = os.path.join(rawdir, ENRICH_FILE)
    if os.path.exists(enrich_path):
        stats = apply_enrich(rows, load_enrich(rawdir))
    else:
        print('경고: K-10 벌크 파일이 없어 보강을 수행하지 않았다', file=sys.stderr)

    pop_path = os.path.join(out_dir, 'population.csv')
    write_population(rows, pop_path)

    axis_counts = {a: sum(1 for r in rows if r['axis'] == a) for a in AXES}
    cell_counts = {f'{a}|{g}': sum(1 for r in rows if r['axis'] == a and r['gu'] == g)
                   for a in AXES for g in GU_ORDER}
    backup = backup_axis_counts(rawdir)
    crosscheck = []
    for a in AXES:
        b = backup.get(a)
        if b is None:
            continue
        base = max(axis_counts[a], 1)
        crosscheck.append({'axis': a, 'primary_rows': axis_counts[a],
                           'backup_rows': b,
                           'delta_pct': round((b - axis_counts[a]) * 100.0 / base, 2)})

    log_path = os.path.join(out_dir, 'download_log.json')
    prior = []
    if os.path.exists(log_path):
        prior = json.loads(open(log_path, encoding='utf-8').read())
    merged = prior + _LOG

    frame = {
        'schema': 'glowmate/d1a/frame/2',
        'frame_sources': [FRAME_SOURCE],
        'collected_at': _now_iso(),
        'reproduction_command': [
            'python3 docs/discovery/D1a/frame_build.py --download <RAWDIR>',
            'python3 docs/discovery/D1a/frame_build.py --download-backup <RAWDIR>',
            'python3 docs/discovery/D1a/frame_build.py --download-enrich <RAWDIR>',
            'python3 docs/discovery/D1a/frame_build.py --build <RAWDIR>',
        ],
        'acquisition': {
            'primary': {'host': PRIMARY_HOST, 'url_template': PRIMARY_URL,
                        'referer_template': PRIMARY_REFERER,
                        'org_codes': ORG_CODES, 'file_count': len(primary_files())},
            'backup': {'host': BACKUP_HOST, 'url_template': BACKUP_URL,
                       'file_count': len(backup_files())},
            'user_agent': USER_AGENT,
            'serial_only': True,
            'min_request_interval_sec': MIN_REQUEST_INTERVAL_SEC,
            'backoff': {'initial_sec': BACKOFF_INITIAL_SEC,
                        'factor': BACKOFF_FACTOR, 'max_tries': BACKOFF_MAX_TRIES},
            'source_charset': 'cp949',
            'declared_charset_ignored': True,
        },
        'slugs': list(SLUGS),
        'dataset_ids': sorted({dataset_id_for(s, g) for s in SLUGS for g in GU_ORDER}),
        'dataset_id_map': DATASET_IDS,
        'filter_expressions': FILTER_EXPRESSIONS,
        'axis_decision_table': AXIS_DECISION_TABLE,
        'axis_rule_text': AXIS_RULE_TEXT,
        'axis_sets': {
            'medical_subjects': list(MEDICAL_SUBJECTS),
            'beauty_business_types': list(BEAUTY_BUSINESS_TYPES),
            'anma_business_types': list(ANMA_BUSINESS_TYPES),
            'fitness_license_category': [FITNESS_LICENSE_CATEGORY],
        },
        'license_status_filter': LICENSE_STATUS_ACTIVE,
        'coordinate': {
            'source_epsg': SOURCE_EPSG,
            'tm_lon0_deg': TM_LON0_DEG, 'tm_lat0_deg': 38.0,
            'false_easting': TM_FALSE_EASTING, 'false_northing': TM_FALSE_NORTHING,
            'ellipsoid': 'Bessel 1841 (a=6377397.155, 1/f=299.1528128)',
            'helmert_7p_position_vector': list(HELMERT_7P),
        },
        'enrichment': {
            'landing': ENRICH_LANDING, 'host_page': ENRICH_HOST_PAGE,
            'join': 'left join only', 'applies_to_axis': 'medical_wellness',
            'match_conditions': ['normalized name exact', 'normalized road address exact'],
            'coordinates_used_for_match': False,
            'stats': stats,
        },
        'row_counts': {'total': len(rows), 'by_axis': axis_counts, 'by_cell': cell_counts},
        'path_crosscheck': crosscheck,
        'datasets': [],
    }
    by_label = {}
    for e in merged:
        if e.get('http_status') == 200 and e.get('sha256'):
            by_label[e['label']] = e
    for spec in primary_files():
        e = by_label.get(f"{spec['slug']}/{spec['gu']}")
        if e:
            frame['datasets'].append({
                'role': 'primary', 'slug': spec['slug'], 'gu': spec['gu'],
                'dataset_id': spec['dataset_id'], 'url': e['url'],
                'sha256': e['sha256'], 'bytes': e['bytes'],
                'retrieved_at': e['requested_at']})
    for spec in backup_files():
        e = by_label.get(f"{spec['dataset_id']} ({spec['slug']}/{spec['scope']})")
        if e:
            frame['datasets'].append({
                'role': 'backup', 'slug': spec['slug'], 'scope': spec['scope'],
                'dataset_id': spec['dataset_id'], 'url': e['url'],
                'sha256': e['sha256'], 'bytes': e['bytes'],
                'retrieved_at': e['requested_at']})

    open(os.path.join(out_dir, 'frame.json'), 'w', encoding='utf-8').write(
        json.dumps(frame, ensure_ascii=False, indent=2, sort_keys=False) + '\n')
    print(f'population.csv {len(rows)}행 -> {pop_path}', file=sys.stderr)
    print(f'축별: {axis_counts}', file=sys.stderr)
    print(f'K-10 보강: {stats}', file=sys.stderr)
    print(f'경로 교차검증: {crosscheck}', file=sys.stderr)


def flush_log(out_dir: str) -> None:
    if not _LOG:
        return
    path = os.path.join(out_dir, 'download_log.json')
    prior = []
    if os.path.exists(path):
        prior = json.loads(open(path, encoding='utf-8').read())
    open(path, 'w', encoding='utf-8').write(
        json.dumps(prior + _LOG, ensure_ascii=False, indent=2) + '\n')


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description='D1a 표본 프레임 구축기 (K-7 4축)')
    ap.add_argument('--download', metavar='RAWDIR')
    ap.add_argument('--download-backup', metavar='RAWDIR')
    ap.add_argument('--download-enrich', metavar='RAWDIR')
    ap.add_argument('--build', metavar='RAWDIR')
    ap.add_argument('--out-dir', default=here)
    args = ap.parse_args()
    if not any([args.download, args.download_backup, args.download_enrich, args.build]):
        ap.error('--download / --download-backup / --download-enrich / --build '
                 '중 하나가 필요하다')
    try:
        if args.download:
            cmd_download(args.download)
        if args.download_backup:
            cmd_download_backup(args.download_backup)
        if args.download_enrich:
            cmd_download_enrich(args.download_enrich)
        if args.build:
            cmd_build(args.build, args.out_dir)
    finally:
        flush_log(args.out_dir)


if __name__ == '__main__':
    main()
