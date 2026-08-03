/**
 * DS0 SSR probe — Next.js 설정.
 *
 * `transpilePackages` 는 seed-design 자신의 문서 앱(daangn/seed-design `docs/next.config.mjs`)이 쓰는 설정과 같다.
 * 다만 **이 probe 에서는 이 설정을 제거해도 `next build` 가 exit 0 이었다**(실측 — ssr_probe.md "관측된 마찰" 절).
 * 상류와 동일한 조건에서 측정하기 위해 켠 채로 두고, 필수가 아니라는 사실을 문서에 남긴다.
 */
export default {
  transpilePackages: ['@seed-design/react'],
};
