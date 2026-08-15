"use client";

// 네이버 지도 v3(NCP) 스크립트 로더. 싱글톤 — 한 번만 로드하고 이후엔 캐시된 Promise 반환.
// 키는 공개키(ncpKeyId, 도메인 화이트리스트로 보호). NCP 콘솔에 서비스 URL 등록 필수.

declare global {
  interface Window { naver?: { maps: unknown } }
}

let loading: Promise<void> | null = null;

export function loadNaverMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.naver?.maps) return Promise.resolve();
  if (loading) return loading;

  const key = process.env.NEXT_PUBLIC_NAVER_MAP_KEY;
  if (!key) return Promise.reject(new Error("NEXT_PUBLIC_NAVER_MAP_KEY 미설정"));

  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    // 2025 변경: ncpClientId → ncpKeyId
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${key}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("네이버 지도 로드 실패")); };
    document.head.appendChild(s);
  });
  return loading;
}
