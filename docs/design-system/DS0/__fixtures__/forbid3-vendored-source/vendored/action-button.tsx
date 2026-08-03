// [FIXTURE] 합성 파일 — 실제 상류 소스가 아니다.
// 벤더링된 컴포넌트 소스의 표지(내부 레시피 CSS import)를 의도적으로 담는다.
// `--check no-vendored` 가 이 파일을 잡지 못하면 FORBID-3 은 장식이다.
import { actionButton } from "@seed-design/css/recipes/action-button";

export const FxButton = () => actionButton;
