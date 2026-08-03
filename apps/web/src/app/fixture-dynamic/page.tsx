// 위반 재현용: 페이지 라우트의 렌더링 기본값을 동적으로 전환한다 (FORBID-3).
export const dynamic = 'force-dynamic';

export default function FixtureDynamicPage() {
  return <main>fixture</main>;
}
