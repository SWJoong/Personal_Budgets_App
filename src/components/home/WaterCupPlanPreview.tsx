'use client'

import { formatCurrency } from '@/utils/budget-visuals'

interface PlanOption {
  name: string
  cost: number
  icon?: string
}

interface WaterCupPlanPreviewProps {
  currentBalance: number
  totalBudget: number
  options: PlanOption[]
  selectedIndex: number | null
  /** 있으면 범례 항목이 눌러서 선택/해제되는 컨트롤이 된다(controlled). 없으면 표시 전용. */
  onSelect?: (index: number | null) => void
}

/**
 * 옵션 3계열을 시맨틱 토큰(정보/성공/경고)으로 매핑 — raw hex 대신 CSS 변수라 다크·고대비·노랑 모드에서
 * 자동 대응한다(고아 컴포넌트 복원 §2 토큰화). fg=선(점선)·글자·마커, bg=선택 배경·번호 배지 배경.
 */
const OPTION_TOKENS = [
  { fg: 'var(--color-info-fg)', bg: 'var(--color-info-bg)' },
  { fg: 'var(--color-success-fg)', bg: 'var(--color-success-bg)' },
  { fg: 'var(--color-warning-fg)', bg: 'var(--color-warning-bg)' },
] as const

export default function WaterCupPlanPreview({
  currentBalance,
  totalBudget,
  options,
  selectedIndex,
  onSelect,
}: WaterCupPlanPreviewProps) {
  const budget = totalBudget || currentBalance

  // 선택된 옵션의 비용으로 실제 물 높이 계산
  const displayBalance = selectedIndex !== null
    ? currentBalance - options[selectedIndex].cost
    : currentBalance

  const displayRatio = budget > 0
    ? Math.max(0, Math.min(100, (displayBalance / budget) * 100))
    : 0

  const currentRatio = budget > 0
    ? Math.max(0, Math.min(100, (currentBalance / budget) * 100))
    : 0

  const isOver = displayBalance < 0
  // 물색: 초과=위험 토큰, 선택시=그 옵션 계열, 선택 전=브랜드 토큰(내 돈). 전부 테마 대응 CSS 변수.
  const waterColor = isOver
    ? 'var(--color-danger-fg)'
    : selectedIndex !== null
      ? OPTION_TOKENS[selectedIndex % OPTION_TOKENS.length].fg
      : 'var(--color-primary)'

  return (
    <div className="bg-card rounded-[2rem] p-6 ring-1 ring-border shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">쓰면 얼마가 남을까요?</span>
        <span className="text-sm font-black text-muted-foreground">
          남는 돈: {formatCurrency(Math.max(0, displayBalance))}원
        </span>
      </div>

      {/* 물컵 + 범례 레이아웃 */}
      <div className="flex items-end gap-6">
        {/* 물컵 시각화 */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative w-24 h-40">
            {/* 컵 테두리 */}
            <div className="absolute inset-0 border-4 border-border rounded-b-3xl rounded-t-lg bg-muted overflow-hidden">
              {/* 현재 잔액 물 (선택 전 기준선) */}
              {selectedIndex !== null && (
                <div
                  className="absolute bottom-0 w-full bg-muted transition-none"
                  style={{ height: `${currentRatio}%`, opacity: 0.4 }}
                />
              )}

              {/* 선택된 옵션의 물 높이 */}
              <div
                className="absolute bottom-0 w-full transition-all duration-700 ease-in-out"
                style={{
                  height: `${displayRatio}%`,
                  backgroundColor: waterColor,
                  opacity: 0.75,
                }}
              />

              {/* 각 옵션별 점선 수위 표시 */}
              {options.map((option, i) => {
                const remaining = currentBalance - option.cost
                const ratio = budget > 0 ? Math.max(0, Math.min(100, (remaining / budget) * 100)) : 0
                const token = OPTION_TOKENS[i % OPTION_TOKENS.length]
                const isSelected = selectedIndex === i
                return (
                  <div
                    key={i}
                    className="absolute w-full transition-all duration-300"
                    style={{
                      bottom: `${ratio}%`,
                      borderTop: `2px dashed ${token.fg}`,
                      opacity: isSelected ? 1 : 0.5,
                    }}
                  >
                    <span
                      className="absolute -right-1 -top-3 text-[9px] font-black px-1 rounded"
                      style={{ color: token.fg, backgroundColor: token.bg }}
                    >
                      {i + 1}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 컵 손잡이 */}
            <div className="absolute -right-3 top-6 h-10 w-3.5 border-4 border-border rounded-r-full" />

            {/* 퍼센트 표시 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-black drop-shadow-sm ${isOver ? 'text-danger-fg' : 'text-muted-foreground'}`}>
                {Math.round(displayRatio)}%
              </span>
            </div>
          </div>

          <span className="text-[10px] font-bold text-muted-foreground">남은 돈</span>
        </div>

        {/* 옵션별 범례 — onSelect 가 있으면 누를 수 있는 컨트롤(선택/해제·aria-pressed·44px) */}
        <div className="flex-1 flex flex-col gap-3">
          {options.map((option, i) => {
            const remaining = currentBalance - option.cost
            const token = OPTION_TOKENS[i % OPTION_TOKENS.length]
            const isSelected = selectedIndex === i
            const isOptionOver = remaining < 0

            return (
              <button
                key={i}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect?.(isSelected ? null : i)}
                className={`w-full text-left flex items-center gap-2 p-3 rounded-xl border-2 min-h-[44px] transition-all duration-300 ${
                  isSelected ? 'shadow-sm' : 'opacity-70'
                }`}
                style={{
                  backgroundColor: isSelected ? token.bg : undefined,
                  borderColor: isSelected ? token.fg : 'transparent',
                }}
              >
                {/* 점선 색상 마커 */}
                <span
                  aria-hidden="true"
                  className="block w-4 h-4 rounded-sm shrink-0 border-2"
                  style={{
                    borderColor: token.fg,
                    background: `repeating-linear-gradient(90deg, color-mix(in srgb, ${token.fg} 40%, transparent) 0 3px, transparent 3px 6px)`,
                  }}
                />
                <span className="flex-1 min-w-0 block">
                  <span className="block text-xs font-black text-muted-foreground truncate">{option.name}</span>
                  <span className="block text-[10px] font-bold text-muted-foreground">쓸 돈 {formatCurrency(option.cost)}원</span>
                </span>
                <span className="text-right shrink-0 block">
                  <span className={`block text-xs font-black ${isOptionOver ? 'text-danger-fg' : isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {isOptionOver ? '돈이 모자라요' : formatCurrency(remaining) + '원'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 현재 잔액 기준 표시 */}
      <div className="mt-4 pt-3 border-t border-border flex justify-between text-[10px] font-bold text-muted-foreground">
        <span>지금 있는 돈: {formatCurrency(currentBalance)}원</span>
        {selectedIndex !== null && (
          <span className={displayBalance < 0 ? 'text-danger-fg' : 'text-muted-foreground'}>
            고른 후: {formatCurrency(Math.max(0, displayBalance))}원
          </span>
        )}
      </div>
    </div>
  )
}
