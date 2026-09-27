import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

/**
 * 개인정보 처리방침 쉬운 말판(/privacy/easy) 사실 가드. 대상: fix/privacy-policy-facts.
 * 전문판(page.render.test.tsx (C))과 같은 사실을 당사자용 문장에서도 못 박는다:
 *  - 저장은 국내(Supabase 서울 리전, docs/release/15 §3) — '모두 미국으로 보낸다'로 읽히지 않게 서울 저장을 밝힌다.
 *  - 영수증 사진은 미국 회사로 그대로(원본) 간다 — 사진은 가릴 수 없다(ocr.ts callAI 직송).
 *  - 글은 이름을 가리고 보낸다(callAIDeidentified). 기관 이름 가림은 배선돼 있지 않으므로 주장 금지.
 * 방식: 클라이언트 컴포넌트 실물 렌더(TTS 는 목 — 클릭 시에만 호출). 섹션은 h2 이름으로 찾는다.
 */

vi.mock('@/utils/tts', () => ({ speak: vi.fn() }))

import EasyPrivacyClient from './EasyPrivacyClient'

/** h2 제목으로 찾은 쉬운 말 섹션의 본문 텍스트. */
function sectionText(title: RegExp): string {
  const section = screen.getByRole('heading', { level: 2, name: title }).closest('section')
  expect(section, `${title} 섹션이 없다`).not.toBeNull()
  return section!.textContent ?? ''
}

describe('/privacy/easy 쉬운 말판 — 저장 위치·국외 전송 사실 가드', () => {
  beforeEach(() => cleanup())

  it('정보는 서울에 저장한다고 알린다(저장은 국외 이전 아님)', () => {
    render(<EasyPrivacyClient />)
    expect(sectionText(/안전하게 지켜요/)).toMatch(/서울에 있는 컴퓨터에 저장/)
  })

  it('영수증 사진은 그대로 미국 회사로 보내고, 글은 이름을 가려서 보낸다고 구분한다', () => {
    render(<EasyPrivacyClient />)
    const text = sectionText(/미국으로 보내는 정보/)
    expect(text).toMatch(/영수증 사진을 그대로 미국 회사에 보내요/)
    expect(text).toMatch(/글을 보낼 때는 이름을 안 보이게 가려요/)
  })

  it('기관 이름을 가린다고 말하지 않는다(배선 안 된 보호조치 주장 금지)', () => {
    render(<EasyPrivacyClient />)
    expect(document.body.textContent ?? '').not.toMatch(/기관 이름/)
  })
})
