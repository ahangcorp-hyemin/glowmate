import { NextResponse } from 'next/server';

/**
 * 동적 Route Handler: `GET /api/health`
 *
 * FORBID-3 의 적용 대상은 **페이지 라우트**(`src/app` 하위의 page.tsx 와 세그먼트 레이아웃)뿐이며,
 * Route Handler(`src/app/api` 하위) · Server Action · middleware 는 정의상 동적이므로 규칙 대상이 아니다
 * (F1.md FORBID-3 when 괄호 · docs/audit/f1-gate2.md §1 B-7).
 *
 * 이 핸들러가 존재하는 이유는 그 예외가 **실제로 작동함을 검증**하기 위해서다 —
 * F1 done_when: "Route Handler 가 동적이어도 test job 이 green". 아래 `force-dynamic` 이
 * test job 을 red 로 만든다면, 그 검사기가 페이지 라우트로 한정되지 않았다는 뜻이다.
 */
export const dynamic = 'force-dynamic';

interface HealthPayload {
  readonly status: 'ok';
  readonly checkedAt: string;
  readonly uptimeSeconds: number;
}

export function GET(): NextResponse<HealthPayload> {
  return NextResponse.json<HealthPayload>({
    status: 'ok',
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
}
