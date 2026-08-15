import QuoteWizard from "./QuoteWizard";
import { getCatalog } from "@/lib/catalog/repo";

export const metadata = { title: "실제 견적 받기 | 글로우메이트" };

// 컨시어지 역경매 신청(#72). 조건만 입력 → 전화는 우리가. 무가입.
export default async function QuoteNewPage() {
  const catalog = await getCatalog();
  const procedures = Object.values(catalog.proceduresById).map((p) => ({ id: p.id, nameKo: p.nameKo }));
  const concerns = Object.values(catalog.concernsById).map((c) => ({ id: c.id, nameKo: c.nameKo }));
  return <QuoteWizard procedures={procedures} concerns={concerns} />;
}
