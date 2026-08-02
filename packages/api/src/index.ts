/**
 * 빈 스캐폴드 패키지 (F1 REQ-3 / out_of_scope).
 *
 * packages/api 는 REQ-3 의 제외 집합 두 패키지 중 하나로, DB 접근을 보유할 수 있다.
 * 다만 조회 함수·zod 계약 구현은 F5-API-LAYER 소관이며 F1 은 경계만 세운다.
 *
 * 이 패키지가 존재해야 하는 이유는 F5 이전에도 boundary job 이
 * "제외 집합이 정확히 {packages/api, packages/db} 다"를 판정할 대상을 가져야 하기 때문이다.
 */

/** F5 가 채울 조회 계층의 자리. 값이 아니라 경계를 표시한다. */
export const API_SCAFFOLD = true as const;
