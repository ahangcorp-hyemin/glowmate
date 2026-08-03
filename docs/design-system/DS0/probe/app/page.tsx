// DS0 SSR probe — 판정 페이지.
//
// 이 파일에는 "use client" 가 없다. 즉 **서버 컴포넌트**이며,
// 아래 seed-design 컴포넌트 6종은 서버 컴포넌트 트리 안에서 렌더된다.
// (seed-design 컴포넌트 자신은 "use client" 를 선언한 클라이언트 컴포넌트다 —
//  Next 는 이들을 SSR 로 HTML 프리렌더한 뒤 브라우저에서 hydrate 한다.)
//
// ⚠ 관측된 제약: namespace 형태 export(`Callout.Root` 처럼 쓰는 `Callout`·`Chip`·`Switch`)를
//    서버 컴포넌트에서 참조하면 `next build` 가 다음 오류로 실패한다.
//      "Attempted to call __exportAll() from the server but __exportAll is on the client."
//    평면 심볼(`CalloutRoot`·`ChipRoot`·`SwitchRoot` …)로 import 하면 정상 동작한다.
//    상세는 ssr_probe.md 의 "관측된 마찰" 절에 기록했다.
//
// 각 컴포넌트의 라벨 문자열은 probe/manifest.json 의 label 과 **문자 그대로** 일치해야 한다.
// DS0-RULE-SSR-1 이 JS 비활성 HTML 에서 이 문자열들을 세기 때문이다.
import {
  ActionButton,
  Badge,
  CalloutContent,
  CalloutDescription,
  CalloutRoot,
  CalloutTitle,
  ChipLabel,
  ChipRoot,
  SwitchControl,
  SwitchHiddenInput,
  SwitchLabel,
  SwitchRoot,
  SwitchThumb,
  Text,
} from '@seed-design/react';

export const dynamic = 'force-static';

export default function ProbePage() {
  return (
    <main id="ds0-probe-root">
      <h1>DS0 SSR probe</h1>

      <section>
        <ActionButton variant="brandSolid" size="medium">
          DS0-PROBE-ACTIONBUTTON
        </ActionButton>
      </section>

      <section>
        <Badge variant="weak" tone="informative" size="medium">
          DS0-PROBE-BADGE
        </Badge>
      </section>

      <section>
        <Text textStyle="t5Bold">DS0-PROBE-TEXT</Text>
      </section>

      <section>
        <CalloutRoot tone="informative">
          <CalloutContent>
            <CalloutTitle>DS0-PROBE-CALLOUT</CalloutTitle>
            <CalloutDescription>서버 컴포넌트 트리 안에서 렌더된 compound 컴포넌트</CalloutDescription>
          </CalloutContent>
        </CalloutRoot>
      </section>

      <section>
        <ChipRoot size="medium" variant="outlineWeak">
          <ChipLabel>DS0-PROBE-CHIP</ChipLabel>
        </ChipRoot>
      </section>

      <section>
        <SwitchRoot defaultChecked>
          <SwitchLabel>DS0-PROBE-SWITCH</SwitchLabel>
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
          <SwitchHiddenInput />
        </SwitchRoot>
      </section>
    </main>
  );
}
