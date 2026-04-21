// 'YYYY-MM' 또는 'YYYY-MM-DD' → 'YYYY-MM-01' 정규화 (타임존 무관)
export function normalizeMonth(month: string): string {
  return month.slice(0, 7) + '-01'
}

// 'YYYY-MM-01' → { year, m, startDate, endDate, display }
export function parseMonth(month: string) {
  const [y, mo] = month.split('-').map(Number)
  const nextY = mo === 12 ? y + 1 : y
  const nextMo = mo === 12 ? 1 : mo + 1
  return {
    year: y,
    m: mo,
    startDate: `${y}-${String(mo).padStart(2, '0')}-01`,
    endDate: `${nextY}-${String(nextMo).padStart(2, '0')}-01`,
    display: `${y}년 ${mo}월`,
  }
}

// 현재 달부터 최근 N개월 목록 (타임존 안전)
export function getRecentMonths(count: number): { value: string; label: string }[] {
  const now = new Date()
  const months: { value: string; label: string }[] = []
  let y = now.getFullYear()
  let mo = now.getMonth() + 1 // 1-indexed
  for (let i = 0; i < count; i++) {
    const value = `${y}-${String(mo).padStart(2, '0')}-01`
    months.push({ value, label: `${y}년 ${mo}월` })
    mo--
    if (mo === 0) { mo = 12; y-- }
  }
  return months
}
