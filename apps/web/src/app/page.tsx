import Link from 'next/link';

import { listVenues } from '@/lib/venues';

/**
 * 정적 페이지 라우트 ①: `/`
 *
 * 요청 시점 API(`cookies()` · `headers()` · `searchParams`)와 캐시 해제 옵션을 쓰지 않으므로
 * `next build` 요약에 Static 으로 출력된다 (REQ-8 · FORBID-3).
 */
export default function HomePage() {
  const venues = listVenues();

  return (
    <section>
      <h1>같은 기준으로 비교하는 뷰티 시술 가격</h1>
      <p>등록된 업체 {venues.length}곳의 가격 기준을 정리하고 있습니다.</p>
      <p>
        <Link href="/venues">업체 목록 보기</Link>
      </p>
    </section>
  );
}
