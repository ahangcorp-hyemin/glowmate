// DS0 SSR probe — 루트 레이아웃 (서버 컴포넌트).
// "use client" 가 없다는 점이 중요하다: 아래 트리는 서버 컴포넌트 트리이며,
// seed-design 컴포넌트는 그 안으로 import 되는 클라이언트 컴포넌트다.
import '@seed-design/css/all.min.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'DS0 SSR probe',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" data-seed data-seed-user-color-scheme="light" data-seed-color-mode="light">
      <body>{children}</body>
    </html>
  );
}
