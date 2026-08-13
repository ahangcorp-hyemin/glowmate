// 고민 → 시술 룰(결정론 큐레이션/견적의 핵심). RAG 아님.
// role: base(리프팅 기둥) / addon(재생·마감) / optional(볼륨 등 예산따라)

export interface Concern {
  id: string;
  nameKo: string; // 내부 태그(짧은 키)
  sentence: string; // 구체 1인칭 문장(4050 실제 표현) — 온보딩 카드
  emoji: string;
}

export interface Rule {
  concernId: string;
  procedureId: string;
  role: "base" | "addon" | "optional";
  weight: number; // 0–100
  rationale: string; // 답변 조립용 근거
}

export const CONCERNS: Concern[] = [
  { id: "lift", nameKo: "탄력·처짐", sentence: "얼굴이 예전 같지 않고 턱선이 흐려진 것 같아요", emoji: "🎈" },
  { id: "nasolabial", nameKo: "팔자·볼처짐", sentence: "팔자주름이 깊어져서 나이 들어 보여요", emoji: "↘️" },
  { id: "wrinkle", nameKo: "주름", sentence: "미간·눈가 주름이 자꾸 신경 쓰여요", emoji: "〰️" },
  { id: "pigment", nameKo: "색소·기미", sentence: "기미·잡티가 올라와서 얼굴이 칙칙해 보여요", emoji: "☕" },
  { id: "volume", nameKo: "볼륨 손실", sentence: "볼이 꺼지고 얼굴이 납작해진 느낌이에요", emoji: "🫧" },
  { id: "pore", nameKo: "모공·피부결", sentence: "모공이 넓어지고 피부결이 거칠어요", emoji: "🕳️" },
  { id: "jowl", nameKo: "이중턱", sentence: "이중턱·턱살이 생겨서 옆모습이 신경 쓰여요", emoji: "💠" },
  { id: "neck", nameKo: "목주름", sentence: "목주름이 자글자글해서 나이가 드러나요", emoji: "🧣" },
];

export const CONCERN_BY_ID = Object.fromEntries(CONCERNS.map((c) => [c.id, c]));

export const RULES: Rule[] = [
  // 탄력·처짐
  { concernId: "lift", procedureId: "ulthera", role: "base", weight: 95, rationale: "처진 탄력을 근막층(SMAS)부터 끌어올리는 대표 리프팅" },
  { concernId: "lift", procedureId: "thermage", role: "base", weight: 88, rationale: "고주파로 전반적 탄력을 올림(주름·모공 동반 시)" },
  { concernId: "lift", procedureId: "shrink", role: "base", weight: 80, rationale: "가성비 리프팅 입문, 회차로 관리" },
  { concernId: "lift", procedureId: "thread", role: "addon", weight: 78, rationale: "처짐이 뚜렷하면 실로 직접 리프팅" },
  // 팔자·볼처짐
  { concernId: "nasolabial", procedureId: "thread", role: "base", weight: 88, rationale: "처진 조직을 물리적으로 끌어올림" },
  { concernId: "nasolabial", procedureId: "filler", role: "optional", weight: 84, rationale: "꺼진 볼륨이 크면 필러로 채움" },
  { concernId: "nasolabial", procedureId: "ulthera", role: "base", weight: 76, rationale: "볼처짐 리프팅 베이스" },
  // 주름
  { concernId: "wrinkle", procedureId: "botox", role: "base", weight: 90, rationale: "표정근을 이완해 동적 주름 완화" },
  { concernId: "wrinkle", procedureId: "rejuran", role: "addon", weight: 72, rationale: "피부결·잔주름 재생" },
  // 색소·기미
  { concernId: "pigment", procedureId: "toning", role: "base", weight: 88, rationale: "저출력 레이저로 색소를 회차로 옅게" },
  { concernId: "pigment", procedureId: "pico", role: "base", weight: 86, rationale: "피코초 레이저, 낮은 열부담" },
  { concernId: "pigment", procedureId: "rejuran", role: "addon", weight: 58, rationale: "톤·결 재생 보조" },
  // 볼륨 손실
  { concernId: "volume", procedureId: "filler", role: "base", weight: 86, rationale: "즉각적 볼륨 채움" },
  { concernId: "volume", procedureId: "sculptra", role: "base", weight: 84, rationale: "콜라겐 생성으로 오래가는 볼륨" },
  { concernId: "volume", procedureId: "juvelook", role: "addon", weight: 78, rationale: "자연스러운 탄력·볼륨" },
  // 모공·피부결
  { concernId: "pore", procedureId: "potenza", role: "base", weight: 86, rationale: "미세바늘+고주파로 모공·결 개선" },
  { concernId: "pore", procedureId: "rejuran", role: "addon", weight: 78, rationale: "피부결 재생" },
  { concernId: "pore", procedureId: "skinbooster", role: "addon", weight: 58, rationale: "수분·광채 보조" },
  // 이중턱
  { concernId: "jowl", procedureId: "inmode", role: "base", weight: 84, rationale: "고주파로 이중턱·턱선 타이트닝" },
  { concernId: "jowl", procedureId: "ulthera", role: "base", weight: 78, rationale: "턱밑 리프팅" },
  // 목주름
  { concernId: "neck", procedureId: "shrink", role: "base", weight: 72, rationale: "목 탄력 리프팅" },
  { concernId: "neck", procedureId: "botox", role: "addon", weight: 64, rationale: "목 가로주름 완화" },
];
