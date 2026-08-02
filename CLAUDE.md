# glowmate

3050을 위한 웰니스 오프라인 업체 리스트업 서비스. 강남·서초·송파 시드.
**UVP: 전화 걸지 않고도 회당 단가로 비교한다.**

---

## 이 프로젝트의 작업 방식

**계약 기반 오케스트레이션이다.** 코드를 바로 짜지 않는다.

```
docs/tasks/<ID>.md (계약, 정본)
      ↓
task-author → task-auditor → dev-executor → pr-reviewer
                  ↓ REVISE/REJECT           ↓ FAIL
                  └───────────────────────────┘
```

- **태스크 1개 = PR 1개 = 에이전트 1회 실행**
- 계약이 정본이고 GitHub 이슈는 파생물이다. 이슈에서 고친 내용은 계약과 어긋나는 순간 무의미해진다
- 검수 역할(`task-auditor`·`pr-reviewer`)은 **자기 보고서 디렉터리에만** 쓰기 권한이 있다. 감사 대상은 못 고친다

### 반드시 먼저 읽을 것

| 문서 | 내용 |
|---|---|
| `docs/00-lean-canvas.md` | 제품 가설 |
| `docs/01-prd.md` | 가설 H1~H7 · 게이트 G1~G5 · 스택 |
| **`docs/02-task-contract-spec.md`** | **계약 작성 헌법. 조건부 금지사항 규격** |
| `docs/03-task-dag.md` | 태스크 40건 · ID 정본 · 배치 · 감사 반영 정정 |
| `docs/04-orchestration.md` | 실행 런북 |
| `docs/audit/` | 감사 보고서 (계약이 왜 지금 모양인지의 근거) |

---

## 핵심 규칙 — 감사 3라운드에서 도출됨

### 조건부 금지사항 5요소

```yaml
forbid:
  - id: FORBID-1
    when:         <좁고 판정 가능한 조건>     # "항상"이면 반려
    must_not:     <금지 행위>
    because:      <구체적 실패 시나리오>       # "좋은 관행이므로"는 반려
    detect:       <탐지 수단>                 # 없으면 반려
    on_violation: block_merge | rollback | alert
```

**무조건 금지는 반드시 깨진다. 한 번 깨지면 규칙 전체가 무시된다.** 예외는 규칙 바깥이 아니라 안으로 넣는다.

### 원칙 2.5 — 모든 금지는 짝이 되는 정상 동작 요구를 가진다

*"이 금지를 극단적으로 준수하면 제품이 사라지는가?"* 사라진다면 짝이 없는 것이다.
`PriceDisplay` 가 항상 "미공개"만 렌더하면 모든 가격 FORBID를 100% 준수한다.

### R-6 / R-7

- **R-6** 품질 임계 REQ는 **표집 절차 명시 + 홀드아웃 분리**. 피검자가 만든 시험지에서 측정하면 임계는 난이도 조절로 언제든 충족된다
- **R-7** 픽스처만으로 충족 가능한 계약 금지. **실환경 하한 REQ 최소 1개**

### 반복해서 나온 실패 유형

| 유형 | 예 |
|---|---|
| **분모를 바꾸는 것이 임계를 바꾸는 것보다 쉽다** | "unparseable 아닌 비율"의 분모를 넓혀 회당가 0건 산출이 만점 |
| **접합부 결함** | `confidence` 소비자 6곳인데 생산자 0곳 — 어느 개별 계약도 위반 안 함 |
| **자기모순(P7)** | 규칙 둘이 각각은 합리적인데 교집합에서 모순 → 앞에 선 사람은 반드시 우회 |
| **탐지 허구** | grep 대상이 스키마에 없으면 검사는 영원히 녹색 |
| **미탐 > 오탐** | 오탐은 시끄러워 잡히지만 미탐은 검사가 녹색인 채로 뚫린다 |

---

## 검증 도구

```bash
python3 scripts/tasks_manifest.py          # 계약 → docs/tasks.json + DAG 검증
python3 scripts/tasks_manifest.py --check  # 검증만 (CI용)
python3 scripts/normalize_ids.py           # 축약형 ID 정본화 + blocks 역방향 대칭
python3 scripts/github_sync.py             # 이슈 동기화 (멱등, 3-pass)
python3 scripts/github_sync.py --ready     # 착수 가능 태스크
```

**계약을 고친 뒤에는 반드시 `tasks_manifest.py` 를 돌려 DAG 정합성을 확인한다.**
`--ready` 는 GitHub `is:blocked` 검색을 쓰지 않는다 — 그 필터는 실제 관계와 어긋난다(`docs/tool-research.md` §1.3).

---

## 현재 상태 (2026-08-03)

- GitHub: `ahangcorp-hyemin/glowmate` (private) · 이슈 37건 + 의존관계 + 보드 `projects/1`
- 계약 40건 (유효 39) · DAG 정합성 ✅
- 감사: 2차 5배치 완료. 1차 REJECT 6건 중 5건 해소
- **진행 중: F1 개발** (`feat/f1-repo-scaffold`, 이슈 #20)
  - 네트워크 오류로 중단됨. 모노레포 골격·CI 픽스처까지 진행
  - **남은 blocking 2건** (`docs/audit/f1-gate2.md`):
    - **B-3b** 의존 분류 파일(`packages/config/dependency-classes.json`)이 F1 소유인데 **하류가 편집할 경로가 없다.** DS3이 Radix를 추가하면 미분류 의존으로 CI가 무조건 red → 통과 불가. 등재는 열되 `data-access` 분류를 `packages/api`·`packages/db` 밖에 부여하는 것만 금지
    - **B-8** 필수 체크 애그리게이터의 `if: always()` 가 **F1 자신의 FORBID-2 금지 패턴에 열거되어 있다.** 예외를 규칙 안으로 명시하거나 다른 방식 사용

### 다음 순서

```
F1 완성 → PR (Closes #20) → pr-reviewer 검수 → 머지
                                    ↓
                        --ready 로 다음 배치 해금 → 병렬 착수
```

F1이 병목인 이유: 나머지 39건의 `detect` 가 전부 F1이 만드는 CI 위에 얹힌다.

---

## 하지 말 것

- 계약 없이 코드를 짜는 것
- `touches` 밖의 파일 수정 (계약 결함이면 멈추고 보고)
- 임계값 낮추기 · 테스트 스킵 · 실패를 조용히 삼키기
- 막혔을 때 계약을 재해석해 범위를 바꾸기 — **우회는 계약 시스템 전체를 무력화한다**
