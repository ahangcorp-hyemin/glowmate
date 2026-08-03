# DS0 — 토큰 추출 경로와 실행 결과 (REQ-5)

> 판정 룰: [`verdict_rule.md`](./verdict_rule.md) §2.4 · `DS0-RULE-TOKEN-1`
> 검증: `node scripts/design-system/validate_ds0.mjs --check tokens`
> 선행 조건: `license.md` 의 3항목이 전부 `allowed` (FORBID-4)

---

## 1. 토큰이 배포되는 경로

| 층 | 패키지 | 포맷 | 이 실사의 채택 |
|---|---|---|---|
| 원본 소스 | `@seed-design/rootage-artifacts@2.3.0` | 당근 자체 포맷(Rootage YAML, `kind`/`metadata`/`data`) — **W3C DTCG 아님** | ✗ (변환기를 직접 써야 한다) |
| **소비 레이어** | **`@seed-design/css@2.3.0`** | **정적 CSS + CSS 커스텀 프로퍼티** | **✓ 이 경로로 추출했다** |
| Tailwind 매핑 | `@seed-design/tailwind4-theme@2.3.0` | Tailwind v4 `@theme` 매핑 CSS 1장 | △ DS1/DS3 이 소비 (본 실사의 추출 대상은 아니다) |

`@seed-design/css` 를 고른 이유:

- `dependencies: {}` · `peerDependencies: {}` — **런타임 의존성 0**, 빌드 플러그인 불필요
- 산출물이 정적 `.css` 이므로 값이 **그 자체로 원본**이다. 중간 변환기가 없으니 "해석된 값"이 끼어들 여지가 없다
- 원본 소스(Rootage YAML)를 쓰려면 DTCG 변환기를 새로 써야 하고, 그 변환기가 곧 해석 계층이 된다

## 2. 대상 파일

| 항목 | 값 |
|---|---|
| tarball | `https://registry.npmjs.org/@seed-design/css/-/css-2.3.0.tgz` |
| tarball integrity | `sha512-O5cOcr+yECVrySl7AlHj4xRMEGqehFkDlI3rjvMrIBrMEw/xM9QEhG5vy9Yyfq0mjIsNSXIdpEbabaqT8Ovd/A==` (실측 일치) |
| 파일 | `package/base.css` (60.5 KB) |
| 파일 sha256 | `74cdc603097077f558a167784bbb8e452e4d4671dac133e530bd7a0a6d63a5d9` |

`all.css`(406 KB) 가 아니라 `base.css` 를 쓴 이유: `all.css` 는 컴포넌트 **레시피 스타일**까지 포함한다.
G5 판정이 option_a 로 가면 컴포넌트 스타일은 쓰지 않으므로, 토큰 축의 근거로는 `base.css` 가 정확하다.

## 3. 추출 커맨드 (재실행 가능)

**리포 루트에서 아래 블록 전체를 그대로 실행하면 `docs/design-system/DS0/extracted_tokens.json` 이 재생성된다.**
타임스탬프를 넣지 않으므로 재실행 결과는 **바이트 단위로 동일**하다.
tarball 무결성이 어긋나면 파일을 쓰지 않고 예외로 중단한다 — 조용히 진행하지 않는다.

<!-- DS0-EXTRACT-CMD-BEGIN -->
```bash
node --input-type=module <<'NODE'
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

// ── 고정 입력 (license.md 와 동일한 핀) ────────────────────────────────
const PKG       = "@seed-design/css";
const VERSION   = "2.3.0";
const TARBALL   = `https://registry.npmjs.org/${PKG}/-/css-${VERSION}.tgz`;
const INTEGRITY = "sha512-O5cOcr+yECVrySl7AlHj4xRMEGqehFkDlI3rjvMrIBrMEw/xM9QEhG5vy9Yyfq0mjIsNSXIdpEbabaqT8Ovd/A==";
const ENTRY     = "package/base.css";
const OUT       = "docs/design-system/DS0/extracted_tokens.json";

// ── 1. tarball 취득 + 무결성 확인 (불일치면 중단한다) ──────────────────
const res = await fetch(TARBALL);
if (!res.ok) throw new Error(`${TARBALL} -> HTTP ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
const got = "sha512-" + createHash("sha512").update(buf).digest("base64");
if (got !== INTEGRITY) throw new Error(`tarball integrity 불일치\n  기대: ${INTEGRITY}\n  실제: ${got}`);

// ── 2. base.css 원문 추출 ─────────────────────────────────────────────
const dir = mkdtempSync(path.join(tmpdir(), "ds0-tokens-"));
writeFileSync(path.join(dir, "pkg.tgz"), buf);
const css = execFileSync("tar", ["-xzOf", path.join(dir, "pkg.tgz"), ENTRY], {
  maxBuffer: 1 << 28,
}).toString("utf8");

// ── 3. --seed-* 커스텀 프로퍼티 선언을 원본 그대로 수집 ────────────────
//     값은 파싱·해석·리네이밍하지 않는다. 선언 원문을 그대로 옮긴다.
const stack = [];
const tokens = [];
css.split(/\r?\n/).forEach((line, i) => {
  const m = line.match(/^\s*(--seed-[A-Za-z0-9_-]+)\s*:\s*([^;{}]+?)\s*;?\s*$/);
  if (m) {
    tokens.push({
      original_key: m[1],
      original_value: m[2],
      selector: stack.length ? stack[stack.length - 1] : "",
      source_line: i + 1,
    });
  }
  const opens = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  for (let k = 0; k < opens; k += 1) {
    const sel = line.slice(0, line.indexOf("{")).trim();
    stack.push(sel || (stack.length ? stack[stack.length - 1] : ""));
  }
  for (let k = 0; k < closes; k += 1) stack.pop();
});

// ── 4. 기록 ───────────────────────────────────────────────────────────
const out = {
  $meta: {
    _note: "DS0 REQ-5. 원본 값 그대로의 추출 결과다. 리네이밍·단위변환·색공간변환을 하지 않는다. 재실행하면 바이트 단위로 동일한 파일이 나온다(타임스탬프를 넣지 않는다).",
    source_package: PKG,
    source_version: VERSION,
    source_tarball: TARBALL,
    source_tarball_integrity: INTEGRITY,
    source_file: ENTRY,
    source_file_sha256: createHash("sha256").update(css).digest("hex"),
    extraction_command: "token_extraction.md 의 DS0-EXTRACT-CMD 블록",
    output_path: OUT,
    leaf_count: tokens.length,
  },
  tokens,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`leaf_count=${tokens.length} -> ${OUT}`);
NODE
```
<!-- DS0-EXTRACT-CMD-END -->

## 4. 추출 결과

| 항목 | 값 |
|---|---|
| 산출물 | [`extracted_tokens.json`](./extracted_tokens.json) (223 KB) |
| 리프 토큰 수 (`leaf_count`) | **874** (기준: 50 이상) |
| 고유 키 수 | 540 (라이트/다크 등 셀렉터별 중복 선언을 각각 별개 리프로 보존했다) |
| 셀렉터 컨텍스트 | 7종 — `:root`, `[data-seed-platform="ios"]`, `.seed-box`, `.seed-grid`, light/dark 색 모드 셀렉터 2종 등 |
| 빈 값 | 0건 |

리프 1건의 형태:

```json
{
  "original_key": "--seed-color-fg-brand",
  "original_value": "var(--seed-color-palette-carrot-500)",
  "selector": ":root, :root[data-seed-color-mode=\"system\"]...",
  "source_line": 1234
}
```

### 4.1 "원본 그대로"를 어떻게 보장했는가

- `original_key` 는 CSS 선언의 **좌변 문자열 그대로**다. 접두사 제거·카멜케이스 변환을 하지 않았다
- `original_value` 는 **우변 문자열 그대로**다. `var(...)` 참조를 해석해 최종 색으로 펼치지 않았고,
  `px` → `rem` 같은 단위 변환도, hex → oklch 같은 색공간 변환도 하지 않았다
- 같은 키가 라이트/다크에서 다른 값을 가지면 **두 개의 리프로 각각 보존**한다.
  하나로 합치는 순간 그것은 해석이다
- `selector` 와 `source_line` 을 함께 남겨 원본 위치로 되돌아갈 수 있게 했다

`--check tokens` 는 각 리프에 `original_key` · `original_value` 가 비어 있지 않은지,
`original_key` 가 `--seed-` 로 시작하는지, 리프 수가 50 이상인지를 검사한다.

### 4.2 다크 모드가 이미 쌍으로 들어 있다

`base.css` 는 색 토큰을 `:root`(라이트)와 `:root[data-seed-color-mode="dark-only"]` 등에서 각각 선언한다.
즉 **다크 모드 값이 추출 시점에 이미 확보**된다. DS1 이 별도로 다크 팔레트를 설계할 필요가 없다.

### 4.3 `carrot` 이 시맨틱 토큰에 물려 있다

`--seed-color-fg-brand` 는 `var(--seed-color-palette-carrot-500)` 을 가리킨다.
즉 브랜드 계열 시맨틱 토큰 전부가 `carrot` 팔레트를 참조한다.
`license.md` O-4(브랜드 컬러 교체)를 이행하려면 **팔레트 계층에서 `carrot-*` 을 교체**하면
시맨틱 계층은 그대로 따라온다. 이것이 DS1 의 brand 오버레이 설계 지점이다.

## 5. 이 실사에서 하지 않은 것

- 3계층(원시/시맨틱/컴포넌트) 토큰 설계와 우리 토큰 파일 작성 → **DS1 소관**
- Style Dictionary 파이프라인 구성 → **DS2 소관** (본 실사 결과 `@seed-design/tailwind4-theme` 가
  그 파이프라인의 산출물을 이미 배포하고 있음을 확인했다)
- Rootage YAML → W3C DTCG 변환기 작성 — 필요해지는 시점에 도입한다
