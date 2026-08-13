-- 0002: M1 카탈로그 증강분을 스키마에 반영(0001은 증강 이전이라 드리프트).
-- procedures: sideEffects/contraindication/misconception/vsNote 추가.
-- concerns: 온보딩 카드용 sentence/emoji 추가.

alter table procedures
  add column if not exists side_effects text not null default '',
  add column if not exists contraindication text not null default '',
  add column if not exists misconception text not null default '',
  add column if not exists vs_note text not null default '';

alter table concerns
  add column if not exists sentence text not null default '',
  add column if not exists emoji text not null default '';
