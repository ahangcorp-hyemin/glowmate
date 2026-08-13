"use client";

import { motion } from "framer-motion";

export type Mood = "hi" | "think" | "happy";

/** 글로우메이트 가이드 캐릭터 — 부드러운 얼굴 SVG + framer-motion.
 *  고민을 '털어놓는' 순간을 임상적이지 않고 친근하게. 감정 과잉은 절제(4050·의료인접). */
export default function GlowGuide({ mood = "hi", arrows = false, size = 132 }: { mood?: Mood; arrows?: boolean; size?: number }) {
  return (
    <motion.div
      style={{ width: size, height: size }}
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" width={size} height={size}>
        {/* 볼 홍조 */}
        <ellipse cx="70" cy="112" rx="12" ry="8" fill="#F7C9BC" opacity="0.7" />
        <ellipse cx="130" cy="112" rx="12" ry="8" fill="#F7C9BC" opacity="0.7" />
        {/* 얼굴 */}
        <ellipse cx="100" cy="100" rx="60" ry="68" fill="#FBEDE7" stroke="#F2D8CC" strokeWidth="2.5" />
        {/* 눈 (깜빡임) */}
        {[80, 120].map((cx) => (
          <motion.ellipse
            key={cx}
            cx={cx} cy="94" rx="6" ry="7" fill="#3A3330"
            animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
            style={{ transformOrigin: `${cx}px 94px` }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
          />
        ))}
        {/* 입 */}
        {mood === "happy" ? (
          <path d="M76 116 Q100 142 124 116" stroke="#3A3330" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        ) : mood === "think" ? (
          <path d="M88 122 Q100 128 112 122" stroke="#3A3330" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M80 118 Q100 134 120 118" stroke="#3A3330" strokeWidth="4" fill="none" strokeLinecap="round" />
        )}

        {/* 리프팅 화살표(고민 단계) */}
        {arrows && (
          <>
            <motion.path
              d="M40 128 Q34 96 52 74" stroke="#F0563C" strokeWidth="4" fill="none" strokeLinecap="round"
              animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.8, repeat: Infinity }} />
            <path d="M52 74 l-9 3 M52 74 l1 9" stroke="#F0563C" strokeWidth="4" fill="none" strokeLinecap="round" />
            <motion.path
              d="M160 128 Q166 96 148 74" stroke="#F0563C" strokeWidth="4" fill="none" strokeLinecap="round"
              animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }} />
            <path d="M148 74 l9 3 M148 74 l-1 9" stroke="#F0563C" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* 생각 점 3개 */}
        {mood === "think" &&
          [70, 100, 130].map((cx, i) => (
            <motion.circle
              key={cx} cx={cx} cy="184" r="5" fill="#F0563C"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
          ))}

        {/* 반짝임(결과) */}
        {mood === "happy" &&
          [[46, 60], [156, 66], [150, 150]].map(([x, y], i) => (
            <motion.g key={i} animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4 }} style={{ transformOrigin: `${x}px ${y}px` }}>
              <path d={`M${x} ${y - 7} L${x + 2} ${y} L${x + 9} ${y} L${x + 3} ${y + 3} L${x} ${y + 9} L${x - 3} ${y + 3} L${x - 9} ${y} L${x - 2} ${y} Z`} fill="#F0A93C" />
            </motion.g>
          ))}
      </svg>
    </motion.div>
  );
}
