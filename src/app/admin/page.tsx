import { getCatalog } from "@/lib/catalog/repo";
import AdminApp from "./AdminApp";

// 운영 어드민 v2 — 서버에서 시술명 맵만 주입, 나머지는 토큰 게이트 클라이언트.
export default async function AdminPage() {
  const catalog = await getCatalog();
  const procNames = Object.fromEntries(
    Object.values(catalog.proceduresById).map((p) => [p.id, p.nameKo])
  );
  return <AdminApp procNames={procNames} />;
}
