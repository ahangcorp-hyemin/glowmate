# instagram — 인스타그램 업체 계정 (대안 소스)

| 항목 | 값 |
|---|---|
| 소스 유형 | 대안 소스 (K-3 필수 외) |
| verdict | **forbidden** |
| rule_id | `R-TOS-PROHIBIT` |
| 조사일시(UTC) | 2026-08-03 |

---

## robots

- 스냅샷: [`snapshots/robots/instagram.txt`](../snapshots/robots/instagram.txt)
  (https://www.instagram.com/robots.txt, HTTP 200) · 정본 [`index.csv`](../snapshots/robots/index.csv)
- 파일 최상단 고지(원문):

```
# Notice: Collection of data on Instagram through automated means is
# prohibited unless you have express written permission from Instagram
# and may only be conducted for the limited purpose contained in said
# permission.
# All authorized user-agents listed on this page must comply with Meta's
# Automated Data Collection Terms available at:
# https://www.facebook.com/legal/automated_data_collection_terms
```

- 이어서 Amazonbot·ClaudeBot·GPTBot·PerplexityBot 등 자동 수집 에이전트를 개별 `Disallow: /` 한다.
- robots 파일 자체가 **명시적 서면 허가 없는 자동 수집을 금지**한다고 선언하고 있으므로,
  개별 경로의 Allow/Disallow 여부와 무관하게 자동 수집 대상이 아니다.

## tos

- 원문 스냅샷: [`snapshots/tos/instagram.terms.html`](../snapshots/tos/instagram.terms.html)
  (https://help.instagram.com/581066165581870 — Instagram 이용약관, HTTP 200)
- 별도 문서인 **Automated Data Collection Terms** 가 robots.txt 에서 인용되어 있으며,
  서면 허가를 받은 에이전트에게만 적용된다. 우리는 허가 대상이 아니다.
- 조항 번호: Instagram 약관은 "You can't do the following" 형태의 비번호 절 구성이라
  `제N조`/`Section N` 형식의 번호를 특정할 수 없다. verdict 는 robots 고지와 명시 문언으로
  이미 `forbidden` 이므로 판정에 영향이 없다.

## official_api

- **Instagram Graph API** 는 비즈니스/크리에이터 계정 소유자가 자기 계정 데이터를 조회하는 용도다.
  제3자가 임의 업체 계정을 조회할 수 없다.
- 결론: 공식 경로로 타 업체 데이터를 얻을 방법이 없다.

## access_method

- 웹 스크래핑: **금지**
- 공식 API: 제3자 조회 불가
- → 어댑터 대상에서 제외한다.

## rate_limit

요청률 실측 미시행 (verdict `forbidden`).

## risk_note

- 강남3구 웰니스 업체의 **가격표 이미지·프로모션이 인스타에 가장 먼저 올라온다.**
  실무적으로 가장 아쉬운 소스지만, Meta 는 자동 수집에 대해 계정 정지·법적 조치를 실제로 집행한다.
- 업체 인스타 계정 URL 자체(예: `instagram.com/<handle>`)를 **링크로 노출**하는 것은 수집이 아니며,
  업체가 공식 홈페이지에 스스로 게시한 링크를 옮기는 범위에서만 허용한다.
  단 K-5 에 따라 **개인 SNS 계정**은 재공개 allow 목록에 넣을 수 없으므로,
  업체 공식 계정과 개인 계정을 구분하지 못하는 상황에서는 노출하지 않는다
  ([`republish_policy.md`](../republish_policy.md) deny_fields).
