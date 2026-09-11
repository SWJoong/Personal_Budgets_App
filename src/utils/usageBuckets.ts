/**
 * 사용내역 시간버킷 util — 예산 실행 통합 뷰(#4)의 ★핵심 로직·계약.
 * 설계출처: Plan&Source/goala_budget_execution_view_W.md §1.
 * 골든 계약: src/utils/usageBuckets.test.ts (W 레인).
 *
 * seoul_service_usages 행들을 건/일/주/월 4모드로 묶는다. 순수 함수(부수효과 없음) — 서버·클라 공용.
 * 불변식: 모든 모드에서 Σ버킷.total = Σusage.amount(금액 보존)·item 버킷수=usage수·같은 달/일은 한 버킷·
 * 주 버킷수는 월(coarse) ≤ 주 ≤ 일(fine).
 */

export type BucketMode = 'item' | 'day' | 'week' | 'month'

export interface UsageForBucket {
  id: string
  usage_date: string
  amount: number
  description?: string | null
  settlement_status?: string | null
  domainLabel?: string | null
}

export interface UsageBucket {
  key: string
  label: string
  count: number
  total: number
  items: UsageForBucket[]
}

/** 'YYYY-MM-DD…' → [year, month, day] (숫자). 앞 10자리만 본다(시각·타임존 무시). */
function ymd(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return [y, m, d]
}

/**
 * ISO 주(월요일 시작)의 월요일 날짜 키(YYYY-MM-DD). TZ 드리프트를 피하려 전부 UTC 로 계산한다.
 * getUTCDay(): 0=일 … 6=토 → (day+6)%7 = "월요일로부터 지난 일수"(월=0 … 일=6).
 */
function isoWeekMonday(dateStr: string): string {
  const [y, m, d] = ymd(dateStr)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const daysSinceMonday = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - daysSinceMonday)
  return dt.toISOString().slice(0, 10)
}

/** 모드별 (버킷 key, 사람이 읽는 label). label 은 계약 밖(자유) — 쉬운 말 한국어로 만든다. */
function keyAndLabel(u: UsageForBucket, mode: BucketMode): { key: string; label: string } {
  const iso = u.usage_date.slice(0, 10)
  const [y, m, d] = ymd(iso)
  switch (mode) {
    case 'item':
      // usage 1건 = 버킷 1. key 는 id(전역 유일), 헤더 라벨은 그 지출의 날짜.
      return { key: u.id, label: `${y}년 ${m}월 ${d}일` }
    case 'day':
      return { key: iso, label: `${y}년 ${m}월 ${d}일` }
    case 'week': {
      const monday = isoWeekMonday(iso)
      const [, wm, wd] = ymd(monday)
      return { key: monday, label: `${wm}월 ${wd}일 주간` }
    }
    case 'month':
      return { key: iso.slice(0, 7), label: `${y}년 ${m}월` }
  }
}

/** 내림차순 문자열 비교(최신 먼저). */
function cmpDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0
}

/**
 * usages 를 mode 로 그룹핑해 버킷 배열을 만든다. 최신 먼저로 정렬한다.
 * - day/week/month: key 자체가 시간순이라 key 내림차순이 곧 최신순.
 * - item: key=id(비시간 UUID)라 대표 항목의 usage_date 내림차순으로 정렬해 "최신 먼저" 의도를 지킨다
 *   (동률이면 id 내림차순으로 결정성 확보). 골든은 item 순서를 제약하지 않지만 UI 스캔성을 위해.
 * 빈 입력 → [].
 */
export function bucketUsages(usages: UsageForBucket[], mode: BucketMode): UsageBucket[] {
  if (usages.length === 0) return []

  const buckets = new Map<string, UsageBucket>()
  for (const u of usages) {
    const { key, label } = keyAndLabel(u, mode)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, label, count: 0, total: 0, items: [] }
      buckets.set(key, bucket)
    }
    bucket.count += 1
    bucket.total += u.amount
    bucket.items.push(u)
  }

  const out = [...buckets.values()]
  if (mode === 'item') {
    out.sort(
      (a, b) => cmpDesc(a.items[0]?.usage_date ?? '', b.items[0]?.usage_date ?? '') || cmpDesc(a.key, b.key),
    )
  } else {
    out.sort((a, b) => cmpDesc(a.key, b.key))
  }
  return out
}
