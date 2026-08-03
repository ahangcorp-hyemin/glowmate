-- 0001_core_schema.down.sql — F2a-CORE-SCHEMA 되돌림
--
-- 이 파일의 DROP 은 FORBID-1 의 검사 대상이 아니다(동일 버전 되돌림용). 검사기는
-- `*.up.sql` 만 파괴적 DDL 로 판정한다.
--
-- REQ-7: 이 스크립트 실행 직후의 카탈로그 스냅샷 sha256 이 F2a 적용 **이전** 스냅샷과
-- 일치해야 한다. 그래서 아래 두 가지를 지킨다.
--   (1) up 이 만든 객체를 전부 지운다 — CASCADE 로 스키마 통째.
--   (2) up 이 만들지 않은 것은 건드리지 않는다 — PostGIS 확장은 환경 수준 객체이며
--       runner bootstrap 이 적용 이전에 이미 만들어 둔다. 여기서 DROP 하면
--       "되돌림"이 아니라 환경 파괴가 되고, 같은 인스턴스의 다른 DB 소비자를 끊는다.
--
-- 빈 down(no-op)은 REQ-7 검사에서 반드시 실패한다 — post-down 스냅샷이 pre 와 달라지기 때문이다.
-- 그 실패가 실제로 발생하는지는 test/core/db/violations.test.mjs 의 no-op down 픽스처가 확인한다.

DROP SCHEMA IF EXISTS core CASCADE;
