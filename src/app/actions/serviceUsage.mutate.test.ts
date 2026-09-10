import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * A2 회계 보강 — 지출 수정/삭제 pending 가드 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A2.
 * 구현 대상: src/app/actions/serviceUsage.ts (updateServiceUsage·deleteServiceUsage 신설).
 *
 * 배경: serviceUsage.ts 는 생성(recordServiceUsage)만 있고 update/delete 가 없어 잘못 기록한 지출을
 *   실무자가 못 고친다. RLS(04:188-205)는 이미 staff UPDATE/DELETE 를 허용하므로 스키마 변경은 없다.
 *
 * 정책(정한 기본값): 편집·삭제는 settlement_status='pending' 일 때만 허용한다. 검토가 끝난 지출
 *   (accepted/rejected/recovered)은 액션이 거부하고 DB 를 건드리지 않는다 — flag_criteria 가
 *   INSERT-only 라 검토 후 편집은 리뷰가 stale 해지고, 정산기록·감사추적을 보호해야 하기 때문.
 *   (RLS 는 staff 에게 더 관대하지만 앱이 pending-only 로 보수적으로 좁힌다.)
 *
 * RED 사유(현재 실패): updateServiceUsage·deleteServiceUsage export 가 없다 → import 시 undefined →
 *   호출이 TypeError. U 가 두 액션을 구현(먼저 settlement_status select → pending 이면 mutate,
 *   아니면 error 반환)하면 초록.
 *
 * 단언 범위: 가드 행위만(mutate 호출 여부·성공/거부). 문구·revalidate 경로·audit 세부는 단언하지 않음.
 */

const h = vi.hoisted(() => ({
  status: 'pending' as string,
  found: true as boolean,
  user: { id: 'u-1' } as { id: string } | null,
  updateCalls: [] as unknown[],
  deleteCalls: 0,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/supabase/viewAs', () => ({ viewAsWriteBlock: async () => null }))
vi.mock('@/utils/audit', () => ({ auditLog: vi.fn(async () => {}) }))
vi.mock('@/utils/supabase/server', () => ({
  createAdminClient: () => ({}),
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: () => {
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        update: (patch: unknown) => {
          h.updateCalls.push(patch)
          return b
        },
        delete: () => {
          h.deleteCalls++
          return b
        },
        // 가드용 현재 상태 조회: settlement_status 를 h.status 로 돌려준다.
        maybeSingle: async () => ({
          data: h.found ? { settlement_status: h.status, participant_id: 'p1' } : null,
          error: null,
        }),
        // update/delete 체인은 thenable — await 시 { error:null } 로 resolve(성공).
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({ data: null, error: null }),
      }
      return b
    },
  }),
}))

import { updateServiceUsage, deleteServiceUsage } from './serviceUsage'

type ActionResult = { success?: boolean; error?: string }

beforeEach(() => {
  h.status = 'pending'
  h.found = true
  h.user = { id: 'u-1' }
  h.updateCalls = []
  h.deleteCalls = 0
})

describe('A2 — updateServiceUsage pending 가드', () => {
  it('pending 지출은 수정된다(update 호출·성공)', async () => {
    h.status = 'pending'
    const r = (await updateServiceUsage('usage-1', { amount: 5000, description: '수정' })) as ActionResult
    expect(h.updateCalls.length).toBe(1)
    expect(r.success).toBe(true)
  })

  it('검토 끝난(accepted) 지출은 거부하고 update 하지 않는다', async () => {
    h.status = 'accepted'
    const r = (await updateServiceUsage('usage-1', { amount: 5000 })) as ActionResult
    expect(h.updateCalls.length).toBe(0)
    expect(r.error).toBeTruthy()
  })

  it('환수된(recovered) 지출도 거부한다', async () => {
    h.status = 'recovered'
    const r = (await updateServiceUsage('usage-1', { amount: 1 })) as ActionResult
    expect(h.updateCalls.length).toBe(0)
    expect(r.error).toBeTruthy()
  })
})

describe('A2 — deleteServiceUsage pending 가드', () => {
  it('pending 지출은 삭제된다(delete 호출·성공)', async () => {
    h.status = 'pending'
    const r = (await deleteServiceUsage('usage-1')) as ActionResult
    expect(h.deleteCalls).toBe(1)
    expect(r.success).toBe(true)
  })

  it('검토 끝난(rejected) 지출은 거부하고 delete 하지 않는다', async () => {
    h.status = 'rejected'
    const r = (await deleteServiceUsage('usage-1')) as ActionResult
    expect(h.deleteCalls).toBe(0)
    expect(r.error).toBeTruthy()
  })
})
