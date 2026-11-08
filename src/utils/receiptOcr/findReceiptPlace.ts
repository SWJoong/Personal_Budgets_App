/**
 * 영수증에서 읽은 상호·주소로 카카오 장소를 찾는다.
 *
 * 브라우저 OCR 로 읽은 주소는 층·호수·전화번호가 섞이거나 글자가 조금 틀리는 일이 많아서,
 * 주소 한 줄만 그대로 검색하면 결과가 비는 경우가 잦다. 그래서
 *   1) 상호로 먼저 찾고(후보 여러 개), 2) 영수증 주소와 가장 가까운 후보를 고르고,
 *   3) 못 찾으면 상호+동네 → 깨끗하게 다듬은 주소 → 도로명+번호 순으로 다시 찾는다.
 *
 * 안전 원칙(OCR 과 같음): 틀린 장소를 그럴듯하게 채우느니 비워 둔다.
 *  - 영수증 주소와 겹치는 후보만 받는다.
 *  - 주소로 확인이 안 되면 '지점 이름(○○점)까지 똑같은' 후보만 받는다.
 *
 * 실제 검색은 `search` 로 받는다(서버 액션을 넣어 주면 되고, 테스트에서는 가짜 검색을 넣는다).
 */
import type { PlaceResult } from '@/app/actions/geocode'

export interface ReceiptPlaceInput {
  store: string | null
  address: string | null
}

export type PlaceSearchFn = (query: string) => Promise<PlaceResult[]>

export interface AddressHints {
  /** 시·도 짧은 이름 (서울, 경기, 충북 …) */
  sido: string | null
  /** 시·군·구 이름 (성남시, 분당구 …) */
  areas: string[]
  /** 동·읍·면·리 이름, 숫자는 뺀 형태 (상계1동 → 상계동) */
  dongs: string[]
  /** 도로명과 건물번호 */
  roads: { name: string; number: string | null }[]
  /** 지번 주소 (동 이름 + 번지) */
  jibun: { dong: string; number: string }[]
}

/** 영수증 주소와 이 점수 이상 겹치면 '주소로 확인된 후보' 로 받는다 (구·동·도로명 중 하나). */
export const ADDRESS_ACCEPT_SCORE = 2
/** 이 점수 이상이면 더 찾지 않고 바로 고른다 (도로명+번호, 또는 구+동+시도 …). */
export const ADDRESS_CONFIDENT_SCORE = 5

const MAX_QUERIES = 4
const MAX_QUERY_LENGTH = 80

// ─────────────────────────────────────────────────────────────
// 이름 다듬기·비교
// ─────────────────────────────────────────────────────────────

const COMPANY_MARK = /\(주\)|㈜|주식회사|\(유\)|유한회사/g

/** 비교용: 소문자, 회사 표시·공백·기호 제거. */
export function normalizeName(text: string): string {
  return text.toLowerCase().replace(COMPANY_MARK, '').replace(/[^가-힣a-z0-9]/g, '')
}

/** 검색어용 상호: 회사 표시와 특수문자를 빼고 공백을 정리한다. */
export function cleanStoreName(store: string | null): string {
  if (!store) return ''
  return store
    .replace(COMPANY_MARK, ' ')
    .replace(/[^가-힣A-Za-z0-9\s&'.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 상호가 '○○점' 으로 끝나는지 — 지점 이름까지 적힌 상호는 다른 곳과 헷갈릴 일이 적다. */
function hasBranchMarker(store: string | null): boolean {
  return !!store && /점$/.test(normalizeName(store))
}

/** 상호와 후보 이름이 얼마나 같은지: 3 = 똑같음, 2 = 한쪽이 다른 쪽을 포함, 0 = 다름. */
export function scoreNameMatch(place: PlaceResult, store: string | null): number {
  if (!store) return 0
  const a = normalizeName(store)
  const b = normalizeName(place.place_name ?? '')
  if (!a || !b) return 0
  if (a === b) return 3
  if (a.length >= 3 && b.includes(a)) return 2
  if (b.length >= 3 && a.includes(b)) return 2
  return 0
}

// ─────────────────────────────────────────────────────────────
// 주소 읽기
// ─────────────────────────────────────────────────────────────

const SIDO_RE =
  /^(서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주|대전광역시|대전시|대전|울산광역시|울산시|울산|세종특별자치시|세종시|세종|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전북특별자치도|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주)/

const SIDO_EXCEPTIONS: Record<string, string> = {
  충청북도: '충북',
  충청남도: '충남',
  전라북도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
}

function shortSido(raw: string): string {
  return SIDO_EXCEPTIONS[raw] ?? raw.slice(0, 2)
}

// 도로명: 동일로 · 노해로69길 · 판교역로 — 뒤따르는 건물번호(1234, 12-3)까지 함께 잡는다.
const ROAD_RE = /([가-힣]{1,8}(?:로|길)(?:\s*\d{1,3}(?:번)?길)?)\s*(\d{1,4}(?:-\d{1,3})?)?/g
// 지번: 상계동 123-4 (층·호 숫자는 번지로 보지 않는다)
const JIBUN_RE = /([가-힣]{1,5})\d?(동|읍|면|리|가)\s*(\d{1,4}(?:-\d{1,3})?)(?!\d|\s*[층호])/g
const DONG_RE = /([가-힣]{1,5})\d?(동|읍|면|리|가)(?=[\s\d]|$)/g
const AREA_RE = /[가-힣]{1,4}(?:시|군|구)/g

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

/** 영수증 주소에서 비교에 쓸 조각(시도·구·동·도로명·번지)을 뽑는다. 글자가 조금 틀려도 맞는 조각만 점수가 된다. */
export function parseAddress(raw: string): AddressHints {
  let s = raw.replace(/[(){}\[\],.·:]/g, ' ').replace(/\s+/g, ' ').trim()

  let sido: string | null = null
  const sidoMatch = SIDO_RE.exec(s)
  if (sidoMatch) {
    sido = shortSido(sidoMatch[1])
    s = s.slice(sidoMatch[0].length).trim()
  }

  const areas = unique(Array.from(s.matchAll(AREA_RE), (m) => m[0])).filter((a) => a.length >= 2)

  const dongs = unique(
    Array.from(s.matchAll(DONG_RE), (m) => m[1] + m[2]).filter((d) => d.length >= 2),
  )

  const roads: AddressHints['roads'] = []
  for (const m of s.matchAll(ROAD_RE)) {
    roads.push({ name: m[1].replace(/\s+/g, ''), number: m[2] ?? null })
  }

  const jibun: AddressHints['jibun'] = []
  for (const m of s.matchAll(JIBUN_RE)) {
    jibun.push({ dong: m[1] + m[2], number: m[3] })
  }

  return { sido, areas, dongs, roads, jibun }
}

/** 검색창에 넣을 수 있게 주소를 다듬는다: 괄호·층·호·쉼표 뒤의 군더더기를 자르고, 번지까지만 남긴다. */
export function cleanAddress(raw: string): string {
  let s = raw
    .replace(/\([^)]*\)?/g, ' ') // 괄호 안 (동 이름·건물명)
    .replace(/[^가-힣A-Za-z0-9\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // 도로명 주소: 건물번호까지만
  const road = /[가-힣]{1,8}(?:로|길)(?:\s*\d{1,3}(?:번)?길)?\s*\d{1,4}(?:-\d{1,3})?/.exec(s)
  if (road) return s.slice(0, road.index + road[0].length).trim()

  // 지번 주소: 번지까지만
  const jibun = /[가-힣]{1,5}\d?(?:동|읍|면|리|가)\s*\d{1,4}(?:-\d{1,3})?/.exec(s)
  if (jibun) return s.slice(0, jibun.index + jibun[0].length).trim()

  // 번지를 못 찾으면 층·호 표시만 잘라 낸다
  s = s
    .replace(/\s*(?:지하\s*)?\d+\s*층.*$/, '')
    .replace(/\s*\d+\s*호.*$/, '')
    .trim()
  return s
}

const compact = (text: string) => text.replace(/\s+/g, '')

/** needle 바로 뒤에 숫자가 이어지지 않을 때만 포함으로 본다 (동일로 123 ≠ 동일로 1234). */
function containsWithBoundary(hay: string, needle: string): boolean {
  let from = 0
  for (;;) {
    const i = hay.indexOf(needle, from)
    if (i < 0) return false
    const next = hay[i + needle.length]
    if (!next || !/\d/.test(next)) return true
    from = i + 1
  }
}

/** 영수증 주소와 후보 주소가 얼마나 겹치는지 점수로 돌려준다 (겹치는 조각이 없으면 0). */
export function scoreAddressMatch(place: PlaceResult, hints: AddressHints): number {
  const hay = compact(`${place.road_address_name ?? ''} ${place.address_name ?? ''}`)
  if (!hay) return 0

  let score = 0
  if (hints.sido && hay.includes(hints.sido)) score += 1
  for (const area of hints.areas) if (hay.includes(area)) score += 2
  for (const dong of hints.dongs) if (hay.includes(dong)) score += 2
  for (const road of hints.roads) {
    if (!hay.includes(road.name)) continue
    score += 3
    if (road.number && containsWithBoundary(hay, road.name + road.number)) score += 3
  }
  for (const j of hints.jibun) {
    if (containsWithBoundary(hay, j.dong + j.number)) score += 3
  }
  return score
}

// ─────────────────────────────────────────────────────────────
// 검색어 만들기
// ─────────────────────────────────────────────────────────────

/**
 * 순서대로 시도할 검색어 (최대 4개, 중복 제거).
 *  1. 상호  2. 상호 + 동네(구·동)  3. 다듬은 주소  4. 도로명 + 건물번호
 */
export function buildPlaceQueries(input: ReceiptPlaceInput): string[] {
  const store = cleanStoreName(input.store)
  const address = input.address?.trim() ?? ''
  const hints = address ? parseAddress(address) : null
  const cleaned = address ? cleanAddress(address) : ''
  const area = hints ? (hints.areas[hints.areas.length - 1] ?? hints.dongs[0] ?? '') : ''

  const queries: string[] = []
  if (store) queries.push(store)
  if (store && area && !normalizeName(store).includes(normalizeName(area))) {
    queries.push(`${store} ${area}`)
  }
  if (cleaned.length >= 5) queries.push(cleaned)
  const road = hints?.roads.find((r) => r.number)
  if (road) {
    const short = `${road.name} ${road.number}`
    if (compact(short) !== compact(cleaned)) queries.push(short)
  }

  const seen = new Set<string>()
  const result: string[] = []
  for (const q of queries) {
    const text = q.slice(0, MAX_QUERY_LENGTH).trim()
    const key = compact(text).toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
    if (result.length >= MAX_QUERIES) break
  }
  return result
}

// ─────────────────────────────────────────────────────────────
// 후보 고르기
// ─────────────────────────────────────────────────────────────

interface Candidate {
  place: PlaceResult
  order: number
  addr: number
  name: number
}

function isUsable(place: PlaceResult): boolean {
  return Number.isFinite(place.lat) && Number.isFinite(place.lng) && !!place.place_name
}

function pickBest(candidates: Candidate[], branchStore: boolean): Candidate | null {
  const acceptable = candidates.filter(
    (c) => c.addr >= ADDRESS_ACCEPT_SCORE || (branchStore && c.name >= 2),
  )
  if (acceptable.length === 0) return null

  acceptable.sort((a, b) => {
    // 주소로 확인된 후보가 먼저, 그다음 (주소 점수 + 이름 점수×2), 같으면 카카오가 준 순서
    const confirmedA = a.addr >= ADDRESS_ACCEPT_SCORE ? 1 : 0
    const confirmedB = b.addr >= ADDRESS_ACCEPT_SCORE ? 1 : 0
    if (confirmedA !== confirmedB) return confirmedB - confirmedA
    const scoreA = a.addr + a.name * 2
    const scoreB = b.addr + b.name * 2
    if (scoreA !== scoreB) return scoreB - scoreA
    return a.order - b.order
  })
  return acceptable[0]
}

function isConfident(c: Candidate): boolean {
  return c.addr >= ADDRESS_CONFIDENT_SCORE || (c.addr >= ADDRESS_ACCEPT_SCORE && c.name === 3)
}

/**
 * 영수증 상호·주소로 장소 1곳을 찾는다. 믿을 만한 후보가 없으면 null.
 * `search` 가 실패하거나 빈 결과를 줘도 예외 없이 다음 검색어로 넘어간다.
 */
export async function findReceiptPlace(
  input: ReceiptPlaceInput,
  search: PlaceSearchFn,
): Promise<PlaceResult | null> {
  const store = cleanStoreName(input.store)
  const address = input.address?.trim() ?? ''
  if (!store && !address) return null

  const hints = address ? parseAddress(address) : null
  const branchStore = hasBranchMarker(store)
  const queries = buildPlaceQueries(input)

  const pool = new Map<string, Candidate>()
  let order = 0

  for (const query of queries) {
    let results: PlaceResult[] = []
    try {
      results = await search(query)
    } catch {
      results = []
    }

    for (const place of results) {
      if (!isUsable(place)) continue
      const key = place.id || `${place.place_name}|${place.address_name}`
      if (pool.has(key)) continue
      pool.set(key, {
        place,
        order: order++,
        addr: hints ? scoreAddressMatch(place, hints) : 0,
        name: scoreNameMatch(place, store),
      })
    }

    const best = pickBest(Array.from(pool.values()), branchStore)
    if (best && isConfident(best)) return best.place
  }

  return pickBest(Array.from(pool.values()), branchStore)?.place ?? null
}
