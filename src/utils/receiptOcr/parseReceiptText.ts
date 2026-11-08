// OCR 이 읽어 낸 글자(여러 줄)에서 영수증 항목을 뽑는 규칙 기반 파서.
// 서버·API 없이 동작하며, 순수 함수라서 단위 테스트가 쉽다.
//
// 읽는 항목: 날짜 · 합계 금액 · 상호명 · 주소 · 결제수단 · 카테고리(키워드 추천)
// OCR 은 한글 사이에 공백을 끼우거나(합 계) 숫자를 문자로 읽기도(2O26) 하므로
// 키워드 비교는 공백을 뺀 문자열로 하고, 날짜 토큰 안의 O/l 은 숫자로 고친다.

import {
  EMPTY_RECEIPT,
  type ParsedReceipt,
  type PaymentMethod,
  type ReceiptCategory,
} from './types'

// ───────────────────────── 공통 도구 ─────────────────────────

/** OCR 결과를 줄 단위로 정리한다 (전각→반각, 공백 정리, 빈 줄 제거). */
export function normalizeLines(text: string): string[] {
  return text
    .normalize('NFKC')
    .replace(/[​-‍﻿]/g, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter((l) => l.length > 0)
}

const compact = (s: string) => s.replace(/\s+/g, '')
const pad2 = (n: number) => String(n).padStart(2, '0')

// ───────────────────────── 날짜 ─────────────────────────

const DATE_KEYWORDS = /일시|거래일|판매일|결제일|승인일|일자|날짜|date|time/i

/** 날짜 모양의 토큰 안에서만 O→0, l/I/|→1 로 고친다. */
function fixDigitLookalikes(line: string): string {
  return line.replace(
    /[0-9OoIl|]{2,4}(?:\s*[-./년]\s*[0-9OoIl|]{1,2}){2}/g,
    (m) => m.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1'),
  )
}

function toIsoDate(y: number, m: number, d: number, now: Date): string | null {
  if (y < 2000 || y > now.getFullYear() + 1) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  // 오늘보다 이틀 넘게 미래면 오인식으로 본다.
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  if (dt.getTime() > today + 2 * 86_400_000) return null
  return `${y}-${pad2(m)}-${pad2(d)}`
}

export function extractDate(lines: string[], now: Date = new Date()): string | null {
  let best: { iso: string; score: number } | null = null

  const consider = (iso: string | null, base: number, line: string) => {
    if (!iso) return
    let score = base
    if (DATE_KEYWORDS.test(compact(line))) score += 20
    if (/\d{1,2}:\d{2}/.test(line)) score += 5
    if (!best || score > best.score) best = { iso, score }
  }

  for (const raw of lines) {
    const line = fixDigitLookalikes(raw)

    for (const m of line.matchAll(/(?<!\d)(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})(?!\d)/g)) {
      consider(toIsoDate(+m[1], +m[2], +m[3], now), 10, line)
    }
    for (const m of line.matchAll(/(?<!\d)(\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})(?!\d)/g)) {
      consider(toIsoDate(2000 + +m[1], +m[2], +m[3], now), 4, line)
    }
    for (const m of line.matchAll(/(?<!\d)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/g)) {
      consider(toIsoDate(+m[1], +m[2], +m[3], now), 6, line)
    }
  }
  return best ? (best as { iso: string }).iso : null
}

// ───────────────────────── 금액 ─────────────────────────

/** 이 낱말이 있는 줄의 숫자는 합계 금액이 아니다. */
const NEGATIVE_AMOUNT_LINE =
  /부가세|부가가치세|과세|면세|공급가|공급대가|vat|봉사료|거스름|거스룸|받은금액|받은돈|받은현금|투입|포인트|적립|할인|잔액|쿠폰|수량|단가|전화|tel|사업자|승인번호|카드번호|가맹점번호|문의/i

// 금액은 '확실한 이름표'가 붙은 줄에서만 채운다. 소계·단독 '금액'·'현금 5,000'(받은 돈) 같은
// 약한 근거나 "가장 큰 숫자" 추측은 일부러 쓰지 않는다: 이 앱의 사용자에게는 칸이 비어 있는 편이
// 받은 돈 같은 그럴듯한 오답이 미리 채워지는 것보다 안전하다.
const AMOUNT_TIERS: Array<{ score: number; re: RegExp; pick: 'last' | 'max' }> = [
  {
    score: 100,
    re: /결제금액|결제하실금액|결제요청|승인금액|카드결제|카드승인금액|받으실금액|받을금액|청구금액|총결제|최종결제|결제액/,
    pick: 'last',
  },
  { score: 80, re: /합계금액|총합계|총계|합계|합게|총액|total/i, pick: 'last' },
]

// 전화번호·날짜·사업자번호처럼 - : / 로 이어지는 숫자는 빼고, 쉼표(또는 OCR 이 쉼표를 점으로 읽은)
// 천 단위 구분 숫자나 3~8자리 숫자만 금액 후보로 본다.
const NUMBER_RE = /(?<![\d,.\-:/])(\d{1,3}(?:[,.]\d{3})+|\d{3,8})(?![\d\-:/]|[,.]\d)/g
const MIN_AMOUNT = 100
const MAX_AMOUNT = 10_000_000

function numbersIn(line: string): number[] {
  const out: number[] = []
  for (const m of line.matchAll(NUMBER_RE)) {
    const n = Number(m[1].replace(/[,.]/g, ''))
    if (n >= MIN_AMOUNT && n <= MAX_AMOUNT) out.push(n)
  }
  return out
}

export function extractAmount(lines: string[]): number | null {
  const candidates: Array<{ score: number; value: number; order: number; pick: 'last' | 'max' }> = []

  lines.forEach((line, idx) => {
    const c = compact(line).toLowerCase()
    if (NEGATIVE_AMOUNT_LINE.test(c)) return
    const tier = AMOUNT_TIERS.find((t) => t.re.test(c))
    if (!tier) return

    let nums = numbersIn(line)
    // 글자와 숫자가 서로 다른 줄에 읽힌 경우: 다음 줄이 숫자뿐이면 그 줄을 쓴다.
    if (nums.length === 0 && idx + 1 < lines.length && /^[\d,.\s원₩W]+$/.test(lines[idx + 1])) {
      nums = numbersIn(lines[idx + 1])
    }
    if (nums.length === 0) return
    // 금액은 보통 줄의 가장 오른쪽 숫자다.
    candidates.push({ score: tier.score, value: nums[nums.length - 1], order: idx, pick: tier.pick })
  })

  if (candidates.length === 0) return null // 확실한 이름표가 없으면 추측하지 않는다
  const top = Math.max(...candidates.map((c) => c.score))
  const group = candidates.filter((c) => c.score === top)
  return group[0].pick === 'last'
    ? group.reduce((a, b) => (b.order > a.order ? b : a)).value
    : Math.max(...group.map((c) => c.value))
}

// ───────────────────────── 상호명 ─────────────────────────

const STORE_LABEL =
  /^\s*(?:상\s*호\s*명?|가\s*맹\s*점\s*명?|매\s*장\s*명|점\s*포\s*명|판\s*매\s*처)\s*[:：]?\s*/

/** 상호명 후보에서 제외할 줄 (영수증 안내문·번호·주소 등) */
const STORE_NOISE =
  /영수증|매출전표|전표|카드|승인|고객|가맹점용|사업자|대표|전화|tel|fax|주소|일시|거래|번호|http|www|pos|단말|금액|합계|품명|수량|단가|감사|환영|신용|체크|현금|발행|교환|환불|부가세|과세|면세|receipt|invoice|\d{3}-\d{2}-\d{5}/i

/** 한 글자씩 띄어 읽힌 한글(스 타 벅 스)을 붙인다. */
function joinSpacedHangul(s: string): string {
  return s.replace(/(?<=^|\s)([가-힣])((?:\s[가-힣])+)(?=\s|$)/g, (m) => m.replace(/\s/g, ''))
}

function cleanName(s: string): string {
  let out = joinSpacedHangul(s.trim())
  out = out.replace(/^[\s*#=_~•·|:-]+|[\s*#=_~•·|:-]+$/g, '')
  if (/^\(/.test(out) && !/^\((주|유|사|재|합)\)/.test(out)) out = out.replace(/^[()[\]{}]+|[()[\]{}]+$/g, '')
  // 굵은 영문 로고(CU, GS25 등)가 숫자 조각으로 깨져 읽힌 앞부분 ('00 노원역점' → '노원역점')
  out = out.replace(/^\d{1,2}\s+(?=[가-힣])/, '')
  return out.trim()
}

/** 한글 낱말(2자 이상)이나 영단어(3자 이상)가 있어야 상호명으로 본다 — 'le', 'FT' 같은 쓰레기는 버린다. */
function looksLikeName(s: string): boolean {
  if (s.length < 2 || s.length > 30) return false
  const letters = (s.match(/[가-힣A-Za-z]/g) ?? []).length
  const digits = (s.match(/\d/g) ?? []).length
  if (letters < 2 || digits > letters) return false
  return /[가-힣]{2,}/.test(s) || /[A-Za-z]{3,}/.test(s)
}

export function extractStore(lines: string[]): string | null {
  // 1) '상호', '가맹점명' 같은 이름표가 있는 줄
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(STORE_LABEL)
    if (!m) continue
    const c = compact(lines[i])
    if (/^(상호|가맹점|매장|점포)(번호|주소|코드)/.test(c)) continue
    let value = cleanName(lines[i].slice(m[0].length))
    if (!value && i + 1 < lines.length) value = cleanName(lines[i + 1])
    if (looksLikeName(value)) return value
  }
  // 2) 맨 위쪽 줄 중 안내문이 아닌 첫 줄 (영수증 맨 위는 보통 상호명)
  for (const line of lines.slice(0, 8)) {
    const name = cleanName(line)
    if (!looksLikeName(name)) continue
    if (STORE_NOISE.test(compact(name))) continue
    return name
  }
  return null
}

// ───────────────────────── 주소 ─────────────────────────

const REGION =
  '(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도)'
const ADDR_BODY = '[가-힣0-9\\s.\\-,()]{2,60}?'
// 줄 하나에 아래 모양을 위에서부터 차례로 시도한다. 도로명(로/길+번지)을 먼저 보는 이유는
// '동일로'처럼 도로 이름 안의 '동' 에서 주소가 끊기지 않게 하기 위해서다.
const ADDRESS_PATTERNS: RegExp[] = [
  new RegExp(`${REGION}${ADDR_BODY}(?:로|길)\\s?\\d[\\d-]*`), // 서울 노원구 동일로 1234
  /[가-힣]{1,6}(?:시|군|구)\s?[가-힣0-9]{1,12}(?:로|길)\s?\d[\d-]*/, // 성남시 판교로 235
  new RegExp(`${REGION}${ADDR_BODY}(?:동|읍|면|리)\\s?\\d[\\d-]*`), // 서울 노원구 상계동 123-4
  new RegExp(`${REGION}${ADDR_BODY}(?:로|길|동|읍|면|리)`), // 번지가 읽히지 않은 경우
]

export function extractAddress(lines: string[]): string | null {
  const finish = (s: string, idx: number) => {
    let out = s.trim()
    // 번지 없이 끝났고 다음 줄이 숫자로 시작하면 이어 붙인다.
    if (!/\d/.test(out.slice(-6)) && idx + 1 < lines.length && /^\d[\d-]*(\s|$)/.test(lines[idx + 1])) {
      out = `${out} ${lines[idx + 1].split(/\s+/).slice(0, 2).join(' ')}`
    }
    return out.slice(0, 100)
  }

  // 1) '주소' 이름표가 있는 줄
  for (let i = 0; i < lines.length; i++) {
    const c = compact(lines[i])
    if (!/주소/.test(c) || /이메일|홈페이지|메일/.test(c)) continue
    const value = lines[i].replace(/^.*?주\s*소\s*[:：]?\s*/, '').trim()
    if (value.length >= 6 && /[가-힣]/.test(value)) return finish(value, i)
  }
  // 2) 주소 모양이 보이는 줄
  for (let i = 0; i < lines.length; i++) {
    for (const re of ADDRESS_PATTERNS) {
      const m = lines[i].match(re)
      if (m) return finish(m[0], i)
    }
  }
  return null
}

// ───────────────────────── 결제수단 ─────────────────────────

const CARD_HINTS =
  /카드번호|카드종류|카드사|카드명|매입사|발급사|할부|visa|master|amex|unionpay|bc카드|삼성카드|신한카드|국민카드|현대카드|롯데카드|하나카드|우리카드|농협카드|nh카드|ic승인|신용승인|체크승인|카드결제|카드승인|카드매출/i

export function extractPaymentMethod(lines: string[]): PaymentMethod | null {
  const all = compact(lines.join('\n')).toLowerCase()
  if (/티머니|t-?money|캐시비|교통카드|후불교통/.test(all)) return '교통카드'
  const cardLike = CARD_HINTS.test(all)
  if (/현금/.test(all) && !cardLike) return '현금'
  if (/체크/.test(all)) return '체크카드'
  if (/신용/.test(all)) return '신용카드'
  return null // 카드인지는 알아도 종류를 모르면 화면 기본값을 유지한다.
}

// ───────────────────────── 카테고리 추천 ─────────────────────────

/** 위에 있는 규칙이 먼저 적용된다. */
const CATEGORY_RULES: Array<{ category: ReceiptCategory; words: string[] }> = [
  { category: '의료비', words: ['약국', '병원', '의원', '치과', '한의원', '안과', '내과', '이비인후과', '정형외과', '피부과', '약품', '의약'] },
  {
    category: '교통비',
    words: ['택시', '버스', '지하철', '철도', 'ktx', 'srt', '코레일', '고속', '주유소', '주유', 'gs칼텍스', 'sk에너지', '에쓰오일', 's-oil', '오일뱅크', '주차', '하이패스', '티머니', '캐시비'],
  },
  { category: '교육', words: ['서점', '문고', '도서', '학원', '교육', '강의', '알라딘', '예스24'] },
  {
    category: '여가활동',
    words: ['영화', '시네마', 'cgv', '메가박스', '롯데시네마', '노래방', '코인노래', 'pc방', '피씨방', '볼링', '당구', '탁구', '스크린골프', '공원', '박물관', '미술관', '공연', '뮤지컬', '콘서트', '놀이공원', '수영', '체험', '오락', '게임'],
  },
  { category: '생활용품', words: ['다이소', '올리브영', '문구', '잡화', '철물', '세탁', '화장품', '생활용품', '리빙'] },
  {
    category: '식비',
    words: [
      '스타벅스', '투썸', '이디야', '메가커피', '메가mgc', '컴포즈', '빽다방', '커피', '카페', '베이커리', '제과', '빵', '치킨', '피자', '버거', '맥도날드', '롯데리아', '버거킹', '맘스터치', 'kfc',
      '김밥', '분식', '떡볶이', '식당', '한식', '중식', '일식', '양식', '국밥', '순대', '족발', '보쌈', '고기', '갈비', '삼겹', '횟집', '초밥', '라면', '도시락', '아이스크림', '음료', '칼국수', '냉면', '샤브', '뷔페', '반점', '짜장',
      '편의점', 'cu', 'gs25', '세븐일레븐', '이마트24', '미니스톱', '마트', '슈퍼', '이마트', '홈플러스', '롯데마트', '하나로',
    ],
  },
]

/** 영수증 본문 전체를 볼 때는 오탐이 적은 긴 낱말만 쓴다. */
const STRONG_TEXT_WORDS = new Set([
  '약국', '병원', '치과', '한의원', '택시', '주유소', 'ktx', '코레일', '영화', 'cgv', '메가박스', '롯데시네마', '노래방', '볼링', '다이소', '올리브영', '서점', '편의점', '아메리카노', '카페라떼',
])

export function suggestCategory(storeName: string | null, wholeText = ''): ReceiptCategory | null {
  const store = compact(storeName ?? '').toLowerCase()
  if (store) {
    for (const rule of CATEGORY_RULES) {
      if (rule.words.some((w) => store.includes(w))) return rule.category
    }
  }
  const text = compact(wholeText).toLowerCase()
  if (text) {
    for (const rule of CATEGORY_RULES) {
      if (rule.words.some((w) => STRONG_TEXT_WORDS.has(w) && text.includes(w))) return rule.category
    }
    if (/아메리카노|라떼|에이드|스무디|샌드위치|김밥|햄버거|떡볶이/.test(text)) return '식비'
  }
  return null
}

// ───────────────────────── 전체 ─────────────────────────

export function parseReceiptText(text: string, now: Date = new Date()): ParsedReceipt {
  const lines = normalizeLines(text)
  if (lines.length === 0) return { ...EMPTY_RECEIPT }

  const store = extractStore(lines)
  return {
    date: extractDate(lines, now),
    amount: extractAmount(lines),
    store,
    address: extractAddress(lines),
    paymentMethod: extractPaymentMethod(lines),
    category: suggestCategory(store, lines.join('\n')),
  }
}

/** 두 번째 시도 결과로 비어 있는 항목만 채운다. */
export function mergeReceipts(primary: ParsedReceipt, fallback: ParsedReceipt): ParsedReceipt {
  return {
    date: primary.date ?? fallback.date,
    amount: primary.amount ?? fallback.amount,
    store: primary.store ?? fallback.store,
    address: primary.address ?? fallback.address,
    paymentMethod: primary.paymentMethod ?? fallback.paymentMethod,
    category: primary.category ?? fallback.category,
  }
}

/** 핵심 3항목(날짜·금액·상호)이 모두 있어야 '충분히 읽었다'고 본다. */
export function isCompleteEnough(r: ParsedReceipt): boolean {
  return r.amount !== null && r.date !== null && r.store !== null
}

/** 사용자에게 보여 줄 만한 값이 하나라도 있는가 (한글 낱말이 없는 상호명만 있으면 쓸모없다) */
export function hasUsefulField(r: ParsedReceipt): boolean {
  return r.amount !== null || r.date !== null || (r.store !== null && /[가-힣]{2,}/.test(r.store))
}
