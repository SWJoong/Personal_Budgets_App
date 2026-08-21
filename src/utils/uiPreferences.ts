/**
 * 화면 개인화(ui_preferences) 정규화 — 순수 로직. 서버/클라이언트 공용, 테스트 가능.
 * 설계: Plan&Source/goala_ui_preferences_W.md. 골든: uiPreferences.test.ts. RLS: verify_ui_preferences_rls.sql.
 *
 * participants.ui_preferences(JSONB)는 신뢰할 수 없는 클라이언트 입력이다. 저장·읽기 모두 이 함수로
 * 정규화해 (a)알 수 없는·필수 블록 제거 (b)중복 제거 (c)정본 순서 (d)잘못된 값→기본값 을 강제한다.
 */

export type BlockId =
  | 'domain_breakdown'
  | 'recent_usages'
  | 'calendar_shortcut'
  | 'plan_shortcut'
  | 'map_shortcut'
  | 'gallery'

export type BalanceWidgetStyle = 'pie' | 'water' | 'cash' | 'emoji' | 'text'

export interface UIPreferences {
  enabled_blocks: BlockId[]
  balance_widget_style: BalanceWidgetStyle
  balance_emoji?: string
}

/** 당사자/담당이 토글하는 선택 블록 — 정본 순서(설계 §3). */
export const OPTIONAL_BLOCKS: BlockId[] = [
  'domain_breakdown',
  'recent_usages',
  'calendar_shortcut',
  'plan_shortcut',
  'map_shortcut',
  'gallery',
]

/** 항상 표시(토글 불가) — enabled_blocks 에 섞이면 안 된다. */
export const REQUIRED_BLOCKS: readonly string[] = ['balance_widget', 'record_button', 'copay']

/** 설정 화면용 메타(아이콘·라벨·설명). 라벨은 easy-read. */
export const BLOCK_METADATA: Record<BlockId, { icon: string; label: string; description: string }> = {
  domain_breakdown: { icon: '🧭', label: '어디에 썼는지', description: '영역별 남은 돈' },
  recent_usages: { icon: '🕐', label: '최근에 쓴 돈', description: '최근 쓴 목록' },
  calendar_shortcut: { icon: '📅', label: '달력', description: '이번 달 활동' },
  plan_shortcut: { icon: '🤔', label: '나의 계획', description: '내 이용계획' },
  map_shortcut: { icon: '🗺️', label: '지도', description: '쓸 수 있는·쓴 곳' },
  gallery: { icon: '🖼️', label: '활동 사진', description: '사진 모아보기' },
}

const BALANCE_WIDGET_STYLES = new Set<string>(['pie', 'water', 'cash', 'emoji', 'text'])
const DEFAULT_BALANCE_EMOJI = '🍎'

/** 기본값 — 자기 정규화 불변(sanitize(DEFAULT)===DEFAULT). 기본은 선택 블록 전부 표시. */
export const DEFAULT_PREFERENCES: UIPreferences = {
  enabled_blocks: [...OPTIONAL_BLOCKS],
  balance_widget_style: 'pie',
  balance_emoji: DEFAULT_BALANCE_EMOJI,
}

function normalizeStyle(v: unknown): BalanceWidgetStyle {
  if (v === 'pouch') return 'pie' // 레거시 위젯 스타일 이관
  if (typeof v === 'string' && BALANCE_WIDGET_STYLES.has(v)) return v as BalanceWidgetStyle
  return 'pie'
}

/** 신뢰할 수 없는 JSON → 정규화된 UIPreferences. 멱등. */
export function sanitizeUIPreferences(raw: unknown): UIPreferences {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!obj) {
    return {
      enabled_blocks: [...DEFAULT_PREFERENCES.enabled_blocks],
      balance_widget_style: DEFAULT_PREFERENCES.balance_widget_style,
      balance_emoji: DEFAULT_PREFERENCES.balance_emoji,
    }
  }

  const optSet = new Set<string>(OPTIONAL_BLOCKS)
  const rawBlocks = obj.enabled_blocks
  let enabled_blocks: BlockId[]
  if (Array.isArray(rawBlocks)) {
    // 유효한 선택 블록만(필수·미지 제거), 중복 제거, 정본 순서로 정규화.
    const seen = new Set<string>()
    for (const b of rawBlocks) if (typeof b === 'string' && optSet.has(b)) seen.add(b)
    enabled_blocks = OPTIONAL_BLOCKS.filter((b) => seen.has(b))
  } else {
    // 배열이 아니면(누락·조작) 기본값 블록.
    enabled_blocks = [...DEFAULT_PREFERENCES.enabled_blocks]
  }

  const balance_emoji =
    typeof obj.balance_emoji === 'string' && obj.balance_emoji ? obj.balance_emoji : DEFAULT_BALANCE_EMOJI

  return {
    enabled_blocks,
    balance_widget_style: normalizeStyle(obj.balance_widget_style),
    balance_emoji,
  }
}
