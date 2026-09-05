import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('오버레이(배경) 클릭으로 닫는다(onClose 호출) — 기본 패널', () => {
    // 기본 Modal 은 패널(relative z-10)이 오버레이를 덮지 않으므로 배경 클릭이 오버레이에 도달한다.
    // (PR #58 ImageLightbox 회귀 = 패널을 w-full h-full 로 override 해 이 오버레이를 가린 특수 케이스.
    //  그 경우의 배경 닫기는 ImageLightbox.test.tsx 가 별도로 잠근다.)
    const onClose = vi.fn()
    const { baseElement } = render(
      <Modal open onClose={onClose} label="대화상자">
        <button>확인</button>
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    const overlay = baseElement.querySelector('[aria-hidden="true"]')
    expect(overlay).not.toBeNull()
    expect(dialog).not.toContainElement(overlay as HTMLElement) // 오버레이는 패널 밖(형제)
    fireEvent.click(overlay!)
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

  /**
   * D11 [low] — 배경 형제 inert/aria-hidden (P7 웨이브2, W 저작·U 초록화).
   * Modal 은 createPortal(document.body) 로 그려지므로 "배경" = 포털 루트를 뺀 body 형제들이다.
   * 감사: 현재 세 effect 는 dialog 내부·document.body.style 만 만지고 배경 형제에는 아무 속성도
   * 걸지 않아 SR/키보드가 배경에 도달할 수 있다.
   *
   * 계약(느슨: inert OR aria-hidden 둘 다 허용 — U 최소diff 경로 과잉제약 방지):
   *   - 열림: 포털 루트를 제외한 body 형제 각각이 inert 또는 aria-hidden="true".
   *   - 포털 루트(대화상자 subtree)는 제외 — 스스로를 숨기지 않는다.
   *   - 닫힘: 배경 형제의 inert/aria-hidden 이 모두 해제되고, 포커스가 트리거로 복원된다
   *     (정리순서 회귀 가드: inert 를 쓰면 focus-restore 전에 형제 inert 를 제거해야 트리거 재포커스 가능).
   *
   * 주: jsdom 은 inert 의 실제 포커스 차단을 에뮬레이트하지 않으므로 이 계약은 속성 "존재"만 단언한다.
   *     실제 AT/SR 배경 억제는 설계문(Plan&Source/goala_p7_focus_W.md)의 수동 QA 층이 덮는다.
   */
  it('backdrop-inert: 열림 시 배경 형제에 inert/aria-hidden, 닫힘 시 해제 + 트리거 복원', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: '열기' })

    await user.click(trigger)
    const dialog = screen.getByRole('dialog')

    // 포털 루트 = dialog 를 subtree 에 담은 body 직계 자식.
    const bodyChildren = Array.from(document.body.children)
    const portalRoot = bodyChildren.find((el) => el.contains(dialog))
    expect(portalRoot).toBeTruthy()

    // 포털 루트를 뺀 나머지 body 형제(= 배경, 트리거를 담은 컨테이너 포함)는 각각 숨겨져야 한다.
    const siblings = bodyChildren.filter((el) => el !== portalRoot)
    expect(siblings.length).toBeGreaterThan(0)
    for (const s of siblings) {
      const hidden = s.hasAttribute('inert') || s.getAttribute('aria-hidden') === 'true'
      expect(hidden).toBe(true)
    }

    // 포털 루트 자신은 제외(숨김 금지).
    expect(portalRoot!.hasAttribute('inert')).toBe(false)
    expect(portalRoot!.getAttribute('aria-hidden')).not.toBe('true')

    // 닫힘: 배경 복원 + 트리거 재포커스(정리순서가 맞아야 통과).
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    for (const s of Array.from(document.body.children)) {
      expect(s.hasAttribute('inert')).toBe(false)
      expect(s.getAttribute('aria-hidden')).not.toBe('true')
    }
    expect(trigger).toHaveFocus()
  })
})
