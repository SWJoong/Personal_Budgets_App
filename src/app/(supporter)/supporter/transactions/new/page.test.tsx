import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redirect } from 'next/navigation'
import NewTransactionRedirect from './page'

/**
 * P5 IA — redirect 회귀잠금: /supporter/transactions/new (redirect-lock/supporter-transactions-new)
 * 설계출처: Plan&Source/goala_p5_ia_W.md §redirectMap (D3).
 *
 * 성격: RED 가 아니라 회귀잠금(현재 GREEN). P4 에서 이미 stub·구현됨.
 *   §1 무맥락 지출 등록 폼은 성립하지 않는다 — 실제 지출폼은 당사자 컨텍스트 필수
 *   (supporter/[participantId]/transactions/new). 여기로 온 사람은 org 거래장부(A1)로 포워딩한다.
 *   누군가 이 stub 의 redirect 를 삭제하거나 canonical 경로를 바꾸면 이 계약이 빨강이 된다.
 *
 * 단언 범위: 행위(redirect 호출 인자)만. 토큰·색·물리 nesting 은 단언하지 않는다.
 */

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const mockRedirect = vi.mocked(redirect)

beforeEach(() => {
  mockRedirect.mockReset()
})

describe('redirect-lock/supporter-transactions-new — 무맥락 지출폼 → org 거래장부', () => {
  it("default export 를 호출하면 redirect('/supporter/transactions') 가 정확히 1회 호출된다", async () => {
    await NewTransactionRedirect()
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/supporter/transactions')
  })

  it('무맥락 지출 등록 폼(JSX)을 렌더하지 않는다 — §1 당사자 컨텍스트 없는 지출폼 불성립', async () => {
    // redirect 를 모킹하면 함수는 폼 JSX 를 반환하지 않고 종료해야 한다(포워딩 전용 stub).
    const result = await NewTransactionRedirect()
    expect(result).toBeUndefined()
  })
})
