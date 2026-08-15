# 운영 어드민 v2 기획 (현 DB 기반 + Mobbin 리서치 + v3 디자인)

## 문제
현 `/admin`은 방문예약 큐 + 파트너 토글 2개뿐. 운영에 필요한데 화면 없는 것:
1. **후기 검수** (가장 시급) — 모든 후기가 status='hidden'으로 들어옴. 승격 안 하면 후기 탭이 영영 빈다.
2. **파트너 문의** — partner_inquiries에 B2B 리드가 쌓이는데 볼 데가 없다.
3. **대시보드** — 오늘 뭘 처리해야 하는지 한눈에.
그리고 디자인이 구 코랄 톤이라 v3(토스)와 안 맞음.

## Mobbin 러닝 (web)
- [Klaviyo Reviews](https://mobbin.com/screens/85bea3ee-f9d6-4734-bc6d-429723dacb32): pending 후기 카드 + ★ + [Publish]/[Reject]. **우리 후기검수의 원형** — 카드형이라 모바일 OK.
- [Reddit Queue](https://mobbin.com/screens/9e81dbcf-db79-45ef-8347-08e81e1b5b77): 상단 탭(Needs Review/Reported/Removed) + 승인✓/반려✗ + 처리 시 토스트.
- [Jobber](https://mobbin.com/screens/56a6ce1c-8d71-4c1a-89cb-1d07f075424a) / Wix: 대시보드 = 상단 stat 카드 행(카운트) + 할 일.
- 러닝: (a) 큐는 탭으로 상태 분리 (b) 검수는 카드 1건 = 판단 1회 (c) 처리 즉시 사라지고 카운트 감소 (d) 대시보드가 "오늘 할 일 수"를 먼저.

## 구조 (v3 디자인 그대로 — 흰 바탕·회색 면·그린 액센트·SVG 아이콘)
상단 세그먼트 탭 4개: **대시보드 · 후기검수 · 방문예약 · 파트너문의**

### 1. 대시보드
- stat 카드 3개(그린 숫자): 검수 대기 후기 N · 오늘 방문신청 N · 미확인 파트너문의 N. 탭으로 점프.

### 2. 후기 검수 (신규 · 핵심)
- 세부 탭: 대기(hidden) / 공개됨(shown) / 반려(demoted). 기본 대기.
- 카드(Klaviyo형): 시술·병원·연령·★ · 본문 · **실결제액·범위비교·시술스펙(가격 데이터)** · 작성 경과 · 영수증 유무.
- **§56 경고**: flagged_phrases 있으면 빨간 배지 + 어떤 표현인지 표시(리터러시 인용은 예외).
- 영수증: 있으면 [영수증 보기] → 비공개 버킷 signed URL(60초). 실방문 인증 토글.
- 액션: [공개] shown / [숨김] hidden 유지 / [반려] demoted. 처리 즉시 목록에서 제거 + 대시보드 카운트 감소.

### 3. 방문예약 (기존 → v3 리스타일)
- 기능 동일(상태머신·tel 링크·파트너 지정). 색만 그린으로.

### 4. 파트너 문의 (신규)
- partner_inquiries 리스트: 병원명·지역·담당자·연락처(tel/mailto)·메시지.
- 상태(신규/연락함/완료) — **0011 마이그레이션 필요**(partner_inquiries.status 추가).

## 서버 액션 (전부 ADMIN_TOKEN 게이트)
- `adminStats(token)` → { pendingReviews, todayVisits, newInquiries }
- `adminListReviews(token, status)` / `adminModerateReview(token, id, action: publish|hide|reject)` + 인증 토글
- `adminReceiptUrl(token, path)` → signed URL(비공개 버킷)
- `adminListInquiries(token)` / `adminUpdateInquiry(token, id, status)`
- 기존 visit 액션 유지.

## 마이그레이션
- `0011_partner_inquiry_status.sql`: `alter table partner_inquiries add column status text default 'new' check (status in ('new','contacted','done'))`.
- reviews는 기존 제약(shown/demoted/hidden) 재활용 → 없음.

## §27/§56 유지
- 후기 반려 사유는 내부 메모만. 병원엔 아무것도 안 감. §56 필터는 노출 전 최종 게이트.
