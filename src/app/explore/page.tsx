import Link from "next/link";
import Icon from "@/components/Icon";
import TabBar from "@/components/TabBar";

// 탐색(후기 필러) — MVP는 수집 모드: 4050 검증후기가 쌓이면 유튜브·홈쇼핑식 탐색 피드로 전환.
// P0-5(후기 수집 폼)가 여기의 첫 기능.

export const metadata = {
  title: "또래 후기 탐색 | 글로우메이트",
  description: "40·50대의 진짜 시술 경험담을 모으고 있어요. 과장 없는 후기만, 검증해서 보여드릴게요.",
};

export default function ExplorePage() {
  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div className="top">
        <div className="logo">또래 <span className="m">후기</span></div>
      </div>
      <div className="pad" style={{ flex: 1 }}>
        <p className="sub" style={{ margin: "2px 0 18px", lineHeight: 1.55 }}>
          또래의 진짜 경험담이 모이는 곳. 과장 후기는 거르고, 검증된 이야기만 보여드릴 거예요.
        </p>

        <div className="estcard" style={{ textAlign: "center", padding: "28px 20px" }}>
          <div style={{ display: "flex", justifyContent: "center", color: "var(--sage)" }}><Icon name="sparkle" size={34} /></div>
          <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8 }}>지금 첫 후기들을 모으고 있어요</div>
          <p className="sub" style={{ marginTop: 8, lineHeight: 1.6 }}>
            받아보신 시술이 있다면 경험을 나눠주세요.<br />
            같은 고민을 하는 또래에게 큰 도움이 돼요.
          </p>
          <Link href="/explore/write" className="reset">
            <button className="btn" style={{ marginTop: 14 }}>후기 남기기 →</button>
          </Link>
          <p className="disc" style={{ marginTop: 8 }}>익명 · 검수 후 공개 · 영수증 첨부 시 인증 배지</p>
        </div>

        <div className="kick" style={{ margin: "20px 0 10px" }}>기다리는 동안</div>
        <Link href="/hospitals" className="reset">
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>내 주변 병원 탐색</div>
              <div className="sub" style={{ marginTop: 4 }}>전국 2,791곳 · 광고 순위 없이 가까운 순</div>
            </div>
            <span style={{ color: "var(--coral)", fontWeight: 900, fontSize: 18 }}>→</span>
          </div>
        </Link>
        <Link href="/learn" className="reset">
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>후기, 이건 걸러야 해요</div>
              <div className="sub" style={{ marginTop: 4 }}>레슨에서 후기 읽는 법부터 연습해보세요</div>
            </div>
            <span style={{ color: "var(--coral)", fontWeight: 900, fontSize: 18 }}>→</span>
          </div>
        </Link>
        <div style={{ height: 20 }} />
      </div>
      <TabBar />
    </main>
  );
}
