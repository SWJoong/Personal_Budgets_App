'use client'

/**
 * 한국 원화 지폐 단순화 SVG 일러스트
 * - 실제 지폐 색상과 인물 실루엣을 반영
 * - 당사자가 "이 돈이 진짜 돈과 비슷하다"고 느낄 수 있도록 디자인
 */

interface BillConfig {
  bg: string
  accent: string
  portrait: string
}

const BILL_CONFIGS: Record<number, BillConfig> = {
  50000: { bg: '#fef9c3', accent: '#a16207', portrait: '신사임당' },
  10000: { bg: '#dcfce7', accent: '#15803d', portrait: '세종대왕' },
  5000:  { bg: '#ffedd5', accent: '#c2410c', portrait: '율곡' },
  1000:  { bg: '#dbeafe', accent: '#1d4ed8', portrait: '퇴계' },
}

export default function BillSvg({ value }: { value: number }) {
  const c = BILL_CONFIGS[value] || BILL_CONFIGS[1000]
  const label = value >= 10000 ? `${value / 10000}만` : `${value / 1000}천`

  return (
    <svg viewBox="0 0 120 50" className="w-full h-full" aria-label={`${value}원 지폐`}>
      {/* 지폐 배경 */}
      <rect x="1" y="1" width="118" height="48" rx="4"
        fill={c.bg} stroke={c.accent} strokeWidth="1.5" />

      {/* 테두리 장식 */}
      <rect x="6" y="6" width="108" height="38" rx="2"
        fill="none" stroke={c.accent} strokeWidth="0.5" opacity="0.3" />

      {/* 인물 실루엣 (원형 프레임) */}
      <circle cx="30" cy="25" r="14" fill={c.accent} opacity="0.1" />
      {/* 머리 */}
      <circle cx="30" cy="19" r="5.5" fill={c.accent} opacity="0.25" />
      {/* 몸 */}
      <ellipse cx="30" cy="32" rx="9" ry="6" fill={c.accent} opacity="0.15" />

      {/* 금액 */}
      <text x="80" y="22" textAnchor="middle"
        fontSize="13" fontWeight="900" fill={c.accent}>
        {label}
      </text>
      <text x="80" y="36" textAnchor="middle"
        fontSize="9" fontWeight="700" fill={c.accent} opacity="0.5">
        원
      </text>

      {/* 작은 장식 원 */}
      <circle cx="10" cy="10" r="3" fill={c.accent} opacity="0.08" />
      <circle cx="110" cy="40" r="3" fill={c.accent} opacity="0.08" />
    </svg>
  )
}
