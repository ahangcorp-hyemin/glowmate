# D2 검증기 메타테스트 픽스처

> 실행: `python scripts/discovery/validate_d2.py --check fixtures`
> 재생성: `python docs/discovery/D2/fixtures/_generate.py`

**여기 있는 데이터는 전부 합성이다.** SERP 실측이 아니며 G2 판정에 쓰이지 않는다.
용도는 하나다 — `validate_d2.py` 가 계약 FORBID 를 **실제로 잡는지** 입증하는 것.

## 왜 위치가 `scripts/discovery/fixtures/d2/` 가 아닌가

계약 `done_when` 은 그 경로를 지정하지만 `deliverable.touches` 3개 글롭 밖이고,
F1 의 `path-guard` job(FORBID-4)이 touches 밖 변경을 exit 1 로 막는다.
문자 그대로 따르면 이 PR 이 자기 자신에게 차단된다.
→ touches 안(`docs/discovery/D2/fixtures/`)에 두었다. 계약 정정 필요:
[../report.md](../report.md) §3(C).

## 픽스처 목록

| # | 디렉터리 | 검사 | 기대 | 귀속 |
|---|---|---|---|---|
| 0 | `00-valid` | 9종 전부 | **exit 0** | — |
| 1 | `01-forbid1-min-independent-domains-1` | `difficulty` | exit ≠ 0 | FORBID-1 |
| 2 | `02-forbid2-low-volume-in-numerator` | `serp` | exit ≠ 0 | FORBID-2 |
| 3 | `03-forbid3-logged-in-snapshot` | `capture-integrity` | exit ≠ 0 | FORBID-3 |
| 4 | `04-forbid4-blocked-45-verdict-pass` | `blocked-cap` | exit ≠ 0 | FORBID-4 |
| 5 | `05-forbid5-naver-fail-final-pass` | `verdict` | exit ≠ 0 | FORBID-5 |
| 6 | `06-forbid6-blocked-pair-has-serp-row` | `blocked` | exit ≠ 0 | FORBID-6 |
| 7 | `07-forbid3-csv-domain-mismatch` | `capture-integrity` | exit ≠ 0 | FORBID-3 (두 번째 갈래) |
| 8 | `08-forbid2-enterable-with-blocked-status` | `verdict` | exit ≠ 0 | FORBID-2 (두 번째 갈래) |

계약 `done_when` 이 요구한 6종은 ①~⑥ 이다. ⑦⑧ 은 FORBID-3·FORBID-2 의
`detect` 가 **두 갈래**를 명시하는데(스냅샷 정규식 스캔 **및** csv↔스냅샷 도메인 대조 /
`--check serp` **및** `--check verdict`) ①~⑥ 이 각각 한 갈래만 덮기 때문에 추가했다.

## `00-valid` 가 있는 이유 (원칙 2.5)

위반 픽스처만 두면 **모든 입력에서 무조건 exit 1 하는 검사기**가 만점을 받는다.
그런 검사기는 위반과 정상을 구분하지 못하므로 검사기가 아니다.
`--check fixtures` 는 `expect: pass` 픽스처가 하나도 없으면 그 자체로 실패한다.

## 구조

```
<case>/
  case.json      # base · checks · expect · expect_rule · env · why
  tree/          # base 트리 위에 덮어쓸 파일만 (오버레이)
    D2/…         # --data-root 로 주입
    G2.md        # --gate-file 로 주입
```

`--check fixtures` 는 매 실행마다 임시 디렉터리에 `base` 트리를 복사하고 오버레이를
덮어쓴 뒤, **검증기 자신을 서브프로세스로 재실행**한다. 통과 판정은
(a) 종료 코드가 기대와 일치하고 (b) 실패 출력에 `[<expect_rule>]` 이 있을 때만 내려진다
— 다른 이유로 실패한 것을 "잡았다" 로 세지 않는다(귀속 검증).
