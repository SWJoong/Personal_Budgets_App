import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * P0-B 열람(read) 감사 배선 회귀 가드 (W 레인).
 * 스펙: docs/release/12-p0b-audit-retention.md §2 · 도11 §4. 설계 Plan&Source/goala_audit_log_W.md.
 * 대상 구현: getReceiptSignedUrl(serviceUsage.ts) · getDocumentSignedUrl(document.ts) ·
 *            getApplicationDocumentUrl(application.ts) — private 버킷 signed URL 발급 = 민감파일 열람.
 *
 * 계약(이 파일이 초록이면 아래가 서 있는 것이다):
 *  (a) 성공 후에만: createSignedUrl 이 성공한 경우에만 감사 기록이 남는다(에러면 감사 없음·URL 없음).
 *  (b) 코드·스코프: receipt.view / document.view + 올바른 target_type·target_id·participant 스코프.
 *  (c) 실패 격리: 감사 rpc 가 던져도 열람(URL 반환)은 마비되지 않는다(auditLog 내부 try/catch).
 *  (d) PII 최소: metadata 는 {bucket} 만 — 이름·자유서술 등 원문 PII 를 싣지 않는다.
 *
 * ★ @/utils/audit 는 목킹하지 않는다 — 실제 auditLog 가 세션 supabase.rpc('seoul_audit', …) 를
 *   호출하는 것까지 관통 검증한다(task: "supabase.rpc('seoul_audit', {…}) 를 호출함을 단언").
 * ★ RED 확인: 세 액션 중 하나에서 auditLog 호출을 지우면 해당 rpc 단언이 실패(RED)해야 한다.
 */

const h = vi.hoisted(() => ({
  user: { id: 'staff-1' } as { id: string } | null,
  receiptRow: { storage_path: 'p-1/rc/receipt.jpg' } as { storage_path: string } | null,
  docRow: { storage_path: 'p-9/doc/scan.pdf', participant_id: 'p-9' } as
    | { storage_path: string; participant_id: string }
    | null,
  signError: false as boolean, // true 면 createSignedUrl 이 에러 반환
  // 파라미터를 명시해 .mock.calls 튜플이 [string, args?] 로 잡히게 한다(tsc).
  rpc: vi.fn(async (_fn: string, _args?: Record<string, unknown>) => ({ data: 'audit-id', error: null })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// getReceipt/Document/ApplicationDocumentUrl 는 assertStaff·viewAs 를 쓰지 않지만 모듈 로드시 import 되므로 스텁.
vi.mock('@/utils/supabase/viewAs', () => ({ viewAsWriteBlock: async () => null }))
vi.mock('@/utils/supabase/staff', () => ({ assertStaff: async () => ({ supabase: {}, user: h.user }) }))

function sessionClient() {
  return {
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    rpc: h.rpc, // 감사 기록 경로(auditLog → supabase.rpc('seoul_audit', …))
    from: (table: string) => {
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        maybeSingle: async () => {
          if (table === 'seoul_receipts') return { data: h.receiptRow, error: null }
          if (table === 'seoul_application_documents') return { data: h.docRow, error: null }
          return { data: null, error: null }
        },
      }
      return b
    },
  }
}

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => sessionClient(),
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async () =>
          h.signError
            ? { data: null, error: { message: 'sign boom' } }
            : { data: { signedUrl: 'https://signed.example/x' }, error: null },
      }),
    },
  }),
}))

import { getReceiptSignedUrl } from '@/app/actions/serviceUsage'
import { getDocumentSignedUrl } from '@/app/actions/document'
import { getApplicationDocumentUrl } from '@/app/actions/application'

/** 마지막 seoul_audit rpc 호출의 인자(2번째)만 뽑는다. */
function lastAuditArgs(): Record<string, unknown> | null {
  const calls = h.rpc.mock.calls.filter((c) => c[0] === 'seoul_audit')
  if (!calls.length) return null
  return calls[calls.length - 1][1] as Record<string, unknown>
}

beforeEach(() => {
  h.user = { id: 'staff-1' }
  h.receiptRow = { storage_path: 'p-1/rc/receipt.jpg' }
  h.docRow = { storage_path: 'p-9/doc/scan.pdf', participant_id: 'p-9' }
  h.signError = false
  h.rpc.mockClear()
  h.rpc.mockImplementation(async () => ({ data: 'audit-id', error: null }))
})

describe('getReceiptSignedUrl — receipt.view 감사', () => {
  it('signed URL 성공 시 seoul_audit(receipt.view) 를 1회 기록한다', async () => {
    const r = await getReceiptSignedUrl('usage-1')
    expect(r.url).toBe('https://signed.example/x')
    const audit = h.rpc.mock.calls.filter((c) => c[0] === 'seoul_audit')
    expect(audit.length).toBe(1)
    const args = lastAuditArgs()!
    expect(args.p_action).toBe('receipt.view')
    expect(args.p_target_type).toBe('receipt')
    expect(args.p_target_id).toBe('usage-1')
  })

  it('metadata 는 {bucket} 만 — 원문 PII 없음(d)', async () => {
    await getReceiptSignedUrl('usage-1')
    expect(lastAuditArgs()!.p_metadata).toEqual({ bucket: 'receipts' })
  })

  it('createSignedUrl 실패 시 감사하지 않고 URL 도 안 준다(a)', async () => {
    h.signError = true
    const r = await getReceiptSignedUrl('usage-1')
    expect(r.url).toBeNull()
    expect(h.rpc.mock.calls.filter((c) => c[0] === 'seoul_audit').length).toBe(0)
  })

  it('감사 rpc 가 던져도 열람(URL 반환)은 계속된다 — 실패 격리(c)', async () => {
    h.rpc.mockImplementation(async () => {
      throw new Error('audit rpc down')
    })
    const r = await getReceiptSignedUrl('usage-1')
    expect(r.url).toBe('https://signed.example/x')
  })
})

describe('getDocumentSignedUrl — document.view 감사(당사자 스코프)', () => {
  it('signed URL 성공 시 seoul_audit(document.view) 를 당사자 스코프로 기록한다', async () => {
    const r = await getDocumentSignedUrl('doc-1')
    expect(r.url).toBe('https://signed.example/x')
    const args = lastAuditArgs()!
    expect(args.p_action).toBe('document.view')
    expect(args.p_target_type).toBe('application_document')
    expect(args.p_target_id).toBe('doc-1')
    expect(args.p_participant_id).toBe('p-9')
    expect(args.p_metadata).toEqual({ bucket: 'documents' })
  })

  it('createSignedUrl 실패 시 감사하지 않고 URL 도 안 준다(a)', async () => {
    h.signError = true
    const r = await getDocumentSignedUrl('doc-1')
    expect(r.url).toBeNull()
    expect(h.rpc.mock.calls.filter((c) => c[0] === 'seoul_audit').length).toBe(0)
  })
})

describe('getApplicationDocumentUrl — document.view 감사(당사자 스코프)', () => {
  it('signed URL 성공 시 seoul_audit(document.view) 를 당사자 스코프로 기록한다', async () => {
    const r = await getApplicationDocumentUrl('doc-9')
    expect(r.url).toBe('https://signed.example/x')
    const args = lastAuditArgs()!
    expect(args.p_action).toBe('document.view')
    expect(args.p_target_type).toBe('application_document')
    expect(args.p_target_id).toBe('doc-9')
    expect(args.p_participant_id).toBe('p-9')
    expect(args.p_metadata).toEqual({ bucket: 'documents' })
  })

  it('createSignedUrl 실패 시 감사하지 않고 URL 도 안 준다(a)', async () => {
    h.signError = true
    const r = await getApplicationDocumentUrl('doc-9')
    expect(r.url).toBeNull()
    expect(h.rpc.mock.calls.filter((c) => c[0] === 'seoul_audit').length).toBe(0)
  })
})
