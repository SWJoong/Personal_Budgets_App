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
  yearly_balance:      { icon: '📊', label: '올해 남은 돈',    description: '1년 동안 남은 돈' },
  monthly_trend:       { icon: '📈', label: '달마다 쓴 돈',    description: '최근 6달 동안 쓴 돈 그림' },
  recent_transactions: { icon: '🕐', label: '최근에 쓴 돈',    description: '최근 3번 쓴 돈 목록' },
  plan_shortcut:       { icon: '🤔', label: '오늘 계획',       description: '오늘 활동 계획 세우기' },
  calendar_shortcut:   { icon: '📅', label: '달력 바로가기',   description: '이번 달 활동을 달력에서 확인' },
  evaluation_letter:   { icon: '💌', label: '선생님 편지',     description: '선생님이 이번 달에 써준 편지' },
  weekly_chart:        { icon: '📉', label: '이번 주 쓴 돈',   description: '최근 7일 하루마다 쓴 돈' },
  source_view:         { icon: '💳', label: '돈 종류별 보기',  description: '돈 종류별 남은 돈' },
  map_widget:          { icon: '🗺️', label: '활동 지도',       description: '돈을 쓴 곳을 지도에서 봐요' },
  activity_gallery:    { icon: '🖼️', label: '활동 사진',       description: '활동 사진 모아보기' },
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
