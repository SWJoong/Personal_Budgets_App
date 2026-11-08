import { describe, expect, it } from 'vitest'
import {
  extractAddress,
  extractAmount,
  extractDate,
  extractPaymentMethod,
  extractStore,
  hasUsefulField,
  isCompleteEnough,
  mergeReceipts,
  normalizeLines,
  parseReceiptText,
  suggestCategory,
} from './parseReceiptText'
import { EMPTY_RECEIPT } from './types'

// 테스트의 '오늘'을 고정한다 (미래 날짜 거르기 규칙 때문)
const NOW = new Date('2026-11-08T12:00:00+09:00')
const lines = (t: string) => normalizeLines(t)

describe('parseReceiptText — 전체 영수증', () => {
  it('카페 신용카드 영수증을 모든 항목으로 읽는다', () => {
    const text = `
스타벅스 노원점
대표자: 홍길동   TEL: 02-1234-5678
사업자번호 123-45-67890
서울특별시 노원구 동일로 1234
거래일시 2026-11-03 14:22:10
아이스 아메리카노 1 5,500
합 계 5,500
부가세 500
결제금액 5,500
신용카드
카드번호 1234-****-****-5678
승인번호 12345678
`
    const r = parseReceiptText(text, NOW)
    expect(r.date).toBe('2026-11-03')
    expect(r.amount).toBe(5500)
    expect(r.store).toBe('스타벅스 노원점')
    expect(r.address).toContain('노원구 동일로 1234')
    expect(r.paymentMethod).toBe('신용카드')
    expect(r.category).toBe('식비')
  })

  it('편의점 현금 영수증: 받은금액·거스름돈이 아니라 합계를 고른다', () => {
    const text = `
CU 노원역점
2026/11/05 09:11
삼각김밥 1 1,500
바나나우유 1 1,800
합계 3,300
받은금액 5,000
거스름돈 1,700
현금영수증 승인 No.123456
`
    const r = parseReceiptText(text, NOW)
    expect(r.amount).toBe(3300)
    expect(r.date).toBe('2026-11-05')
    expect(r.store).toBe('CU 노원역점')
    expect(r.paymentMethod).toBe('현금')
    expect(r.category).toBe('식비')
  })

  it('OCR 오류(한글 사이 공백, O↔0, 쉼표→점)를 견딘다', () => {
    const text = `
스 타 벅 스 노 원 점
일 시 : 2O26-11-O3 14:22
합 계 15.000
결 제 금 액 15.000
`
    const r = parseReceiptText(text, NOW)
    expect(r.date).toBe('2026-11-03')
    expect(r.amount).toBe(15000)
    expect(r.store).toBe('스타벅스노원점')
    expect(r.category).toBe('식비')
  })

  it('빈 글자는 모두 null', () => {
    expect(parseReceiptText('', NOW)).toEqual(EMPTY_RECEIPT)
    expect(parseReceiptText('   \n \n', NOW)).toEqual(EMPTY_RECEIPT)
  })
})

describe('extractDate', () => {
  it('여러 날짜 표기를 읽는다', () => {
    expect(extractDate(lines('2026년 11월 3일'), NOW)).toBe('2026-11-03')
    expect(extractDate(lines('26.11.03 14:00'), NOW)).toBe('2026-11-03')
    expect(extractDate(lines('거래일 20261103 14:00'), NOW)).toBe('2026-11-03')
    expect(extractDate(lines('2026-1-3'), NOW)).toBe('2026-01-03')
  })

  it('"일시" 같은 이름표가 붙은 줄을 우선한다', () => {
    const t = `사업자 등록일 2019-05-01\n거래일시 2026-11-03 10:00`
    expect(extractDate(lines(t), NOW)).toBe('2026-11-03')
  })

  it('말이 안 되는 날짜(없는 날, 먼 미래, 너무 옛날)는 버린다', () => {
    expect(extractDate(lines('2026-02-31'), NOW)).toBeNull()
    expect(extractDate(lines('2027-01-01'), NOW)).toBeNull()
    expect(extractDate(lines('1999-05-05'), NOW)).toBeNull()
    expect(extractDate(lines('02-1234-5678'), NOW)).toBeNull()
  })
})

describe('extractAmount', () => {
  it('부가세·과세 줄은 건너뛴다', () => {
    const t = `과세물품가액 4,545\n부가세 455\n합 계 5,000`
    expect(extractAmount(lines(t))).toBe(5000)
  })

  it('결제금액(할인 후)이 합계보다 우선한다', () => {
    const t = `합계 10,000\n할인 -1,000\n결제금액 9,000`
    expect(extractAmount(lines(t))).toBe(9000)
  })

  it('소계보다 합계를 쓴다', () => {
    expect(extractAmount(lines(`소계 10,000\n합계 9,000`))).toBe(9000)
  })

  it('글자와 숫자가 서로 다른 줄에 읽혀도 찾는다', () => {
    expect(extractAmount(lines(`합계\n12,000`))).toBe(12000)
  })

  it('원·₩ 표시가 있어도 읽는다', () => {
    expect(extractAmount(lines(`결제금액 ₩12,000원`))).toBe(12000)
  })

  it('확실한 이름표가 없으면 추측하지 않는다 (전화번호·품목 가격을 금액으로 쓰지 않음)', () => {
    const t = `TEL 02-123-4567\n사업자 123-45-67890\n라면 1 3,500\n김밥 2 6,000`
    expect(extractAmount(lines(t))).toBeNull()
  })

  it('소계·단독 금액·현금 줄처럼 약한 근거만 있으면 채우지 않는다', () => {
    expect(extractAmount(lines('소계 10,000'))).toBeNull()
    expect(extractAmount(lines('금액 3,000'))).toBeNull()
    // 받은 돈(현금)을 합계로 오해하면 안 된다
    expect(extractAmount(lines('현금 5,000\n거스름돈 1,700'))).toBeNull()
  })

  it('"받은금액"이 글자 오인식으로 깨져도 합계가 없으면 그 값을 쓰지 않는다', () => {
    expect(extractAmount(lines('반은금액 5,000\n거스름돈 1,700'))).toBeNull()
  })

  it('받은금액이 있어도 읽힌 합계를 우선한다', () => {
    expect(extractAmount(lines('합계 3,300\n받은금액 5,000\n거스름돈 1,700'))).toBe(3300)
  })

  it('찾을 숫자가 없으면 null', () => {
    expect(extractAmount(lines('안녕하세요\n감사합니다'))).toBeNull()
  })
})

describe('extractStore', () => {
  it('"상호:" 이름표를 우선한다', () => {
    expect(extractStore(lines('상 호: 다이소 노원점\n대표자 김철수'))).toBe('다이소 노원점')
  })

  it('안내문 줄은 건너뛰고 첫 상호명을 고른다', () => {
    const t = `영수증\n신용카드 매출전표\n행복마트\n서울시 노원구 동일로 1`
    expect(extractStore(lines(t))).toBe('행복마트')
  })

  it('"(주)" 로 시작하는 상호는 유지한다', () => {
    expect(extractStore(lines('(주)에이비씨마트 노원점'))).toBe('(주)에이비씨마트 노원점')
  })

  it('상호명을 찾을 수 없으면 null', () => {
    expect(extractStore(lines('123-45-67890\n2026-11-03'))).toBeNull()
  })

  it('영문 로고가 깨져 생긴 앞쪽 숫자 조각은 떼어 낸다', () => {
    expect(extractStore(lines('00 노원역점\n2026/11/05 09:11'))).toBe('노원역점')
  })

  it('한글도 영단어도 아닌 쓰레기 글자는 상호명으로 쓰지 않는다', () => {
    expect(extractStore(lines('le\nFT\nBN'))).toBeNull()
    expect(extractStore(lines('ᅵ] ny'))).toBeNull()
  })
})

describe('extractAddress', () => {
  it('"주소:" 이름표가 있으면 그 값을 쓴다', () => {
    const r = extractAddress(lines('주소: 서울 노원구 한글비석로 123 2층'))
    expect(r).toContain('노원구 한글비석로 123')
  })

  it('이름표가 없어도 주소 모양이면 찾는다', () => {
    const r = extractAddress(lines('판교점\n경기도 성남시 분당구 판교로 235'))
    expect(r).toContain('판교로 235')
  })

  it('도로명 주소는 도로 이름 속 "동" 에서 끊기지 않는다', () => {
    const r = extractAddress(lines('서울시 노원구 동일로 1234 1층'))
    expect(r).toContain('동일로 1234')
  })

  it('지번 주소도 찾는다', () => {
    const r = extractAddress(lines('서울 노원구 상계동 123-4'))
    expect(r).toContain('상계동 123-4')
  })

  it('이메일 주소는 주소가 아니다', () => {
    expect(extractAddress(lines('이메일주소: a@b.com'))).toBeNull()
  })

  it('주소가 없으면 null', () => {
    expect(extractAddress(lines('스타벅스\n합계 5,500'))).toBeNull()
  })
})

describe('extractPaymentMethod', () => {
  it('교통카드·체크카드·신용카드를 구분한다', () => {
    expect(extractPaymentMethod(lines('티머니 승인'))).toBe('교통카드')
    expect(extractPaymentMethod(lines('카드종류 신한체크\n카드번호 1234'))).toBe('체크카드')
    expect(extractPaymentMethod(lines('신용승인\n카드번호 1234'))).toBe('신용카드')
  })

  it('카드 영수증 안의 "현금영수증 문의" 문구는 현금으로 보지 않는다', () => {
    expect(extractPaymentMethod(lines('카드번호 1234-****\n현금영수증 문의 126'))).not.toBe('현금')
  })

  it('카드 종류를 알 수 없으면 null (화면 기본값을 유지)', () => {
    expect(extractPaymentMethod(lines('삼성카드 승인 12345'))).toBeNull()
    expect(extractPaymentMethod(lines('감사합니다'))).toBeNull()
  })
})

describe('suggestCategory', () => {
  it('상호명 키워드로 카테고리를 추천한다', () => {
    expect(suggestCategory('온누리약국')).toBe('의료비')
    expect(suggestCategory('서울택시')).toBe('교통비')
    expect(suggestCategory('CGV 노원')).toBe('여가활동')
    expect(suggestCategory('다이소 노원점')).toBe('생활용품')
    expect(suggestCategory('영풍문고')).toBe('교육')
    expect(suggestCategory('이마트24 노원점')).toBe('식비')
  })

  it('상호명으로 모르면 본문의 확실한 낱말을 본다', () => {
    expect(suggestCategory('행복상회', '아이스 아메리카노 1 4,500')).toBe('식비')
  })

  it('근거가 없으면 null', () => {
    expect(suggestCategory('행복상회', '합계 3,000')).toBeNull()
    expect(suggestCategory(null)).toBeNull()
  })
})

describe('mergeReceipts / isCompleteEnough', () => {
  it('두 번째 결과로 빈 항목만 채운다', () => {
    const a = { ...EMPTY_RECEIPT, amount: 5000, store: '가게' }
    const b = { ...EMPTY_RECEIPT, amount: 9999, date: '2026-11-03', category: '식비' as const }
    expect(mergeReceipts(a, b)).toEqual({
      ...EMPTY_RECEIPT,
      amount: 5000,
      store: '가게',
      date: '2026-11-03',
      category: '식비',
    })
  })

  it('보여 줄 만한 값이 있는지: 금액·날짜·한글 상호 중 하나', () => {
    expect(hasUsefulField(EMPTY_RECEIPT)).toBe(false)
    expect(hasUsefulField({ ...EMPTY_RECEIPT, store: 'le' })).toBe(false)
    expect(hasUsefulField({ ...EMPTY_RECEIPT, store: '행복마트' })).toBe(true)
    expect(hasUsefulField({ ...EMPTY_RECEIPT, amount: 1000 })).toBe(true)
  })

  it('날짜·금액·상호가 모두 있어야 충분하다', () => {
    expect(isCompleteEnough({ ...EMPTY_RECEIPT, amount: 1, date: '2026-01-01', store: 'a' })).toBe(true)
    expect(isCompleteEnough({ ...EMPTY_RECEIPT, amount: 1, date: '2026-01-01' })).toBe(false)
  })
})
