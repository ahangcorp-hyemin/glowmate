// packages/db/src/types.ts
//
// ⚠ 생성 파일이다. 직접 편집하지 마라 — 편집분은 다음 생성에서 사라지고,
//   CI(db-schema job)의 `pnpm db:generate-types --check` 가 즉시 실패한다.
//
// 원천: packages/db/migrations/** 를 적용한 DB 의 카탈로그 (F2a-CORE-SCHEMA)
// 재생성: cd packages/db && DATABASE_URL=... pnpm db:generate-types

/** core.gu_code */
export type GuCode = 'gangnam' | 'seocho' | 'songpa';

/** core.price_unit_type */
export type PriceUnitType = 'per_session' | 'period_pass' | 'single_session' | 'unparseable';

/** core.source_license_status */
export type SourceLicenseStatus = 'allowed' | 'conditional' | 'pending' | 'forbidden';

/** core.venue_category */
export type VenueCategory = 'exercise_body' | 'relax_recovery' | 'medical_wellness' | 'beauty_care';

/** core.editor_report */
export interface EditorReportRow {
  readonly id: string;
  readonly venue_id: string;
  readonly slug: string;
  readonly editor_id: string;
  readonly visited_at: string;
  readonly created_at: Date;
}

/** core.need_tag */
export interface NeedTagRow {
  readonly id: string;
  readonly ontology_id: string;
  readonly slug: string;
  readonly created_at: Date;
}

/** core.price_plan */
export interface PricePlanRow {
  readonly id: string;
  readonly venue_id: string;
  readonly source_record_id: string;
  readonly raw_text: string;
  readonly price_unit_type: PriceUnitType;
  readonly price_per_month_krw: number | null;
  readonly period_days: number | null;
  readonly source_snippet: string;
  readonly captured_at: Date;
  readonly parser_version: string;
  readonly total_amount_krw: number | null;
  readonly session_count: number | null;
  readonly price_per_session: number | null;
  readonly failure_reason: string | null;
  readonly is_promotional: boolean;
  readonly promo_valid_until: string | null;
  readonly created_at: Date;
}

/** core.source_record */
export interface SourceRecordRow {
  readonly id: string;
  readonly source_url: string;
  readonly raw_payload: unknown;
  readonly fetched_at: Date;
  readonly source_license_status: SourceLicenseStatus;
  readonly tombstoned_at: Date | null;
  readonly tombstone_reason: string | null;
  readonly created_at: Date;
}

/** core.venue */
export interface VenueRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: VenueCategory;
  readonly gu: GuCode;
  readonly location: string;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/** core.venue_need_tag */
export interface VenueNeedTagRow {
  readonly venue_id: string;
  readonly need_tag_id: string;
  readonly evidence_snippet: string;
  readonly assigned_at: Date;
}

/** core 스키마 테이블 → 행 타입 대응 */
export interface CoreTables {
  readonly editor_report: EditorReportRow;
  readonly need_tag: NeedTagRow;
  readonly price_plan: PricePlanRow;
  readonly source_record: SourceRecordRow;
  readonly venue: VenueRow;
  readonly venue_need_tag: VenueNeedTagRow;
}
