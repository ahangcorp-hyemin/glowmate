// 시술 카탈로그 — 단일 소스(TS). DB 시드 + 프로토타입 공용.
// 출처: 식약처(MFDS)·FDA·학회. 리서치 검증분(에너지/주사/색소).
// ⚠️ 의료광고(§56): 효과보증·과장 금지. caution/sideEffects(부작용)은 §24조의2 고지 필수 노출.
// ⚠️ 미확인 승인번호는 표기하지 않고 "허가 여부"만 서술. 결절 빈도 등 자료 상충치는 단정 금지.

export type Category = "lifting" | "volume" | "pigment";
export type PriceUnit = "회" | "샷300" | "cc" | "바이알" | "부위";

export interface Source {
  label: string;
  url?: string;
  type: "mfds" | "fda" | "society" | "crawl_avg";
}

export interface Procedure {
  id: string;
  nameKo: string;
  category: Category;
  tagline: string;
  mechanism: string; // 뭐냐(기전)
  effect: string; // 효과
  downtime: string; // 아픔·회복
  caution: string; // 주의(요약)
  sideEffects: string; // 대표 부작용(빈도·지속)
  contraindication: string; // 이런 분은 피하세요/상담
  misconception: string; // 흔한 오해
  vsNote: string; // 헷갈리는 시술 감별
  goodFor: string; // 이런 분께
  priceMin: number;
  priceMax: number;
  priceUnit: PriceUnit;
  sessions: string; // 회차·유지
  sources: Source[];
}

export const PROCEDURES: Procedure[] = [
  {
    id: "ulthera", nameKo: "울쎄라", category: "lifting",
    tagline: "처진 피부를 안쪽부터 끌어올리는 대표 리프팅.",
    mechanism: "미세초점 초음파(HIFU)를 1.5·3.0·4.5mm 깊이에 집속해 근막층(SMAS)까지 열응고점을 만들어 콜라겐 수축·재생을 유도.",
    effect: "턱선·볼 처짐에 뚜렷. 리프팅 중 강도가 높은 편이라 40·50대 처짐에 많이 선택.",
    downtime: "시술 중 통증 있는 편(수면·무통 옵션). 다운타임은 짧아 일상 가능.",
    caution: "효과는 2–3개월에 걸쳐 서서히. 정품·적정 샷 확인. 개인차 있음.",
    sideEffects: "붉음·붓기·압통·멍(대개 수일). 드물게 화상·일시적 신경자극·볼꺼짐. 전체 이상반응은 1–2% 미만으로 낮은 편.",
    contraindication: "마른 얼굴·지방 적은 분은 볼꺼짐 우려로 신중. 켈로이드·임신·시술부 감염, 필러/실 삽입부는 상담이 필요해요.",
    misconception: "\"한 번에 확 당겨진다\"는 오해 — 콜라겐 재생이라 2–3개월에 걸쳐 서서히 나타나요. 샷수보다 정품·정확한 타겟팅이 중요.",
    vsNote: "울쎄라=초음파로 SMAS(4.5mm)까지 '선' 리프팅 / 써마지=고주파로 진피를 '면'으로 타이트닝 / 슈링크=같은 초음파지만 영상가이드 없이 저강도·가성비.",
    goodFor: "처짐이 확실히 신경 쓰이는, 강한 리프팅을 원하는 40·50대.",
    priceMin: 1000000, priceMax: 1800000, priceUnit: "샷300", sessions: "1회 · 유지 12–18개월(연 1회 권장)",
    sources: [
      { label: "식약처 의료기기 허가 · 초음파집속자극시스템", type: "mfds", url: "https://www.mfds.go.kr" },
      { label: "FDA 리프팅 적응증(눈썹·턱밑·목) · Merz", type: "fda" },
    ],
  },
  {
    id: "thermage", nameKo: "써마지 FLX", category: "lifting",
    tagline: "고주파로 콜라겐을 수축·재생시키는 탄력 시술.",
    mechanism: "6.78MHz 모노폴라 고주파(RF)를 용량결합 방식으로 진피~피하 상부까지 '면'으로 가열해 콜라겐 수축·재생을 유도. AccuREP로 조직 저항에 맞춰 에너지 자동 보정.",
    effect: "전체적인 탄력·잔주름·모공에 두루. 울쎄라(선/리프팅)와 결이 다름.",
    downtime: "뜨거운 느낌, 다운타임 거의 없음. 직후 화장 가능한 경우 많음.",
    caution: "효과는 서서히 3개월. 정품 팁·적정 샷 확인. 개인차 있음.",
    sideEffects: "열감·홍조·붓기·멍(대개 2–3일, 길어도 1주). 드물게 화상·색소침착·볼꺼짐.",
    contraindication: "체내 금속·심박동기·심한 부정맥은 RF 특성상 신중. 임신·켈로이드·마른 얼굴은 상담이 필요해요.",
    misconception: "\"샷수 많을수록 좋다\"는 오해 — 600샷이 얼굴 전체 표준 커버예요. 부위·목적에 맞는 정품팁·적정 샷이 핵심.",
    vsNote: "써마지=면(전체 탄력·모공·결) / 울쎄라=선·근막(처짐 리프팅). 국산 올리지오·텐써마는 같은 모노폴라 계열의 저가 대안.",
    goodFor: "처짐보다 전반적 탄력·주름·모공을 함께 원하는 분.",
    priceMin: 1300000, priceMax: 2000000, priceUnit: "샷300", sessions: "1회(600샷 표준) · 유지 약 12개월",
    sources: [
      { label: "FDA 510(k) K170758(2017) · 모노폴라 RF · Solta", type: "fda" },
      { label: "식약처 의료기기 허가 · 고주파자극기", type: "mfds" },
    ],
  },
  {
    id: "shrink", nameKo: "슈링크 유니버스", category: "lifting",
    tagline: "초음파로 탄력을 올리는 가성비 리프팅.",
    mechanism: "국산 집속 초음파(HIFU)를 카트리지 깊이별로 조사해 진피·SMAS에 열응고점을 만들어 콜라겐 수축·재생을 유도. 펜타입 핸드피스로 굴곡 부위 정밀 조사.",
    effect: "울쎄라보다 회당 강도는 낮지만 저렴해 반복 관리. 부위별 카트리지.",
    downtime: "울쎄라보다 통증 약함, 붓기 정도. 당일 일상 가능.",
    caution: "저강도·다회 전략. 개인차 있음.",
    sideEffects: "붉음·붓기·시술 중 통증(수시간~수일). 드물게 화상·볼꺼짐.",
    contraindication: "임신·켈로이드·시술부 감염, 마른 얼굴 볼꺼짐은 신중. 필러/실 부위는 상담이 필요해요.",
    misconception: "\"울쎄라 저렴이\"라는 오해 — 원리는 유사하나 영상가이드·에너지가 달라 같은 효과를 보장하진 않고, 저부담·잦은 유지에 맞는 별개 포지션.",
    vsNote: "슈링크=국산 초음파(영상 없음·저강도·저가) / 울쎄라=영상가이드 초음파 / 써마지=고주파 면 타이트닝.",
    goodFor: "리프팅 입문·가성비로 꾸준히 관리하려는 30–50대.",
    priceMin: 60000, priceMax: 300000, priceUnit: "회", sessions: "약 6개월 간격 반복 권장",
    sources: [{ label: "식약처 의료기기 허가 · 초음파집속자극(클래시스)", type: "mfds" }],
  },
  {
    id: "inmode", nameKo: "인모드", category: "lifting",
    tagline: "고주파로 이중턱·탄력을 다듬는 시술.",
    mechanism: "바이폴라 고주파(RF)로 두 전극 사이 진피를 국소 가열. Forma는 얕은 진피(탄력·결), FX는 프랙셔널 RF로 표피 리모델링을 표적.",
    effect: "이중턱·처진 볼살·턱선 윤곽 + 피부결. 마취 없이 열감 위주.",
    downtime: "다운타임 거의 없음, 통증 적음. 즉시 일상.",
    caution: "저강도·다회 누적형. 개인차 있음.",
    sideEffects: "홍조·온열감·경미한 부종(수시간~1일). 드물게 화상·물집·색소침착.",
    contraindication: "체내 금속·심박동기·심한 부정맥은 RF 신중. 임신·켈로이드·자가면역·광과민은 상담이 필요해요.",
    misconception: "\"한 번에 턱선 확 잡힌다\"는 오해 — 2–4주 간격 3회 이상 누적으로 서서히 나타나요.",
    vsNote: "인모드=니들 없는 표면 바이폴라 RF(탄력 위주) / 포텐자=니들로 진피에 RF 직접(흉터·모공·재생).",
    goodFor: "이중턱·턱선을 부담 적게 관리하려는 분.",
    priceMin: 60000, priceMax: 300000, priceUnit: "회", sessions: "2주 간격 3회+",
    sources: [
      { label: "FDA 510(k) · RF 타이트닝 계열", type: "fda" },
      { label: "식약처 의료기기 허가 · 고주파자극기", type: "mfds" },
    ],
  },
  {
    id: "thread", nameKo: "실리프팅", category: "lifting",
    tagline: "녹는 실로 처진 조직을 물리적으로 끌어올리는 시술.",
    mechanism: "미늘(cog)이 달린 녹는 실(PDO/PLLA)로 처진 조직을 즉시 견인·고정하고, 실 주변 이물 반응으로 신생 콜라겐을 유도. 실 흡수 후에도 지지력 일부 유지.",
    effect: "팔자·볼처짐·턱선에 즉각적 리프팅. 초음파/고주파보다 당김이 직접적.",
    downtime: "마취 후 진행. 붓기·멍 2–4주 내 호전, 이물감 1–2주 가능.",
    caution: "흡수기간(실 자체, PDO 약 6–8개월)과 효과 유지기간(부위·종류별 6–18개월)은 다름. 시술자 숙련도 영향 큼.",
    sideEffects: "멍·붓기·당김(흔함). 딤플/함몰·비대칭·실 비침·감염·일시 저림 가능(빈도는 낮은 편).",
    contraindication: "피부가 얇거나 지방이 거의 없는 분(실 비침·돌출), 처짐이 심한 경우, 켈로이드 체질, 출혈경향/항응고제 복용 시 상담이 필요해요.",
    misconception: "\"실은 한 번 넣으면 오래간다\"는 오해 — 실은 흡수성이고 효과는 유한(수개월~1년대), 유지엔 재시술이 필요해요.",
    vsNote: "실리프팅=실로 직접 물리적 견인(즉각적) / 초음파·고주파 리프팅=열로 탄력·타이트닝(당김의 직접성은 낮음).",
    goodFor: "처짐·팔자가 뚜렷해 즉각적 리프팅을 원하는 40·50대.",
    priceMin: 500000, priceMax: 2000000, priceUnit: "회", sessions: "1회 · 효과 유지 6–18개월",
    sources: [
      { label: "식약처 의료기기 허가 · 성형용 실", type: "mfds" },
      { label: "대한피부과학회 · 실리프팅 안전 자료", type: "society" },
    ],
  },
  {
    id: "potenza", nameKo: "포텐자", category: "lifting",
    tagline: "미세바늘+고주파로 모공·흉터를 다듬는 시술.",
    mechanism: "미세 니들이 진피를 천공하며 니들 끝에서 고주파(RF·모노/바이폴라, 1·2MHz)를 진피 심부에 직접 전달해 콜라겐 수축·재생을 동시 유도. 표면 손상 최소화.",
    effect: "넓은 모공·여드름 흉터·피부결·잔주름·경미한 탄력.",
    downtime: "마취크림, 다운타임 2–3일(홍조·미세딱지).",
    caution: "일회용 니들 팁·정품 확인. 개인차 있음.",
    sideEffects: "홍조·미세 출혈점·부종·격자 자국(대개 1–3일). 드물게 화상·색소침착(PIH)·감염.",
    contraindication: "임신·켈로이드/비후성 흉터·활동성 여드름·심박동기, 최근 이소트레티노인 복용·광과민은 상담이 필요해요.",
    misconception: "\"포텐자=리프팅\"이라는 오해 — 강점은 모공·흉터·피부결(진피 재생)이고, 강한 처짐 리프팅은 HIFU/모노폴라 RF의 영역.",
    vsNote: "포텐자=니들로 진피에 RF 직접 주입(재생·흉터·모공) / 인모드=표면 바이폴라 RF(탄력 위주).",
    goodFor: "모공·흉터 + 경미한 탄력을 함께 원하는 분.",
    priceMin: 190000, priceMax: 300000, priceUnit: "회", sessions: "3–4주 간격 3–5회",
    sources: [{ label: "FDA 510(k) K192545(2020) · Potenza RF 마이크로니들", type: "fda" }],
  },
  {
    id: "filler", nameKo: "필러", category: "volume",
    tagline: "꺼진 볼륨을 채워 팔자·볼을 자연스럽게.",
    mechanism: "가교 히알루론산(HA) 겔을 진피·피하에 넣어 물리적으로 공간을 채워 즉각적 볼륨을 만듦. 콜라겐 자극이 아닌 직접 충전.",
    effect: "팔자·볼·이마 볼륨 손실에 즉각적. 리프팅과 함께 처짐+꺼짐을 같이 해결.",
    downtime: "따끔함·붓기 2–3일, 멍 가능. 일상 가능.",
    caution: "HA는 히알루로니다제로 용해 가능. 정품 확인.",
    sideEffects: "멍·붓기·발적·결절(수일~2주). 중대(드묾): 혈관폐색→피부괴사·실명. 창백·심한 통증·변색 시 즉시 내원.",
    contraindication: "혈관 밀집 부위(미간·코·눈밑·팔자)는 고위험이라 특히 신중. 켈로이드·주사부 감염·임신은 상담이 필요해요.",
    misconception: "\"필러는 다 녹는다\"는 오해 — 녹는 건 HA 필러뿐, 칼슘·PLLA 등 비-HA 필러는 용해되지 않아요.",
    vsNote: "필러=HA로 즉각 물리적 볼륨(녹임 가능) / 콜라겐부스터(스컬트라·쥬베룩)=서서히 콜라겐 볼륨(녹임 불가).",
    goodFor: "팔자·볼 꺼짐이 뚜렷한 분, 리프팅 보완.",
    priceMin: 100000, priceMax: 600000, priceUnit: "부위", sessions: "1회 · 유지 6–18개월",
    sources: [
      { label: "식약처 의료기기 허가 · HA 필러(제품별)", type: "mfds" },
      { label: "RANZCO 필러 실명 가이드 · 대한피부과학회", type: "society" },
    ],
  },
  {
    id: "sculptra", nameKo: "스컬트라", category: "volume",
    tagline: "콜라겐을 새로 만들어 꺼진 볼륨을 채우는 시술.",
    mechanism: "L-PLLA(젖산 중합체) 미립구가 이물 반응으로 콜라겐 신생을 강하게·지속적으로 자극해 자가 콜라겐으로 볼륨을 회복. 분해가 느려 효과가 오래(최대 약 2년).",
    effect: "넓은 볼륨 손실·꺼진 볼/관자·탄력. 콜라겐 부스터 중 볼륨감 크고 오래감.",
    downtime: "붓기·멍. 시술 후 마사지·수화 프로토콜 필요.",
    caution: "즉각 채움이 아니라 수주~수개월에 걸쳐 볼륨 형성. 정품 확인.",
    sideEffects: "멍·붓기·통증. 지연성 결절/구진이 대표 이슈(수개월 뒤). 빈도는 희석·마사지·시술자에 크게 좌우돼 단정하기 어려움.",
    contraindication: "결절·육아종 병력·자가면역, 켈로이드·주사부 감염·임신은 상담이 필요해요.",
    misconception: "\"맘에 안 들면 필러처럼 녹인다\"는 오해 — PLLA는 히알루로니다제로 녹지 않아요.",
    vsNote: "스컬트라=강한 PLLA 콜라겐 볼륨(최대 ~2년) / 쥬베룩=PDLLA+HA(더 순함) / 필러=즉각 HA(녹임 가능).",
    goodFor: "40·50대 광범위 볼륨 소실, 오래가는 자연 볼륨을 원하는 분.",
    priceMin: 400000, priceMax: 770000, priceUnit: "바이알", sessions: "4–6주 간격 2–3회 · 유지 최대 ~2년",
    sources: [
      { label: "FDA 미용 승인(2009)·볼주름 적응증(2023) · Galderma", type: "fda" },
      { label: "식약처 의료기기 허가", type: "mfds" },
    ],
  },
  {
    id: "juvelook", nameKo: "쥬베룩", category: "volume",
    tagline: "콜라겐 생성과 물광을 함께 주는 콜라겐 부스터.",
    mechanism: "빠르게 분해되는 PDLLA 미립구가 콜라겐 신생을 자극하고, 함께 든 히알루론산(HA)이 초기 수분·물광감을 제공하는 이중 작용. 스컬트라(L-PLLA)보다 입자가 작고 분해가 빠름.",
    effect: "탄력·잔주름·피부결·자연스러운 볼륨.",
    downtime: "붓기·멍 수일.",
    caution: "국내 식약처 허가(미 FDA 미승인). 정품 확인.",
    sideEffects: "초기 좁쌀 구진(대개 24–48시간 내 완화)·멍·붓기. 콜라겐 자극제 공통으로 결절·육아종 가능(빈도 자료 상충, 단정 불가).",
    contraindication: "결절·육아종 병력, 자가면역, 켈로이드·주사부 감염·임신은 상담이 필요해요.",
    misconception: "\"맞자마자 볼륨이 찬다\"는 오해 — 초기 물광은 HA 덕분이고, 실제 볼륨은 콜라겐 생성으로 수주~수개월 뒤 서서히.",
    vsNote: "쥬베룩=PDLLA(콜라겐)+HA(초기 물광) / 스컬트라=강한 PLLA 볼륨·더 오래감 / 필러=즉각 HA 볼륨.",
    goodFor: "결절 위험을 낮추고 자연스러운 탄력·볼륨을 원하는 분.",
    priceMin: 200000, priceMax: 400000, priceUnit: "cc", sessions: "4주 간격 2–3회 · 유지 약 12–18개월",
    sources: [{ label: "식약처 허가 국산 PDLLA+HA 제제", type: "mfds" }],
  },
  {
    id: "rejuran", nameKo: "리쥬란", category: "volume",
    tagline: "피부를 안쪽부터 다시 채워주는 재생 시술.",
    mechanism: "연어 유래 폴리뉴클레오타이드(PN)를 진피에 주입해 조직 재생·항염·콜라겐 신생 환경을 유도. HA처럼 즉각 채우는 게 아니라 피부 스스로 재생을 촉진(4–12주에 걸쳐 발현).",
    effect: "피부결·잔주름·탄력·모공을 은은하게. 리프팅과 조합해 결을 함께 올림.",
    downtime: "주사 시 따끔함(마취크림). 붓기·자국 1–3일. 회복 빠른 편.",
    caution: "회차가 쌓여야 체감. 개인차 큼.",
    sideEffects: "멍·붓기·발적·엠보싱(주입 자국, 하루~며칠). 결절·통증 드묾.",
    contraindication: "연어(어류) 성분 알레르기·과민, 주사부 감염, 켈로이드·임신은 상담이 필요해요.",
    misconception: "\"리쥬란=물광\"이라는 오해 — 물광(HA)은 즉각 수분, 리쥬란(PN)은 재생 유도로 성분·기전·발현 속도가 달라요.",
    vsNote: "리쥬란=PN 재생(서서히) / 물광=HA 즉각 수분 / 쥬베룩·스컬트라=콜라겐 볼륨.",
    goodFor: "피부결·탄력을 부담 적게 관리하려는 30–50대, 리프팅 보조.",
    priceMin: 100000, priceMax: 400000, priceUnit: "회", sessions: "2–4주 간격 3–4회 코스",
    sources: [{ label: "식약처 허가(2014) · PN 제제 · 파마리서치", type: "mfds" }],
  },
  {
    id: "skinbooster", nameKo: "물광주사", category: "volume",
    tagline: "히알루론산으로 수분과 광채를 채우는 시술.",
    mechanism: "저점도·비가교 히알루론산(HA)을 진피 얕은 층에 다점 주입해 수분을 공급(보습·채움). 볼륨 충전용 가교 필러와 달리 퍼져서 수분을 공급.",
    effect: "건조·푸석함·잔결·즉각 물광. 색소보다 수분·톤.",
    downtime: "미세 붓기·주사자국 수일.",
    caution: "장기 재생 목적이면 리쥬란과 구분. 개인차 있음.",
    sideEffects: "다발성 주사자국·멍·붓기(수일), 일시적 팽진. 드물게 결절.",
    contraindication: "HA·리도카인 알레르기, 주사부 감염, 켈로이드·임신은 상담이 필요해요.",
    misconception: "\"물광도 콜라겐을 새로 만든다\"는 오해 — 주 기전은 HA 수분 공급이라 재생 부스터(리쥬란·쥬베룩)와 구분해야 해요.",
    vsNote: "물광=HA 즉각 수분·광채 / 리쥬란=PN 재생 / 필러=물리적 볼륨.",
    goodFor: "건조·푸석함, 즉각적 물광을 원하는 분.",
    priceMin: 100000, priceMax: 300000, priceUnit: "회", sessions: "2–4주 간격 3회 코스",
    sources: [{ label: "식약처 허가 · HA 스킨부스터(제품별)", type: "mfds" }],
  },
  {
    id: "botox", nameKo: "보톡스", category: "lifting",
    tagline: "표정근·저작근을 이완해 주름과 윤곽을 다듬는 시술.",
    mechanism: "보툴리눔 톡신 A형이 신경말단의 아세틸콜린 분비를 차단해 근육을 일시적으로 이완 → 동적(표정) 주름 완화. 신경 재생과 함께 서서히 소실.",
    effect: "이마·미간·눈가 동적 주름 / 사각턱(V라인) / 승모근. 2–7일 발현, 3–4개월 유지.",
    downtime: "다운타임 거의 없음, 미세 통증.",
    caution: "내성 방지 위해 최소 3개월 간격. 개인차 있음.",
    sideEffects: "멍·두통·일시적 표정 어색함. 이마 시 눈꺼풀·눈썹 처짐(수주~2–3개월 회복). 잦은 시술 시 항체(내성, 2% 미만).",
    contraindication: "임신·수유, 중증근무력증 등 신경근질환, 주사부 감염은 회피. 이마는 개안력 평가가 필요해요.",
    misconception: "\"보톡스=필러처럼 볼륨을 채운다\"는 오해 — 보톡스는 근육 이완, 필러는 충전으로 목적이 반대예요.",
    vsNote: "보톡스=근육 이완(표정 주름) / 필러=볼륨 충전.",
    goodFor: "표정 주름·사각턱이 고민인 분.",
    priceMin: 20000, priceMax: 190000, priceUnit: "부위", sessions: "3–4개월 간격",
    sources: [
      { label: "FDA 미간주름 미용 승인(2002) · Allergan", type: "fda" },
      { label: "식약처 허가 국산 톡신(보툴렉스·나보타 등)", type: "mfds" },
    ],
  },
  {
    id: "toning", nameKo: "레이저 토닝", category: "pigment",
    tagline: "색소를 여러 번에 걸쳐 옅게 만드는 관리형 시술.",
    mechanism: "저플루언스(약 1–2 J/cm²) 1064nm Q-스위치 Nd:YAG를 큰 스팟·고빈도로 반복 조사해 멜라노좀만 선택적으로 손상(아세포 선택적 광열분해). 고출력은 오히려 반동을 유발해 저출력이 핵심.",
    effect: "기미·색소침착·잡티·칙칙한 톤. 한 번보다 회차로 관리.",
    downtime: "따끔함, 다운타임 거의 없음.",
    caution: "자외선 차단·보습 필수. 개인차 있음.",
    sideEffects: "일시적 홍조. 과도·잦은 시술 시 저색소증(흰 반점) 또는 반동색소(오히려 진해짐).",
    contraindication: "기미 반동/PIH 위험군, 임신·광과민·시술부 감염은 상담이 필요해요. 자외선 차단 필수.",
    misconception: "\"한 번에 기미가 사라진다\"는 오해 — 기미는 만성·재발성이라 저출력 다회 누적이 원칙, 무리한 강출력은 반동·저색소증 위험.",
    vsNote: "토닝=나노초 Nd:YAG(열작용 큼) / 피코=피코초 광음향(열 적음·반동↓) / IPL=광대역광(표재성 잡티·홍조).",
    goodFor: "기미·잡티를 꾸준히 관리하려는 30–50대.",
    priceMin: 50000, priceMax: 150000, priceUnit: "회", sessions: "1–2주 간격 5–10회+",
    sources: [{ label: "저출력 Nd:YAG 토닝 기전 · 피부과 문헌(PMC/JCAS)", type: "society" }],
  },
  {
    id: "pico", nameKo: "피코토닝", category: "pigment",
    tagline: "짧은 펄스로 색소를 잘게 부수는 색소 시술.",
    mechanism: "피코초(10⁻¹²초) 초단 펄스가 색소에 광음향(충격파)을 가해 멜라닌을 더 잘게 분쇄(포토메카니컬). 나노초 대비 주변 조직 열전달이 적어 반동·PIH 위험이 상대적으로 낮음.",
    effect: "기미·잡티·주근깨·PIH·문신·톤. 나노 토닝보다 회차 적게 기대.",
    downtime: "미미, 다음날 화장 가능.",
    caution: "자외선 차단 필수. 개인차 있음.",
    sideEffects: "일시적 홍조·가려움, 드물게 색소 변화·물집. 저색소증·PIH 가능(0은 아님).",
    contraindication: "기미 반동/PIH 위험군, 임신·광과민·시술부 감염은 상담이 필요해요. 자외선 차단 필수.",
    misconception: "\"피코는 열이 없어 부작용 제로\"라는 오해 — 열 최소화일 뿐 저색소증·PIH·물집이 가능하고 다회·관리가 필요해요.",
    vsNote: "피코=피코초 광음향(색소 미세 분쇄·반동↓) / 토닝=나노초(열작용) / IPL=광대역광.",
    goodFor: "색소·톤을 낮은 열부담으로 관리하려는 분.",
    priceMin: 30000, priceMax: 170000, priceUnit: "회", sessions: "2–4주 간격 5–10회",
    sources: [{ label: "FDA 피코초 레이저 허가(PicoSure 2012·PicoWay)", type: "fda" }],
  },
];

export const PROCEDURE_BY_ID = Object.fromEntries(PROCEDURES.map((p) => [p.id, p]));
