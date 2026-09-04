import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AdminHelpModal from '@/components/help/AdminHelpModal'
import { ADMIN_HELP } from '@/data/adminHelpContent'

/**
 * P6 Phase B — 모달 소비자 배선 계약: AdminHelpModal.
 * 설계출처: Plan&Source/goala_p6_phaseB_W.md §Modal 소비자 매핑.
 *
 * 버킷: [ALIGN] — 이미 Modal 소비. onClose 스파이로 닫힘 배선 검증. RED 아님.
 * ★프리미티브 소유 행위(Esc/오버레이/포커스/scroll-lock)는 재작성 금지.
 */
const page = Object.values(ADMIN_HELP)[0]

describe('AdminHelpModal p6 소비자 — 모달 접근성 이름 + onClose', () => {
  it('[ALIGN] 페이지 제목으로 접근성 이름을 가진 dialog 를 렌더한다', () => {
    render(<AdminHelpModal page={page} onClose={() => {}} />)
    expect(
      screen.getByRole('dialog', { name: `${page.pageTitle} 도움말` }),
    ).toBeInTheDocument()
  })

  it('[ALIGN] 확인 버튼을 누르면 onClose 가 정확히 1회 호출된다', () => {
    const onClose = vi.fn()
    render(<AdminHelpModal page={page} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
