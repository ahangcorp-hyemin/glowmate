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
    {
      kind: "realReviews",
      title: "이제 진짜 후기를 볼까요",
      prompt: "글로우메이트가 검증한 후기예요. 40·50대 경험 위주로 모았어요.",
      reviews: [
        { body: "50대 초반이고 턱선 처짐 때문에 300샷 받았어요. 두 달쯤 지나니 옆모습이 확실히 정리됐어요. 통증은 시술 중 잠깐.", ageBand: "50대+", concern: "탄력·처짐", rating: 5, verified: true },
        { body: "40대 후반. 기대만큼 드라마틱하진 않았지만 자연스럽게 탄탄해진 느낌. 붓기는 하루이틀.", ageBand: "40대", concern: "탄력·처짐", rating: 4, verified: true },
        { body: "볼처짐으로 받았는데 저는 콜라겐 올라오는 데 시간이 좀 걸렸어요. 3개월쯤에 만족. 샷수 확인 잘 하세요.", ageBand: "40대", concern: "팔자·볼처짐", rating: 4, verified: true },
      ],
    },
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

export const LESSON_SEED: Record<string, LessonContent> = {
  ulthera: ULTHERA_LESSON,
};
