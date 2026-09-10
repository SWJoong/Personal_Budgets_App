import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * B2 관계망 — 서버 액션 CRUD 계약 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_relationship_network_crud_W.md §2 B2.
 * 구현 대상: src/app/actions/networkEntities.ts (create/update/deleteNetworkEntity 신규).
 *
 * 배경: needsAssessment.ts 템플릿 — assertStaff → 순수 검증(networkEntity util) → mutate →
 *   friendlyDbError → revalidatePath → {success,id}|{error}. update/delete 는 .select().maybeSingle()
 *   의 0행(RLS staff-only 로 못 보는 행)을 권한없음 메시지로 다룬다.
 *
 * 계약: create 유효→insert 호출·성공 / create 무효(분면 밖)→거부·insert 안 함 /
 *   update·delete 대상 있음→성공 / 대상 없음(RLS 0행)→거부.
 *
 * RED 사유: create/update/deleteNetworkEntity export 가 없다 → import 시 undefined → TypeError.
 */

const h = vi.hoisted(() => ({
  inserted: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
  deleted: 0,
  updateRow: { id: 'e-1', participant_id: 'p-1' } as Record<string, unknown> | null,
  deleteRow: { id: 'e-1', participant_id: 'p-1' } as Record<string, unknown> | null,
  user: { id: 'u-1' } as { id: string },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

function sessionClient() {
  return {
    from: () => {
      const b: Record<string, unknown> = {
        _op: '',
        insert: (row: Record<string, unknown>) => {
          h.inserted.push(row)
          b._op = 'insert'
          return b
        },
        update: (row: Record<string, unknown>) => {
          h.updated.push(row)
          b._op = 'update'
          return b
        },
        delete: () => {
          h.deleted++
          b._op = 'delete'
          return b
        },
        select: () => b,
        eq: () => b,
        single: async () => ({ data: { id: 'new-id' }, error: null }),
        maybeSingle: async () => ({
          data: b._op === 'update' ? h.updateRow : b._op === 'delete' ? h.deleteRow : null,
          error: null,
        }),
      }
      return b
    },
  }
}

vi.mock('@/utils/supabase/staff', () => ({
  assertStaff: async () => ({ supabase: sessionClient(), user: h.user }),
}))

import { createNetworkEntity, updateNetworkEntity, deleteNetworkEntity } from './networkEntities'

type Res = { success?: boolean; error?: string; id?: string }

beforeEach(() => {
  h.inserted = []
  h.updated = []
  h.deleted = 0
  h.updateRow = { id: 'e-1', participant_id: 'p-1' }
  h.deleteRow = { id: 'e-1', participant_id: 'p-1' }
  h.user = { id: 'u-1' }
})

describe('B2 — createNetworkEntity', () => {
  it('유효한 입력은 insert 되고 성공한다', async () => {
    const r = (await createNetworkEntity({
      participantId: 'p-1',
      relationCategory: 'family',
      entityName: '김엄마',
      closeness: 1,
    })) as Res
    expect(h.inserted.length).toBe(1)
    expect(h.inserted[0].relation_category).toBe('family')
    expect(r.success).toBe(true)
    expect(r.id).toBe('new-id')
  })

  it('4분면 밖 값은 거부하고 insert 하지 않는다', async () => {
    const r = (await createNetworkEntity({
      participantId: 'p-1',
      relationCategory: 'coworker' as 'family',
      entityName: '홍길동',
    })) as Res
    expect(r.error).toBeTruthy()
    expect(h.inserted.length).toBe(0)
  })
})

describe('B2 — updateNetworkEntity', () => {
  it('대상이 있으면 수정 성공', async () => {
    h.updateRow = { id: 'e-1', participant_id: 'p-1' }
    const r = (await updateNetworkEntity('e-1', { closeness: 2 })) as Res
    expect(h.updated.length).toBe(1)
    expect(r.success).toBe(true)
  })

  it('대상이 없으면(RLS 0행) 거부한다', async () => {
    h.updateRow = null
    const r = (await updateNetworkEntity('e-x', { closeness: 2 })) as Res
    expect(r.error).toBeTruthy()
    expect(r.success).toBeUndefined()
  })
})

describe('B2 — deleteNetworkEntity', () => {
  it('대상이 있으면 삭제 성공', async () => {
    h.deleteRow = { id: 'e-1', participant_id: 'p-1' }
    const r = (await deleteNetworkEntity('e-1')) as Res
    expect(h.deleted).toBe(1)
    expect(r.success).toBe(true)
  })

  it('대상이 없으면(RLS 0행) 거부한다', async () => {
    h.deleteRow = null
    const r = (await deleteNetworkEntity('e-x')) as Res
    expect(r.error).toBeTruthy()
    expect(r.success).toBeUndefined()
  })
})
