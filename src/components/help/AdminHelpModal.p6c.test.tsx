import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import AdminHelpModal from './AdminHelpModal'
import { ADMIN_HELP } from '@/data/adminHelpContent'

/**
 * P6 Phase C — touch44 + 장식 이모지: AdminHelpModal (f13f641 B4·A6-content 재적용)
 * 출처: feat/kwcag-a11y-foundation f13f641 — Modal 리팩터(#58) 뒤 main 에 다시 들어오지 못한 조각.
 *
 * - 헤더 닫기 ✕ · 하단 '확인': 44px 터치 클래스(확인은 py-2.5+text-sm=40px 였음 → min-h-11).
 * - 항목 아이콘·저장 용량 💡: 제목/설명 옆 장식 → aria-hidden.
 *
 * settings 페이지 = storageNote 가 켜진 유일한 페이지라 💡 까지 한 번에 본다.
 * ★Esc/오버레이/포커스/scroll-lock 은 Modal.test.tsx 소유 → 재작성 금지. 색 토큰 단언 없음.
 */
const TOUCH_H = /(?:^|\s)(?:min-h-11|min-h-\[44px\]|h-11)(?:\s|$)/
const TOUCH_W = /(?:^|\s)(?:min-w-11|min-w-\[44px\]|w-11)(?:\s|$)/
const page = ADMIN_HELP.settings

describe('P6-C touch44 — AdminHelpModal 버튼 (adminhelpmodal-close-touch)', () => {
  it('헤더 ✕ 닫기 버튼이 가로·세로 44px 터치 크기 클래스를 가진다', () => {
    render(<AdminHelpModal page={page} onClose={() => {}} />)
    const close = screen.getByRole('button', { name: '닫기' })
    expect(close.className).toMatch(TOUCH_H)
    expect(close.className).toMatch(TOUCH_W)
  })

  it("하단 '확인' 버튼이 44px 높이 클래스를 가진다(가로는 w-full)", () => {
    render(<AdminHelpModal page={page} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: '확인' }).className).toMatch(TOUCH_H)
  })
})

describe('P6-C 장식 이모지 — AdminHelpModal 항목 아이콘 (adminhelpmodal-icons-hidden)', () => {
  it('모든 항목 아이콘은 aria-hidden 이다', () => {
    render(<AdminHelpModal page={page} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    for (const item of page.items) {
      // 같은 아이콘이 두 항목에 쓰일 수 있어 getAll
      for (const icon of within(dialog).getAllByText(item.icon)) {
        expect(icon.closest('[aria-hidden="true"]'), `${item.title} 아이콘 ${item.icon}`).not.toBeNull()
      }
    }
  })

  it('저장 용량 안내의 💡 는 aria-hidden 이다', () => {
    render(<AdminHelpModal page={page} onClose={() => {}} />)
    expect(screen.getByText('💡').closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
