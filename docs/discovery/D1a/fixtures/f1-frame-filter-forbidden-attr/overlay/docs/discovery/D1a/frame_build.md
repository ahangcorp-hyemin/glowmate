# D1a — 표본 프레임 구축 (모집단 · 수집 쿼리 · 필터 전문 · 재현 로그)

> 계약: [`docs/tasks/D1a.md`](../../tasks/D1a.md) REQ-1 · FORBID-1
> 검증: `python scripts/discovery/validate_d1a.py --check frame`

---

## 1. 프레임 소스 (K-5)

| 항목 | 값 |
|---|---|
| `frame_source` | **`public_license_registry`** (K-5 허용 enum 중 1종) |
| 발행 주체 | 서울특별시 · 서울 열린데이터광장 (data.seoul.go.kr) — LOCALDATA 인허가 원본 |
| 수집 방식 | 자치단체 인허가 대장 **전수 시트 파일** 내려받기. 검색·정렬·상위 N 절단 없음 |
| 지역 | 강남구 · 서초구 · 송파구 |

`map_category_enumeration` 은 **사용하지 않았다.** 채택 시점(아래 §5 수집 로그)에 지도 서비스의
지역×카테고리 전수 나열 엔드포인트가 익명 접근에 대해 사람 확인 절차 또는 HTTP 429 를 반환했고,
그 상태에서 나열을 강행하는 것은 D1b FORBID-6(접근 제어 우회 금지)과 D3 실사 결론 이전의
접근 이력 생성에 해당한다. 프레임 소스를 1종으로 좁힌 대가는 §6 에 한계로 기록한다.

## 2. 데이터셋 3종

| dataset_id | 제목 | 축 |
|---|---|---|
| `OA-16142` | 서울시 체력단련장업 인허가 정보 | `exercise_body` |
| `OA-16146` | 서울시 목욕장업 인허가 정보 | `relax_recovery` |
| `OA-16480` | 서울시 의원 인허가 정보 | `medical_wellness` (한의원 · 재활의학과/정형외과 표방 의원) |

내려받기 URL 은 §5 표에 원본 sha256 과 함께 있다.

## 3. 수집 필터 전문

아래 블록은 `frame_build.py` 의 `FILTER_EXPRESSIONS` 와 **글자 단위로 동일**해야 하며,
검증기가 그 동일성과 K-5 금지 속성 토큰 0건 매칭을 함께 검사한다.

<!-- BEGIN filter-expressions -->
```
영업상태명 == '영업/정상'
address_gu(도로명주소, 지번주소) in ('강남구', '서초구', '송파구')
address_prefix == '서울특별시 <자치구> '
axis_of(dataset_id, license_category, medical_subjects) is not None
예약연동 == 'Y'
```
<!-- END filter-expressions -->

**K-5 금지 속성은 하나도 쓰지 않았다.** 프레임은 인허가 상태 · 소재지 자치구 · 인허가 업종 ·
표방 진료과목 4가지만으로 결정된다. 이 4가지는 업체의 노출·광고·판매 행위와 독립적이며,
그래서 "분모를 바꾸는" 경로가 닫힌다. 검증기는 선언된 필터 문자열뿐 아니라
`frame_build.py` **전문**을 같은 토큰 사전으로 훑는다 — 선언에 없는 필터를 코드에 숨기는 경로를
막기 위해서다.

## 4. 축 결정표

| 규칙 | 조건 | 축 |
|---|---|---|
| R1 | `dataset_id == OA-16142` ∧ `license_category == 체력단련장업` | `exercise_body` |
| R2 | `dataset_id == OA-16146` ∧ `license_category` 비어 있지 않음 | `relax_recovery` |
| R3 | `dataset_id == OA-16480` ∧ `license_category == 한의원` | `medical_wellness` |
| R4 | `dataset_id == OA-16480` ∧ `license_category == 의원` ∧ 진료과목에 `재활의학과` 또는 `정형외과` | `medical_wellness` |
| R5 | 그 외 | 프레임 밖 (모집단 제외) |

규칙은 위에서 아래로 처음 일치하는 것을 적용한다. 결정표는 §7 기계 판독 블록에 데이터로도 들어
있고, 검증기는 그 데이터를 `population.csv` 전 행에 **재적용**해 `axis` 컬럼과 대조한다.
축을 손으로 옮기면 그 시점에 `--check frame` 이 red 가 된다.

`venue_id` 는 `'V' + sha256(dataset_id | 개방자치단체코드 | 관리번호)[:12]` 의 대문자 표기다.
관리번호는 개방자치단체코드 안에서만 유일하므로 3요소를 모두 넣어야 전역 유일성이 성립한다
(2요소로 만들면 자치구가 다른 서로 다른 업체가 같은 id 를 갖는다 — 실제로 발생했다).

## 5. 재현 절차 · 수집 로그

```bash
# (1) 원본 3종 내려받기 — sha256 을 표준출력에 남긴다
python3 docs/discovery/D1a/frame_build.py --download /tmp/d1a-raw

# (2) 모집단 생성 (네트워크 미사용)
python3 docs/discovery/D1a/frame_build.py --build /tmp/d1a-raw
```

| dataset_id | 파일 | bytes | sha256 |
|---|---|---|---|
| `OA-16142` | `OA-16142_physical_training.csv` | 2,989,888 | `4db40a363e1fd745c196d0ef43d4b6a8eff5119792bca2a0ce42ad29bfbb6ceb` |
| `OA-16146` | `OA-16146_bathhouse.csv` | 1,490,541 | `70fd61b1b0222ac8b4e24cd2655be2f49ae99f5de8d875ef990c44adf5e6f9de` |
| `OA-16480` | `OA-16480_clinic.csv` | 17,812,089 | `c45dae7921d1c81e0138810471a7114ed6fc1ef77f1832de859e8411368d90b4` |

- 수집 일시: **2026-08-03T02:48:22Z** (UTC)
- 원본 3종은 합계 22MB 이고 상류에서 매일 갱신되므로 리포지토리에 커밋하지 않는다.
  대신 위 sha256 을 남긴다 — 재실행 시 값이 달라지면 상류 갱신이 있었다는 뜻이고,
  그때 `population.csv` 가 그대로면 그것이 오히려 이상 신호다.
- 원본 인코딩은 CP949, 구분자는 쉼표다.

### 산출 결과

| 축 | 강남구 | 서초구 | 송파구 | 합계 |
|---|---|---|---|---|
| `exercise_body` | 595 | 354 | 367 | 1,316 |
| `relax_recovery` | 72 | 30 | 37 | 139 |
| `medical_wellness` | 614 | 422 | 446 | 1,482 |
| **합계** | 1,281 | 806 | 850 | **2,937** |

9칸 최소값은 30 (relax_recovery × 서초구) 으로 REQ-1 의 칸당 20 하한을 충족한다.

## 6. 이 프레임이 대표하지 못하는 것 (한계 명시)

1. **인허가 대상이 아닌 업태가 빠진다.** 필라테스·요가 스튜디오, 손 기술 위주의 케어 업소는
   상당수가 자유업이라 인허가 대장에 없다. `exercise_body` 는 체력단련장업으로 신고된 업체에
   한정되고, `relax_recovery` 는 목욕장업 신고 업체에 한정된다.
2. **그 편향의 방향은 커버리지를 낮추는 쪽이 아니라 높이는 쪽일 수 있다.** 인허가 업체는 규모가
   상대적으로 크고 웹 노출이 잦다. 따라서 G1 판정이 임계 근처로 나올 경우, 이 프레임 한계는
   판정을 낙관적으로 만드는 방향으로 작용했을 가능성을 함께 기록해야 한다.
3. **`medical_wellness` 는 표방 진료과목 기준이다.** 도수치료·영양수액 시행 여부는 인허가
   대장에 없다. 재활의학과·정형외과 표방을 대리 지표로 썼다.
4. 위 1~3 은 D1b 리포트에 그대로 전재해야 하며, G1 판정문에 프레임 한계 문단이 없으면
   판정은 재현 불가능한 수치가 된다.

## 7. 기계 판독 블록

<!-- BEGIN frame.json -->
```json
{
  "frame_sources": ["public_license_registry"],
  "collected_at": "2026-08-03T02:48:22Z",
  "region": ["강남구", "서초구", "송파구"],
  "reproduction_command": "python3 docs/discovery/D1a/frame_build.py --download /tmp/d1a-raw && python3 docs/discovery/D1a/frame_build.py --build /tmp/d1a-raw",
  "datasets": [
    {
      "dataset_id": "OA-16142",
      "title": "서울시 체력단련장업 인허가 정보",
      "url": "https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do?infId=OA-16142&seq=2&srvType=S",
      "bytes": 2989888,
      "sha256": "4db40a363e1fd745c196d0ef43d4b6a8eff5119792bca2a0ce42ad29bfbb6ceb"
    },
    {
      "dataset_id": "OA-16146",
      "title": "서울시 목욕장업 인허가 정보",
      "url": "https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do?infId=OA-16146&seq=2&srvType=S",
      "bytes": 1490541,
      "sha256": "70fd61b1b0222ac8b4e24cd2655be2f49ae99f5de8d875ef990c44adf5e6f9de"
    },
    {
      "dataset_id": "OA-16480",
      "title": "서울시 의원 인허가 정보",
      "url": "https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do?infId=OA-16480&seq=2&srvType=S",
      "bytes": 17812089,
      "sha256": "c45dae7921d1c81e0138810471a7114ed6fc1ef77f1832de859e8411368d90b4"
    }
  ],
  "filter_expressions": [
    "영업상태명 == '영업/정상'",
    "address_gu(도로명주소, 지번주소) in ('강남구', '서초구', '송파구')",
    "address_prefix == '서울특별시 <자치구> '",
    "axis_of(dataset_id, license_category, medical_subjects) is not None",
    "예약연동 == 'Y'"
  ],
  "axis_decision_table": [
    {
      "id": "R1",
      "when": {"dataset_id": "OA-16142", "license_category": "체력단련장업"},
      "axis": "exercise_body"
    },
    {
      "id": "R2",
      "when": {"dataset_id": "OA-16146", "license_category_not_empty": true},
      "axis": "relax_recovery"
    },
    {
      "id": "R3",
      "when": {"dataset_id": "OA-16480", "license_category": "한의원"},
      "axis": "medical_wellness"
    },
    {
      "id": "R4",
      "when": {
        "dataset_id": "OA-16480",
        "license_category": "의원",
        "medical_subjects_any": ["재활의학과", "정형외과"]
      },
      "axis": "medical_wellness"
    }
  ],
  "population_rows": 2937,
  "population_cells_min": 30
}
```
<!-- END frame.json -->
