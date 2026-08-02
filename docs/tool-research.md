# 태스크 관리 도구 실사 (2026-08-03)

> 목적: glowmate 태스크(현재 `docs/tasks.json` 기준 **33건**, 목표 40건)를 "태스크 1건 = PR 1개"로 관리하되,
> **의존관계 DAG가 도구 안에서 1급 시민으로 표현**되고 자동화 에이전트가 API/CLI로 갱신할 수 있어야 한다.
>
> **검증 등급 표기**
> - 🟢 **실측**: 이 머신에서 직접 명령을 실행해 확인 (가장 강한 근거)
> - 🔵 **1차 출처**: 공식 문서·체인지로그·소스코드 원문 확인
> - 🟡 **2차 출처**: 블로그·커뮤니티 등
> - ⚪ **확인 불가**

---

## 0. 결론 요약

**1순위 권고: GitHub Issues (네이티브 dependencies) + Projects v2 보드.**

판단이 갈린 지점은 단 하나 — **"blocked by 관계가 도구의 데이터 모델에 존재하는가, 아니면 내가 흉내내야 하는가"**.

| 도구 | 의존관계의 실체 |
|---|---|
| **GitHub** | **네이티브 1급 관계.** `Issue.blockedBy` / `Issue.blocking` 이 GraphQL 스키마의 실제 필드, `addBlockedBy` 가 실제 mutation. 🟢 실측 확인 |
| Linear | 네이티브 관계 있음 (`issueRelationCreate`, type `blocks`). 다만 공식 MCP의 관계 툴 노출 여부 ⚪ |
| Notion | **없음.** 범용 DB relation으로 *흉내내는* 것. "blocked" 의미론·순환 감지·전이 조회 전부 자체 구현 |
| Plane | UI엔 있으나 **공개 API v1에 relation 엔드포인트 부재** → 자동화 불가 (실격) |
| Height | **서비스 종료** (2025-09-24 데이터 삭제 완료) — 후보 제외 |
| Huly | 클라우드 종료(2026-07경), 셀프호스트만 생존. 의존관계 API ⚪ |
| Vikunja | `PUT /tasks/{id}/relations` 로 가능. 단 셀프호스트 + PR 연동 없음 |

Notion은 "MCP가 이미 붙어 있어 유리하다"는 초기 가설이 **실사 결과 뒤집혔다**. 붙어 있는 것은 *편집기*이지 *이슈 트래커*가 아니다 (§3 참조).

---

## 1. GitHub Issues + Projects — 🟢 실측 중심

### 1.1 의존관계: 네이티브 지원, GA 상태

- **GA 시점: 2025-08-21.** "Dependencies on issues are now generally available... You can link up to **50 issues for each relationship type**." 🔵
  - <https://github.blog/changelog/2025-08-21-dependencies-on-issues/>
  - 공개 프리뷰 피드백 스레드에서 GA 선언 재확인: <https://github.com/orgs/community/discussions/165749>

**🟢 GraphQL 스키마 실측** (이 머신에서 introspection 실행):

```
$ gh api graphql -f query='{ __type(name:"Mutation"){ fields{ name } } }' | grep -iE "block|subissue"
addBlockedBy      removeBlockedBy
addSubIssue       removeSubIssue      reprioritizeSubIssue

$ gh api graphql -f query='{ __type(name:"AddBlockedByInput"){ inputFields{ name } } }'
→ clientMutationId, issueId (ID!), blockingIssueId (ID!)

$ gh api graphql -f query='{ __type(name:"Issue"){ fields{ name } } }' | grep -iE "block|sub|parent"
blockedBy   blocking   issueType   parent   subIssues   subIssuesSummary
```

**🟢 실 데이터 읽기 검증** (공개 리포에 대해 실제 질의 성공):

```
$ gh api graphql -f query='{ repository(owner:"cli",name:"cli"){ issue(number:11757){
    blockedBy(first:5){ totalCount nodes{ number } } blocking(first:5){ totalCount } } } }'
{"data":{"repository":{"issue":{"blockedBy":{"totalCount":0,...},"blocking":{"totalCount":0}}}}}
```

REST 엔드포인트도 존재 🔵 (<https://docs.github.com/en/rest/issues/issue-dependencies>):

| Method | Path |
|---|---|
| GET / POST | `/repos/{owner}/{repo}/issues/{n}/dependencies/blocked_by` |
| DELETE | `/repos/{owner}/{repo}/issues/{n}/dependencies/blocked_by/{issue_id}` |
| GET | `/repos/{owner}/{repo}/issues/{n}/dependencies/blocking` |

### 1.2 `gh` CLI — 🟢 이 머신에서 이미 사용 가능

로컬 `gh` 버전 **2.96.0** (요구 최소치 2.94.0 초과) — 🔵 <https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/> ("Anyone on GitHub CLI v2.94.0 or later can use the new hierarchy and dependency support" = GA)

🟢 `--help` 실측 출력:

```
gh issue create:
  --blocked-by numbers   Mark the new issue as blocked by these issue numbers or URLs
  --blocking   numbers   Mark the new issue as blocking these issue numbers or URLs
  --parent     number    Add the new issue as a sub-issue of the specified parent
  --type       name      Set the issue type by name

gh issue edit:
  --add-blocked-by / --remove-blocked-by
  --add-blocking   / --remove-blocking
  --parent / --remove-parent

gh issue view/list --json 사용 가능 필드:
  ..., blockedBy, blocking, issueType, parent, subIssues, subIssuesSummary, ...
```

즉 **읽기(`--json blockedBy`)와 쓰기(`--add-blocked-by`) 양방향이 CLI 한 줄로 끝난다.** 이게 다른 후보와 갈리는 결정적 지점이다.

### 1.3 ⚠️ 실사에서 발견한 함정 — `is:blocked` 검색 필터를 믿지 마라

여러 2차 자료(및 본 실사의 보조 조사)가 "`is:blocked` 검색 필터로 막힌 이슈를 걸러낼 수 있다"고 기술한다. **🟢 직접 검증한 결과 거짓이다.**

```
$ gh api -X GET search/issues -f q='repo:cli/cli is:issue is:open is:blocked'   → total_count 64
$ gh api -X GET search/issues -f q='repo:cli/cli is:issue is:open'              → total_count 988
$ gh api -X GET search/issues -f q='repo:cli/cli is:issue is:open -is:blocked'  → total_count 988  ← 부정이 안 먹음

# 위 64건이 정말 blocked인지 GraphQL로 대조:
issue 13904: blockedBy=0
issue 13881: blockedBy=0
issue 13820: blockedBy=0
issue 13819: blockedBy=0
issue 13818: blockedBy=0        ← 전부 의존관계 없음 = 전부 오탐

$ gh issue list -R cli/cli --search "is:open is:blocked" --json number   → []   ← REST와 결과 불일치
```

또한 공식 docs의 dependency 페이지에도 `is:blocked` 검색 한정자는 **기재되어 있지 않다** 🔵
(<https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies>).

→ **대응**: 준비 큐(ready queue)는 검색 한정자가 아니라 **`blockedBy` 필드를 읽어 클라이언트에서 계산**한다. §6.3에 스크립트를 넣었다. (이 경로는 🟢 실측으로 동작 확인)

### 1.4 Projects v2 (보드) — 사람용 뷰

- 레이아웃: **Table / Board(칸반) / Roadmap** 🔵 <https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/changing-the-layout-of-a-view>
- 항목 상한 1,200 → **50,000**으로 확대, Insights 전 플랜 개방 🟡 (33~40건에는 무관)
- **한계 (중요)**: 의존관계는 **Projects의 필드가 아니다.** 따라서 보드에서 blocked 여부로 **group/filter/sort 할 수 없다.** 커뮤니티 GA 스레드에서도 "dependencies are not yet available as native project table fields", 로드맵 뷰에 의존 화살표 없음이 미해결 요청으로 남아 있다 🔵 <https://github.com/orgs/community/discussions/165749>
  - 다만 **blocked 아이콘은 보드 카드와 Issues 목록에 표시된다** 🔵 (공식 docs: "Blocked issues are marked with a 'Blocked' icon on your project boards or repository's Issues page").
  - **완화책**: `blocked` 라벨 또는 Status 필드를 스크립트가 `blockedBy` 기준으로 동기화해주면 보드에서 필터링 가능해진다 (§6.3).
- `gh project` 서브커맨드 완비(`item-add`, `field-create`, `item-edit` 등) 🟢. 단 **토큰에 `project` 스코프 필요** — 현재 로컬 토큰 스코프는 `gist, read:org, repo` 뿐이라 🟢 `gh auth refresh -s project` 가 필요하다.

### 1.5 GitHub MCP 서버 — 의존관계 툴은 **feature flag 뒤에 있다** 🔵

이건 문서 표면에 안 드러나서 소스를 직접 읽어 확인했다.

```
$ gh api search/code -f q='repo:github/github-mcp-server blocked_by'
→ pkg/github/issue_dependencies.go
  pkg/github/__toolsnaps__/issue_dependency_read_ff_issue_dependencies.snap
  pkg/github/__toolsnaps__/issue_dependency_write_ff_issue_dependencies.snap
  docs/feature-flags.md
```

`pkg/github/feature_flags.go` 원문 🔵:

```go
// FeatureFlagIssueDependencies is the feature flag name for the issue dependency
// tools (issue_dependency_read / issue_dependency_write) ... It is gated so these
// tools are not advertised in the default surface ... unless explicitly opted in.
const FeatureFlagIssueDependencies = "issue_dependencies"

var AllowedFeatureFlags = []string{ ..., FeatureFlagIssueDependencies }   // ← 사용자 토글 가능
```

- 플래그 켜는 법 🔵 (`docs/feature-flags.md`): 원격 서버는 헤더 `X-MCP-Features: issue_dependencies`, 로컬은 `--features=` 또는 `GITHUB_FEATURES=`.
- `issue_dependency_write` 툴 스키마 🔵: `method`(add/remove) × `type`(**blocked_by** / **blocking**) + `related_owner`/`related_repo`(교차 리포 지원 시사).
- 원격 서버 URL: `https://api.githubcopilot.com/mcp/`, 툴셋별 URL도 제공(`/x/issues`, `/x/projects`). 최신 릴리스 **v1.8.0 (2026-07-30)** 🟢
- <https://github.com/github/github-mcp-server>

> **주의**: MCP는 *있으면 좋은* 보조 수단이다. 우리 파이프라인의 정본 경로는 `gh` CLI + GraphQL이며 이건 MCP 없이도 완결된다.

### 1.6 비용 / PR 연결

- **비용 $0.** Free 플랜에 private repo 무제한, Issues·Projects 포함 🟡
- **PR 연결이 구조적으로 공짜**: PR 본문에 `Closes #12` 만 넣으면 머지 시 이슈 자동 종료 → **의존관계가 자동으로 해소되어 하류 태스크가 준비 큐로 올라온다.** 이 되먹임 고리는 GitHub 밖 도구에서는 전부 웹훅으로 직접 배선해야 한다.
- `gh issue view --json closedByPullRequestsReferences` 로 태스크↔PR 역추적 가능 🟢

---

## 2. Linear

| 항목 | 내용 | 등급 |
|---|---|---|
| 공식 MCP | `claude mcp add --transport http linear-server https://mcp.linear.app/mcp` (OAuth 2.1). `/sse`는 deprecated fallback | 🔵 <https://linear.app/docs/mcp> |
| 관계 API | `issueRelationCreate(input:{ issueId, relatedIssueId, type })`, `IssueRelationType` = `blocks` \| `duplicate` \| `related`. **`blockedBy` enum 값은 없고 방향을 뒤집어 표현** | 🔵/🟡 |
| **MCP가 관계 툴을 노출하는가** | **⚪ 확인 불가.** 공식 문서에 툴 목록이 이름 단위로 없고, 2025-05·2026-02·2026-04·2026-07 체인지로그 어디에도 dependency 툴 추가 언급 없음. 공식 예시 프롬프트에 "add related relationships ... do not invent dependencies" 문구가 있어 *정황상* 가능해 보이나 확정 불가 → 확실히 하려면 GraphQL 직접 호출 | ⚪ |
| Free 플랜 | 비아카이브 이슈 **250개**, 팀 2개, 멤버 무제한, API/webhook 포함 (40건에 충분) | 🔵 <https://linear.app/pricing> |
| ⚠️ 상충 정보 | 다수 SEO성 블로그가 "2026-02부터 Free 10명 제한"이라 주장하나 **공식 가격 페이지 직접 확인 결과 "Unlimited members"** — 2차 자료가 부정확한 것으로 판단 | 🔵 vs 🟡 |
| PR 연결 | 브랜치명/PR 제목에 이슈 ID → 자동 링크. 매직워드 `closes/fixes/resolves/implements...` 지원 | 🔵 <https://linear.app/docs/github> |
| 공식 CLI | **없음.** 전부 서드파티(`schpet/linear-cli`, `linearis` 등) | 🔵 |

**평가**: 의존관계 자체는 진짜다. 하지만 (a) 신규 SaaS 계정 + OAuth 도입 마찰, (b) 공식 CLI 부재로 셸 자동화가 GraphQL 수기 호출이 됨, (c) MCP의 관계 툴 지원이 미확정, (d) 태스크 정본이 이미 git 안에 있는데 상태만 외부 SaaS로 나감. **GitHub 대비 순이득이 없다.**

---

## 3. Notion — 초기 가설이 뒤집힌 지점

"MCP가 이미 붙어 있으니 유리하다"는 전제로 시작했으나, **의존관계 축에서 가장 약한 후보**로 판명됐다.

**긍정 (예상보다 나았던 점)**
- self-referencing relation 가능, **relation 속성을 API로 생성 가능** ✅ — `relation.type = "dual_property"`(양방향) / `"single_property"`(단방향)을 API로 지정 가능. "relation은 UI에서만 만들 수 있다"는 통념은 **사실이 아님** 🔵
  - 단 2025-09-03 API 버전부터 `database_id` → `data_source_id` 로 파괴적 변경 🔵 <https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03>
- 타임라인 뷰에서 "Depends on" 속성 기반 **의존 화살표를 그려준다** (GitHub Roadmap 뷰에는 없는 것) 🟡
- 칸반 보드 전 플랜 사용 가능, 1인 워크스페이스 사실상 무제한 🟡
- GitHub PR 연동 네이티브 속성 존재 🔵

**결정적 부정**
1. **의미론이 없다.** `blocked_by`는 그냥 이름 붙인 relation이다. "막힌 이슈"라는 개념이 시스템에 없으므로 blocked 아이콘도, 상태 전파도, 링크 무결성 검사도 없다.
2. **전이적 조회 불가.** rollup의 rollup이 **공식적으로 금지**되어 있다 — Notion 공식: *"Unfortunately not, as this could create unintended loops."* 🔵 <https://www.notion.com/help/relations-and-rollups>
   → 우리의 G1~G5 게이트/B1~B7 배치는 본질적으로 **전이적 도달가능성 질의**다. Notion 안에서는 계산할 수 없고 전부 밖으로 끌어내 계산해야 한다.
3. **순환 감지 없음.** DAG 무결성을 도구가 지켜주지 않는다.
4. **공식 MCP에 relation 값 세팅 버그가 열려 있다** — `makenotion/notion-mcp-server` issue #45 (open): relation 값을 문자열로 잘못 포맷해 실패 🔵
5. API rate limit 평균 **3 req/s** + 워크스페이스당 5분에 1,000 요청 🔵 <https://developers.notion.com/reference/request-limits>

**결론**: DAG 엔진을 우리가 직접 만들어 Notion에 *렌더링*하는 꼴이 된다. 그럴 거면 정본(`docs/tasks.json`)이 이미 git에 있으므로 Notion은 순수 중복이다. ⚪ 확인 불가: 무료 플랜에서 간트 자동 일정 재조정 지원 여부.

---

## 4. 그 외 후보

| 도구 | 판정 | 근거 |
|---|---|---|
| **Height** | ❌ **후보 제외 — 서비스 종료.** 2025-03 종료 발표, **2025-09-24 전 데이터 삭제** | 🟡 <https://www.creativerly.com/height-app-is-shutting-down/> |
| **Plane** (OSS) | ❌ **실격.** UI엔 blocked_by 있으나 **공개 API v1에 relation 엔드포인트가 없다.** 내부 엔드포인트만 존재. issue #6236 현재도 **Open** → 에이전트가 API로 DAG를 못 만든다 = 본 프로젝트 1번 요구사항 미충족 | 🔵 <https://github.com/makeplane/plane/issues/6236> |
| **Huly** | ⚠️ 클라우드 **2026-07경 종료**(자금 중단), 셀프호스트만 생존. 의존관계 API 자동화 가능 여부 ⚪ | 🟡 <https://github.com/hcengineering/huly-selfhost> |
| **Vikunja** (OSS) | 🟨 기술적으론 적합. `PUT /tasks/{id}/relations` 로 `blocked_by` 설정 가능, 반대 방향 자동 동기화. 리스트/칸반/간트 전부 무료. 커뮤니티 MCP 존재(비공식). **단 셀프호스트 운영 부담 + PR 연동 없음** → 1인 창업자에겐 순손실 | 🔵 <https://vikunja.io/help/task-relations/> |

---

## 5. 비교표

| | 의존관계 표현 | 자동화 (CLI/API/MCP) | PR 연결 | 비용 | 도입 마찰 |
|---|---|---|---|---|---|
| **GitHub** ⭐ | **네이티브 1급** `blockedBy`/`blocking`, GA 🟢 | `gh` **네이티브 플래그** 🟢 + REST + GraphQL + MCP(플래그) | **`Closes #n` 자동, 최상** | **$0** | **최저** — 리포·`gh` 이미 있음 |
| Linear | 네이티브 (`blocks`) | GraphQL ✅ / 공식 CLI ❌ / MCP 관계툴 ⚪ | 매직워드 ✅ | $0 (250이슈) | 중 — 신규 SaaS+OAuth |
| Notion | **범용 relation으로 흉내** ❌ 전이·순환 불가 | MCP ✅(relation 버그) / API 3 req/s | 네이티브 속성 ✅ | $0 | 중 — 인증 + DAG 자체구현 |
| Plane | UI만, **API 부재** ❌ | **실격** | — | $0 | 고 (셀프호스트) |
| Vikunja | API ✅ | REST ✅ / MCP 비공식 | ❌ | $0 | 고 (셀프호스트) |
| Height | — | **서비스 종료** | — | — | — |

---

## 6. 권고안 도입 절차 (명령어 수준)

> 전제: 🟢 로컬 `gh` 2.96.0 인증됨. **단 현재 토큰 스코프는 `gist, read:org, repo`** — Projects를 쓰려면 스코프 추가 필요.
> ⚠️ 현재 인증 계정은 `ahangcorp-hyemin` 이다. 개인 프로젝트 리포를 이 계정 소유로 만들 것인지 먼저 확인할 것.

### 6.1 리포 생성 + 스코프 확보

```bash
cd /Users/yimminseo/orca/projects/glowmate
gh auth refresh -s project                      # Projects v2 조작에 필요
gh repo create glowmate --private --source=. --remote=origin --push
```

### 6.2 태스크 → 이슈 일괄 생성 (2-pass)

의존관계는 **양쪽 이슈가 모두 존재해야** 걸 수 있으므로 반드시 2단계로 나눈다.

```bash
mkdir -p .tmp

# Pass 1 — 이슈 생성, 태스크ID → 이슈번호 매핑 저장
python3 - <<'PY'
import json, subprocess, pathlib
tasks = json.load(open('docs/tasks.json'))['tasks']
m = {}
for t in tasks:
    if t.get('deprecated'): continue
    body = pathlib.Path(t['file']).read_text()
    url = subprocess.check_output([
        'gh','issue','create',
        '--title', f"[{t['id']}] {t['title']}",
        '--body', f"계약 정본: `{t['file']}`\n\n---\n\n{body[:60000]}",
        '--label', t['workstream'],
    ], text=True).strip()
    m[t['id']] = int(url.rsplit('/',1)[-1])
    print(t['id'], '→', m[t['id']])
json.dump(m, open('.tmp/issue-map.json','w'), indent=2)
PY

# Pass 2 — depends_on 을 --add-blocked-by 로 반영
python3 - <<'PY'
import json, subprocess
tasks = json.load(open('docs/tasks.json'))['tasks']
m = json.load(open('.tmp/issue-map.json'))
for t in tasks:
    deps = [m[d] for d in t.get('depends_on', []) if d in m]
    if not deps: continue
    subprocess.check_call(['gh','issue','edit', str(m[t['id']]),
                           '--add-blocked-by', ','.join(map(str,deps))])
    print(t['id'], 'blocked by', deps)
PY
```

> `blocks` 는 `depends_on` 의 역방향이므로 **중복 입력하지 말 것**(GitHub이 자동으로 양방향 표시).
> 관계당 상한 50개 🔵 — 우리 DAG 최대 차수는 이보다 훨씬 작아 문제없다.

### 6.3 준비 큐(ready queue) 계산 — §1.3 함정 회피 경로

`is:blocked` 검색 대신 **`blockedBy` 필드를 직접 읽는다** (🟢 이 경로만 신뢰 가능):

```bash
cat > scripts/ready-queue.sh <<'EOF'
#!/usr/bin/env bash
# 열린 이슈 중, 자신을 막고 있는 열린 이슈가 하나도 없는 것 = 착수 가능
gh issue list --state open --limit 200 \
  --json number,title,blockedBy \
  --jq '.[] | select([.blockedBy.nodes[]? | select(.state=="OPEN")] | length == 0)
        | "#\(.number)  \(.title)"'
EOF
chmod +x scripts/ready-queue.sh && ./scripts/ready-queue.sh
```

보드에서도 필터하고 싶으면 라벨을 동기화한다(선택):

```bash
gh label create blocked --color B60205 --description "열린 선행 이슈가 있음"
# 이후 주기적으로: blockedBy 가 열려 있으면 blocked 라벨 add, 아니면 remove
```

### 6.4 보드 구성

```bash
gh project create --owner @me --title "glowmate MVP"
gh project list --owner @me                       # 번호 확인
gh project item-add <N> --owner @me --url <issue-url>
gh project field-create <N> --owner @me --name "Phase" \
  --data-type SINGLE_SELECT \
  --single-select-options "P0-Discovery,P1-Foundation,P2-Pipeline,P3-Web,P4-Ops"
```
웹 UI에서 Board 레이아웃 + Status 그룹핑으로 칸반 완성. blocked 아이콘은 카드에 자동 표시된다 🔵.

### 6.5 (선택) GitHub MCP + 의존관계 툴

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "X-MCP-Features: issue_dependencies"
```
플래그를 빼면 `issue_dependency_*` 툴이 **노출되지 않는다** 🔵 (§1.5). 정본 경로는 `gh`이므로 MCP는 선택사항.

### 6.6 PR에서 태스크 닫기 (DAG 자동 전진)

```bash
gh pr create --title "[C1-CRAWLER-CORE] 크롤러 코어" --body "Closes #12"
```
머지 → 이슈 종료 → 하류 이슈의 blocked 해소 → `ready-queue.sh` 에 자동 등장.

---

## 7. 확인 불가 / 미검증 항목 (추측으로 메우지 않음)

1. **의존관계 쓰기 경로의 end-to-end 실행 검증 안 함.** `--add-blocked-by` 플래그 존재(🟢)와 `addBlockedBy` mutation 존재(🟢)는 확인했으나, 실제 이슈 2건을 만들어 링크하는 테스트는 **하지 않았다**. 이유: 현재 토큰에 `delete_repo` 스코프가 없어 테스트용 리포를 정리할 수 없고, 사용자 계정에 잔여물을 남기지 않기 위함. → §6.2 실행 시 첫 2건으로 검증할 것.
2. **교차 리포지토리 의존관계**: MCP 툴 스키마에 `related_owner`/`related_repo` 가 있어 지원 시사(🔵)하나, 일부 2차 자료는 "동일 리포만 지원"이라 기술. **단일 리포 구성이므로 본 프로젝트엔 무관.**
3. **Linear 공식 MCP의 관계(blocks) 툴 이름** — 공식 문서 미기재.
4. **Huly**의 의존관계 API 자동화 지원 여부.
5. **Notion** 무료 플랜의 간트 자동 일정 재조정 지원 여부.
6. Projects v2에 의존관계 필드가 2026년 중 추가되었는지 — **추가되었다는 근거를 찾지 못했다**(부재 증명은 아님).

---

## 8. 별건 지적

- `docs/tasks.json` 의 `count` 는 **33**인데 지시서는 40건을 전제했다. DAG 정본 레지스트리에는 F5·F6·W8·W9 등 "감사 반영 신설" 태스크와 D1a 분할이 있으나 매니페스트에 아직 반영되지 않은 것으로 보인다. **이슈 생성 전에 매니페스트를 정본과 동기화할 것** — 이슈를 만든 뒤 ID가 바뀌면 매핑이 깨진다.
- 폐기 태스크(F3, DS2)가 `deprecated` 플래그로 구분되는지 확인 필요. §6.2 스크립트는 `deprecated: true` 를 건너뛴다.

---

## 참고 출처

- <https://github.blog/changelog/2025-08-21-dependencies-on-issues/>
- <https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/>
- <https://docs.github.com/en/rest/issues/issue-dependencies>
- <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies>
- <https://github.com/orgs/community/discussions/165749>
- <https://github.com/github/github-mcp-server> (`pkg/github/feature_flags.go`, `docs/feature-flags.md`)
- <https://linear.app/docs/mcp> · <https://linear.app/pricing> · <https://linear.app/docs/github>
- <https://developers.notion.com/guides/mcp/overview> · <https://www.notion.com/help/relations-and-rollups> · <https://developers.notion.com/reference/request-limits> · <https://github.com/makenotion/notion-mcp-server/issues/45>
- <https://github.com/makeplane/plane/issues/6236>
- <https://vikunja.io/help/task-relations/>
- <https://www.creativerly.com/height-app-is-shutting-down/>
