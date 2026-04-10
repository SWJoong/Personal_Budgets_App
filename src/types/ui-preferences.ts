export type BlockId =
  | 'yearly_balance'
  | 'monthly_trend'
  | 'recent_transactions'
  | 'plan_shortcut'
  | 'evaluation_letter'

export interface UIPreferences {
  enabled_blocks: BlockId[]
}

export const REQUIRED_BLOCKS = ['balance_widget', 'receipt_button'] as const

export const OPTIONAL_BLOCKS: BlockId[] = [
  'yearly_balance',
  'monthly_trend',
  'recent_transactions',
  'plan_shortcut',
  'evaluation_letter',
]

export const BLOCK_METADATA: Record<BlockId, { icon: string; label: string; description: string }> = {
  yearly_balance:      { icon: '📊', label: '올해 잔액',      description: '연간 예산 남은 금액' },
  monthly_trend:       { icon: '📈', label: '월별 추이',      description: '최근 6개월 지출 그래프' },
  recent_transactions: { icon: '🕐', label: '최근 사용 내역', description: '최근 3건 사용 내역' },
  plan_shortcut:       { icon: '🤔', label: '계획 AI',        description: '오늘 활동 계획 세우기' },
  evaluation_letter:   { icon: '💌', label: '지원자 편지',    description: '지원자 선생님의 이달 편지' },
}

export const DEFAULT_PREFERENCES: UIPreferences = {
  enabled_blocks: ['yearly_balance', 'monthly_trend', 'recent_transactions', 'plan_shortcut', 'evaluation_letter'],
}
