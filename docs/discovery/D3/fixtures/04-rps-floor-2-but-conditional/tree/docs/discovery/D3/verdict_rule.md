# 픽스처 판정 룰

| rule_id | 적용 조건 | 산출 verdict |
|---|---|---|
| `R-ROBOTS-DISALLOW` | robots Disallow | forbidden |
| `R-ROBOTS-UNKNOWN` | robots 취득 실패 | forbidden |
| `R-TOS-PROHIBIT` | ToS 명시 금지 | forbidden |
| `R-RPS-FLOOR` | 요청률 하한 미달 | forbidden |
| `R-PENDING-NO-TOS` | ToS 미확보 | pending |
| `R-COND-ATTRIB` | 출처표시 조건부 | conditional |
| `R-COND-RATE` | 요청률 조건부 | conditional |
| `R-ALLOWED-OPEN` | 조건 없음 | allowed |
