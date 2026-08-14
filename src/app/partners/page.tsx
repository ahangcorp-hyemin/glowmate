import PartnerForm from "./PartnerForm";

export const metadata = {
  title: "병원 파트너 안내 | 글로우메이트",
  description: "40·50대가 '알고 가는' 병원을 찾는 곳. 광고 순위 없는 거리순 노출, 무료 프로필 등록, 정액 광고. 예약·시술 건당 수수료가 없습니다.",
};

// U5 입점 랜딩 — 소구: 4050 타깃·전국 노출·광고 순위 없음·무수수료(§27)·무료 프로필 약속.
const POINTS: [string, string, string][] = [
  ["🎯", "40·50대만 모이는 곳", "노화·리프팅 고민의 4050이 '알고 가려고' 들어옵니다. 이벤트 헌터가 아니라 상담 의사가 있는 환자군이에요."],
  ["📍", "광고 순위 없는 노출", "전국 2,791개 피부과·성형외과가 거리순으로 공정하게 노출됩니다. 병원 상세·전화·길찾기 연결까지 기본 제공."],
  ["🧾", "건당 수수료 0원", "예약·시술 건당 수수료를 받지 않습니다(의료법 §27 준수). 광고는 정액 노출만, 견적·후기 순위에 영향을 주지 않아요."],
  ["📖", "정보로 신뢰를 먼저", "시술 레슨·출처 있는 답변으로 환자가 '알고' 옵니다. 상담 시간이 설명이 아니라 결정에 쓰여요."],
];

const FREE_PROMISE = [
  "병원 프로필 등록·수정(사진·의료진·소개)",
  "새 후기 등록 시 알림",
  "잘못된 공공데이터 정보 정정 요청",
];

export default function PartnersPage() {
  return (
    <main className="shell" style={{ minHeight: "100dvh" }}>
      <div className="top">
        <div className="logo">병원 <span className="m">파트너</span></div>
      </div>

      <div className="hero" style={{ margin: "8px 22px 18px" }}>
        <div className="kick">파트너 안내</div>
        <h1 style={{ fontSize: 23 }}>알고 오는 4050 환자를<br />만나보세요.</h1>
        <p>글로우메이트는 40·50대가 병원 가기 전 정보를 정리하는 서비스입니다.</p>
      </div>

      <div className="pad">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {POINTS.map(([e, t, d]) => (
            <div key={t} className="card" style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: 15 }}>
              <span style={{ fontSize: 24, lineHeight: 1.1 }}>{e}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15.5 }}>{t}</div>
                <div className="sub" style={{ marginTop: 4, lineHeight: 1.55 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="estcard" style={{ marginTop: 14 }}>
          <div className="kick">입점하면 무료로</div>
          {FREE_PROMISE.map((t) => (
            <div key={t} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 14.5, fontWeight: 600 }}>
              <span style={{ color: "var(--hi)", fontWeight: 900 }}>✓</span>{t}
            </div>
          ))}
          <p className="disc" style={{ marginTop: 10, lineHeight: 1.55 }}>
            유료는 정액 노출 광고뿐이며 '광고' 라벨이 붙습니다. 후기·견적 결과는 광고와 무관하게 유지돼요.
          </p>
        </div>

        <div className="kick" style={{ margin: "22px 0 10px" }}>입점·제휴 문의</div>
        <PartnerForm />
        <div style={{ height: 28 }} />
      </div>
    </main>
  );
}
