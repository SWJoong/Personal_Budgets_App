import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * 활동사진 Wave B — addActivityPhotos 서버액션 계약 (RED: src/app/actions/activityPhoto.ts 미생성)
 * 설계출처: Plan&Source/goala_activity_photos_waveB_W.md §2
 *
 * ★보안 핵심: 경로 접두(participantId)를 usage 에서 서버측 도출한다(클라 신뢰 금지).
 *   액션 시그니처에 storage_path 가 없다 = 클라가 경로를 못 준다. 첫 세그먼트는 항상 usage 소유 참여자.
 *   (Wave A 트리거 seoul_check_activity_photo_path 가 DB 2차 방어. 이 테스트는 서버 1차 방어를 가둔다.)
 */

const h = vi.hoisted(() => ({
  uploads: [] as { bucket: string; path: string }[],
  inserted: [] as Record<string, unknown>[],
  removed: [] as string[],
  cfg: {
    user: { id: 'u-1' } as { id: string } | null,
    usage: { participant_id: 'PART-1' } as { participant_id: string } | null,
    uploadError: null as null | { message: string },
    insertError: null as null | { message: string },
  },
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.cfg.user } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.cfg.usage }) }) }),
      insert: async (row: Record<string, unknown>) => {
        if (table === 'seoul_activity_photos' && !h.cfg.insertError) h.inserted.push(row)
        return { error: h.cfg.insertError }
      },
    }),
  }),
  createAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          if (!h.cfg.uploadError) h.uploads.push({ bucket, path })
          return { error: h.cfg.uploadError }
        },
        remove: async (paths: string[]) => {
          h.removed.push(...paths)
          return { error: null }
        },
      }),
    },
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { addActivityPhotos } from './activityPhoto'

const photo = (base64 = 'AAAA', mimeType = 'image/jpeg') => ({ base64, mimeType })

beforeEach(() => {
  h.uploads.length = 0
  h.inserted.length = 0
  h.removed.length = 0
  h.cfg.user = { id: 'u-1' }
  h.cfg.usage = { participant_id: 'PART-1' }
  h.cfg.uploadError = null
  h.cfg.insertError = null
})

describe('addActivityPhotos — 업로드 서버액션', () => {
  it('[A] 단건: usage 소유 참여자 접두로 activity-photos 버킷 업로드 + 행 insert', async () => {
    const res = await addActivityPhotos('usage-9', [photo('AAAA', 'image/png')])
    expect(res).toMatchObject({ success: true, added: 1 })
    expect(h.uploads).toHaveLength(1)
    expect(h.uploads[0].bucket).toBe('activity-photos')
    // ★서버도출: 경로 첫 세그먼트 = mock usage 의 participant_id(PART-1), 클라 미전달
    expect(h.uploads[0].path).toMatch(/^PART-1\/usage-9\/[^/]+\.png$/)
    expect(h.inserted).toHaveLength(1)
    expect(h.inserted[0]).toMatchObject({ usage_id: 'usage-9', storage_path: h.uploads[0].path })
  })

  it('[B] 다건: N장 업로드 + N행 insert, 접두 모두 usage 참여자, 파일명 유일', async () => {
    const res = await addActivityPhotos('usage-9', [photo(), photo(), photo()])
    expect(res).toMatchObject({ success: true, added: 3 })
    expect(h.uploads).toHaveLength(3)
    expect(h.inserted).toHaveLength(3)
    for (const u of h.uploads) expect(u.path.startsWith('PART-1/usage-9/')).toBe(true)
    expect(new Set(h.uploads.map((u) => u.path)).size).toBe(3)
  })

  it('[보안] 접두는 항상 usage 의 참여자 — 다른 usage 면 접두도 그 참여자', async () => {
    h.cfg.usage = { participant_id: 'PART-2' }
    await addActivityPhotos('usage-x', [photo()])
    expect(h.uploads[0].path.startsWith('PART-2/usage-x/')).toBe(true)
  })

  it('[D] usage 없음(권한/부재) → error, 업로드 0', async () => {
    h.cfg.usage = null
    const res = await addActivityPhotos('nope', [photo()])
    expect(res.error).toBeTruthy()
    expect(h.uploads).toHaveLength(0)
    expect(h.inserted).toHaveLength(0)
  })

  it('[E] insert 실패 → orphan 파일 remove(롤백), added 0', async () => {
    h.cfg.insertError = { message: 'rls' }
    const res = await addActivityPhotos('usage-9', [photo()])
    expect(res).toMatchObject({ added: 0 })
    expect(h.uploads).toHaveLength(1)
    expect(h.removed).toContain(h.uploads[0].path)
    expect(h.inserted).toHaveLength(0)
  })

  it('[F] 미로그인 → error, 업로드 0', async () => {
    h.cfg.user = null
    const res = await addActivityPhotos('usage-9', [photo()])
    expect(res.error).toBeTruthy()
    expect(h.uploads).toHaveLength(0)
  })

  it('[G] photos 빈 배열 → added 0, 업로드 0', async () => {
    const res = await addActivityPhotos('usage-9', [])
    expect(res).toMatchObject({ added: 0 })
    expect(h.uploads).toHaveLength(0)
  })
})
