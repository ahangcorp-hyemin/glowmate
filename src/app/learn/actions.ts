"use server";

import { getLesson } from "@/lib/lessons/repo";
import type { LessonContent } from "@/lib/lessons/types";

// 클라이언트 레슨 플레이어가 호출. 데이터는 서버(DB/시드)에서.
export async function fetchLesson(procedureId: string): Promise<LessonContent | null> {
  return getLesson(procedureId);
}
