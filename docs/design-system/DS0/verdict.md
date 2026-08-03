# DS0 — ⛔G5 판정 (REQ-6 · REQ-7)

> 판정 룰: [`verdict_rule.md`](./verdict_rule.md) — **실측보다 앞선 커밋으로 잠겨 있다**
> 검증: `node scripts/design-system/validate_ds0.mjs --check verdict --check appendix --check evidence`

---

## ▶ 판정: **`option_a`** — seed-design 은 **토큰만** 채택, 컴포넌트는 **shadcn/ui 로 소유**

적용 룰: `DS0-RULE-G5-1`
> `option_b ⟺ license=pass ∧ ssr_compat=pass ∧ coverage=pass` · 그 외는 `option_a`

`coverage` 가 fail 이므로 `option_a` 다. **판정을 가른 것은 커버리지 단 하나다** —
라이선스도 SSR 호환성도 문제가 없었다.

## 1. 축별 판정

| axis | value | rule_id | 실측값 | 기준 | 근거 |
|---|---|---|---|---|---|
| `license` | **pass** | `DS0-RULE-LICENSE-1` | commercial_use/modification/redistribution = allowed/allowed/allowed | 3항목 전부 `allowed` | [`snapshots/license/seed-design-NOTICE.txt`](./snapshots/license/seed-design-NOTICE.txt) |
| `ssr_compat` | **pass** | `DS0-RULE-SSR-1` | build_exit=0 · hydration 경고 0 · 라벨 6/6 · 컴포넌트 6종 | exit 0 ∧ 경고 0 ∧ 라벨 누락 0 ∧ 5종 이상 | [`probe/logs/build.log`](./probe/logs/build.log) |
| `coverage` | **fail** | `DS0-RULE-COVERAGE-1` | **83.3%** (10/12) | ≥ 90.0% | [`coverage.csv`](./coverage.csv) |
| `token_extractability` | **pass** | `DS0-RULE-TOKEN-1` | 리프 874개 · extraction_allowed=true | ≥ 50 ∧ extraction_allowed | [`extracted_tokens.json`](./extracted_tokens.json) |

부재 컴포넌트 2종: **Card** · **Pagination**.
`Card` 는 이 제품의 시그니처(가격 비교 카드)의 기반이고, `Pagination` 은 SEO 목록 페이지의 필수 요소다.
둘 다 화면 골격이며, 라이브러리 밖에서 소유하면 두 개의 컴포넌트 체계를 동시에 유지하게 된다 —
`verdict_rule.md` §2.3 이 90.0% 를 임계로 잡은 근거가 정확히 이 상황이다.

<!-- DS0-VERDICT-BEGIN -->
```json
{
  "verdict": "option_a",
  "verdict_rule_id": "DS0-RULE-G5-1",
  "decided_at_utc": "2026-08-03",
  "axes": {
    "license": {
      "value": "pass",
      "rule_id": "DS0-RULE-LICENSE-1",
      "evidence_ref": "snapshots/license/seed-design-NOTICE.txt"
    },
    "ssr_compat": {
      "value": "pass",
      "rule_id": "DS0-RULE-SSR-1",
      "evidence_ref": "probe/logs/build.log"
    },
    "coverage": {
      "value": "fail",
      "rule_id": "DS0-RULE-COVERAGE-1",
      "evidence_ref": "coverage.csv"
    },
    "token_extractability": {
      "value": "pass",
      "rule_id": "DS0-RULE-TOKEN-1",
      "evidence_ref": "extracted_tokens.json"
    }
  },
  "evidence": [
    {
      "axis": "license",
      "evidence_ref": "snapshots/license/seed-design-LICENSE.txt",
      "sha256": "44b8c61c1d0f4fad76c7755a21e44067893ab23f5bcc2a0d7fbfdf1794e8d160",
      "source": "https://raw.githubusercontent.com/daangn/seed-design/9e6cbb9501d73f548d270df268edd72a96bf9161/LICENSE"
    },
    {
      "axis": "license",
      "evidence_ref": "snapshots/license/seed-design-NOTICE.txt",
      "sha256": "be1bd7fc9f5a9a803d0df6738b21ced46165dd22825fc24a68ca5dbdf24a8ec5",
      "source": "https://raw.githubusercontent.com/daangn/seed-design/9e6cbb9501d73f548d270df268edd72a96bf9161/NOTICE"
    },
    {
      "axis": "license",
      "evidence_ref": "snapshots/license/npm-dist-metadata.json",
      "sha256": "bf6424008018f345cfb051d17e1c9c92e837154bbde07bceeac88a31dea74256",
      "source": "@seed-design/css@2.3.0"
    },
    {
      "axis": "ssr_compat",
      "evidence_ref": "probe/logs/build.log",
      "sha256": "5f6119c675e148215eb453addafe0c060e148da82354d75886e50d17568b65ca",
      "source": "next@15.5.22 · @seed-design/react@2.1.0"
    },
    {
      "axis": "ssr_compat",
      "evidence_ref": "probe/logs/console.log",
      "sha256": "fab6375ad43f3624f04bd87f9b7a69274e50fc70273f68071566eefe28704fcb",
      "source": "next@15.5.22 · @seed-design/react@2.1.0"
    },
    {
      "axis": "ssr_compat",
      "evidence_ref": "probe/logs/nojs.html",
      "sha256": "e19bc44b6fd932e271ed3ee870bfe4e88cb47c95db6a5311c43ed80bf3499754",
      "source": "next@15.5.22 · @seed-design/react@2.1.0"
    },
    {
      "axis": "ssr_compat",
      "evidence_ref": "probe/manifest.json",
      "sha256": "d509b6eca89441b929ee83859c0a50c0c980f704b9d776be8f2153e926a24bbf",
      "source": "@seed-design/react@2.1.0"
    },
    {
      "axis": "coverage",
      "evidence_ref": "coverage.csv",
      "sha256": "8914b9339a91d0af6165ba72990ec50e4219b9f04e4cc6e23476361db10e117d",
      "source": "@seed-design/react@2.1.0"
    },
    {
      "axis": "token_extractability",
      "evidence_ref": "extracted_tokens.json",
      "sha256": "d7be140e903b9863f0b3aaa93deaac795a2f8ceda97b3cf671b776a5f0df0daf",
      "source": "@seed-design/css@2.3.0"
    }
  ]
}
```
<!-- DS0-VERDICT-END -->

## 2. 이 판정이 뜻하지 않는 것

- seed-design 의 품질 문제가 아니다. **적합성** 문제다. 부재한 것은 정보 밀도형 웹 컴포넌트이고,
  대신 모바일 커머스 앱용 컴포넌트(BottomSheet · PullToRefresh · FAB)와 당근 도메인 종속
  컴포넌트(`MannerTemp` · `Celsius`)가 카탈로그를 채우고 있다.
- SSR 이 안 된다는 뜻이 아니다. `ssr_compat` 은 **pass** 이며, 마찰 3건은 전부 회피 가능했다
  ([`ssr_probe.md`](./ssr_probe.md) §4).
- 토큰을 못 쓴다는 뜻이 아니다. 정반대다 — 토큰 레이어는 채택 비용이 사실상 0이고,
  이 실사에서 확인한 seed-design 의 최대 강점이다.

## 3. 재판정 트리거

`verdict_rule.md` §6 에 잠긴 조건 그대로다.

1. 실사 기준일(**2026-08-03**)로부터 **12주 경과** → 2026-10-26 이후
2. `@seed-design/css` **메이저 버전 변경** (현재 2.3.0)
3. `coverage.csv` 의 부재 2종(`Card` · `Pagination`)이 상류에 추가되어 충족률이 90.0% 이상이 되는 경우

3번은 실제로 가능성이 있다 — 저장소 활동이 매우 높다(최근 52주 커밋 1,104건, 주당 최대 48건).
재판정 시에도 `verdict_rule.md` 를 고치지 않고 `rule_set_version` 을 올린 새 룰과 새 lock 을 만든다.

---

# 부록 — `option_a` 대응 (REQ-7)

## A. shadcn/ui 로 소유할 컴포넌트

`coverage.csv` 의 12종 전부를 **shadcn/ui 프리미티브로 소유**한다.
seed-design 에 있는 10종까지 shadcn 으로 가져가는 이유는 두 체계 혼용을 피하기 위해서다 —
컴포넌트 레이어가 두 규약으로 갈리면 커스터마이즈 마찰이 컴포넌트마다 달라진다.

| 컴포넌트 | seed 존재 | 소유 방식 | 비고 |
|---|---|---|---|
| Button | ✅ | shadcn/ui `button` | |
| **Card** | ❌ | shadcn/ui `card` | **판정을 가른 부재 1** — 가격 비교 카드의 기반 |
| Badge | ✅ | shadcn/ui `badge` | |
| Chip | ✅ | shadcn/ui `badge` 파생 | shadcn 에 Chip 이 없어 badge 를 파생한다 |
| Input | ✅ | shadcn/ui `input` | |
| Select | ✅ | shadcn/ui `select` | |
| Checkbox | ✅ | shadcn/ui `checkbox` | |
| Radio | ✅ | shadcn/ui `radio-group` | |
| Tabs | ✅ | shadcn/ui `tabs` | |
| Dialog | ✅ | shadcn/ui `dialog` | |
| Tooltip | ✅ | shadcn/ui `tooltip` | |
| **Pagination** | ❌ | shadcn/ui `pagination` | **판정을 가른 부재 2** — SEO 목록 페이지 필수 |

실제 설치·초기화는 **DS3 소관**이다. 이 표는 판정의 귀결을 적은 것이며 구현 지시가 아니다.

## B. `extracted_tokens.json` → glowmate primitive 매핑 (32행)

좌변은 전부 [`extracted_tokens.json`](./extracted_tokens.json) 에 **실재하는 키**다
(`--check appendix` 가 부분집합 여부를 전수 검사한다).
우변 이름은 **DS1 이 확정할 3계층 설계의 입력**이며, 이 문서가 이름을 확정하지 않는다.

<!-- DS0-APPENDIX-MAPPING-BEGIN -->
| seed 토큰 키 | glowmate primitive | 쓰임 |
|---|---|---|
| `--seed-color-fg-brand` | `color.fg.brand` | 브랜드 텍스트/아이콘 |
| `--seed-color-fg-neutral` | `color.fg.default` | 본문 기본 전경색 |
| `--seed-color-fg-neutral-muted` | `color.fg.muted` | 보조 텍스트 |
| `--seed-color-fg-neutral-subtle` | `color.fg.subtle` | 3차 텍스트 |
| `--seed-color-fg-placeholder` | `color.fg.placeholder` | 입력 플레이스홀더 |
| `--seed-color-fg-disabled` | `color.fg.disabled` | 비활성 전경 |
| `--seed-color-fg-critical` | `color.fg.critical` | 오류 텍스트 |
| `--seed-color-fg-positive` | `color.fg.positive` | 성공 텍스트 |
| `--seed-color-fg-warning` | `color.fg.warning` | 경고 텍스트 |
| `--seed-color-bg-brand-solid` | `color.bg.brand.solid` | 주요 CTA 배경 |
| `--seed-color-bg-brand-solid-pressed` | `color.bg.brand.solid.pressed` | CTA press 상태 |
| `--seed-color-bg-brand-weak` | `color.bg.brand.weak` | 브랜드 약배경 |
| `--seed-color-bg-critical-solid` | `color.bg.critical.solid` | 파괴적 액션 배경 |
| `--seed-color-bg-disabled` | `color.bg.disabled` | 비활성 배경 |
| `--seed-color-bg-layer-default` | `color.bg.surface` | 카드/표면 배경 |
| `--seed-color-bg-layer-basement` | `color.bg.canvas` | 페이지 바닥 배경 |
| `--seed-color-stroke-neutral-muted` | `color.border.default` | 기본 경계선 |
| `--seed-color-stroke-neutral-subtle` | `color.border.subtle` | 약한 경계선 |
| `--seed-color-stroke-brand-solid` | `color.border.brand` | 브랜드 경계선 |
| `--seed-color-stroke-focus-ring` | `color.border.focus` | 포커스 링 — 접근성 판정 대상 |
| `--seed-radius-r2` | `radius.sm` | 작은 모서리 |
| `--seed-radius-r3` | `radius.md` | 카드 모서리 |
| `--seed-radius-r4` | `radius.lg` | 큰 모서리 |
| `--seed-radius-full` | `radius.full` | pill/원형 |
| `--seed-dimension-x2` | `space.2` | 간격 스케일 |
| `--seed-dimension-x3` | `space.3` | 간격 스케일 |
| `--seed-dimension-x4` | `space.4` | 간격 스케일 |
| `--seed-dimension-x6` | `space.6` | 간격 스케일 |
| `--seed-font-size-t4` | `font.size.body` | 본문 크기 |
| `--seed-font-size-t6` | `font.size.heading.sm` | 소제목 크기 |
| `--seed-line-height-t4` | `font.lineHeight.body` | 본문 행간 |
| `--seed-font-weight-bold` | `font.weight.bold` | 굵기 |
<!-- DS0-APPENDIX-MAPPING-END -->

### B-1. `brand` 계열은 그대로 쓸 수 없다

`--seed-color-fg-brand` 의 원본 값은 `var(--seed-color-palette-carrot-500)` 이다.
brand 계열 시맨틱 토큰 전부가 당근 브랜드 팔레트(`carrot`)를 참조하므로,
[`license.md`](./license.md) O-4 에 따라 **팔레트 계층에서 `carrot-*` 을 교체**해야 한다.
시맨틱 계층은 참조를 유지하므로 교체가 자동으로 전파된다. 이 오버레이 설계가 **DS1 의 입력**이다.

## C. 이 판정이 하류에 남기는 것

| 태스크 | 이 판정이 정하는 것 | 이 판정이 정하지 않는 것 |
|---|---|---|
| DS1 | 토큰 원천 = `@seed-design/css@2.3.0` · carrot 교체 의무 · 위 32행 매핑이 입력 | 3계층 구조·최종 토큰 이름 |
| DS3 | 컴포넌트 레이어 = shadcn/ui · `@seed-design/react` 미채택 · Apache-2.0 고지 의무(O-1) | 설치 절차·디렉터리 구조 |
| DS4~DS7 | 컴포넌트 베이스가 shadcn/ui 프리미티브 조합이라는 전제 | 개별 컴포넌트 설계 |
