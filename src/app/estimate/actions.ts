"use server";

import { buildEstimate, type EstimateInput, type Estimate } from "@/lib/estimate/engine";
import { getCatalog, getConcerns } from "@/lib/catalog/repo";
import { getNearbyHospitals } from "@/lib/hospitals/repo";
import { regionLabel } from "@/lib/geo/kakao";
import type { Concern } from "@/lib/catalog/rules";
import type { NearbyHospital } from "@/lib/hospitals/types";

// 서버에서 카탈로그를 읽어 결정론 견적을 계산. 데이터·§56검증은 서버/DB에.

export async function fetchConcerns(): Promise<Concern[]> {
  return getConcerns();
}

export async function runEstimate(input: EstimateInput): Promise<Estimate> {
  const catalog = await getCatalog();
  return buildEstimate(input, catalog);
}

// 실위치(또는 폴백 지역 좌표) 기준 근처 병원 실데이터 + 공개가(없으면 문의).
export async function fetchNearbyHospitals(lat: number, lng: number, procedureId: string): Promise<NearbyHospital[]> {
  return getNearbyHospitals(lat, lng, procedureId);
}

export async function fetchRegionLabel(lat: number, lng: number): Promise<string | null> {
  return regionLabel(lat, lng);
}

// 코호트 실결제 분포(#73) — n<5면 null(비노출 하드 룰)
export async function fetchCohortDist(procedureId: string, ageBand?: string) {
  const { getCohortDist } = await import("@/lib/reviews/stats");
  return getCohortDist(procedureId, ageBand);
}
