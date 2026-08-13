import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 서버 전용 Supabase 클라이언트. service_role 키를 쓰므로 절대 클라이언트에 노출 금지.
// 키가 없으면 null → repo가 TS 시드로 폴백(부트스트랩·데모 유지).

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isDbConfigured = Boolean(URL && SERVICE_KEY);

let client: SupabaseClient | null = null;

/** DB가 설정돼 있으면 서버 클라이언트, 아니면 null(폴백 신호). */
export function getServerClient(): SupabaseClient | null {
  if (!isDbConfigured) return null;
  if (!client) {
    client = createClient(URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
