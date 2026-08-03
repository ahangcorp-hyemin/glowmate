# DS0 — 라이선스 실사 (REQ-2 · FORBID-4)

> 판정 룰: [`verdict_rule.md`](./verdict_rule.md) §2.1 · `DS0-RULE-LICENSE-1`
> 검증: `node scripts/design-system/validate_ds0.mjs --check license`

---

## 1. 고정된 대상

| 항목 | 값 |
|---|---|
| 저장소 | https://github.com/daangn/seed-design (branch `dev`) |
| `repo_commit_sha` | `9e6cbb9501d73f548d270df268edd72a96bf9161` (2026-08-02T16:24:41Z) |
| `package_version` (`@seed-design/css`) | **2.3.0** |
| `@seed-design/react` | 2.1.0 |
| `@seed-design/tailwind4-theme` | 2.3.0 |
| SPDX (npm 메타데이터 3종 전부) | `Apache-2.0` |

세 패키지 모두 tarball 을 직접 내려받아 registry 가 공표한 `integrity`(sha512)·`shasum`(sha1)과
**바이트 단위로 일치**함을 확인했다 → [`snapshots/license/npm-dist-metadata.json`](./snapshots/license/npm-dist-metadata.json)

## 2. 원문 스냅샷

원문은 **커밋 SHA 로 고정된 URL**에서 취득했다(브랜치 URL 은 내용이 바뀌므로 근거가 되지 못한다).

| 파일 | sha256 | 취득 URL |
|---|---|---|
| [`snapshots/license/seed-design-LICENSE.txt`](./snapshots/license/seed-design-LICENSE.txt) | `44b8c61c1d0f4fad76c7755a21e44067893ab23f5bcc2a0d7fbfdf1794e8d160` | `https://raw.githubusercontent.com/daangn/seed-design/9e6cbb9501d73f548d270df268edd72a96bf9161/LICENSE` |
| [`snapshots/license/seed-design-NOTICE.txt`](./snapshots/license/seed-design-NOTICE.txt) | `be1bd7fc9f5a9a803d0df6738b21ced46165dd22825fc24a68ca5dbdf24a8ec5` | `https://raw.githubusercontent.com/daangn/seed-design/9e6cbb9501d73f548d270df268edd72a96bf9161/NOTICE` |
| [`snapshots/license/npm-dist-metadata.json`](./snapshots/license/npm-dist-metadata.json) | `bf6424008018f345cfb051d17e1c9c92e837154bbde07bceeac88a31dea74256` | `https://registry.npmjs.org/@seed-design/{css,react,tailwind4-theme}` |

[`snapshots/license/SHA256SUMS`](./snapshots/license/SHA256SUMS) 로 3건을 한 번에 대조할 수 있다.

```bash
cd docs/design-system/DS0/snapshots/license && shasum -a 256 -c SHA256SUMS
```

## 3. 3항목 판정

<!-- DS0-LICENSE-BEGIN -->
```json
{
  "package": "@seed-design/css",
  "package_version": "2.3.0",
  "repo_commit_sha": "9e6cbb9501d73f548d270df268edd72a96bf9161",
  "spdx": "Apache-2.0",
  "snapshots": [
    {
      "path": "snapshots/license/seed-design-LICENSE.txt",
      "sha256": "44b8c61c1d0f4fad76c7755a21e44067893ab23f5bcc2a0d7fbfdf1794e8d160",
      "source": "https://raw.githubusercontent.com/daangn/seed-design/9e6cbb9501d73f548d270df268edd72a96bf9161/LICENSE"
    },
    {
      "path": "snapshots/license/seed-design-NOTICE.txt",
      "sha256": "be1bd7fc9f5a9a803d0df6738b21ced46165dd22825fc24a68ca5dbdf24a8ec5",
      "source": "https://raw.githubusercontent.com/daangn/seed-design/9e6cbb9501d73f548d270df268edd72a96bf9161/NOTICE"
    },
    {
      "path": "snapshots/license/npm-dist-metadata.json",
      "sha256": "bf6424008018f345cfb051d17e1c9c92e837154bbde07bceeac88a31dea74256",
      "source": "@seed-design/css@2.3.0"
    }
  ],
  "judgments": {
    "commercial_use": "allowed",
    "modification": "allowed",
    "redistribution": "allowed"
  },
  "extraction_allowed": true
}
```
<!-- DS0-LICENSE-END -->

### 3.1 `commercial_use` = `allowed`

NOTICE 원문 4행:

> 이 소프트웨어는 Apache License 2.0에 따라 배포되며, **상업적 목적을 포함하여 자유롭게 사용, 수정, 재배포할 수 있습니다.**

Apache-2.0 §2 가 부여하는 권리에 더해, 저작권자가 상업적 사용을 **명시적으로** 확인한 문장이다.

### 3.2 `modification` = `allowed`

동일 문장("수정")과 Apache-2.0 §4(b) — 수정한 파일에 변경 사실을 표기할 의무를 전제로 수정이 허용된다.

### 3.3 `redistribution` = `allowed`

동일 문장("재배포")과 NOTICE 5행:

> 재배포할 때에는 Apache License 2.0 제4조에 따라 라이선스 사본을 제공하고 이 파일에 담긴 귀속 고지를 전달해야 합니다.

**조건부이지만 허용이다.** 조건(라이선스 사본 + 귀속 고지 동봉)은 이행 가능한 의무이며,
"금지"도 "불명"도 아니다.

### 3.4 브랜드 리소스 조항을 `unclear` 로 보지 않은 이유

NOTICE 7행이 스스로 범위를 한정한다.

> 아래 "브랜드 리소스"에 관한 내용은 **상표에 관한 안내이며, Apache License 2.0이 정하는 조건을 변경하지 않습니다.**

브랜드 리소스의 정의는 **"로고, 상호명, 캐릭터 등 당근마켓이나 당근마켓의 제품으로 식별될 수 있는 모든 요소"** 이며,
이는 저작권 라이선스(코드·토큰의 사용/수정/재배포)가 아니라 상표권의 문제다.
따라서 3항목 판정은 `allowed` 이고, 상표 리스크는 **판정이 아니라 의무**로 아래에 적는다.

## 4. 이행해야 할 의무 (판정과 별개)

| # | 의무 | 근거 | 귀속 |
|---|---|---|---|
| O-1 | 배포물에 Apache-2.0 **라이선스 사본 + NOTICE 귀속 고지** 동봉 | Apache-2.0 §4(a)(d) · NOTICE 5행 | DS3 (wiring 단계) |
| O-2 | seed-design 파일을 **수정해서 재배포**하는 경우 변경 사실 표기 | Apache-2.0 §4(b) | DS3·DS4 |
| O-3 | 당근 **로고·상호명·캐릭터** 사용 금지 | NOTICE 9~11행 | 전 단계 (해당 자산을 쓰지 않는다) |
| O-4 | **`carrot` 브랜드 팔레트를 그대로 제품 브랜드 컬러로 쓰지 않는다** | NOTICE 17~18행 "당근마켓이 제공하는 제품 또는 서비스인 것처럼 오인하게 하는 사용" | **DS1** (토큰 계층에서 brand 오버레이로 교체) |

O-4 는 법적 확정이 아니라 **리스크 회피 판단**이다. 색상값 자체가 상표는 아니지만,
SEED 의 브랜드 컬러(`carrot`)를 그대로 서비스 브랜드 컬러로 쓰는 것은 위 조항에 근접한다.
이 판단은 `license` 축의 pass/fail 에 영향을 주지 않는다 — 축 판정은 §3 의 3항목만으로 결정된다.

## 5. 확인 불가로 남긴 것

| 항목 | 상태 | 영향 |
|---|---|---|
| 당근 브랜드 리소스 가이드라인 원문 | **확인 불가** — NOTICE 가 링크로만 제공(Notion). 접근 검증하지 않았다 | O-3·O-4 의 세부 경계. 3항목 판정에는 영향 없음(§3.4) |

## 6. FORBID-4 와의 관계

3항목 중 하나라도 `denied` 또는 `unclear` 였다면 `extraction_allowed=true` 를 기록할 수도,
`extracted_tokens.json` 을 커밋할 수도 없다. 현재 3항목 전부 `allowed` 이므로 `extraction_allowed=true` 다.
이 관계는 `validate_ds0.mjs --check license` 가 강제한다 —
`denied|unclear` 가 하나라도 있는데 `extraction_allowed=true` 이거나 `extracted_tokens.json` 이 존재하면 non-zero 로 종료한다.
