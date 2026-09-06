import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhotoGallery } from '@/components/ui/PhotoGallery'
import type { GalleryPhoto } from '@/utils/gallery'

/**
 * 활동사진 Wave C — 공용 PhotoGallery 렌더 골든 (RED: src/components/ui/PhotoGallery.tsx 미생성)
 * 설계출처: Plan&Source/goala_activity_photos_waveC_W.md §3
 *
 * 당사자·실무자 갤러리 공용 프레젠테이셔널. 순서는 호출측 mergeGalleryPhotos 가 정하고,
 * 이 컴포넌트는 프롭 순서대로 렌더한다(순수 = Supabase mock 불필요).
 */
const p = (usageId: string, label: string, kind: GalleryPhoto['kind'] = 'activity'): GalleryPhoto => ({
  usageId,
  url: `https://s/${usageId}`,
  label,
  date: '2026-01-01',
  kind,
})

describe('PhotoGallery — 공용 사진 그리드', () => {
  it('photos 를 프롭 순서대로 listitem 으로 렌더', () => {
    render(<PhotoGallery photos={[p('a', '첫사진'), p('b', '둘째사진', 'receipt')]} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('첫사진')
    expect(items[1].textContent).toContain('둘째사진')
  })

  it('빈 배열 → EmptyState(사진 없음), listitem 0', () => {
    render(<PhotoGallery photos={[]} />)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(/사진이 없어요/)).toBeInTheDocument()
  })

  it('각 사진에 img(alt=label) 이 있다', () => {
    render(<PhotoGallery photos={[p('a', '활동사진A')]} />)
    expect(screen.getByRole('img', { name: '활동사진A' })).toBeInTheDocument()
  })
})
