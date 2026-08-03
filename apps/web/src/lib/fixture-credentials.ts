// 위반 재현용 가짜 자격증명 (REQ-5 픽스처 ⑤). 실재하지 않는 값이다.
//
// 주의: `AKIAIOSFODNN7EXAMPLE` 은 AWS 공식 문서의 예제 키라 gitleaks 가 기본 allowlist 로
// 제외한다 — 그 값을 쓰면 픽스처가 secret-scan 을 red 로 만들지 못한다(실측으로 확인했다).
// 그래서 allowlist 되지 않는 형식의 값을 쓴다.
export const GITHUB_TOKEN = 'ghp_R7kQ2mVx9LtZaB4NcW1yPjE6sHdG0fUiO3Xn';
export const AWS_ACCESS_KEY_ID = 'AKIA4KQZ7XNVJRPLM2WD';
export const AWS_SECRET_ACCESS_KEY = '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';
