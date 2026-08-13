"use client";

import { motion } from "framer-motion";
import GlowGuide from "@/components/GlowGuide";

// 유입 순간의 후킹 애니메이션.
// 스토리: 시술 이름들이 머릿속을 맴돌며 "뭘 받지…?" 고민(confusion)
//        → 글로우메이트가 근거로 '정리'해 추천 조합으로 수렴(clarity). 무한 반복.
// 이게 곧 제품의 핵심 가치(고민→근거 있는 정리)를 3초 안에 전달한다.

const LOOP = 5.4;
// 하나의 공유 타임라인. 0.1~0.46 고민, 0.58~ 정리 완료.
const TIMES = [0, 0.1, 0.46, 0.58, 0.66, 1];

// 얼굴 주변에 흩뿌려질 시술 이름들(중심 기준 px 오프셋)
const CHIPS = [
  { t: "울쎄라?", x: -92, y: -6, r: -7 },
  { t: "실리프팅?", x: 84, y: -20, r: 6 },
  { t: "필러?", x: -104, y: 46, r: -4 },
  { t: "써마지?", x: 96, y: 40, r: 5 },
  { t: "리쥬란?", x: -4, y: 80, r: -3 },
];

export default function GlowHero({ height = 214 }: { height?: number }) {
  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden" }} aria-hidden>
      {/* 정리 순간의 은은한 후광 링 */}
      <motion.div
        style={{
          position: "absolute", left: "50%", top: 78, width: 150, height: 150,
          marginLeft: -75, marginTop: -75, borderRadius: "50%",
          border: "2px solid var(--coral)",
        }}
        animate={{ opacity: [0, 0, 0, 0.5, 0.25, 0], scale: [0.6, 0.6, 0.6, 1, 1.25, 1.4] }}
        transition={{ duration: LOOP, repeat: Infinity, ease: "easeInOut", times: TIMES }}
      />

      {/* 얼굴 — 고민(think) → 해결(happy) 크로스페이드 */}
      <div style={{ position: "absolute", left: "50%", top: 78, transform: "translate(-50%,-50%)" }}>
        <motion.div
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}
          animate={{ opacity: [1, 1, 1, 0, 0, 0] }}
          transition={{ duration: LOOP, repeat: Infinity, ease: "easeInOut", times: TIMES }}
        >
          <GlowGuide mood="think" size={104} />
        </motion.div>
        <motion.div
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}
          animate={{ opacity: [0, 0, 0, 1, 1, 1] }}
          transition={{ duration: LOOP, repeat: Infinity, ease: "easeInOut", times: TIMES }}
        >
          <GlowGuide mood="happy" size={104} />
        </motion.div>
      </div>

      {/* 맴도는 시술 이름 칩 → 중심으로 수렴하며 사라짐 */}
      {CHIPS.map((c, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute", left: "50%", top: 78, transform: "translate(-50%,-50%)",
            fontSize: 13, fontWeight: 800, whiteSpace: "nowrap",
            padding: "6px 11px", borderRadius: 999,
            background: "var(--white)", border: "1.5px solid var(--coral-soft)",
            color: "var(--coral)", boxShadow: "0 4px 14px rgba(240,86,60,0.10)",
          }}
          animate={{
            opacity: [0, 1, 1, 0.4, 0, 0],
            x: [c.x, c.x, c.x * 1.04, 0, 0, 0],
            y: [c.y - 6, c.y, c.y + 6, 0, 0, 0],
            scale: [0.8, 1, 1, 0.5, 0.4, 0.4],
            rotate: [c.r, c.r * -1, c.r, 0, 0, 0],
          }}
          transition={{ duration: LOOP, repeat: Infinity, ease: "easeInOut", times: TIMES, delay: i * 0.04 }}
        >
          {c.t}
        </motion.div>
      ))}

      {/* 고민 단계 '?' 말풍선 */}
      <motion.div
        style={{
          position: "absolute", left: "50%", top: 8, transform: "translateX(18px)",
          fontSize: 26, fontWeight: 900, color: "var(--coral)",
        }}
        animate={{ opacity: [0, 1, 1, 0, 0, 0], y: [4, 0, -2, -6, -6, -6] }}
        transition={{ duration: LOOP, repeat: Infinity, ease: "easeInOut", times: TIMES }}
      >
        ?
      </motion.div>

      {/* 정리 완료 — 추천 조합 카드 슬라이드업 */}
      <motion.div
        style={{
          position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          padding: "9px 14px", borderRadius: 14,
          background: "var(--white)", border: "1.5px solid var(--coral)",
          boxShadow: "0 8px 22px rgba(240,86,60,0.16)",
        }}
        animate={{ opacity: [0, 0, 0, 1, 1, 0], y: [14, 14, 14, 0, 0, 0] }}
        transition={{ duration: LOOP, repeat: Infinity, ease: "easeInOut", times: TIMES }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>울쎄라 + 리쥬란</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--hi)", background: "var(--hi-bg)", padding: "3px 8px", borderRadius: 8 }}>✓ 근거 있음</span>
      </motion.div>
    </div>
  );
}
