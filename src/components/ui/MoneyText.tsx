import { formatCurrency } from '@/utils/budget-visuals'

/**
 * MoneyText — 금액 렌더러 프리미티브 (계약: src/components/ui/MoneyText.test.tsx).
 * 지역 won() 헬퍼 16개 + ko-KR 호출부 17곳 + 반올림 분기를 정본 1개로 통일한다.
 * 포맷은 공유 budget-visuals.formatCurrency 에 위임(단일 진실원천) — MoneyText 는
 * Math.round 로 정규 반올림 후 '원' 접미사를 붙인다(formatCurrency 시그니처 불변).
 * 지출은 색이 아니라 글자 단서(선행 '-')로도 표시 → 고대비 모드에서 비색큐(S5) 보장.
 */

export type MoneyEmphasis = 'hero' | 'body' | 'muted'
export type MoneySign = 'expense' | 'income' | 'none'

export interface MoneyTextProps {
  value: number
  emphasis?: MoneyEmphasis
  sign?: MoneySign
  onHero?: boolean
}

export function MoneyText({ value, emphasis = 'body', sign = 'none', onHero = false }: MoneyTextProps) {
  // 정규 반올림 → ko-KR 그룹화 → '원' 접미사(한 텍스트 노드로 인접 렌더).
  const amount = `${formatCurrency(Math.round(value))}원`
  // 지출은 색 없이도 구분되도록 선행 부호를 붙인다(고대비 대비).
  const text = sign === 'expense' ? `-${amount}` : amount

  const colorClass = onHero
    ? 'text-hero-foreground'
    : sign === 'expense'
      ? 'text-danger'
      : sign === 'income'
        ? 'text-positive'
        : emphasis === 'muted'
          ? 'text-muted-foreground'
          : 'text-foreground'

  return <span className={`tabular-nums ${colorClass}`}>{text}</span>
}
