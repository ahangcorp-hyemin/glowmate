"use server";

import { getLesson, getLessonIds } from "@/lib/lessons/repo";
import type { LessonContent } from "@/lib/lessons/types";

// 클라이언트 레슨 플레이어가 호출. 데이터는 서버(DB/시드)에서.
export async function fetchLesson(procedureId: string): Promise<LessonContent | null> {
  return getLesson(procedureId);
}

/** 레슨이 준비된 시술 id(견적 화면에서 '알아보기' 진입점 노출 판단용). */
export async function fetchLessonIds(): Promise<string[]> {
  return getLessonIds();
}
