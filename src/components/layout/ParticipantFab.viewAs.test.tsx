import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { VIEW_AS_ID_COOKIE } from '@/utils/viewAsCookies'
import ParticipantFab from './ParticipantFab'

/**
 * ParticipantFab — 관리자 둘러보기(view-as) 중 지출입력 진입점 은닉 계약 (W 작성 · 독립 계약 테스트).
 * 설계출처: ParticipantFab.tsx 주석 — view-as 중엔 읽기전용 미리보기라 '내가 쓴 돈 적기' FAB(→/receipt)
 *           를 숨긴다(저장이 차단되는데 입력 진입점을 노출하면 관리자가 헛수고/혼란).
 *
 * ★기존 ParticipantFab.test.tsx(목적지 중복 가드)와 분리된 신규 파일 — 쿠키 축만 다룬다(충돌 없음).
 * 스펙:
 *  - view_as_participant 쿠키가 있으면 FAB 를 렌더하지 않는다(하이드레이션 후 은닉).
 *  - 쿠키가 없으면(일반 당사자) 당사자 라우트에서 FAB 를 렌더한다(대조군).
 *
 * 단언 범위: 행위(FAB 존재/부재)만. 위치/safe-area/CSS 는 단언하지 않는다(jsdom 불가).
 */

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

const mockUsePathname = vi.mocked(usePathname)

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`
}
function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/') // 당사자 홈 — 평상시 FAB 노출 라우트
  clearCookie(VIEW_AS_ID_COOKIE)
})

afterEach(() => {
  cleanup()
  clearCookie(VIEW_AS_ID_COOKIE)
})

describe('ParticipantFab — view-as 중 은닉 계약 (participant-fab-viewas-hidden)', () => {
  it('쿠키가 없으면(일반 당사자) 당사자 홈에서 FAB 를 렌더한다 (대조군)', async () => {
    render(<ParticipantFab />)
    // 평상시엔 지출 입력 진입점이 보인다.
    expect(await screen.findByRole('link', { name: '내가 쓴 돈 적기' })).toBeInTheDocument()
  })

  it('★view-as 쿠키가 있으면 FAB 를 숨긴다(읽기전용 미리보기 — 저장 차단됨)', async () => {
    setCookie(VIEW_AS_ID_COOKIE, '11e95b8b-6806-496d-9f36-88bd04e814b3')
    render(<ParticipantFab />)
    // 쿠키는 useEffect(마운트 후)에 읽혀 은닉되므로, effect 반영을 기다린 뒤 부재를 확인한다.
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: '내가 쓴 돈 적기' })).toBeNull()
    })
  })
})
