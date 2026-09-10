import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * 계약(W레인·RED) : getSettlements 의 allocation 스코프 — view-as 정산 충실도 갭(C2, docs/release/08 §9).
 * 구현 대상: src/app/actions/settlement.ts (getSettlements)
 *
 * 배경(갭): 정산은 participant_id 컬럼이 없고 allocation 을 통해 참여자에 묶인다. 일반 당사자는
 * getSettlements(undefined) 로 RLS self → 자기 **모든** allocation 의 정산을 본다. 그런데 관리자
 * view-as 는 관리자 RLS 라 인자 없이 부르면 전체 유출 → evaluations 페이지가 대상의 allocation 으로
 * 스코프해야 하는데, **최신 1건만**(limit 1) 넘겨 다건 배정 당사자의 과거 정산이 빠졌다(view-as 가
 * 당사자 실제 화면보다 적게 보임 = 충실도 갭).
 *
 * 정본 동작: getSettlements 가 allocation 을 string | string[] 로 받는다.
 *   - string   → .eq('allocation_id', id)         (기존 실무자/관리자 상세 호출부 하위호환)
 *   - string[] → .in('allocation_id', ids)         (view-as: 대상의 **모든** allocation)
 *   - []       → .in('allocation_id', [SENTINEL])   (신규 당사자·빈 배열: 유출 방지, 아무것도 매칭 안 함)
 *   - undefined→ allocation 필터 없음               (일반 당사자 RLS self)
 *
 * test-first: 현재 코드는 truthy 검사 `if (allocationId)` 하나라 배열도 .eq 로 잘못 필터한다 → RED.
 * 테스트 파일만 신설(구현 미수정).
 */

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

const h = vi.hoisted(() => ({
  eqCalls: [] as [string, unknown][],
  inCalls: [] as [string, unknown][],
  user: { id: 'u-1' } as { id: string } | null,
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: () => {
      const b: Record<string, unknown> = {
        select: () => b,
        order: () => b,
        eq: (col: string, val: unknown) => {
          h.eqCalls.push([col, val])
          return b
        },
        in: (col: string, val: unknown) => {
          h.inCalls.push([col, val])
          return b
        },
        // PostgREST 빌더는 thenable — `await query` 가 { data, error } 로 resolve.
        then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }),
      }
      return b
    },
  }),
}))

import { getSettlements } from './settlement'

function allocEqCalls() {
  return h.eqCalls.filter((c) => c[0] === 'allocation_id')
}
function allocInCalls() {
  return h.inCalls.filter((c) => c[0] === 'allocation_id')
}

beforeEach(() => {
  h.eqCalls.length = 0
  h.inCalls.length = 0
  h.user = { id: 'u-1' }
})

describe('getSettlements — allocation 스코프 계약(C2 view-as 충실도)', () => {
  it('배열: 대상의 모든 allocation_id 로 .in 필터(view-as 전체 스코프)', async () => {
    await getSettlements(['a1', 'a2', 'a3'])
    expect(allocInCalls()).toContainEqual(['allocation_id', ['a1', 'a2', 'a3']])
    expect(allocEqCalls()).toHaveLength(0)
  })

  it('빈 배열: 유출 방지 sentinel 로 .in — 아무 정산도 매칭 안 함(신규 당사자)', async () => {
    await getSettlements([])
    expect(allocInCalls()).toContainEqual(['allocation_id', [NO_MATCH]])
    expect(allocEqCalls()).toHaveLength(0)
  })

  it('문자열(하위호환): 단일 allocation .eq — 기존 실무자/관리자 상세 호출부 불변', async () => {
    await getSettlements('a1')
    expect(allocEqCalls()).toContainEqual(['allocation_id', 'a1'])
    expect(allocInCalls()).toHaveLength(0)
  })

  it('undefined: allocation 필터 없음(일반 당사자 RLS self → 모든 자기 정산)', async () => {
    await getSettlements(undefined)
    expect(allocEqCalls()).toHaveLength(0)
    expect(allocInCalls()).toHaveLength(0)
  })
})
