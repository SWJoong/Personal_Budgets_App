import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import MorePage from './page'

/**
 * P6 Phase C — 장식 이모지: 당사자 더보기 페이지 제목·프로필 대체 글자 (#201 b5f49e9 고정)
 * 출처: #201 검증 finding requirements-types-4 — 페이지 h1 '⚙ 더보기' 의 ⚙ 와 프로필 대체 글자 👤 가
 *   aria-hidden 없이 읽혔다(MoreMenuClient 계약의 이모지 스캔은 그 컨테이너만 봐서 못 잡음).
 *
 * 단언: (1) h1 접근명이 정확히 '더보기'(⚙ 는 aria-hidden). (2) 이름이 없어 👤 로 대체될 때 그 글자는
 *   aria-hidden 이고, 페이지 자체 마크업에 스크린리더로 노출되는 이모지가 없다.
 * 렌더 게이트: async 서버 컴포넌트 → 데이터 계층(createClient·getCurrentParticipant)·redirect 모킹 후
 *   render(await Page()). 자식 클라 컴포넌트(MoreMenuClient·NavDropdown·HelpButton·HelpAutoTrigger)는
 *   각자 계약이 소유 → null 스텁으로 격리(페이지 자신의 마크업만 본다).
 */
const h = vi.hoisted(() => ({ profileName: '김지수' as string | null }))

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: 'u-1', name: h.profileName, role: 'participant' } }),
        }),
      }),
    }),
  }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/utils/supabase/participant', () => ({
  getCurrentParticipant: async () => null,
}))
vi.mock('@/components/layout/MoreMenuClient', () => ({ default: () => null }))
vi.mock('@/components/layout/NavDropdown', () => ({ default: () => null }))
vi.mock('@/components/help/HelpButton', () => ({ default: () => null }))
vi.mock('@/components/help/HelpAutoTrigger', () => ({ default: () => null }))

const EMOJI = /\p{Extended_Pictographic}/u

/** 스크린리더에 그대로 노출되는 이모지 텍스트 — aria-hidden 조상도, aria-label 로 이름이 덮인 컨트롤 조상도 없는 것. */
function exposedEmoji(root: HTMLElement): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? ''
    if (!EMOJI.test(text)) continue
    const el = n.parentElement!
    if (el.closest('[aria-hidden="true"]')) continue
    if (el.closest('button[aria-label], a[aria-label]')) continue
    out.push(text.trim())
  }
  return out
}

async function renderPage() {
  return render(await MorePage({ searchParams: Promise.resolve({}) }))
}

beforeEach(() => {
  h.profileName = '김지수'
})

describe('P6-C 장식 이모지 — 당사자 더보기 페이지 (more-page-emoji-hidden)', () => {
  it("페이지 제목 h1 접근명은 정확히 '더보기'다(⚙ 는 aria-hidden)", async () => {
    await renderPage()
    // exact 문자열 — '⚙ 더보기' 로 읽히면 실패
    expect(screen.getByRole('heading', { level: 1, name: '더보기' })).toBeInTheDocument()
    expect(screen.getByText('⚙').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('이름이 없어 프로필 대체 글자 👤 가 나오면 aria-hidden 이고, 페이지에 노출 이모지가 없다', async () => {
    h.profileName = null
    const { container } = await renderPage()
    expect(screen.getByText('👤').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(exposedEmoji(container)).toEqual([])
  })
})
