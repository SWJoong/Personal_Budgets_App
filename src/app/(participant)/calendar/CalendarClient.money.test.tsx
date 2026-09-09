import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CalendarClient from './CalendarClient'

/**
 * 렌더 계약(W레인): 당사자 달력의 금액 표시 = 정본 MoneyText 프리미티브로 고정.
 *
 * 배경: 당사자 화면 5곳의 지역 won() 헬퍼가 MoneyText / formatCurrency 로 이관됐다.
 * 이 계약은 그 이관이 (1) 같은 금액 문자열 (2) 같은 글자색을 보존함을 잠근다.
 * 누군가 MoneyText 를 맨 문자열({amount}원)로 되돌리면 tabular-nums 가 사라지고
 * (또는 색 이관이 어긋나면) 이 테스트가 빨개진다. 구현 미수정(테스트 전용).
 *
 * 대상 선정: CalendarClient 는 순수 클라이언트(prop=usages 배열)라 서버·supabase·
 * LiveRegion 의존 없이 실제 MoneyText 를 렌더한다 — 렌더 계약의 대표로 최적.
 * 색 대응(정본 MoneyText): 월 합계 "이번 달에 쓴 돈:" = emphasis="muted" →
 * text-muted-foreground, 날짜별 지출 금액 = emphasis="body" → text-foreground.
 * (둘 다 tabular-nums 를 달아 "MoneyText 를 거쳤음"을 증명한다.)
 */

// 표시 중인 달(오늘 기준 연·월)에 지출이 잡히도록 현재 달의 날짜키를 만든다.
const now = new Date()
const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`

// 월 합계 = 12,345 + 3,210 = 15,555원 (같은 날에 두 건 → 그 날을 열면 둘 다 보인다).
const usages = [
  { id: 'u1', usage_date: dayKey, amount: 12345, description: '수영장' },
  { id: 'u2', usage_date: dayKey, amount: 3210, description: '간식' },
]

describe('CalendarClient — 당사자 금액 표시 렌더 계약(MoneyText 이관 고정)', () => {
  it('월 합계는 MoneyText(muted): "15,555원"이 tabular-nums·text-muted-foreground 로 렌더', () => {
    render(<CalendarClient usages={usages} />)
    // 맨 문자열이면 "이번 달에 쓴 돈: 15,555원" 한 덩어리라 이 exact 조회가 실패한다.
    const total = screen.getByText('15,555원')
    expect(total).toHaveClass('tabular-nums') // MoneyText 를 거쳤음(맨 헬퍼 아님)
    expect(total).toHaveClass('text-muted-foreground') // muted 색 보존
  })

  it('날짜별 지출 금액은 MoneyText(body): 정확한 "12,345원" + tabular-nums·text-foreground', () => {
    render(<CalendarClient usages={usages} />)
    // 지출이 있는 10일 칸을 눌러 그 날 목록을 연다(버튼 접근명 = 날짜 숫자).
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    const amount = screen.getByText('12,345원')
    expect(amount).toHaveClass('tabular-nums') // 반전 시(맨 {amount}원) 사라짐 → RED
    expect(amount).toHaveClass('text-foreground') // body 색(muted 아님) 보존
    expect(amount).not.toHaveClass('text-muted-foreground')
  })
})
