import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GalleryPage from './page'

/**
 * P6 Phase C — list 시맨틱: 활동 사진 갤러리 (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §list (contract list.gallery.photos)
 *
 * validPhotos.map → <div grid grid-cols-2> 안 <div>(사진+설명), role 없음.
 * grid 는 픽셀이 아닌 DOM role 문제라 jsdom 가능하나, gallery/page.tsx 는 async 서버
 * 컴포넌트(createAdminClient) → 데이터 계층 모킹 후 render(await Page()).
 * (권장 대안: 목록부를 client 프레젠테이셔널 서브컴포넌트로 추출해 fixture prop 렌더.)
 *
 * 단언: 사진 N장이 listitem 으로 렌더(현재 0). figure/figcaption 채택 시 U 는 설계문 대안 참조.
 * 대비 sweep 배치3 겹침.
 */
const usagesData = [
  { id: 'u1', usage_date: '2026-09-01', description: '활동1' },
  { id: 'u2', usage_date: '2026-09-02', description: '활동2' },
]
const receiptsData = [
  { usage_id: 'u1', storage_path: 'part-1/r1.jpg' },
  { usage_id: 'u2', storage_path: 'part-1/r2.jpg' },
]

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    from: () => ({
      select: () => ({
        eq: async () => ({ data: usagesData }),
        in: async () => ({ data: receiptsData }),
      }),
    }),
  }),
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: 'https://example.test/photo.jpg' } }),
      }),
    },
  }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/utils/supabase/participant', () => ({
  getCurrentParticipant: async () => ({ id: 'part-1' }),
}))

describe('P6-C list — 갤러리 사진 목록 시맨틱 (gallery-photos-list)', () => {
  it('[RED] 사진이 list/listitem 으로 렌더된다', async () => {
    render(await GalleryPage())
    // RED: 현재 <div> grid 나열 — listitem 0건
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
