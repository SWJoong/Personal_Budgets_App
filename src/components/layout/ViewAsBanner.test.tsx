import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { VIEW_AS_ID_COOKIE, VIEW_AS_NAME_COOKIE } from '@/utils/viewAsCookies'
import { ViewAsBanner } from './ViewAsBanner'

/**
 * ViewAsBanner — 관리자 둘러보기(view-as) 상단 배너 UI 배선 계약 (W 작성 · 독립 계약 테스트).
 * 설계출처: viewAs.ts/ViewAsBanner.tsx 헤더 주석(미리보기 중이며 저장되지 않음을 알리고 원터치 탈출).
 *
 * 스펙:
 *  - view_as_participant 쿠키가 있으면 배너(관리자 미리보기·대상 이름·'미리보기 나가기')를 렌더한다.
 *  - 쿠키가 없으면 아무것도 렌더하지 않는다(null) — 일반 세션 화면 오염 금지.
 *  - '미리보기 나가기' 버튼은 exitParticipantView 서버액션을 호출한다(탈출 경로 배선).
 *
 * 성격: 현 구현에 GREEN 이어야 한다. 쿠키는 클라이언트가 마운트 후 읽으므로 jsdom document.cookie 로 세팅.
 * 서버액션(exitParticipantView)은 next/headers·redirect 등 서버 전용 의존을 끌어오므로 모킹한다.
 * 단언 범위: 행위(존재/부재·이름표시·액션호출)만. 색상/토큰/위치는 단언하지 않는다.
 */

const h = vi.hoisted(() => ({ exitSpy: vi.fn() }))

// 서버액션 모킹: 실제 구현은 cookies()/redirect 로 jsdom 에서 폭발한다 → 스파이로 대체(호출 배선만 검증).
vi.mock('@/app/actions/viewAs', () => ({
  exitParticipantView: h.exitSpy,
}))

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`
}
function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

beforeEach(() => {
  clearCookie(VIEW_AS_ID_COOKIE)
  clearCookie(VIEW_AS_NAME_COOKIE)
  h.exitSpy.mockReset()
})

afterEach(() => {
  cleanup()
  clearCookie(VIEW_AS_ID_COOKIE)
  clearCookie(VIEW_AS_NAME_COOKIE)
})

describe('ViewAsBanner — 미리보기 배너 렌더 계약 (view-as-banner-render)', () => {
  it('view-as 쿠키가 있으면 status 배너를 렌더하고 대상 이름을 보여준다', async () => {
    setCookie(VIEW_AS_ID_COOKIE, '11e95b8b-6806-496d-9f36-88bd04e814b3')
    setCookie(VIEW_AS_NAME_COOKIE, '김지수')
    render(<ViewAsBanner />)

    // 쿠키는 useEffect(마운트 후)에서 읽히므로 배너 출현을 기다린다.
    const banner = await screen.findByRole('status')
    expect(banner).toBeInTheDocument()
    // 대상 당사자 이름이 배너에 노출된다(누구 화면을 보는지 관리자가 인지).
    expect(banner).toHaveTextContent('김지수')
    // 탈출 컨트롤이 존재한다.
    expect(screen.getByRole('button', { name: /미리보기 나가기/ })).toBeInTheDocument()
  })

  it('이름 쿠키가 없어도 id 쿠키만 있으면 배너는 렌더된다(이름 폴백)', async () => {
    setCookie(VIEW_AS_ID_COOKIE, 'some-participant-id')
    // 이름 쿠키 미설정 — 배너는 여전히 미리보기 상태를 알려야 한다.
    render(<ViewAsBanner />)
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /미리보기 나가기/ })).toBeInTheDocument()
  })

  it('view-as 쿠키가 없으면 아무것도 렌더하지 않는다(null)', async () => {
    // 일반 당사자/실무자 세션 — 배너가 뜨면 안 된다.
    const { container } = render(<ViewAsBanner />)
    // 마운트 후 effect 가 돌 시간을 준 뒤에도 배너/버튼이 없어야 한다.
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull()
    })
    expect(screen.queryByRole('button', { name: /미리보기 나가기/ })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ViewAsBanner — 탈출 배선 계약 (view-as-banner-exit-wiring)', () => {
  it("'미리보기 나가기'를 누르면 exitParticipantView 서버액션을 호출한다", async () => {
    setCookie(VIEW_AS_ID_COOKIE, 'p-1')
    setCookie(VIEW_AS_NAME_COOKIE, '홍길동')
    render(<ViewAsBanner />)

    const btn = await screen.findByRole('button', { name: /미리보기 나가기/ })
    fireEvent.click(btn)

    // 탈출 경로가 실제로 서버액션에 연결돼 있어야 한다(단순 표시용 버튼이 아니다).
    await waitFor(() => expect(h.exitSpy).toHaveBeenCalledTimes(1))
  })
})
