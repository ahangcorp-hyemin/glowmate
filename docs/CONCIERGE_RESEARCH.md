# 컨시어지/두낫스케일 방법론 — 크로스도메인 레퍼런스 + 우리 번역

도메인은 달라도 "수동으로 서비스를 대행하며 공급측을 시딩한다"는 우리 상황과 같은 맥락의 아티클을 정리. 각 항목 = 원 방법론 + 글로우메이트 번역.

## 1. Paul Graham — "Do Things That Don't Scale" (YC 정전, 2013)
링크: http://paulgraham.com/ds.html · [요약(Indie Hackers)](https://www.indiehackers.com/post/summary-do-things-that-don-t-scale-by-paul-graham-bdcb54215a) · [PDF](https://educapital.com.br/wp-content/uploads/2022/06/Do-Things-that-Dont-Scale-1.pdf)
- **방법론**: 스타트업은 저절로 안 뜬다. 초기엔 유저를 **한 명씩 손으로** 모은다. 유명 사례 — 에어비앤비 창업자가 뉴욕을 **문 두드리며** 다니고 호스트의 리스팅을 **직접 개선**해줌. Stripe의 "Collison 설치"(그 자리에서 대신 셋업). 요점: **수작업 자체가 목적이 아니라, 자동 퍼널이 절대 못 가르쳐주는 걸 배우는 것.**
- **우리 번역**: 미입점 병원 대행 전화 = 에어비앤비 문 두드리기의 우리 버전. 전화하며 배우는 것(병원이 왜 거절하나·무슨 정보를 원하나·유저가 뭘 두려워하나)이 자동화보다 값지다.

## 2. Concierge MVP 방법론
[N-iX](https://www.n-ix.com/concierge-mvp/) · [LearningLoop](https://learningloop.io/plays/concierge) · [Koji 2026 가이드](https://www.koji.so/docs/concierge-mvp-guide)
- **방법론**: 자동화 전에 창업자가 **모든 단계를 손으로** 대행하며 수요·지불의사를 검증. "창업자가 마찰을 직접 느껴야 뭘 자동화할지 안다." **자동화 시점 기준: 배송의 80%가 반복 가능한 프로세스 + 이탈 낮은 유료 고객 10곳↑.**
- **우리 번역**: 지금은 자동 예약 시스템 만들 때가 아니다. 대행 80%가 같은 패턴이 되고 파트너(유료) 몇 곳이 안 빠지고 남을 때 자동화. 그 전엔 손으로.

## 3. Andrew Chen — "The Cold Start Problem" (a16z)
[8장(하드사이드)](https://andrewchen.com/solve-a-hard-problem-cold-start-problem/) · [요약](https://blas.com/the-cold-start-problem/) · [Stripe Atlas 인터뷰](https://stripe.com/guides/atlas/andrew-chen-marketplaces)
- **방법론**: 마켓플레이스의 **하드사이드 = 공급(우리는 병원)**. 순서는 "공급, 수요, 공급, 공급, 공급" — 결국 공급이 병목. **첫 수십 쌍을 손으로 매칭**하면 잘못된 필터·랭킹·가격 가정이 다 드러난다. 임계 공급을 먼저 시딩.
- **우리 번역**: 병원이 하드사이드가 맞다. 첫 방문 매칭들을 손으로 하며 "고민 분류가 맞나·거리순이 맞나·가격 렌즈가 맞나"를 검증(이미 우리가 필터 재정비하며 겪은 것). 공급(파트너)이 결국 병목이니 거기에 집중.

## 4. 밀도/집중 — Lenny Rachitsky 마켓플레이스 딥다이브
[FORKOFF 2026 플레이북](https://forkoff.xyz/blog/founder-growth/two-sided-marketplace-cold-start-2026) · [Sharetribe 니치 마켓](https://www.sharetribe.com/how-to-build/niche-marketplace/) · [Stripe 가이드](https://stripe.com/resources/more/two-sided-marketplace-strategy)
- **방법론**: **유동성이 생길 때까지 시장을 좁혀라 — 도시 하나, 카테고리 하나, 유스케이스 하나.** 오늘날 성공한 마켓플레이스 거의 전부가 **작은 지역(동네)이나 단일 카테고리**로 시작. FORKOFF 4단계: 싱글플레이어 유틸리티 → 합성 공급 시드 → **컨시어지 매칭** → 네트워크 플립.
- **우리 번역**: 이게 우리 "밀도" 문제의 정답. 전국 2,791곳 흩뿌리기 금지 → **강남 × 울쎄라/써마지**로 좁혀 리드를 5~10 병원에 집중. 리드가 한 병원에 3~5건 쌓여야 전환 탄약이 된다.

## 5. 국내 참고 (동일 판)
- 강남언니: **리뷰로 수요 선점** 후 병원 유입 → 광고. [소비자평가](http://www.iconsumer.or.kr/news/articleView.html?idxno=27835)
- 모두닥: **"6년 삽질 끝에 찾은 밀도"**, 유저풀 기반 입찰 광고. [OBR](https://obrkorea.com/modoodoc-journey)
- Zocdoc: 창업자가 뉴욕 치과 수백 곳 **문 두드리고** 캘린더 손동기화. [Contrary](https://research.contrary.com/company/zocdoc) · [Inc](https://www.inc.com/chris-beier-and-daniel-wolfman/zocdoc-cyrus-massoumi-convinced-doctors-to-sign-up.html)

---

## 4개 방법론이 우리에게 주는 합의된 결론
1. **손으로 하는 게 맞다**(PG·Concierge MVP) — 지금 단계에선 자동화가 오히려 틀림.
2. **공급(병원)이 하드사이드**(Chen) — 거기에 자원 집중, 첫 매칭은 손으로.
3. **좁혀서 밀도를 만들어라**(Lenny) — 강남×울쎄라 비치헤드.
4. **자동화 졸업선**(Concierge MVP): 대행 80% 반복화 + 안 빠지는 유료 파트너 10곳.
→ 지금 KPI는 매출이 아니라 **비치헤드 병원별 누적 리드**와 **첫 파트너까지 걸린 리드 수(CAC)**.
