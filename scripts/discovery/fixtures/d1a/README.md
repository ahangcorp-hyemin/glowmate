# D1a 위반 픽스처 12종 — 메타테스트

> 계약: [`docs/tasks/D1a.md`](../../../../docs/tasks/D1a.md) `done_when` §메타테스트
> 실행: `python scripts/discovery/validate_d1a.py --check meta`

**금지사항을 지키는 것만으로는 계약을 이행한 것이 아니다.** 미래의 누군가가 그것을 어길 때
검사기가 실제로 잡아내는지를 여기서 실증한다.

## 구조

```
f<NN>-<slug>/
  expect.json   # { id, label, rule, must_fail_checks }
  patch.py      # (선택) 트리 루트에서 실행되는 제자리 변형
  overlay/      # (선택) 파일 단위 덮어쓰기. {{SAMPLE_ID_n}} 은 확정 표본 id 로 치환된다
```

`patch.py` 방식을 쓰는 이유는 8,895행짜리 `population.csv` 를 픽스처마다 통째로
복제하지 않기 위해서다. 변형 스크립트 자체가 리뷰 대상으로 리포지토리에 남는다.

## 메타테스트가 요구하는 3가지

1. **기준선 green** — 오버레이·패치 없는 트리에서 해당 `--check` 가 exit 0
2. **위반 시 non-zero** — 픽스처를 적용하면 exit ≠ 0
3. **사유 귀속** — 실패 출력에 `rule` 문자열이 있고, **기준선 출력에는 그 문자열이 없다**

3번이 핵심이다. 이것이 없으면 "무조건 실패하는 검사기"가 12종 전부를 통과시킨다.

## 픽스처 목록

| # | 디렉터리 | 위반 | 대상 검사 |
|---|---|---|---|
| ① | `f01-frame-filter-forbidden-attr` | 수집 필터에 K-5 금지 속성(예약 연동 여부) | `frame` |
| ② | `f02-allowed-channel-outside-k1` | `allowed_channels` 에 K-1 밖 채널 추가 | `definition` |
| ③ | `f03-threshold-lowered` | `proceed_threshold` 0.40 → 0.35 | `thresholds` |
| ④ | `f04-holdout-plaintext-leak` | 표본 `venue_id` 평문 노출 | `holdout-sealed` |
| ⑤ | `f05-positive-example-snapshot-missing` | 양성 예시 스냅샷 파일 삭제 | `definition-recall` |
| ⑥ | `f06-medical-subject-removed` | 진료과목 집합에서 `피부과` 제거 | `frame` |
| ⑦ | `f07-prior-seal-fingerprint-reuse` | `key_fingerprint == superseded_key_fingerprint` | `holdout-sealed` |
| ⑧ | `f08-mobile-phone-injected` | `phone` 에 휴대전화 대역 1건 주입 | `population-quality` |
| ⑨ | `f09-hair-added-to-beauty-set` | `beauty_care` 편입 집합에 `일반미용업` 추가 | `frame` |
| ⑩ | `f10-closed-business-row` | 폐업 행 1건 잔존 (T-4 필터 누락) | `frame` |
| ⑪ | `f11-enrich-inner-join` | K-10 보강을 inner join 으로 수행해 모집단 축소 | `frame` |
| ⑫ | `f12-dataset-id-songpa-missing` | 송파 미용업 `OA-17925` 누락 — **총계로는 안 잡힌다** | `frame` |

⑦ 의 디렉터리 이름에 `holdout` 과 `key` 를 함께 넣지 않은 이유는, 검증기의
"키로 보이는 추적 파일" 휴리스틱(`(holdout).*(key|secret|pass)`)에 자기 픽스처가 걸려
계약이 자기 PR 을 차단하기 때문이다 (규격 §3.4 P7 안티패턴 회피).
