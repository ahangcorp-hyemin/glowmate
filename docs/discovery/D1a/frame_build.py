#!/usr/bin/env python3
"""D1a 표본 프레임 구축기 — public_license_registry 3종 → population.csv.

재현 절차는 `frame_build.md` 에 있다. 이 스크립트는 그 절차의 **집행 코드**이며,
D1a 계약 touches(`docs/discovery/D1a/**`) 안에 있다.

    python3 docs/discovery/D1a/frame_build.py --download <원본보관디렉터리>
    python3 docs/discovery/D1a/frame_build.py --build    <원본보관디렉터리>

--download 는 서울 열린데이터광장 시트 파일 3종을 내려받아 sha256 을 출력한다.
--build 는 그 원본에서 population.csv 를 생성한다. 네트워크를 쓰지 않는다.

**금지 필터 자기검사**: 이 스크립트가 사용하는 필터 표현식은 FILTER_EXPRESSIONS 에
문자열로 선언되어 있고, frame_build.md 와 protocol.md 가 같은 문자열을 전재한다.
validate_d1a.py --check frame 이 그 문자열을 K-5 금지 속성 토큰 사전과 대조한다.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import os
import subprocess
import sys

# ── K-5 허용 소스 · 데이터셋 정본 ────────────────────────────────────────────
FRAME_SOURCE = 'public_license_registry'

DATASETS = [
    {
        'dataset_id': 'OA-16142',
        'title': '서울시 체력단련장업 인허가 정보',
        'file': 'OA-16142_physical_training.csv',
        'url': ('https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do'
                '?infId=OA-16142&seq=2&srvType=S'),
        'category_column': '문화체육업종명',
        'subject_column': None,
    },
    {
        'dataset_id': 'OA-16146',
        'title': '서울시 목욕장업 인허가 정보',
        'file': 'OA-16146_bathhouse.csv',
        'url': ('https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do'
                '?infId=OA-16146&seq=2&srvType=S'),
        'category_column': '위생업태명',
        'subject_column': None,
    },
    {
        'dataset_id': 'OA-16480',
        'title': '서울시 의원 인허가 정보',
        'file': 'OA-16480_clinic.csv',
        'url': ('https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do'
                '?infId=OA-16480&seq=2&srvType=S'),
        'category_column': '업태구분명',
        'subject_column': '진료과목내용명',
    },
]

TARGET_GU = ('강남구', '서초구', '송파구')

# ── 수집 필터 전문 (frame_build.md · protocol.md 와 문자열 동일) ─────────────
FILTER_EXPRESSIONS = [
    "영업상태명 == '영업/정상'",
    "address_gu(도로명주소, 지번주소) in ('강남구', '서초구', '송파구')",
    "address_prefix == '서울특별시 <자치구> '",
    "axis_of(dataset_id, license_category, medical_subjects) is not None",
]

AXIS_ORDER = ('exercise_body', 'relax_recovery', 'medical_wellness')

MEDICAL_SUBJECT_KEYWORDS = ('재활의학과', '정형외과')

POPULATION_COLUMNS = [
    'venue_id', 'name', 'gu', 'axis', 'frame_source', 'dataset_id',
    'license_category', 'medical_subjects', 'org_code', 'license_no',
    'road_address', 'jibun_address', 'license_status',
]


# ── 축 결정표 (protocol.md §3 축 결정표와 동일. validate_d1a.py 가 재적용한다) ──
def axis_of(dataset_id: str, license_category: str, medical_subjects: str):
    """축 결정표 R1~R5. 프레임 밖이면 None."""
    cat = (license_category or '').strip()
    sub = medical_subjects or ''
    if dataset_id == 'OA-16142' and cat == '체력단련장업':          # R1
        return 'exercise_body'
    if dataset_id == 'OA-16146' and cat != '':                      # R2
        return 'relax_recovery'
    if dataset_id == 'OA-16480' and cat == '한의원':                # R3
        return 'medical_wellness'
    if dataset_id == 'OA-16480' and cat == '의원' and any(          # R4
            k in sub for k in MEDICAL_SUBJECT_KEYWORDS):
        return 'medical_wellness'
    return None                                                     # R5


def venue_id_of(dataset_id: str, org_code: str, license_no: str) -> str:
    """관리번호는 개방자치단체코드 안에서만 유일하다 (구가 다르면 재사용된다).
    따라서 3요소를 전부 넣어야 전역 유일성이 성립한다."""
    digest = hashlib.sha256(f'{dataset_id}|{org_code}|{license_no}'.encode()).hexdigest()
    return 'V' + digest[:12].upper()


def gu_of(road: str, jibun: str):
    for addr in (road or '', jibun or ''):
        for gu in TARGET_GU:
            if addr.startswith(f'서울특별시 {gu} '):
                return gu
    return None


def _read(path: str):
    raw = open(path, 'rb').read()
    return list(csv.DictReader(io.StringIO(raw.decode('cp949', 'replace'))))


def build(rawdir: str):
    rows = []
    for ds in DATASETS:
        path = os.path.join(rawdir, ds['file'])
        if not os.path.exists(path):
            raise SystemExit(f'원본 부재: {path} — 먼저 --download 를 실행하라')
        for r in _read(path):
            if (r.get('영업상태명') or '').strip() != '영업/정상':
                continue
            gu = gu_of(r.get('도로명주소', ''), r.get('지번주소', ''))
            if gu is None:
                continue
            cat = (r.get(ds['category_column']) or '').strip()
            sub = ((r.get(ds['subject_column']) or '').strip()
                   if ds['subject_column'] else '')
            axis = axis_of(ds['dataset_id'], cat, sub)
            if axis is None:
                continue
            license_no = (r.get('관리번호') or '').strip()
            org_code = (r.get('개방자치단체코드') or '').strip()
            rows.append({
                'venue_id': venue_id_of(ds['dataset_id'], org_code, license_no),
                'name': (r.get('사업장명') or '').strip(),
                'gu': gu,
                'axis': axis,
                'frame_source': FRAME_SOURCE,
                'dataset_id': ds['dataset_id'],
                'license_category': cat,
                'medical_subjects': sub,
                'org_code': org_code,
                'license_no': license_no,
                'road_address': (r.get('도로명주소') or '').strip(),
                'jibun_address': (r.get('지번주소') or '').strip(),
                'license_status': '영업/정상',
            })
    seen, uniq = set(), []
    for r in rows:
        if r['venue_id'] in seen:
            continue
        seen.add(r['venue_id'])
        uniq.append(r)
    uniq.sort(key=lambda r: r['venue_id'])
    return uniq


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--download', metavar='RAWDIR')
    ap.add_argument('--build', metavar='RAWDIR')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                  'population.csv'))
    args = ap.parse_args()
    if not args.download and not args.build:
        ap.error('--download 또는 --build 중 하나가 필요하다')

    if args.download:
        os.makedirs(args.download, exist_ok=True)
        for ds in DATASETS:
            dest = os.path.join(args.download, ds['file'])
            subprocess.run(['curl', '-sSL', '-m', '180', '-o', dest, ds['url']], check=True)
            digest = hashlib.sha256(open(dest, 'rb').read()).hexdigest()
            print(f"{ds['dataset_id']}  {ds['file']}  sha256={digest}  "
                  f"bytes={os.path.getsize(dest)}")

    if args.build:
        rows = build(args.build)
        with open(args.out, 'w', encoding='utf-8', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=POPULATION_COLUMNS, lineterminator='\n')
            w.writeheader()
            w.writerows(rows)
        print(f'population.csv {len(rows)}행 -> {args.out}', file=sys.stderr)


if __name__ == '__main__':
    main()
