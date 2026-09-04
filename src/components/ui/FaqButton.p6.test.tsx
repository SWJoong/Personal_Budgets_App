import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FaqButton from '@/components/ui/FaqButton'

/**
 * P6 Phase B — 모달 소비자 배선 계약: FaqModal (FaqButton).
 * 설계출처: Plan&Source/goala_p6_phaseB_W.md §Modal 소비자 매핑.
 *
 * 버킷: [ALIGN] — 이미 Modal 프리미티브를 소비한다. main 에 이 소비자 테스트가 없어
 *   접근성 이름 + 열기/닫기 배선만 잠근다(회귀방지). RED 아님.
 *
 * ★프리미티브 소유 경계(리뷰 규칙): Esc·오버레이·포커스이동/트랩/복원·scroll-lock 은
 *   Modal.test.tsx 가 이미 잠갔다. 여기서 재작성 금지(중복) — 소비자가 넘긴
 *   label(=접근성 이름)과 자체 ✕ 배선만 검증한다.
 */
describe('FaqButton p6 소비자 — 모달 접근성 이름 + 열기/닫기', () => {
  it('[ALIGN] 트리거를 누르면 접근성 이름을 가진 dialog 가 열린다', () => {
    render(<FaqButton variant="inline" />)
    fireEvent.click(screen.getByRole('button', { name: '자주 묻는 질문' }))
    expect(
      screen.getByRole('dialog', { name: 'Q&A · 자주 묻는 질문' }),
    ).toBeInTheDocument()
  })

  it('[ALIGN] 모달 자체 ✕(닫기) 를 누르면 dialog 가 사라진다', () => {
    render(<FaqButton variant="inline" />)
    fireEvent.click(screen.getByRole('button', { name: '자주 묻는 질문' }))
    const dialog = screen.getByRole('dialog', { name: 'Q&A · 자주 묻는 질문' })
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(dialog).not.toBeInTheDocument()
  })
})
