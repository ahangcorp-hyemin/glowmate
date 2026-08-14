import type { LessonContent } from "@/lib/lessons/types";

// 울쎄라 레슨 정적 시드(부트스트랩). DB 미설정/빈 테이블일 때 폴백.
// 카피는 §56 광고 금지표현 회피(과장·보증·최저가 등 금지). 후기 리터러시의 '나쁜 예'는
// 어디까지나 '이런 건 걸러라' 교육용 인용.

export const ULTHERA_LESSON: LessonContent = {
  procedureId: "ulthera",
  nameKo: "울쎄라",
  cards: [
    {
      kind: "intro",
      title: "울쎄라, 알고 가볼까요?",
      subtitle: "병원 가기 전 5분. 뭘 물어보고 뭘 조심할지 하나씩 짚어드려요.",
    },
    {
      kind: "layers",
      title: "어디에 작용하나요?",
      prompt: "깊이를 눌러보세요. 울쎄라는 초음파 열을 피부 속에 점으로 모아요.",
      depths: [
        { mm: 1.5, layer: "진피 얕은층", note: "잔주름·피부결 위주로 자극해요." },
        { mm: 3.0, layer: "진피 깊은층", note: "탄력을 담당하는 콜라겐층을 데워요." },
        { mm: 4.5, layer: "SMAS 근막층", note: "성형수술에서 당기는 바로 그 층. 울쎄라의 핵심 타깃이에요." },
      ],
    },
    {
      kind: "timeline",
      title: "효과는 언제 나타나요?",
      prompt: "밀어서 시간을 옮겨보세요.",
      points: [
        { day: 0, label: "시술 직후엔 약간 탄탄한 느낌. 극적 변화는 아직이에요." },
        { day: 30, label: "한 달쯤부터 콜라겐이 새로 차오르기 시작해요." },
        { day: 90, label: "2~3개월에 걸쳐 턱선·탄력이 서서히 또렷해져요." },
      ],
      reality: "수술 리프팅과는 결이 달라요. 처짐 정도·나이·피부에 따라 개인차가 큽니다.",
    },
    {
      kind: "compare",
      title: "써마지·실리프팅과 뭐가 다르죠?",
      prompt: "탭해서 비교해보세요.",
      options: [
        { id: "ulthera", name: "울쎄라", depthMm: 4.5, keep: "12~18개월", pain: 3, note: "근막층(SMAS)까지. 처진 탄력을 끌어올리는 데 강점." },
        { id: "thermage", name: "써마지", depthMm: 2.5, keep: "약 12개월", pain: 2, note: "고주파로 진피 전반. 탄력·잔주름·모공을 넓게." },
        { id: "thread", name: "실리프팅", depthMm: 4.5, keep: "1~2년", pain: 3, note: "실로 조직을 물리적으로 견인. 처짐이 뚜렷할 때." },
      ],
    },
    {
      kind: "contra",
      title: "나는 받아도 될까요?",
      prompt: "해당하는 걸 눌러 확인해보세요.",
      options: [
        { label: "임신 또는 수유 중이에요", safe: false, note: "이 경우 시술을 미루고 상담이 필요해요." },
        { label: "시술 부위에 필러·실·보형물이 있어요", safe: false, note: "겹치는 부위는 상담에서 꼭 알리세요." },
        { label: "몸에 심박동기 등 전자기기를 넣었어요", safe: false, note: "장비에 따라 제한될 수 있어 상담이 필요해요." },
        { label: "특별히 해당되는 게 없어요", safe: true, note: "좋아요. 그래도 상담에서 피부 상태를 확인받으세요." },
      ],
    },
    {
      kind: "price",
      title: "가격은 왜 병원마다 다를까요?",
      prompt: "샷수를 밀어보세요. 울쎄라는 '샷수'로 가격이 정해져요.",
      unitWon: 3500,
      minUnit: 100,
      maxUnit: 600,
      step: 50,
      lowWarnBelow: 200,
      lowWarn: "샷수를 확 줄여 '초저가'처럼 광고하는 경우가 있어요. 총 샷수를 꼭 확인하세요.",
      note: "부위·총 샷수·정품 팁 개수에 따라 실제 비용이 달라져요.",
    },
    {
      kind: "reviewLiteracy",
      title: "후기, 이건 걸러야 해요",
      prompt: "믿을 만한 후기일까요? 왼쪽=의심, 오른쪽=신뢰로 밀어보세요.",
      samples: [
        { body: "3일 만에 10년은 어려졌어요!! 원장님 완전 강추, 링크는 프로필에 있어요 :)", trustworthy: false, flag: "극적 과장 + 홍보 링크 유도 → 대가성 후기 신호예요." },
        { body: "붓기는 이틀 정도 갔고, 턱선이 조금 또렷해진 느낌이에요. 큰 변화는 아니지만 만족해요.", trustworthy: true, flag: "구체적 경과 + 현실적 표현 → 실제 경험일 가능성이 높아요." },
        { body: "여기가 근처에서 제일 싸요! 이벤트 오늘까지니까 궁금하면 DM 주세요~", trustworthy: false, flag: "가격 강조 + 마감 압박 + DM 유도 → 광고성이에요." },
        { body: "통증은 좀 있었는데 참을 만했고, 2~3개월 뒤에 천천히 좋아진다고 하셔서 기다리는 중이에요.", trustworthy: true, flag: "통증·대기까지 솔직히 언급 → 균형 잡힌 실후기예요." },
      ],
    },
    // realReviews 카드는 실후기 수집(탐색 필러) 전까지 미게시 — 제작 후기 게시는 원칙 위반(CONTENT_PLAN §3).
    {
      kind: "questionSheet",
      title: "병원 갈 때 이건 물어보세요",
      intro: "캡처하거나 저장해서 상담 때 그대로 물어보면 돼요.",
      questions: [
        "제가 이 시술에 맞는 피부 상태인가요?",
        "쓰는 장비가 정품이고 식약처 허가 제품인가요?",
        "총 몇 샷을 하고, 그게 가격에 다 포함인가요?",
        "마취·재시술·애프터케어는 별도 비용인가요?",
        "부작용이 생기면 어떻게 대응해 주시나요?",
        "원장님이 직접 시술하시나요?",
      ],
    },
    {
      kind: "done",
      title: "이제 울쎄라, 알고 가요 👏",
      subtitle: "핵심만 짚었어요. 우리 동네 병원 참고가도 비교해볼까요?",
    },
  ],
};

// ── 써마지 FLX (수요 37 · 울쎄라 대체 비교축) ──
export const THERMAGE_LESSON: LessonContent = {
  procedureId: "thermage",
  nameKo: "써마지 FLX",
  cards: [
    { kind: "intro", title: "써마지, 알고 가볼까요?", subtitle: "울쎄라와 가장 많이 비교되는 시술. 뭐가 다르고 뭘 확인해야 하는지 5분 정리." },
    {
      kind: "layers", title: "어디에 작용하나요?", prompt: "깊이를 눌러보세요. 써마지는 고주파 열을 '면'으로 넓게 전달해요.",
      depths: [
        { mm: 1.0, layer: "표피", note: "냉각 가스로 보호해요. 열은 아래층으로만." },
        { mm: 2.4, layer: "진피 깊은층", note: "콜라겐이 즉시 수축하고, 새 콜라겐 재생이 시작돼요." },
        { mm: 4.3, layer: "피하 상부", note: "팁에 따라 지방층 상부까지. 울쎄라의 '점'과 달리 '면'으로 데워요." },
      ],
    },
    {
      kind: "timeline", title: "효과는 언제 나타나요?", prompt: "밀어서 시간을 옮겨보세요.",
      points: [
        { day: 0, label: "직후에 살짝 탄탄한 느낌 — 콜라겐 즉시 수축 덕이에요. 본 효과는 아직." },
        { day: 45, label: "1~2개월에 걸쳐 콜라겐 리모델링이 진행돼요." },
        { day: 120, label: "2~6개월 사이 탄력·결 개선이 서서히 또렷해져요. 보통 연 1회 주기." },
      ],
      reality: "수술이 아니라서 '당겨진다'기보다 '탄탄해진다'에 가까워요. 개인차가 큽니다.",
    },
    {
      kind: "compare", title: "울쎄라·슈링크와 뭐가 다르죠?", prompt: "탭해서 비교해보세요.",
      options: [
        { id: "thermage", name: "써마지", depthMm: 2.4, keep: "약 12개월", pain: 2, note: "고주파 '면' 가열. 탄력·잔주름·모공을 넓게. 처짐 자체보다 결·탄력 위주." },
        { id: "ulthera", name: "울쎄라", depthMm: 4.5, keep: "12~18개월", pain: 3, note: "초음파 '점' 리프팅, 근막층(SMAS)까지. 처짐이 뚜렷할 때 강점." },
        { id: "shrink", name: "슈링크", depthMm: 4.5, keep: "6개월~", pain: 1, note: "같은 초음파지만 저강도·가성비. 회차로 관리하는 입문형." },
      ],
    },
    {
      kind: "contra", title: "나는 받아도 될까요?", prompt: "해당하는 걸 눌러 확인해보세요.",
      options: [
        { label: "심박동기 등 몸속 전자기기가 있어요", safe: false, note: "고주파 시술의 대표 금기예요. 반드시 상담에서 알리세요." },
        { label: "시술 부위에 금속 보형물·실이 있어요", safe: false, note: "열 전달에 영향을 줄 수 있어 위치 확인이 필요해요." },
        { label: "임신 중이에요", safe: false, note: "시술을 미루고 상담이 필요해요." },
        { label: "특별히 해당되는 게 없어요", safe: true, note: "좋아요. 그래도 피부 상태·팁 선택은 상담에서 확인하세요." },
      ],
    },
    {
      kind: "price", title: "가격은 왜 이렇게 다를까요?", prompt: "샷수를 밀어보세요. 써마지는 팁(샷수)으로 가격이 정해져요.",
      unitWon: 3200, minUnit: 100, maxUnit: 900, step: 100, lowWarnBelow: 300,
      lowWarn: "'써마지 99만원' 광고는 대부분 소형 팁·적은 샷수예요. 팁 종류와 총 샷수를 꼭 확인하세요.",
      note: "보통 양볼 300샷, 얼굴 전체 600샷, 얼굴+목 900샷 기준이에요. 정품 팁은 개봉 전 실(seal)을 확인할 수 있어요.",
    },
    {
      kind: "reviewLiteracy", title: "후기, 이건 걸러야 해요", prompt: "믿을 만한 후기일까요? 판별해보세요.",
      samples: [
        { body: "써마지 특가 99만! 오늘까지만 이 가격, 디엠 주세요~", trustworthy: false, flag: "가격 강조 + 마감 압박 + DM 유도 → 소형 팁이거나 광고성일 가능성이 높아요." },
        { body: "600샷 받았고 두 달쯤부터 볼 탄력이 조금씩 좋아졌어요. 직후엔 큰 차이 몰랐어요.", trustworthy: true, flag: "샷수·시점이 구체적이고 기대치가 현실적 → 실제 경험일 가능성이 높아요." },
        { body: "한 번 받고 10년은 젊어졌다는 말이 딱이에요!! 원장님 최고!", trustworthy: false, flag: "극적 과장 + 근거 없음 → 대가성 후기 신호예요." },
      ],
    },
    {
      kind: "questionSheet", title: "병원 갈 때 이건 물어보세요", intro: "캡처해서 상담 때 그대로 물어보면 돼요.",
      questions: [
        "제 피부엔 울쎄라와 써마지 중 뭐가 맞나요? 이유는요?",
        "팁 종류와 총 샷수는요? 정품 실(seal) 개봉을 볼 수 있나요?",
        "마취 방법과 비용은 포함인가요?",
        "제 경우 효과가 제한적일 수 있는 요인이 있나요?",
        "원장님이 직접 시술하시나요?",
      ],
    },
    { kind: "done", title: "이제 써마지, 알고 가요 👏", subtitle: "핵심만 짚었어요. 동네 병원도 비교해볼까요?" },
  ],
};

// ── 실리프팅 (수요 37) ──
export const THREAD_LESSON: LessonContent = {
  procedureId: "thread",
  nameKo: "실리프팅",
  cards: [
    { kind: "intro", title: "실리프팅, 알고 가볼까요?", subtitle: "실로 처진 조직을 직접 끌어올리는 시술. 실 종류와 줄수가 핵심이에요." },
    {
      kind: "layers", title: "실은 어디에 들어가나요?", prompt: "깊이를 눌러보세요.",
      depths: [
        { mm: 1.5, layer: "진피", note: "가는 모노실은 여기에 — 콜라겐 자극용이라 '리프팅' 효과는 제한적이에요." },
        { mm: 3.0, layer: "피하지방층", note: "돌기(코그) 달린 실이 조직을 걸어 고정하는 층이에요." },
        { mm: 4.5, layer: "SMAS 인접", note: "처짐을 당겨 올리는 방향(벡터)을 설계하는 기준층." },
      ],
    },
    {
      kind: "timeline", title: "언제 자연스러워져요?", prompt: "밀어서 시간을 옮겨보세요.",
      points: [
        { day: 0, label: "직후 당김이 가장 뚜렷해요. 당김·이물감·붓기는 자연스러운 과정이에요." },
        { day: 14, label: "2주쯤 이물감이 줄고 표정이 자연스러워져요." },
        { day: 240, label: "실은 6~8개월에 걸쳐 흡수돼요. 흡수 후에도 콜라겐이 자리를 잡아 효과는 더 가요(6~18개월)." },
      ],
      reality: "실이 녹는 기간과 효과 유지 기간은 달라요. '실 녹으면 끝'이 아니지만, 수술만큼 강하지도 않아요.",
    },
    {
      kind: "compare", title: "울쎄라·필러와 뭐가 다르죠?", prompt: "탭해서 비교해보세요.",
      options: [
        { id: "thread", name: "실리프팅", depthMm: 4.5, keep: "6~18개월", pain: 3, note: "물리적으로 당겨 올려요. 처짐이 뚜렷하면 에너지 장비보다 체감이 빠른 편." },
        { id: "ulthera", name: "울쎄라", depthMm: 4.5, keep: "12~18개월", pain: 3, note: "열로 서서히 조여요. 다운타임은 짧지만 체감까지 2~3개월." },
        { id: "filler", name: "필러(팔자)", depthMm: 3.0, keep: "6~18개월", pain: 2, note: "꺼진 볼륨을 채워요. 처짐이 원인이면 채우기만으론 한계." },
      ],
    },
    {
      kind: "contra", title: "나는 받아도 될까요?", prompt: "해당하는 걸 눌러 확인해보세요.",
      options: [
        { label: "볼 지방이 많은 편이에요", safe: false, note: "무게 때문에 유지가 짧아질 수 있어요. 실 종류·줄수 설계 상담이 필요해요." },
        { label: "얼굴이 많이 마른 편이에요", safe: false, note: "실 윤곽이 드러나거나 함몰(딤플)이 보일 수 있어 신중해야 해요." },
        { label: "항응고제를 복용 중이에요", safe: false, note: "멍·출혈 위험이 커져요. 반드시 상담에서 알리세요." },
        { label: "특별히 해당되는 게 없어요", safe: true, note: "좋아요. 딤플·비대칭은 대부분 일시적이지만 시술자 경험이 중요해요." },
      ],
    },
    {
      kind: "price", title: "가격은 '줄수'가 정해요", prompt: "줄수를 밀어보세요.",
      unitWon: 120000, minUnit: 2, maxUnit: 20, step: 2, lowWarnBelow: 4,
      lowWarn: "'리프팅 9.9만' 광고는 콜라겐용 모노실 몇 줄인 경우가 많아요. 당겨 올리는 코그실 기준 줄수를 확인하세요.",
      note: "코그실 기준 턱선은 보통 좌우 2~4줄씩. 실 종류(PDO·PLLA·PCL)에 따라 유지와 가격이 달라요.",
    },
    {
      kind: "reviewLiteracy", title: "후기, 이건 걸러야 해요", prompt: "믿을 만한 후기일까요? 판별해보세요.",
      samples: [
        { body: "실리프팅 10줄 9만9천원! 오늘 예약분만!", trustworthy: false, flag: "코그실 10줄이 이 가격일 수 없어요 — 모노실이거나 추가금이 붙는 구조예요." },
        { body: "코그 좌우 3줄씩 했어요. 일주일은 당기고 어색했는데 2주부터 자연스러워졌어요.", trustworthy: true, flag: "실 종류·줄수·회복 경과가 구체적 → 실제 경험 신호예요." },
      ],
    },
    {
      kind: "questionSheet", title: "병원 갈 때 이건 물어보세요", intro: "캡처해서 상담 때 그대로 물어보면 돼요.",
      questions: [
        "어떤 실(PDO·PLLA·PCL)을 몇 줄 쓰나요? 코그실 기준인가요?",
        "제 지방량·피부 두께면 실이 맞나요, 에너지 장비가 맞나요?",
        "딤플·비대칭이 생기면 어떻게 조치해 주시나요?",
        "견적에 마취·사후관리가 포함인가요?",
        "원장님이 직접 시술하시나요?",
      ],
    },
    { kind: "done", title: "이제 실리프팅, 알고 가요 👏", subtitle: "핵심만 짚었어요. 동네 병원도 비교해볼까요?" },
  ],
};

// ── 보톡스 (수요 34 · 50대 1위) ──
export const BOTOX_LESSON: LessonContent = {
  procedureId: "botox",
  nameKo: "보톡스",
  cards: [
    { kind: "intro", title: "보톡스, 알고 가볼까요?", subtitle: "가장 대중적인 시술이라 오해도 가장 많아요. 내성·주기까지 5분 정리." },
    {
      kind: "layers", title: "어디에 작용하나요?", prompt: "깊이를 눌러보세요. 보톡스는 '근육'에 놓는 주사예요.",
      depths: [
        { mm: 0.5, layer: "진피(스킨보톡스)", note: "아주 얕게 넓게 — 잔주름·모공 결 개선용이에요." },
        { mm: 2.0, layer: "표정근 얕은층", note: "눈가처럼 얇은 근육은 얕게, 소량으로." },
        { mm: 4.0, layer: "표정근 본체", note: "미간·이마·사각턱 — 근육의 과한 움직임을 이완시켜요." },
      ],
    },
    {
      kind: "timeline", title: "언제부터, 얼마나 가요?", prompt: "밀어서 시간을 옮겨보세요.",
      points: [
        { day: 3, label: "3~4일부터 근육 움직임이 서서히 줄어요. 바로 안 변해도 정상이에요." },
        { day: 14, label: "2주쯤 효과가 최대로 안정돼요. 어색하면 이 시점에 보완 상담을." },
        { day: 120, label: "3~6개월에 걸쳐 서서히 원래대로 돌아와요. 표정이 굳는 게 아니라 '풀리는' 거예요." },
      ],
      reality: "6개월보다 짧은 간격으로 자주 맞으면 내성(항체) 위험이 커져요. 주기를 지키는 게 오래 쓰는 법이에요.",
    },
    {
      kind: "compare", title: "필러·리쥬란과 뭐가 다르죠?", prompt: "주름의 '원인'이 달라요. 탭해서 비교해보세요.",
      options: [
        { id: "botox", name: "보톡스", depthMm: 4.0, keep: "3~6개월", pain: 1, note: "움직여서 생기는 주름(미간·눈가) — 근육을 이완시켜요." },
        { id: "filler", name: "필러", depthMm: 3.0, keep: "6~18개월", pain: 2, note: "꺼져서 생기는 주름·볼륨 — 채워 넣어요." },
        { id: "rejuran", name: "리쥬란", depthMm: 1.5, keep: "6~12개월(3회)", pain: 3, note: "피부 자체 재생 — 결·잔주름을 바닥부터." },
      ],
    },
    {
      kind: "contra", title: "나는 받아도 될까요?", prompt: "해당하는 걸 눌러 확인해보세요.",
      options: [
        { label: "임신 중이거나 수유 중이에요", safe: false, note: "시술을 미루세요. 대표적 금기예요." },
        { label: "근무력증 등 신경·근육 질환이 있어요", safe: false, note: "반드시 상담에서 알리세요." },
        { label: "최근 항생제 주사를 맞았어요", safe: false, note: "일부 항생제는 효과에 영향을 줄 수 있어 시점 조율이 필요해요." },
        { label: "특별히 해당되는 게 없어요", safe: true, note: "좋아요. 처음이면 저용량으로 반응을 보는 게 안전해요." },
      ],
    },
    {
      kind: "price", title: "부위 수로 계산해보세요", prompt: "부위 수를 밀어보세요(미간·이마·눈가·턱 등).",
      unitWon: 45000, minUnit: 1, maxUnit: 6, step: 1, lowWarnBelow: 1,
      lowWarn: "",
      note: "부위당 만원 미만 초저가는 희석 농도·제품(국산/수입, 내성 줄인 제품인지)을 확인하세요. 중단하면 서서히 원래 상태로 돌아갈 뿐, '못 끊게 되는' 시술이 아니에요.",
    },
    {
      kind: "reviewLiteracy", title: "후기, 이건 걸러야 해요", prompt: "믿을 만한 후기일까요? 판별해보세요.",
      samples: [
        { body: "9,900원 보톡스! 전 부위 무제한 이벤트!", trustworthy: false, flag: "희석 농도나 제품을 확인할 수 없는 초저가 미끼 구조일 수 있어요." },
        { body: "미간에 소량 맞았어요. 3일쯤부터 덜 찌푸려지고 2주쯤 자연스럽게 자리 잡았어요.", trustworthy: true, flag: "용량·시점·현실적 경과 → 실제 경험 신호예요." },
        { body: "한 번 맞으면 평생 끊을 수 없대요. 절대 시작하지 마세요.", trustworthy: false, flag: "근거 없는 공포담이에요. 중단하면 서서히 원래 상태로 돌아갈 뿐이에요." },
      ],
    },
    {
      kind: "questionSheet", title: "병원 갈 때 이건 물어보세요", intro: "캡처해서 상담 때 그대로 물어보면 돼요.",
      questions: [
        "어떤 제품(국산/수입, 내성 줄인 제품인지)을 쓰나요?",
        "제 부위엔 몇 단위를 권하세요? 이유는요?",
        "눈썹 처짐 같은 부작용 가능성과 대처는요?",
        "재시술 권장 주기는요? (6개월 미만 반복 권유는 경계)",
        "시술은 의사가 직접 하나요?",
      ],
    },
    { kind: "done", title: "이제 보톡스, 알고 가요 👏", subtitle: "핵심만 짚었어요. 동네 병원도 비교해볼까요?" },
  ],
};

// ── 리쥬란 (수요 21 · 40대 재생 축) ──
export const REJURAN_LESSON: LessonContent = {
  procedureId: "rejuran",
  nameKo: "리쥬란",
  cards: [
    { kind: "intro", title: "리쥬란, 알고 가볼까요?", subtitle: "'연어주사'로 불리는 재생 시술. 회차·정량·통증까지 5분 정리." },
    {
      kind: "layers", title: "어디에 작용하나요?", prompt: "깊이를 눌러보세요.",
      depths: [
        { mm: 1.0, layer: "표피 아래", note: "주사 직후 올라오는 엠보싱(볼록함)은 보통 하루 안에 가라앉아요." },
        { mm: 1.5, layer: "진피 얕은층", note: "PN(연어 DNA 유래 성분)이 재생 환경을 만드는 층이에요." },
        { mm: 2.0, layer: "진피", note: "결·잔주름·속건조가 좋아지는 바탕. '채우는' 필러와는 목적이 달라요." },
      ],
    },
    {
      kind: "timeline", title: "몇 번 맞아야 해요?", prompt: "밀어서 시간을 옮겨보세요.",
      points: [
        { day: 1, label: "엠보싱·멍이 있을 수 있어요. 대부분 1~3일 내 가라앉아요." },
        { day: 28, label: "4주 간격으로 보통 3회가 한 코스예요. 1회로는 유지가 짧아요." },
        { day: 180, label: "3회 코스 후 6~12개월 유지가 일반적이에요. 결·탄력이 서서히." },
      ],
      reality: "즉각 변신형 시술이 아니라 '바탕 관리'형이에요. 1회 체험으로 판단하면 돈이 아깝게 느껴질 수 있어요.",
    },
    {
      kind: "compare", title: "스킨부스터·쥬베룩과 뭐가 다르죠?", prompt: "탭해서 비교해보세요.",
      options: [
        { id: "rejuran", name: "리쥬란", depthMm: 1.5, keep: "6~12개월(3회)", pain: 3, note: "PN 재생 — 결·잔주름·속탄력. 통증이 있는 편(마취크림·기계주입으로 완화)." },
        { id: "skinbooster", name: "물광(HA)", depthMm: 1.0, keep: "2~3개월", pain: 2, note: "수분·광 — 즉각적이지만 짧아요." },
        { id: "juvelook", name: "쥬베룩", depthMm: 2.0, keep: "12개월+", pain: 2, note: "콜라겐 생성 유도 — 볼륨·탄력 쪽에 가까워요." },
      ],
    },
    {
      kind: "contra", title: "나는 받아도 될까요?", prompt: "해당하는 걸 눌러 확인해보세요.",
      options: [
        { label: "생선·해산물 알레르기가 있어요", safe: false, note: "연어 유래 성분이라 반드시 상담에서 알리세요." },
        { label: "시술 부위에 염증·트러블이 올라와 있어요", safe: false, note: "가라앉힌 뒤 시술하는 게 안전해요." },
        { label: "임신 중이에요", safe: false, note: "시술을 미루고 상담이 필요해요." },
        { label: "특별히 해당되는 게 없어요", safe: true, note: "좋아요. 통증이 걱정되면 마취크림·기계 주입 여부를 물어보세요." },
      ],
    },
    {
      kind: "price", title: "정량(cc)을 확인하세요", prompt: "용량을 밀어보세요. 얼굴 전체 표준은 2cc예요.",
      unitWon: 130000, minUnit: 1, maxUnit: 4, step: 1, lowWarnBelow: 2,
      lowWarn: "'리쥬란 반값' 광고는 1cc이거나 희석인 경우가 있어요. 정품 2cc 기준인지, 개봉을 보여주는지 확인하세요.",
      note: "가격보다 '정량 + 회차(3회 코스)' 기준으로 비교해야 정확해요.",
    },
    {
      kind: "questionSheet", title: "병원 갈 때 이건 물어보세요", intro: "캡처해서 상담 때 그대로 물어보면 돼요.",
      questions: [
        "정품 리쥬란인가요? 용량(cc)과 개봉을 확인할 수 있나요?",
        "손주사인가요 기계 주입인가요? 마취크림 시간은 충분한가요?",
        "제 고민(결/잔주름/속건조)에 리쥬란이 맞나요, 다른 부스터가 맞나요?",
        "3회 코스 기준 총비용은요? 회차 할인 조건은요?",
        "멍·엠보싱이 오래가면 어떻게 하나요?",
      ],
    },
    { kind: "done", title: "이제 리쥬란, 알고 가요 👏", subtitle: "핵심만 짚었어요. 동네 병원도 비교해볼까요?" },
  ],
};

export const LESSON_SEED: Record<string, LessonContent> = {
  ulthera: ULTHERA_LESSON,
  thermage: THERMAGE_LESSON,
  thread: THREAD_LESSON,
  botox: BOTOX_LESSON,
  rejuran: REJURAN_LESSON,
};
