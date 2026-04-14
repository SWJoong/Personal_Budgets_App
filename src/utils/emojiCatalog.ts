export interface EmojiEntry {
  emoji: string
  slug: string    // English slug e.g. "red_apple"
  group: string   // English group name
}

export const GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  'Smileys & Emotion':  { label: '얼굴·감정',  icon: '😀' },
  'People & Body':      { label: '사람·신체',  icon: '🙋' },
  'Animals & Nature':   { label: '동물·자연',  icon: '🐾' },
  'Food & Drink':       { label: '음식·음료',  icon: '🍎' },
  'Travel & Places':    { label: '여행·장소',  icon: '🗺️' },
  'Activities':         { label: '활동',       icon: '🎾' },
  'Objects':            { label: '사물',       icon: '📦' },
  'Symbols':            { label: '기호',       icon: '🔤' },
  'Flags':              { label: '국기',       icon: '🏳️' },
}

// The ordered group names (same order as unicode-emoji-json)
export const GROUP_ORDER = [
  'Food & Drink',
  'Animals & Nature',
  'Smileys & Emotion',
  'Activities',
  'People & Body',
  'Travel & Places',
  'Objects',
  'Symbols',
  'Flags',
]

let _cache: EmojiEntry[] | null = null

/**
 * Lazily loads the full Unicode emoji catalog.
 * Result is cached in module scope after first load.
 */
export async function loadEmojiCatalog(): Promise<EmojiEntry[]> {
  if (_cache) return _cache

  // Dynamic import keeps the heavy JSON out of the initial bundle
  const raw = await import('unicode-emoji-json/data-by-emoji.json')
  const data = raw.default as Record<string, { slug: string; group: string; skin_tone_support?: boolean }>

  _cache = Object.entries(data)
    .filter(([, v]) => !v.skin_tone_support)   // skip skin-tone variants
    .map(([emoji, v]) => ({
      emoji,
      slug: v.slug,
      group: v.group,
    }))

  return _cache
}

export function searchEmoji(catalog: EmojiEntry[], query: string): EmojiEntry[] {
  if (!query.trim()) return []
  const q = query.toLowerCase().replace(/\s+/g, '_')
  return catalog
    .filter(e => e.slug.includes(q) || e.emoji === query.trim())
    .slice(0, 24)
}

export function getEmojisByGroup(catalog: EmojiEntry[], group: string): EmojiEntry[] {
  return catalog.filter(e => e.group === group)
}
