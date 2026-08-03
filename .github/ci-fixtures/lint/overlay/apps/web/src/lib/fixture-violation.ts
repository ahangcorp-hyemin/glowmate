// 위반 재현용. 사유 주석(`-- reason: <이슈 URL>`)이 없는 disable 이다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unsafeCast(value: unknown): any {
  return value;
}
