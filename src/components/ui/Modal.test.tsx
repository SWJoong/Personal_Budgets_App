import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '@/components/ui/Modal'

/**
 * Modal 프리미티브 RED 계약 — KRDS/KWCAG 접근성 (W 작성, U 초록화).
 *
 * 기존 NavDropdown 이 이미 갖춘 것(portal·role=dialog·aria-modal·Esc·scroll-lock)은 회귀 고정용이고,
 * 이 계약의 핵심 신규가치는 **포커스 관리**다 — 어떤 모달도 포커스를 옮기거나 복원하지 않는 것이 감사에서 드러났다.
 *   1) 열릴 때 포커스가 대화상자 안으로 이동(focus-move-in)
 *   2) 열려 있는 동안 Tab/Shift+Tab 이 대화상자를 벗어나지 못함(focus-trap)
 *   3) 닫힐 때 포커스가 트리거로 복원(focus-restore)
 *
 * 접근성 배선은 jest-axe 없이 역할/이름 쿼리(getByRole)로 강제한다(프로젝트 관례).
 *
 * RED: '@/components/ui/Modal' 미존재 → import 실패로 스위트 전체 RED. U 가 §5 계약대로 구현하면 초록.
 */

/** open 상태와 트리거를 함께 관리하는 소형 하네스 — focus-restore·open/close 를 실제 흐름으로 검증. */
function Harness({ label = '테스트 대화상자' }: { label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>열기</button>
      <Modal open={open} onClose={() => setOpen(false)} label={label}>
        <button>첫 번째</button>
        <button>마지막</button>
      </Modal>
    </>
  )
}

describe('Modal — 접근성 프리미티브 계약', () => {
  it('닫힘: open=false 이면 대화상자를 렌더하지 않는다', () => {
    render(
      <Modal open={false} onClose={() => {}} label="숨김 대화상자">
        <p>내용</p>
      </Modal>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('열림 시맨틱: role=dialog · aria-modal=true · 접근성 이름(label)', () => {
    render(
      <Modal open onClose={() => {}} label="영수증 도움말">
        <p>내용</p>
      </Modal>
    )
    const dialog = screen.getByRole('dialog', { name: '영수증 도움말' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('Esc 키로 닫는다(onClose 호출)', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal open onClose={onClose} label="대화상자">
        <button>확인</button>
      </Modal>
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('focus-move-in: 열리면 포커스가 대화상자 안으로 이동한다', () => {
    render(
      <Modal open onClose={() => {}} label="대화상자">
        <button>첫 번째</button>
        <button>마지막</button>
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('focus-trap: 열려 있는 동안 Tab / Shift+Tab 이 대화상자를 벗어나지 않는다', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: '열기' }))
    const dialog = screen.getByRole('dialog')

    // 앞으로 여러 번 Tab — 포커스는 언제나 대화상자 안에 머문다(트리거·body 로 새어나가지 않음).
    for (let i = 0; i < 5; i++) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
    // 역방향도 동일.
    for (let i = 0; i < 5; i++) {
      await user.tab({ shift: true })
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('focus-restore: 닫히면 포커스가 열었던 트리거로 복원된다', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: '열기' })

    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('scroll-lock: 열려 있는 동안 body 스크롤을 잠그고 닫으면 해제한다', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(document.body.style.overflow).not.toBe('hidden')

    await user.click(screen.getByRole('button', { name: '열기' }))
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
