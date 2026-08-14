import { getCatalog } from "@/lib/catalog/repo";
import ReviewForm from "./ReviewForm";

export const metadata = {
  title: "시술 후기 남기기 | 글로우메이트",
  description: "같은 고민을 하는 40·50대 또래에게 진짜 경험을 나눠주세요. 검수 후 익명으로 공개돼요.",
};

export default async function WriteReviewPage() {
  const catalog = await getCatalog();
  const procedures = Object.values(catalog.proceduresById).map((p) => ({ id: p.id, nameKo: p.nameKo }));
  return <ReviewForm procedures={procedures} />;
}
