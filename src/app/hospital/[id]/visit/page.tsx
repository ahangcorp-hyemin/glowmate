import { notFound } from "next/navigation";
import { getHospitalById } from "@/lib/hospitals/repo";
import VisitForm from "./VisitForm";

export const metadata = { title: "방문 희망 신청 | 글로우메이트" };

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await getHospitalById(id);
  if (!h) notFound();
  return <VisitForm hospitalId={h.id} hospitalName={h.name} district={h.district} isPartner={h.isPartner ?? false} />;
}
