'use server'

import { createClient } from '@/utils/supabase/server'

export interface CsvRow {
  date: string        // YYYY-MM-DD
  description: string // 내용 (가게명)
  memo: string        // 메모 (상세설명)
  amount: number      // 양수 = 출금(지출), 음수 = 입금(수입)
  type: '출금' | '입금' | string
}

export interface MatchResult {
  csvRow: CsvRow
  matchedTxId?: string
  matchedTxName?: string
  isDuplicate: boolean
}

export interface ParseAndMatchResult {
  matched: MatchResult[]
  unmatched: MatchResult[]
  duplicate: MatchResult[]
  parseErrors: string[]
}

// ── 실제 카카오뱅크 xlsx/csv 파싱 ──────────────────────────────────────
// 실제 포맷 (Row 11이 헤더):
//   거래일시 | 구분 | 거래금액 | 거래 후 잔액 | 거래구분 | 내용 | 메모
//
// Row 1: '카카오뱅크 거래내역' (타이틀)
// Row 4: 성명, 계좌번호 등 메타정보
// Row 11: 헤더 행
// Row 12~: 실제 데이터

function parseDate(raw: string | number | Date | null | undefined): string | null {
  if (!raw) return null

  // Excel serial number (숫자)
  if (typeof raw === 'number') {
    // xlsx가 이미 JS Date로 변환하므로 보통 여기 오지 않음
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }

  // JS Date 객체
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10)
  }

  // 문자열: '2026.03.05 10:53:34' 또는 '2026-03-05'
  const str = String(raw).replace(/\./g, '-')
  const m = str.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(String(raw).replace(/[,\s]/g, ''))
  return isNaN(n) ? null : n
}

/**
 * xlsx 라이브러리로 바이너리 → 2D 배열 변환
 * ArrayBuffer | string (csv text) 모두 지원
 */
async function parseWorkbook(buffer: ArrayBuffer): Promise<(unknown[])[]> {
  const XLSX = await import('xlsx')

  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // header: 1 → 첫 행을 배열 인덱스로 사용 (헤더 자동 감지하지 않음)
  const rows: (unknown[])[] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,   // 날짜·숫자 모두 문자열로 받아 직접 파싱
  }) as (unknown[])[]

  return rows
}

/**
 * CSV 텍스트를 2D 배열로 변환 (xlsx 없이)
 */
function parseCsvText(text: string): (string | null)[][] {
  return text
    .split('\n')
    .map(line => splitCsvLine(line))
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/**
 * 2D 배열에서 '거래일시' 헤더 행 찾기
 * 카카오뱅크: 약 11행째에 헤더 있음
 */
function findHeaderRow(rows: unknown[][]): { headerIdx: number; colMap: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    if (!row) continue
    const headerText = row.map(c => String(c ?? '').trim())
    const dateColIdx = headerText.findIndex(c =>
      c === '거래일시' || c === '거래일' || c === '일시'
    )
    if (dateColIdx >= 0) {
      const colMap: Record<string, number> = {}
      headerText.forEach((col, j) => {
        colMap[col] = j
      })
      return { headerIdx: i, colMap }
    }
  }
  return null
}

function extractRows(rows: unknown[][], headerIdx: number, colMap: Record<string, number>): CsvRow[] {
  const result: CsvRow[] = []

  // 카카오뱅크 컬럼 순서 확인
  // 공식: 거래일시(0) | 구분(1) | 거래금액(2) | 거래 후 잔액(3) | 거래구분(4) | 내용(5) | 메모(6)
  // colMap으로 실제 인덱스 찾기
  const iDate    = colMap['거래일시'] ?? colMap['거래일'] ?? colMap['일시'] ?? 0
  const iType    = colMap['구분'] ?? 1
  const iAmount  = colMap['거래금액'] ?? colMap['출금(원)'] ?? 2
  const iContent = colMap['내용'] ?? 5
  const iMemo    = colMap['메모'] ?? 6

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === null || String(c).trim() === '')) continue

    const rawDate   = row[iDate]
    const rawType   = String(row[iType] ?? '').trim()
    const rawAmount = row[iAmount]
    const rawContent = String(row[iContent] ?? '').trim()
    const rawMemo   = String(row[iMemo] ?? '').trim()

    const date = parseDate(rawDate as string)
    if (!date) continue

    const amountVal = parseAmount(rawAmount)
    if (amountVal === null) continue

    // 거래금액이 음수면 출금, 양수면 입금
    // 구분 컬럼이 '출금'이면 양수화하여 지출로 처리
    let finalAmount: number
    if (rawType === '출금') {
      finalAmount = Math.abs(amountVal)   // 양수 = 지출
    } else if (rawType === '입금') {
      finalAmount = -Math.abs(amountVal)  // 음수 = 수입
    } else {
      // 구분 없이 금액 부호로 판단
      finalAmount = amountVal < 0 ? Math.abs(amountVal) : -Math.abs(amountVal)
    }

    const description = rawContent || rawMemo || '(내용 없음)'
    const memo = rawContent && rawMemo && rawContent !== rawMemo ? rawMemo : ''

    result.push({ date, description, memo, amount: finalAmount, type: rawType })
  }

  return result
}

// ── 메인 파서 (XLSX binary 또는 CSV text) ─────────────────────────────
async function parseKakaoBankFile(buffer: ArrayBuffer, fileName: string): Promise<{ rows: CsvRow[]; errors: string[] }> {
  const errors: string[] = []
  let rawRows: unknown[][]

  const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
  const isCsv  = fileName.endsWith('.csv')

  if (isXlsx) {
    rawRows = await parseWorkbook(buffer)
  } else {
    // CSV — text decode 후 파싱
    const text = new TextDecoder('utf-8').decode(buffer)
    rawRows = parseCsvText(text)
  }

  const found = findHeaderRow(rawRows)
  if (!found) {
    errors.push('헤더 행("거래일시")을 찾을 수 없습니다. 카카오뱅크 거래내역 파일인지 확인하세요.')
    return { rows: [], errors }
  }

  const rows = extractRows(rawRows, found.headerIdx, found.colMap)

  if (rows.length === 0) {
    errors.push('파싱된 거래 행이 없습니다. 파일 내용을 확인하세요.')
  }

  return { rows, errors }
}

// ── 서버 액션: 파일 파싱 + DB 대조 ──────────────────────────────────────
export async function parseAndMatchFile(
  fileData: { buffer: number[]; name: string },
  participantId: string
): Promise<ParseAndMatchResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const buffer = new Uint8Array(fileData.buffer).buffer
  const { rows, errors } = await parseKakaoBankFile(buffer, fileData.name)

  if (rows.length === 0) {
    return { matched: [], unmatched: [], duplicate: [], parseErrors: errors }
  }

  // 해당 참가자의 거래 조회 (날짜+금액 대조)
  const dates = [...new Set(rows.map(r => r.date))]
  const { data: existingTxs } = await supabase
    .from('transactions')
    .select('id, date, amount, activity_name')
    .eq('participant_id', participantId)
    .in('date', dates)

  const txMap = new Map<string, { id: string; activity_name: string }[]>()
  for (const tx of existingTxs || []) {
    const key = `${tx.date}__${Math.abs(Number(tx.amount))}`
    if (!txMap.has(key)) txMap.set(key, [])
    txMap.get(key)!.push({ id: tx.id, activity_name: tx.activity_name })
  }

  const matched: MatchResult[] = []
  const unmatched: MatchResult[] = []
  const duplicate: MatchResult[] = []

  for (const row of rows) {
    const key = `${row.date}__${Math.abs(row.amount)}`
    const existing = txMap.get(key)

    if (!existing || existing.length === 0) {
      unmatched.push({ csvRow: row, isDuplicate: false })
    } else {
      const sameDesc = existing.find(tx => tx.activity_name === row.description)
      if (sameDesc) {
        duplicate.push({ csvRow: row, matchedTxId: sameDesc.id, matchedTxName: sameDesc.activity_name, isDuplicate: true })
      } else {
        matched.push({ csvRow: row, matchedTxId: existing[0].id, matchedTxName: existing[0].activity_name, isDuplicate: false })
      }
    }
  }

  return { matched, unmatched, duplicate, parseErrors: errors }
}

// ── 선택된 항목 일괄 임포트 ──────────────────────────────────────────────
export async function importSelectedRows(
  rows: CsvRow[],
  participantId: string,
  fundingSourceId: string
): Promise<{ imported: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (rows.length === 0) return { imported: 0 }

  const records = rows.map(row => ({
    participant_id: participantId,
    funding_source_id: fundingSourceId,
    date: row.date,
    activity_name: row.description,
    amount: row.amount,
    category: '기타',
    status: 'pending' as const,
    payment_method: '체크카드',
    memo: row.memo || 'CSV 자동 임포트',
  }))

  const { error } = await supabase.from('transactions').insert(records)
  if (error) return { imported: 0, error: error.message }

  return { imported: records.length }
}

// 하위 호환 — 이전 시그니처 유지 (모달에서 참조)
export { type CsvRow as ImportCsvRow }
