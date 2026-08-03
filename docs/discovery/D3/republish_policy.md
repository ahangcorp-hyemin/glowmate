# D3 — 재공개 정책 (republish policy)

> 대상: `verdicts.csv` 의 `verdict ∈ {allowed, conditional}` 인 **모든** 소스 (REQ-5)
> 검증: `scripts/discovery/validate_d3.py --check republish` · `--check pii`
> **판정은 필드명이 아니라 값으로 한다** (K-5). `author_name` → `contributor_label` 개명 우회를 막기 위해
> 각 `allow_field` 에 실제 샘플값 3건을 첨부하고, 그 값을 K-5 값 패턴 사전과 대조한다.

---

## K-5 재공개 금지 (allow 목록에 들어갈 수 없는 것)

리뷰 작성자 식별자·닉네임 / 작성자 프로필 URL / 개인 휴대전화번호 / 개인 SNS 계정 /
개인 이메일 / 방문자 사진 중 얼굴 포함 이미지

검사 패턴 (검증기 `pii_hits()` 정본):

| 패턴 | 정규식 요지 |
|---|---|
| 휴대전화번호 | `01[016789]` + 3~4자리 + 4자리 |
| 이메일 | `local@domain.tld` |
| 개인 SNS 핸들 | `instagram.com/…`·`facebook.com/…`·`x.com/…` 프로필 경로, 또는 단독 `@handle` |
| 인명 | 값 전체가 (성씨 + 1~2자) 이거나, (성씨 + 1~2자) 뒤에 `님`·`씨`·`강사`·`트레이너`·`원장`·`실장`·`디자이너` |

필드명 사전(`author`·`nickname`·`reviewer`·`writer`·`profile_url`·`mobile`·`email`·`sns`·
`instagram`·`face`·`portrait`)은 **보조 수단**으로만 쓴다.

---

## source: official_website

- allow_fields: venue_name, road_address, venue_type_label, landline_number, business_hours, source_page_url
- deny_fields: 리뷰 작성자 닉네임, 리뷰 작성자 프로필 URL, 트레이너·강사 실명, 트레이너 프로필 사진, 개인 휴대전화번호, 개인 이메일, 개인 SNS 계정, 방문자 사진 중 얼굴 포함 이미지, 업체 소개문 원문(저작물), 업체 촬영 사진 원본
- attribution_text: "출처: <업체 공식 홈페이지> · 원문 링크 제공 · 가격·영업시간은 수집 시점 기준이며 실제와 다를 수 있습니다"

### allow_field: venue_name
- sample_values: "스포애니 강남역1호점" | "휘트니스엠 학동점" | "순수 청담본점"
- pii_assessment: 상호(사업자 명칭)로 개인 식별정보가 아니다. 세 값 모두 지점 접미사를 포함한 법인·사업장 명칭이며 자연인 이름이 아니다. K-5 값 패턴 4종 모두 미매칭.

### allow_field: road_address
- sample_values: "서울 강남구 강남대로78길 8 (역삼동) 한국빌딩 B2층" | "서울 서초구 서초중앙로22길 17 (서초동) B1층" | "서울 송파구 삼학사로 99 (삼전동, 세경빌딩) 6층 7층"
- pii_assessment: 사업장 소재지로 공개 영업 정보다. 개인 주거지가 아니며 자연인과 결합해 개인을 식별하지 않는다. K-5 값 패턴 4종 모두 미매칭.

### allow_field: venue_type_label
- sample_values: "피트니스" | "프로" | "휘트니스"
- pii_assessment: 업체가 스스로 표기한 업종·브랜드 라인 라벨이다. 개인정보가 아니며 K-5 값 패턴 4종 모두 미매칭.

### allow_field: landline_number
- sample_values: "02-556-2558" | "02-587-9618" | "02-414-3801"
- pii_assessment: 지역번호 02 로 시작하는 **사업장 유선 대표번호**로, 업체가 자기 홈페이지에 영업 목적으로 공개한 값이다. K-5 가 금지하는 것은 개인 휴대전화번호이며 세 값 모두 휴대전화 패턴(`01[016789]-…`)에 미매칭이다. **수집 단계에서 `01x` 로 시작하는 번호가 발견되면 이 필드에 저장하지 않고 폐기한다** — 개인 휴대전화가 업체 대표번호로 등록된 경우가 존재하기 때문이다.

### allow_field: business_hours
- sample_values: "00:00~23:00" | "10:00~18:00" | "06:00 - 24:00"
- pii_assessment: 영업시간 문자열로 개인정보가 아니다. K-5 값 패턴 4종 모두 미매칭.

### allow_field: source_page_url
- sample_values: "https://www.spoany.co.kr/branch_view.php?idx=26" | "https://www.fitnessm1.com/hakdong" | "https://soonsoobeauty.com/"
- pii_assessment: 업체 공식 홈페이지의 공개 URL 이다. **작성자 프로필 URL 이 아니며**, SNS 프로필 경로(`instagram.com/<handle>` 등)도 포함하지 않는다. K-5 값 패턴 4종 모두 미매칭.

---

## 재공개 조건 (`conditional` 의 실체)

`official_website` 를 `conditional` 로 판정한 근거는 확보한 5개 도메인 약관이 공통적으로
**회사 저작물의 무단 복제·배포·영리 이용을 제한**한다는 점이다. 따라서:

1. **사실 정보만 재공개한다.** 상호·주소·업종 라벨·유선 대표번호·영업시간·가격 숫자는
   저작권 보호 대상 표현이 아니다. 반대로 업체가 작성한 **소개문·홍보 문구·사진은 재공개하지 않고**
   원문 링크로 대체한다.
2. **모든 업체 카드에 출처와 원문 링크를 붙인다** (`attribution_text`).
3. **수집 시점을 함께 표기한다.** 가격·영업시간은 변동하며, 시점 없는 가격 표기는
   "가격이 틀린 사이트"라는 평판으로 직결된다.
4. **업체의 삭제·정정 요청을 접수하는 경로를 제공한다.** 요청 시 해당 업체 레코드를 비공개 전환한다.
   원문(`source_record`)은 K-4 에 따라 행 삭제가 아니라 payload tombstone 으로 처리한다.
5. **의료 카테고리의 가격 표기는 D4 의 의료광고 가드레일을 따른다.** 본 문서는 수집·재공개 범위만
   규정하며 표기 규칙은 D4 소관이다(`out_of_scope`).
