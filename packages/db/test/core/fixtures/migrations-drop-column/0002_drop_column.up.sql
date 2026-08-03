-- 위반 픽스처 — FORBID-1 (b) 'up 마이그레이션의 데이터 손실형 DDL'.
-- 이 파일은 packages/db/migrations 밖에 있고 어떤 실행 경로에서도 적용되지 않는다.
-- 존재 이유는 단 하나: 검사기가 실제로 이것을 잡는지 확인하는 것.
ALTER TABLE core.price_plan DROP COLUMN failure_reason;
