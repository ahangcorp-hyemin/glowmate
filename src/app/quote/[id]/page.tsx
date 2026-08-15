import QuoteResult from "./QuoteResult";

export const metadata = { title: "받은 견적 | 글로우메이트", robots: { index: false } };

export default async function QuoteResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuoteResult requestId={id} />;
}
