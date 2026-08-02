import type { Metadata } from 'next';
import Link from 'next/link';

import { listVenues, VENUE_CATEGORY_LABELS } from '@/lib/venues';

/**
 * 정적 페이지 라우트 ②: `/venues`
 *
 * 목록 데이터는 빌드 시점 상수이며 요청 시점 API 를 쓰지 않는다 →
 * `next build` 요약에 Static 으로 출력된다 (REQ-8 · FORBID-3).
 */

export const metadata: Metadata = {
  title: '업체 목록',
  description: '가격 기준이 정리된 업체 목록.',
};

export default function VenuesPage() {
  const venues = listVenues();

  return (
    <section>
      <h1>업체 목록</h1>
      <ul>
        {venues.map((venue) => (
          <li key={venue.slug}>
            <Link href={`/venues/${venue.slug}`}>{venue.name}</Link>
            <span>
              {' '}
              · {venue.district} · {VENUE_CATEGORY_LABELS[venue.category]}
            </span>
            <p>{venue.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
