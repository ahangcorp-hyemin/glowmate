"use server";

import { buildEstimate, type EstimateInput, type Estimate } from "@/lib/estimate/engine";
import { getCatalog, getConcerns, getHospitalPrices } from "@/lib/catalog/repo";
import type { Concern } from "@/lib/catalog/rules";
import type { HospitalPriceRow } from "@/lib/catalog/hospitals";

// 서버에서 카탈로그를 읽어 결정론 견적을 계산. 데이터·§56검증은 서버/DB에.

export async function fetchConcerns(): Promise<Concern[]> {
  return getConcerns();
}

export async function runEstimate(input: EstimateInput): Promise<Estimate> {
  const catalog = await getCatalog();
  return buildEstimate(input, catalog);
}

export async function fetchHospitalPrices(procedureId: string): Promise<HospitalPriceRow[]> {
  return getHospitalPrices(procedureId);
}
