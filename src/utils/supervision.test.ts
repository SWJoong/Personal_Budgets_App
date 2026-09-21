import { describe, it, expect } from 'vitest'
import { buildSupervision, type StaffMember } from './supervision'

const staff: StaffMember[] = [
  { id: 's1', name: '김실무', email: 'a@x.kr', role: 'supporter' },
  { id: 's2', name: null, email: 'b@x.kr', role: 'supporter' },
  { id: 's3', name: '관리자', email: null, role: 'admin' },
]

describe('buildSupervision', () => {
  it('담당 당사자 수·활동 건수·마지막 활동시각을 실무자별로 집계한다', () => {
    const rows = buildSupervision(
      staff,
      [
        { assigned_supporter_id: 's1' },
        { assigned_supporter_id: 's1' },
        { assigned_supporter_id: 's2' },
        { assigned_supporter_id: null },
      ],
      [
        { actor_user_id: 's1', created_at: '2026-01-01T00:00:00Z' },
        { actor_user_id: 's1', created_at: '2026-03-01T00:00:00Z' },
        { actor_user_id: 's2', created_at: '2026-02-01T00:00:00Z' },
        { actor_user_id: null, created_at: '2026-02-01T00:00:00Z' },
      ],
    )
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId.s1.assignedCount).toBe(2)
    expect(byId.s1.actions).toBe(2)
    expect(byId.s1.lastActiveAt).toBe('2026-03-01T00:00:00Z') // 최신
    expect(byId.s2.assignedCount).toBe(1)
    expect(byId.s3.assignedCount).toBe(0)
    expect(byId.s3.actions).toBe(0)
    expect(byId.s3.lastActiveAt).toBeNull()
  })

  it('이름 없으면 이메일→미상 폴백', () => {
    const rows = buildSupervision(staff, [], [])
    const s2 = rows.find((r) => r.id === 's2')!
    expect(s2.name).toBe('b@x.kr')
  })

  it('담당 많은 순 → 활동 많은 순 → 이름순으로 정렬', () => {
    const rows = buildSupervision(
      staff,
      [{ assigned_supporter_id: 's1' }, { assigned_supporter_id: 's2' }, { assigned_supporter_id: 's2' }],
      [],
    )
    // s2(담당2) > s1(담당1) > s3(담당0)
    expect(rows.map((r) => r.id)).toEqual(['s2', 's1', 's3'])
  })
})
