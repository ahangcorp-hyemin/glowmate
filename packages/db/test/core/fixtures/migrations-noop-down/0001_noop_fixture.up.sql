-- 위반 픽스처 — REQ-7 'no-op down'. 이 up 은 객체를 만들고, 짝인 down 은 아무것도 하지 않는다.
-- 왕복 검사가 post-down == pre 를 실제로 비교하는지(= 빈 down 을 통과시키지 않는지) 확인한다.
CREATE SCHEMA noop_fixture;
CREATE TABLE noop_fixture.leftover (id integer PRIMARY KEY);
