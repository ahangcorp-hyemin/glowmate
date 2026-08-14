"use server";

import { searchHospitals, getHospitalsByIds } from "@/lib/hospitals/repo";
import type { NearbyHospital } from "@/lib/hospitals/types";

export async function searchHospitalsAction(q: string): Promise<NearbyHospital[]> {
  return searchHospitals(q);
}

export async function fetchHospitalsByIds(ids: string[]): Promise<NearbyHospital[]> {
  return getHospitalsByIds(ids);
}
