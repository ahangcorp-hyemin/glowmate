# 레슨 데이터 계약 (프론트 ↔ 백엔드 핸드오프)

> 목적: 시술 레슨(듀오링고식 카드) 기능을 **다른 워크트리의 백엔드가 그대로 이어받게** 하는 경계 문서.
> 프론트(UI)는 아래 타입만 알면 되고, 백엔드는 아래 테이블만 채우면 UI 변경 0.

## 아키텍처 (M2 카탈로그 패턴과 동일)

```
UI 카드 플레이어 (client)
  └─ fetchLesson(procedureId)         src/app/learn/actions.ts   ("use server")
       └─ getLesson(procedureId)       src/lib/lessons/repo.ts    (server-only, seam)
            ├─ DB: lessons + lesson_cards  →  snake→camel 매핑
            └─ 폴백: 정적 시드              src/lib/lessons/seed.ts
```

- **DB 미설정/오류/빈 테이블이면 정적 시드로 폴백** → 백엔드 붙기 전에도 앱이 돈다.
- DB에 행이 있으면 **DB가 주인**. 60초 캐시.
- `catalog/repo.ts`(procedures/concerns/hospitals)와 완전히 같은 규약.

## UI 타입 계약 — `src/lib/lessons/types.ts`

- `LessonContent { procedureId, nameKo, cards: LessonCard[] }`
- `LessonCard`는 `kind`로 구분되는 discriminated union. kind별 필드는 types.ts 참고.
  - `intro | layers | timeline | compare | contra | price | reviewLiteracy | realReviews | questionSheet | done`
- **이 타입이 유일한 계약.** 필드 추가/변경은 여기서 하고 양쪽이 맞춘다.

## DB 스키마 — `supabase/migrations/0002_lessons.sql`

- `lessons (procedure_id PK → procedures.id, name_ko, updated_at)`
- `lesson_cards (id, procedure_id → lessons, ord, kind, payload jsonb)`
  - `kind` = types.ts의 union kind
  - `payload` = **해당 kind의 나머지 필드를 그대로** 담는 jsonb
    - 예) `layers` 카드 → `payload = { title, prompt, depths: [...] }`
  - `repo.ts`의 매핑: `{ kind, ...payload }` → `LessonCard`. 즉 payload 키 = 타입 필드명(camelCase) 그대로.

## 백엔드가 할 일

1. `0002_lessons.sql` 적용(또는 자체 마이그레이션에 반영).
2. 시드 이관: `src/lib/lessons/seed.ts`의 `ULTHERA_LESSON`을 `lessons` 1행 +
   `lesson_cards` N행(ord 순, kind, payload=카드의 나머지 필드)으로 insert.
   - `catalog/seed.ts`처럼 seed→DB 시더 스크립트에 함께 넣으면 됨.
3. 끝. UI는 그대로 DB를 읽는다(`getServerClient()`가 non-null이면 자동).

## 주의 / 경계

- **후기**(`realReviews`, `reviewLiteracy` 샘플)는 지금 카드 payload에 인라인. 진짜 UGC 후기가
  쌓이기 시작하면 `lesson_reviews`(또는 기존 `reviews`) 테이블로 승격하고 `realReviews` 카드는
  "테이블에서 join"으로 바꾸는 걸 권장. 그때 계약(types.ts)만 맞추면 UI는 유지.
- **§56 준수**: 레슨 카피는 광고 금지표현(과장·보증·최저가·부작용 없음 등) 회피. DB로 옮겨도
  시더/입력 단계에서 `bannedPhrases` 검증을 태우는 걸 권장(카탈로그와 동일 정책).
- 프론트는 `procedures/hospitals/concerns` 등 백엔드 소유 파일을 건드리지 않음(신규 파일만 추가).
