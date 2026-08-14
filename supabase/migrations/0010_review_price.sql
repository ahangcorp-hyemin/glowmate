-- 0010: 후기 = 가격 데이터 수집기 (이슈 #67 C).
-- 모두닥 암묵지: 4050은 '가서도 그 가격이 맞는지'를 가장 두려워한다 → 리뷰의 1급 필드는
-- 감상이 아니라 실결제액·예상범위 일치 여부·시술 스펙. 이 데이터가 쌓여 우리의 가격 DB가 된다.
-- 노출 정책(docs/PRICE_DATA_STRATEGY.md): 시술별 실결제 후기 3건 미만이면 어디에도 노출하지 않는다.

alter table reviews
  add column if not exists paid_amount int,          -- 실결제 총액(만원 단위, 선택)
  add column if not exists price_match text
    check (price_match in ('in_range','higher','lower','unsure')),  -- 예상 범위와 비교
  add column if not exists procedure_spec text;      -- 시술 스펙(부위·회차 등 자유 서술, 선택)

comment on column reviews.paid_amount is '실결제 총액(만원). 예: 90 = 90만원';
comment on column reviews.price_match is '글로우메이트 예상 범위와 비교: in_range/higher/lower/unsure';
