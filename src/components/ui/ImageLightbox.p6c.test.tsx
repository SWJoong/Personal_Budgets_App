import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ImageLightbox from './ImageLightbox'
import { Modal } from './Modal'

/**
 * P6 Phase C — touch/label GUARD: 이미 green 인 라벨·터치 사실 회귀락
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §touch-label (contract touch-label.green-labels.guard)
 *
 * 진짜 icon-only 무라벨 <button> 은 0건(스캔 무결과) — 라벨 갭은 ← 백링크뿐(별도 RED).
 * 여기서는 이미 통과하는 라벨/터치를 잠근다: ImageLightbox 닫기(w-11 h-11 + aria-label),
 * Modal dialog aria-label.
 */
describe('P6-C touch-label GUARD — 이미 green (green-labels)', () => {
  it('ImageLightbox 닫기 버튼: 접근명 + 44px 터치 크기', () => {
    render(<ImageLightbox src="https://example.test/x.jpg" alt="사진1" onClose={() => {}} />)
    const close = screen.getByRole('button', { name: '닫기' })
    expect(close.className).toMatch(/w-11/)
    expect(close.className).toMatch(/h-11/)
  })

  it('Modal: dialog 가 aria-label 을 가진다', () => {
    render(
      <Modal open onClose={() => {}} label="테스트 대화상자">
        <p>내용</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', '테스트 대화상자')
  })
})
