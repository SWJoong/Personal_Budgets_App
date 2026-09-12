import { MoneyText } from '@/components/ui/MoneyText'
import { formatCurrency } from '@/utils/budget-visuals'
import type { BalanceWidgetStyle } from '@/utils/uiPreferences'

/**
 * BalanceWidget — 당사자 홈 "지금 쓸 수 있는 돈" 시각 잔액 위젯 (F0 인지 접근성 복원).
 * 설계: Plan&Source/goala_balance_widget_roleswitch_W.md §1. 계약: BalanceWidget.test.tsx.
 *
 * ★인지·SR 원칙: 정보는 그래픽 '모양·색'만으로 전달하지 않는다. 라벨("지금 쓸 수 있는 돈")·금액·
 *   남은 비율(%)을 **항상 텍스트로도** 노출하고, 장식 그래픽(SVG·이모지)은 aria-hidden 으로 둔다.
 *   위젯 전체를 role="img" + aria-label(라벨+금액+비율 한 문장) 로 요약해 SR 은 한 번에 읽는다.
 *
 * 색은 시맨틱 토큰만 사용한다(raw 팔레트 금지). 남은 비율대→상태 밴드→토큰으로 매핑한다
 *   (높을수록 긍정=초록, 낮을수록 경고/위험). 표면은 히어로(bg-hero) 유지.
 */

export interface BalanceWidgetProps {
  remaining: number
  total: number
  spent: number
  style: BalanceWidgetStyle
  emoji: string
}

type Band = 'success' | 'info' | 'warning' | 'danger'

/** 남은 비율 → 상태 밴드. 높을수록 긍정(초록), 낮을수록 경고/위험. */
function ratioBand(ratio: number): Band {
  if (ratio >= 61) return 'success'
  if (ratio >= 41) return 'info'
  if (ratio >= 21) return 'warning'
  return 'danger'
}

/** 채움 그래픽(도넛 호·물·지폐)의 진행색 — 시맨틱 솔리드 토큰(stroke/fill=currentColor 로 상속). */
const FILL_COLOR: Record<Band, string> = {
  success: 'text-positive',
  info: 'text-info-solid',
  warning: 'text-warning',
  danger: 'text-danger',
}

/** 남은 비율 배지 — 파스텔 bg/fg 쌍(시맨틱 토큰). */
const PILL: Record<Band, string> = {
  success: 'bg-success-bg text-success-fg',
  info: 'bg-info-bg text-info-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
}

export default function BalanceWidget({ remaining, total, style, emoji }: BalanceWidgetProps) {
  // 나눗셈 방어: total 0 → 0%. 이상치 방어로 0~100 클램프.
  const ratio = total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0
  const band = ratioBand(ratio)
  const label = '지금 쓸 수 있는 돈'
  // aria-label 의 금액은 MoneyText 와 동일 포맷(formatCurrency + '원')으로 맞춘다.
  const amountText = `${formatCurrency(Math.round(remaining))}원`
  const ariaLabel = `${label} ${amountText}, 전체의 ${ratio}%`

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="p-8 rounded-3xl bg-hero text-hero-foreground flex flex-col items-center gap-4"
    >
      {/* 시각 표현(장식) — 정보는 아래 텍스트가 담당하므로 그래픽은 aria-hidden. */}
      <BalanceVisual style={style} ratio={ratio} band={band} emoji={emoji} />

      {/* 텍스트(지적·시각 공통) — 라벨·금액·남은 비율을 반드시 글자로도. */}
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-bold text-hero-foreground/70">{label}</span>
        <span className={`${style === 'text' ? 'text-5xl' : 'text-4xl'} font-black tracking-tight`}>
          <MoneyText value={remaining} emphasis="hero" onHero />
        </span>
        <span
          className={`mt-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${PILL[band]}`}
        >
          전체의 <strong>{ratio}%</strong>
        </span>
      </div>
    </div>
  )
}

/** 스타일별 장식 그래픽. 정보는 텍스트가 담당하므로 전부 aria-hidden(또는 role=img 컨테이너가 흡수). */
function BalanceVisual({
  style,
  ratio,
  band,
  emoji,
}: {
  style: BalanceWidgetStyle
  ratio: number
  band: Band
  emoji: string
}) {
  const fill = FILL_COLOR[band]

  if (style === 'text') {
    // 큰 숫자만(현행 히어로와 동등) — 별도 그래픽 없음. 아래 금액이 크게 표시된다.
    return null
  }

  if (style === 'emoji') {
    // 고른 이모지를 크게. role=img 컨테이너가 접근 이름을 담당하므로 SR 중복이 없다.
    return (
      <span className="text-7xl leading-none" aria-hidden="true">
        {emoji}
      </span>
    )
  }

  if (style === 'pie') {
    // 도넛: 남은 비율만큼 호를 채운다(-90° 회전으로 12시 방향 시작).
    const r = 42
    const c = 2 * Math.PI * r
    const filled = (c * ratio) / 100
    return (
      <svg aria-hidden="true" viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="12"
          stroke="currentColor"
          className="text-hero-foreground/20"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={`${filled} ${c - filled}`}
          className={fill}
        />
      </svg>
    )
  }

  if (style === 'water') {
    // 컵: 바닥부터 남은 비율만큼 물이 찬다.
    const innerH = 64
    const fillH = (ratio / 100) * innerH
    const y = 16 + (innerH - fillH)
    return (
      <svg aria-hidden="true" viewBox="0 0 100 100" className="w-24 h-28">
        <rect
          x="26"
          y="16"
          width="48"
          height={innerH}
          rx="8"
          fill="none"
          strokeWidth="4"
          stroke="currentColor"
          className="text-hero-foreground/30"
        />
        <rect x="30" y={y} width="40" height={fillH} rx="4" fill="currentColor" className={fill} />
      </svg>
    )
  }

  // cash: 남은 비율만큼 지폐가 쌓인다(0~5장).
  const bills = Math.max(0, Math.min(5, Math.round(ratio / 20)))
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="w-28 h-28">
      {[0, 1, 2, 3, 4].map((i) => {
        const on = i < bills
        const yy = 68 - i * 12
        return (
          <rect
            key={i}
            x="18"
            y={yy}
            width="64"
            height="16"
            rx="3"
            strokeWidth="2"
            stroke="currentColor"
            fill={on ? 'currentColor' : 'none'}
            className={on ? fill : 'text-hero-foreground/25'}
          />
        )
      })}
    </svg>
  )
}
