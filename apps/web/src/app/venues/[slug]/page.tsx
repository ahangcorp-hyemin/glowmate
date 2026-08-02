import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { findVenueBySlug, listVenues, VENUE_CATEGORY_LABELS } from '@/lib/venues';

/**
 * 정적(ISR) 페이지 라우트 ③: `/venues/[slug]`
 *
 * - `generateStaticParams` 로 빌드 시점에 전 slug 를 프리렌더한다 (SSG).
 * - `revalidate = 3600` 은 **1시간 주기 재생성(ISR)** 이다. FORBID-3 이 금지하는 것은
 *   revalidate 를 영(0)으로 두어 캐시를 해제하는 경우이며, 양수 revalidate 는 REQ-8 이 요구하는
 *   "Static 또는 ISR" 의 ISR 쪽에 해당한다.
 * - `dynamicParams = false` — 미등록 slug 는 온디맨드 렌더 대신 404 다. 존재하지 않는 업체가
 *   렌더되어 색인되는 경로를 막는다.
 */

export const revalidate = 3600;
export const dynamicParams = false;

interface VenueDetailPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return listVenues().map((venue) => ({ slug: venue.slug }));
}

export async function generateMetadata({ params }: VenueDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = findVenueBySlug(slug);

  if (venue === undefined) {
    return { title: '업체를 찾을 수 없습니다' };
  }

  return { title: venue.name, description: venue.summary };
}

export default async function VenueDetailPage({ params }: VenueDetailPageProps) {
  const { slug } = await params;
  const venue = findVenueBySlug(slug);

  if (venue === undefined) {
    notFound();
  }

  return (
    <article>
      <h1>{venue.name}</h1>
      <dl>
        <dt>지역</dt>
        <dd>{venue.district}</dd>
        <dt>카테고리</dt>
        <dd>{VENUE_CATEGORY_LABELS[venue.category]}</dd>
      </dl>
      <p>{venue.summary}</p>
      <p>
        <Link href="/venues">목록으로</Link>
      </p>
    </article>
  );
}
