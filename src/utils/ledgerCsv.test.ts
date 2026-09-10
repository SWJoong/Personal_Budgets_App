import { describe, it, expect } from 'vitest'
import { buildLedgerCsv, type LedgerExportRow } from './ledgerCsv'
import { settlementLabel } from './settlementStatus'

/**
 * A5 회계 보강 — 거래장부 CSV 직렬화 골든 (W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A5.
 * 구현 대상: src/utils/ledgerCsv.ts (buildLedgerCsv 신규 순수 함수).
 *
 * 배경: 리빌딩 때 사라진 회계 export 를 서울형 컬럼으로 되살린다. 직렬화는 순수 함수로 떼어 골든으로
 *   잠그고(라벨 조회·다운로드는 route 담당), Excel 한글 깨짐 방지 BOM + CSV 이스케이프를 못박는다.
 *
 * 계약: (1) `﻿`(BOM) + 헤더 `날짜,당사자,영역,제공기관,금액,정산상태,메모` 로 시작
 *   (2) 행은 컬럼 순서·상태는 settlementLabel·금액은 원시 정수(Excel 계산용)
 *   (3) `, " \n \r` 포함 필드는 `"` 래핑 + 내부 `"` 이중화 (4) null 영역/제공기관/메모→'' · null 금액→0
 *   (5) 행 구분 `\r\n` · 빈 rows → BOM+헤더만.
 *
 * RED 사유: buildLedgerCsv 가 아직 없다 → import 실패. 단언 범위: 직렬화 산출 문자열만.
 */

const BOM = '﻿'
const HEADER = '날짜,당사자,영역,제공기관,금액,정산상태,메모'

function row(over: Partial<LedgerExportRow> = {}): LedgerExportRow {
  return {
    usageDate: '2026-09-01',
    participantName: '김지수',
    domainLabel: '일상생활',
    providerName: '행복복지관',
    amount: 12000,
    settlementStatus: 'pending',
    description: '간식',
    ...over,
  }
}

describe('buildLedgerCsv (A5)', () => {
  it('빈 rows → BOM + 헤더만', () => {
    expect(buildLedgerCsv([])).toBe(BOM + HEADER)
  })

  it('한 행을 컬럼 순서대로, 상태는 라벨·금액은 원시 정수로 직렬화한다', () => {
    const csv = buildLedgerCsv([row({ settlementStatus: 'accepted', amount: 5000 })])
    const lines = csv.slice(BOM.length).split('\r\n')
    expect(lines[0]).toBe(HEADER)
    expect(lines[1]).toBe(
      `2026-09-01,김지수,일상생활,행복복지관,5000,${settlementLabel('accepted')},간식`,
    )
  })

  it('쉼표·따옴표·줄바꿈이 있는 필드는 CSV 이스케이프한다', () => {
    const csv = buildLedgerCsv([
      row({ description: '간식, 음료' }),
      row({ description: '그는 "좋다"고 했다' }),
      row({ description: '첫줄\n둘째줄' }),
    ])
    expect(csv).toContain('"간식, 음료"') // 쉼표 → 래핑
    expect(csv).toContain('"그는 ""좋다""고 했다"') // 따옴표 → 이중화 + 래핑
    expect(csv).toContain('"첫줄\n둘째줄"') // 줄바꿈 → 래핑
  })

  it('null 영역·제공기관·메모는 빈칸, null 금액은 0', () => {
    const csv = buildLedgerCsv([
      row({ domainLabel: null, providerName: null, description: null, amount: null }),
    ])
    const line = csv.slice(BOM.length).split('\r\n')[1]
    expect(line).toBe('2026-09-01,김지수,,,0,정산 대기,')
  })

  it('여러 행을 \\r\\n 로 잇는다(헤더 + N행)', () => {
    const csv = buildLedgerCsv([row(), row({ participantName: '이철수' })])
    const lines = csv.slice(BOM.length).split('\r\n')
    expect(lines.length).toBe(3)
  })
})
