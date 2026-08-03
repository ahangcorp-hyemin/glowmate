import type { NextConfig } from 'next';

/**
 * F1 REQ-8 / FORBID-3.
 *
 * 렌더링 기본값을 바꾸는 옵션(예: 전역 `fetchCache`, `dynamicIO` 강제)은 두지 않는다 —
 * 페이지 라우트는 App Router 기본값대로 정적(Static/ISR)으로 남아야 W1·W4 의 대량 정적 생성이 성립한다.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
