import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GalleryPage from './page'

/**
 * P7 웨이브3 — 갤러리 결정적 정렬 · 계약: gallery.sort (RED-jsdom)
 * 설계출처: Plan&Source/goala_p7_emptystate_W.md §6(정렬)
 *
 * 감사(Study C): gallery/page.tsx 에 .order() 가 전무 → 렌더 순서가 DB 반환 순서(비결정).
 *   사진 목록은 usage_date 최신순(newest first)으로 결정적이어야 한다. receipts 는 자체 날짜가
 *   없으므로 조인된 usage_date 로 최종 photos 를 정렬해야 한다(정렬 위치는 U 재량 — 쿼리 .order
 *   또는 JS sort). 이는 단순 문구가 아닌 실동작 개선(‘문구 초과’ 요건 충족).
 *
 * 단언: fixture 사진 2장(u1 2026-09-01 < u2 2026-09-02)을 렌더 → 첫 listitem 이 최신(u2).
 * 선례: gallery/page.p6c.test.tsx mock 하니스 재사용(supabase/participant/next-navigation mock).
 *
 * RED 이유: 오늘 정렬 없음 → 렌더 순서 = receipts 배열 순서(u1 먼저). 최신순 아님 → RED.
 */

const usagesData = [
  { id: 'u1', usage_date: '2026-09-01', description: '오래된 활동' },
  { id: 'u2', usage_date: '2026-09-02', description: '새 활동' },
]
// receipts 배열 순서는 의도적으로 usage_date 오름차순(u1→u2) — 정렬이 없으면 오래된 것이 먼저 렌더된다.
const receiptsData = [
  { usage_id: 'u1', storage_path: 'part-1/r1.jpg' },
  { usage_id: 'u2', storage_path: 'part-1/r2.jpg' },
]

// 체이너블+thenable 쿼리 스텁 — select/eq/in/order 를 임의 순서로 받고 await 시 {data} 로 resolve.
// (U 가 .order() 를 쿼리에 넣든 JS 에서 정렬하든 깨지지 않도록.)
function query(data: Record<string, unknown>[]) {
  const p = {
    select: () => p,
    eq: () => p,
    in: () => p,
    order: () => p,
    then: (res: (v: { data: Record<string, unknown>[] }) => unknown) =>
      Promise.resolve({ data }).then(res),
  }
  return p
}

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    from: (table: string) =>
      query(table === 'seoul_receipts' ? receiptsData : usagesData),
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

describe('P7-C gallery.sort — 사진 최신순 결정적 정렬', () => {
  it('[RED] 첫 사진이 usage_date 최신(u2, 새 활동)이다', async () => {
    render(await GalleryPage())
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    // RED: 정렬 없으면 items[0] = '오래된 활동'. 최신순이면 '새 활동' 이어야 한다.
    expect(items[0].textContent).toContain('새 활동')
    expect(items[1].textContent).toContain('오래된 활동')
  })
})
