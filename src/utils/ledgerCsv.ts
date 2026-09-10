/**
 * A5 회계 보강 — 거래장부 CSV 직렬화(순수). 계약: src/utils/ledgerCsv.test.ts.
 * 설계: Plan&Source/goala_supporter_accounting_W.md §2 A5.
 *
 * 리빌딩 때 사라진 회계 export 를 서울형 컬럼으로 되살린다. 직렬화만 순수 함수로 떼어
 * 골든으로 잠그고(라벨 조회·다운로드는 route 담당), Excel 한글 깨짐을 막는 BOM 과
 * CSV 이스케이프를 여기서 못박는다. 금액은 원시 정수로 내보내 Excel 계산이 되게 한다.
 */

import { settlementLabel } from './settlementStatus'

/** CSV 한 행에 실리는 값(라벨은 route 에서 이미 배선, 상태는 원시 코드 그대로 받아 라벨화). */
export interface LedgerExportRow {
  usageDate: string
  participantName: string
  domainLabel: string | null
  providerName: string | null
  amount: number | null
  settlementStatus: string
  description: string | null
}

const BOM = '﻿'
const HEADER = '날짜,당사자,영역,제공기관,금액,정산상태,메모'

/** `, " \n \r` 이 있으면 `"` 로 감싸고 내부 `"` 를 이중화한다(RFC 4180). 금액 외 모든 텍스트에 적용. */
function escapeField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function toLine(row: LedgerExportRow): string {
  return [
    escapeField(row.usageDate),
    escapeField(row.participantName),
    escapeField(row.domainLabel ?? ''),
    escapeField(row.providerName ?? ''),
    String(row.amount ?? 0),
    escapeField(settlementLabel(row.settlementStatus)),
    escapeField(row.description ?? ''),
  ].join(',')
}

/** BOM + 헤더 + 행들(`\r\n` 구분, 후행 개행 없음). 빈 rows → BOM + 헤더만. */
export function buildLedgerCsv(rows: LedgerExportRow[]): string {
  return BOM + [HEADER, ...rows.map(toLine)].join('\r\n')
}
