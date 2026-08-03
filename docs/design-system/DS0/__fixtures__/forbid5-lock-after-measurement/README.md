# [FIXTURE] FORBID-5 (b)

내용은 baseline 과 같지만 **커밋 순서**가 뒤집혀 있다:
실측 산출물이 먼저 커밋되고 verdict_rule.md + rule.lock 이 나중에 커밋됐다.
`--check rule-lock` 이 커밋 시각 비교로 non-zero 여야 한다.
