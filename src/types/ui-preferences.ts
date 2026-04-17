export type BlockId =
  | 'yearly_balance'
  | 'monthly_trend'
  | 'recent_transactions'
  | 'plan_shortcut'
  | 'calendar_shortcut'
  | 'evaluation_letter'
  | 'weekly_chart'
  | 'source_view'
  | 'map_widget'
  | 'activity_gallery'

export interface UIPreferences {
  enabled_blocks: BlockId[]
}

export const REQUIRED_BLOCKS = ['balance_widget', 'receipt_button'] as const

export const OPTIONAL_BLOCKS: BlockId[] = [
  'yearly_balance',
  'monthly_trend',
  'recent_transactions',
  'plan_shortcut',
  'calendar_shortcut',
  'evaluation_letter',
  'weekly_chart',
  'source_view',
  'map_widget',
  'activity_gallery',
]

export const BLOCK_METADATA: Record<BlockId, { icon: string; label: string; description: string }> = {
  yearly_balance:      { icon: '📊', label: '올해 잔액',      description: '연간 예산 남은 금액' },
  monthly_trend:       { icon: '📈', label: '월별 추이',      description: '최근 6개월 지출 그래프' },
  recent_transactions: { icon: '🕐', label: '최근 사용 내역', description: '최근 3건 사용 내역' },
  plan_shortcut:       { icon: '🤔', label: '계획 AI',        description: '오늘 활동 계획 세우기' },
  calendar_shortcut:   { icon: '📅', label: '달력 바로가기',   description: '이번 달 활동을 달력에서 확인' },
  evaluation_letter:   { icon: '💌', label: '지원자 편지',    description: '지원자 선생님의 이달 편지' },
  weekly_chart:        { icon: '📉', label: '이번 주 지출',   description: '최근 7일 하루별 지출 막대 그래프' },
  source_view:         { icon: '💳', label: '재원별 보기',    description: '재원(돈의 종류)별 잔액 카드' },
  map_widget:          { icon: '🗺️', label: '활동 지도',      description: '거래 장소를 지도에서 확인' },
  activity_gallery:    { icon: '🖼️', label: '활동 사진',      description: '활동 사진 모아보기' },
}

export const DEFAULT_PREFERENCES: UIPreferences = {
  enabled_blocks: [
    'yearly_balance',
    'monthly_trend',
    'recent_transactions',
    'plan_shortcut',
    'evaluation_letter',
    'weekly_chart',
  ],
}
