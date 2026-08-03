# 픽스처 재공개 정책

## source: official_website
- allow_fields: venue_name, road_address
- deny_fields: 리뷰 작성자 닉네임, 개인 휴대전화번호
- attribution_text: "출처: 픽스처"

### allow_field: venue_name
- sample_values: "픽스처짐 강남1호점" | "픽스처요가 서초점" | "픽스처스파 송파점"
- pii_assessment: 상호이며 K-5 값 패턴 미매칭

### allow_field: road_address
- sample_values: "서울 강남구 테스트로 1" | "010-1234-5678" | "서울 송파구 테스트로 3"
- pii_assessment: 사업장 소재지이며 K-5 값 패턴 미매칭

## source: alt_one
- allow_fields: venue_name, road_address
- deny_fields: 리뷰 작성자 닉네임, 개인 휴대전화번호
- attribution_text: "출처: 픽스처"

### allow_field: venue_name
- sample_values: "픽스처짐 강남1호점" | "픽스처요가 서초점" | "픽스처스파 송파점"
- pii_assessment: 상호이며 K-5 값 패턴 미매칭

### allow_field: road_address
- sample_values: "서울 강남구 테스트로 1" | "서울 서초구 테스트로 2" | "서울 송파구 테스트로 3"
- pii_assessment: 사업장 소재지이며 K-5 값 패턴 미매칭
