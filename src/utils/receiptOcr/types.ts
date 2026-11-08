// 영수증 OCR 공용 타입·상수 (브라우저/서버 어디서나 import 가능한 순수 모듈)

/** 거래 화면(영수증 검토)의 카테고리 선택지와 같은 값 */
export const RECEIPT_CATEGORIES = [
  '식비',
  '교통비',
  '여가활동',
  '생활용품',
  '의료비',
  '교육',
  '기타',
] as const
export type ReceiptCategory = (typeof RECEIPT_CATEGORIES)[number]

/** transactions.payment_method 에 저장하는 값 (기본값은 '체크카드') */
export const PAYMENT_METHODS = ['체크카드', '신용카드', '현금', '교통카드'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** 영수증에서 읽어 낸 값. 읽지 못한 항목은 null 이다. */
export interface ParsedReceipt {
  /** YYYY-MM-DD */
  date: string | null
  /** 원 단위 정수 */
  amount: number | null
  store: string | null
  address: string | null
  /** 카드 종류까지는 알 수 없으면 null (화면 기본값 유지) */
  paymentMethod: PaymentMethod | null
  category: ReceiptCategory | null
}

export interface ReceiptAnalysis {
  success: boolean
  /** 'local' = 브라우저 OCR, 'ai' = 서버 AI(키가 있을 때만) */
  source?: 'local' | 'ai'
  data?: ParsedReceipt
  error?: string
}

/** 진행률 콜백: percent 0~100, message 는 사용자에게 보여 줄 쉬운 말 */
export type OcrProgressHandler = (percent: number, message: string) => void

export const EMPTY_RECEIPT: ParsedReceipt = {
  date: null,
  amount: null,
  store: null,
  address: null,
  paymentMethod: null,
  category: null,
}
