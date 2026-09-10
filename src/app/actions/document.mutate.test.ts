import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * A3 서류 보강 — 서류함 업로드/삭제 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A3.
 * 구현 대상: src/app/actions/document.ts (uploadShelfDocument·deleteShelfDocument 신설).
 *
 * 배경: document.ts 는 나열/열람만 있고, 서류 추가는 신청서 상세(uploadApplicationDocument)에서만
 *   가능했다. 서류함에서 직접 올리고 지울 수 있게 한다. 테이블·스토리지 RLS 는 이미 staff write/delete
 *   를 허용하므로 스키마 변경은 없다.
 *
 * 잠금 계약:
 *  (1) 업로드 경로는 반드시 '{participantId}/...' 로 시작한다 — 06_storage.seoul_storage_owner()가
 *      첫 세그먼트로 소유자를 판별하므로 이 규칙을 어기면 접근제어가 깨진다(경로 위조 방지).
 *  (2) seoul_application_documents.application_id 는 NOT NULL 이라, 서류함 업로드는 참여자의 최신
 *      신청(seoul_applications)을 서버가 자동 해결해 그 id 로 넣는다 — 신청이 없으면 거부하고
 *      스토리지에 파일을 올리지도, 행을 넣지도 않는다.
 *  (3) 삭제는 RLS 로 볼 수 있는(=담당) 행만 — 조회 실패면 스토리지 파일도 건드리지 않는다.
 *
 * RED 사유: uploadShelfDocument·deleteShelfDocument export 가 없다 → import 시 undefined → 호출 시
 *   TypeError. 단언 범위: 경로 접두·application 가드·mutate 호출 여부만(문구·revalidate 세부 제외).
 */

const h = vi.hoisted(() => ({
  app: { id: 'app-1' } as { id: string } | null, // 참여자 최신 신청(null = 없음)
  docRow: { storage_path: 'p-1/shelf/old.pdf', participant_id: 'p-1' } as Record<string, unknown> | null,
  user: { id: 'u-1' } as { id: string },
  uploadPaths: [] as string[],
  inserted: [] as Record<string, unknown>[],
  deletedRows: 0,
  removedPaths: [] as string[][],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/audit', () => ({ auditLog: vi.fn(async () => {}) }))

function sessionClient() {
  return {
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (table: string) => {
      const b: Record<string, unknown> = {
        _inserted: false,
        select: () => b,
        eq: () => b,
        order: () => b,
        limit: () => b,
        insert: (row: Record<string, unknown>) => {
          h.inserted.push(row)
          b._inserted = true
          return b
        },
        delete: () => {
          h.deletedRows++
          return b
        },
        maybeSingle: async () => {
          if (table === 'seoul_applications') return { data: h.app, error: null }
          if (table === 'seoul_application_documents') {
            // insert 직후면 새 행 id, 아니면(삭제 경로의 조회) 기존 행.
            return { data: b._inserted ? { id: 'new-doc' } : h.docRow, error: null }
          }
          return { data: null, error: null }
        },
        then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: null, error: null }),
      }
      return b
    },
  }
}

vi.mock('@/utils/supabase/staff', () => ({
  assertStaff: async () => ({ supabase: sessionClient(), user: h.user }),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => sessionClient(),
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: async (path: string) => {
          h.uploadPaths.push(path)
          return { error: null }
        },
        remove: async (paths: string[]) => {
          h.removedPaths.push(paths)
          return { error: null }
        },
      }),
    },
  }),
}))

import { uploadShelfDocument, deleteShelfDocument } from './document'

type Res = { success?: boolean; error?: string; documentId?: string }

beforeEach(() => {
  h.app = { id: 'app-1' }
  h.docRow = { storage_path: 'p-1/shelf/old.pdf', participant_id: 'p-1' }
  h.user = { id: 'u-1' }
  h.uploadPaths = []
  h.inserted = []
  h.deletedRows = 0
  h.removedPaths = []
})

describe('A3 — uploadShelfDocument', () => {
  it('신청이 있으면 참여자 접두 경로로 올리고 행을 넣는다(성공)', async () => {
    h.app = { id: 'app-1' }
    const r = (await uploadShelfDocument({
      participantId: 'p-1',
      docType: 'other',
      fileName: 'note.pdf',
      base64: 'AAAA',
      mimeType: 'application/pdf',
    })) as Res
    expect(h.uploadPaths.length).toBe(1)
    expect(h.uploadPaths[0].startsWith('p-1/')).toBe(true) // 경로 위조 방지(소유자=첫 세그먼트)
    expect(h.inserted.length).toBe(1)
    expect(h.inserted[0].application_id).toBe('app-1') // NOT NULL 을 서버가 자동 해결
    expect(r.success).toBe(true)
  })

  it('참여자에게 신청이 없으면 거부하고 파일 업로드·행 삽입을 하지 않는다', async () => {
    h.app = null
    const r = (await uploadShelfDocument({
      participantId: 'p-1',
      docType: 'other',
      fileName: 'note.pdf',
      base64: 'AAAA',
    })) as Res
    expect(r.error).toBeTruthy()
    expect(h.uploadPaths.length).toBe(0)
    expect(h.inserted.length).toBe(0)
  })
})

describe('A3 — deleteShelfDocument', () => {
  it('담당 서류는 행+스토리지 파일을 함께 지운다(성공)', async () => {
    h.docRow = { storage_path: 'p-1/shelf/old.pdf', participant_id: 'p-1' }
    const r = (await deleteShelfDocument('doc-1')) as Res
    expect(h.deletedRows).toBe(1)
    expect(h.removedPaths.length).toBe(1)
    expect(h.removedPaths[0]).toContain('p-1/shelf/old.pdf')
    expect(r.success).toBe(true)
  })

  it('RLS 로 안 보이는 서류는 거부하고 스토리지도 건드리지 않는다', async () => {
    h.docRow = null
    const r = (await deleteShelfDocument('doc-x')) as Res
    expect(r.error).toBeTruthy()
    expect(h.deletedRows).toBe(0)
    expect(h.removedPaths.length).toBe(0)
  })
})
