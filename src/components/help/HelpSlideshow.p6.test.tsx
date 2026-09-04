import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HelpSlideshow from '@/components/help/HelpSlideshow'
import { HELP_SECTIONS } from '@/data/helpSlides'

/**
 * P6 Phase B — 모달 소비자 배선 계약: HelpSlideshow.
 * 설계출처: Plan&Source/goala_p6_phaseB_W.md §Modal 소비자 매핑.
 *
 * 버킷: [ALIGN] — 이미 Modal 소비. 부모가 조건부 마운트로 열고 닫으므로 open 은 항상 true;
 *   닫힘은 언마운트라 onClose 스파이로 검증(dialog 제거 아님). RED 아님.
 *
 * ★Esc/오버레이/포커스/scroll-lock 은 Modal.test.tsx 소유 → 재작성 금지.
 */
const section = HELP_SECTIONS.home

describe('HelpSlideshow p6 소비자 — 모달 접근성 이름 + onClose', () => {
  it('[ALIGN] 섹션 제목으로 접근성 이름을 가진 dialog 를 렌더한다', () => {
    render(<HelpSlideshow section={section} onClose={() => {}} />)
    expect(
      screen.getByRole('dialog', { name: `${section.title} 도움말` }),
    ).toBeInTheDocument()
  })

  it('[ALIGN] ✕(닫기) 를 누르면 onClose 가 정확히 1회 호출된다', () => {
    const onClose = vi.fn()
    render(<HelpSlideshow section={section} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
