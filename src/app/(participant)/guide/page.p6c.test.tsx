import { describe, it, expect, vi } from 'vitest'
import { render, within } from '@testing-library/react'
import GuidePageClient from './page'

/**
 * P6 Phase C — touch44 + button/link 라벨: guide 뒤로가기 링크 (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §touch-label (contract touch-label.guide.backlink)
 *
 * guide 헤더의 뒤로가기는 <Link href='/' className='…text-2xl'>←</Link> — 아이콘 전용인데
 * aria-label/sr-only 가 없어 접근명이 '←' 이고(getByRole 접근명 실패), 크기 클래스도 없어
 * 인라인 텍스트 링크로 44px 터치 영역 미달이다.
 *
 * 굿패턴 참조: calendar/gallery 홈링크(aria-label + min-w/min-h-[44px]).
 * 렌더 게이트: 'use client' 순수 컴포넌트 → NavDropdown(usePathname)만 모킹.
 * 단언: 접근명(getByRole name) + 터치 클래스 문자열(min-h-11|min-h-[44px]) 존재. 렌더 px 아님.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/guide',
}))

const BACK_NAME = /집으로|홈으로|뒤로/

describe('P6-C touch-label — guide 뒤로가기 링크 (guide-backlink)', () => {
  it('[RED] 헤더 뒤로가기 링크가 접근 가능한 이름을 가진다', () => {
    const { container } = render(<GuidePageClient />)
    // 하단 '확인했어요! 홈으로 가기' CTA 와 구분하기 위해 헤더로 scope
    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    // RED: 헤더 ← 링크의 접근명이 '←' 뿐 — aria-label 부재로 name 매칭 실패
    expect(within(header as HTMLElement).getByRole('link', { name: BACK_NAME })).toBeInTheDocument()
  })

  it('[RED] 뒤로가기 링크가 44px 터치 크기 클래스를 가진다', () => {
    const { container } = render(<GuidePageClient />)
    // 접근명이 아직 없어도 검증 가능하도록 href 로 취득(그린 이후에도 유효)
    const back = container.querySelector('header a[href="/"]')
    expect(back).not.toBeNull()
    // RED: 현재 className 은 'text-2xl' 뿐 — 최소 터치 크기 클래스 없음
    expect(back?.className).toMatch(/min-h-11|min-w-11|min-h-\[44px\]|min-w-\[44px\]/)
  })
})
