import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * 루트 레이아웃 (세그먼트 레이아웃 포함) — FORBID-3 대상 파일이다.
 * `dynamic` · `revalidate` · `fetchCache` 라우트 세그먼트 설정을 두지 않으므로
 * 하위 페이지 라우트는 App Router 기본값대로 정적으로 렌더된다.
 */

export const metadata: Metadata = {
  title: {
    default: 'glowmate',
    template: '%s · glowmate',
  },
  description: '뷰티 시술 가격을 같은 기준으로 비교하는 서비스.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header>
          <a href="/">glowmate</a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
