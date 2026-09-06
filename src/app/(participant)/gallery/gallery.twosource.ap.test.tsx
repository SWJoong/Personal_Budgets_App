import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GalleryPage from './page'

/**
 * 활동사진 Wave A — 갤러리 2소스 렌더 통합 (활동사진 우선 → 영수증 후순위)
 * 설계출처: Plan&Source/goala_activity_photos_W.md §6-2
 *
 * 순수 병합은 src/utils/gallery.test.ts 골든이, page.tsx 배선은 gallery.wiring.ap fs-scan 이 잡는다.
 * 이 테스트는 그 사이 — page.tsx 가 두 소스를 실제로 읽어 '활동사진 먼저' 순서로 렌더하는지(통합)를 검증한다.
 *
 * 핵심: 활동사진(9/2)이 영수증(9/5)보다 날짜상 오래됐어도 렌더 순서는 활동사진이 먼저다(활동 우선).
 * → 전역 날짜정렬이 아니라 그룹(활동→영수증) 순서임을 렌더 레벨에서 확인.
 */
const usagesData = [
  { id: 'u1', usage_date: '2026-09-01', description: '지출A' },
  { id: 'u2', usage_date: '2026-09-05', description: '지출B' },
]
const activityData = [
  { usage_id: 'u1', storage_path: 'part-1/u1/p1.jpg', caption: '나들이 사진', taken_at: '2026-09-02' },
]
const receiptsData = [
  { usage_id: 'u2', storage_path: 'part-1/u2/r.jpg' },
]

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ data: usagesData }),
        in: async () => ({
          data:
            table === 'seoul_activity_photos'
              ? activityData
              : table === 'seoul_receipts'
                ? receiptsData
                : [],
        }),
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

describe('gallery.twosource — 활동사진 우선 → 영수증 후순위 렌더', () => {
  it('활동사진(caption)이 영수증보다 먼저 렌더된다 (날짜와 무관)', async () => {
    render(await GalleryPage())
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    // 활동사진(9/2)이 영수증(9/5)보다 오래됐지만 활동이 먼저.
    expect(items[0].textContent).toContain('나들이 사진')
    expect(items[1].textContent).toContain('지출B')
  })
})
