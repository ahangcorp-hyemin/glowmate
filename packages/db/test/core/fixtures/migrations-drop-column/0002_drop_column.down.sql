-- 위반 픽스처의 짝. down 의 되돌림용 DDL 은 FORBID-1 검사 대상이 아니다.
ALTER TABLE core.price_plan ADD COLUMN failure_reason text;
