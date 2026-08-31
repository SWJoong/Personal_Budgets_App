import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ImageLightbox from '@/components/ui/ImageLightbox'

/**
 * ImageLightbox 배경-탭 닫기 계약 — PR #58 회귀 잠금 (W 검증-레인).
 *
 * 배경: ImageLightbox 는 Modal 패널을 w-full h-full 로 override 해 뷰포트를 덮는다.
 * 그러면 Modal 기본 오버레이(onClick=onClose)가 패널 아래에 가려져 "배경 탭 → 닫기"가 죽는다
 * (PR #58 최초 구현의 회귀 — Esc·✕ 만 작동). 복구책은 "배경 탭 닫기"를 패널 안에
 * 이미지의 **형제(sibling)** 레이어로 두는 것이다(자손 아님 → 이미지 클릭은 이 레이어로 전파되지 않음).
 *
 * 이 계약이 잠그는 불변식:
 *   1) 이미지 밖 배경(형제 레이어) 클릭 → onClose (배경 탭 닫기 복원)
 *   2) ★이미지 클릭 → onClose 호출 안 됨 (닫기 핸들러가 이미지의 조상에 있으면 안 됨 — 회귀의 정체)
 *   3) ✕ 버튼 클릭 → onClose
 *
 * jsdom 은 레이아웃/히트테스트를 하지 않으므로(어느 요소가 위에 그려지는지는 모름)
 * 각 요소에 직접 click 을 디스패치해 "핸들러 배선 + 버블링 경로"를 검증한다.
 * z-index 스태킹(이미지가 배경 레이어 위)은 코드리뷰로 커버 — 여기서 잠그는 건
 * "이미지 클릭이 닫기로 새지 않는다"는 DOM 구조 불변식이다.
 */
describe('ImageLightbox — 배경 탭 닫기 계약 (#58 회귀 잠금)', () => {
  it('이미지를 alt 접근성 이름으로 렌더한다', () => {
    render(<ImageLightbox src="https://x/receipt.jpg" alt="영수증 원본" onClose={() => {}} />)
    expect(screen.getByRole('img', { name: '영수증 원본' })).toBeInTheDocument()
  })

  it('배경(이미지 밖) 클릭 → onClose 를 호출한다', () => {
    const onClose = vi.fn()
    render(<ImageLightbox src="https://x/a.jpg" alt="사진" onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    // 패널 안의 배경 닫기 레이어(aria-hidden). Modal 오버레이는 패널 밖이라 dialog 스코프 쿼리로 구분된다.
    const backdrop = dialog.querySelector('[aria-hidden="true"]')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('★이미지 클릭 → onClose 를 호출하지 않는다(닫기 레이어가 이미지의 조상이면 회귀)', () => {
    const onClose = vi.fn()
    render(<ImageLightbox src="https://x/a.jpg" alt="사진" onClose={onClose} />)
    fireEvent.click(screen.getByRole('img', { name: '사진' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('✕ 버튼 클릭 → onClose 를 호출한다', () => {
    const onClose = vi.fn()
    render(<ImageLightbox src="https://x/a.jpg" alt="사진" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
