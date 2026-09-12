import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { PhotoGallery } from './PhotoGallery'
import type { GalleryPhoto } from '@/utils/gallery'

/**
 * 활동 사진 갤러리 — 사진 확대(라이트박스) 복원 계약 (W 레인). 고아 컴포넌트 ImageLightbox 복원.
 * 설계: Plan&Source/goala_orphan_components_restore_W.md §1.
 *
 * 배경: ImageLightbox(Modal 기반 확대뷰)는 만들어졌으나 소비처 0 — 갤러리 사진을 크게 볼 수 없었다.
 *   저시력·인지 사용자에게 확대는 중요. 사진을 누르면 확대 다이얼로그가 열린다.
 *
 * RED 사유: 현재 PhotoGallery 는 <img> 만 렌더(클릭 불가). 사진이 버튼/클릭가능 + 라이트박스 필요.
 */

const PHOTOS: GalleryPhoto[] = [
  { kind: 'activity', usageId: 'u1', url: 'https://x/a.jpg', label: '미술 활동' } as GalleryPhoto,
  { kind: 'receipt', usageId: 'u2', url: 'https://x/b.jpg', label: '커피' } as GalleryPhoto,
]

afterEach(() => cleanup())

describe('PhotoGallery — 사진 확대(라이트박스)', () => {
  it('사진이 눌러서 열 수 있는 컨트롤(button)로 렌더된다', () => {
    render(<PhotoGallery photos={PHOTOS} />)
    expect(screen.getByRole('button', { name: /미술 활동/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /커피/ })).toBeInTheDocument()
  })

  it('사진을 누르면 확대 다이얼로그(role=dialog)가 열린다', () => {
    render(<PhotoGallery photos={PHOTOS} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /미술 활동/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('빈 배열이면 빈 상태를 그대로 보여준다(회귀)', () => {
    render(<PhotoGallery photos={[]} />)
    expect(screen.getByText(/아직 사진이 없어요/)).toBeInTheDocument()
  })
})
