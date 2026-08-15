import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

// 견적요청 만료·연락처 파기(#72, §23 이행). Vercel cron이 호출.
// 보호: CRON_SECRET 헤더 일치 시에만. expire_and_purge_quotes()는 멱등.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const db = getServerClient();
  if (!db) return NextResponse.json({ ok: false, error: "no db" }, { status: 500 });
  const { data, error } = await db.rpc("expire_and_purge_quotes");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, affected: data });
}
