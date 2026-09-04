import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SupporterError from './error'

/**
 * P6 Phase C — nav 완전성: 에러 바운더리 랜드마크 + h1 (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §nav (contract nav.error-boundary.landmark-and-h1)
 *
 * 전역 skip-link '본문 바로가기'(#main-content)와 heading 시퀀스(h1 유일)는 정상 페이지에는
 * 깔려 있으나, error.tsx 는 <div> 래퍼로 렌더되고 첫 heading 이 <h2> 라 에러 상태에서
 * 랜드마크·skip-link 목적지가 죽고 h1 없이 h2 로 시작한다.
 *
 * 단언 범위: 랜드마크(main#main-content)·heading 레벨(h1)만. 색/토큰/문구 스타일은 단언하지 않는다.
 * 렌더 게이트: 'use client' + useEffect 뿐 → jsdom 렌더 가능(데이터 계층 없음).
 */
describe('P6-C nav — SupporterError 랜드마크·h1 (error-boundary-landmark)', () => {
  it("[RED] 에러 화면이 <main id='main-content'> 랜드마크를 가진다", () => {
    const { container } = render(<SupporterError error={new Error('boom')} reset={() => {}} />)
    // RED: 현재 루트가 <div className='flex...min-h-screen'> — main#main-content 부재
    expect(container.querySelector('#main-content')).not.toBeNull()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it("[RED] 에러 화면의 최상위 제목이 h1 이다", () => {
    render(<SupporterError error={new Error('boom')} reset={() => {}} />)
    // RED: 현재 첫 heading 이 <h2>페이지를 불러올 수 없습니다</h2> — h1 부재
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/불러올 수 없습니다/)
  })
})
