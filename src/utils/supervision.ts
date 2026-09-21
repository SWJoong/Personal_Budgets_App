/**
 * 슈퍼비전(실무자 활동 가시성) 집계 — 순수 함수. 계약: src/utils/supervision.test.ts.
 * 설계: docs/release/14 P2(#13 축C 슈퍼비전). 관리자가 담당자별 업무량·최근활동을 한눈에.
 *
 * 소스(관리자 RLS 로 조회): profiles(실무자·관리자) · participants.assigned_supporter_id(담당 배정) ·
 * seoul_audit_log(actor_user_id·created_at, 최근 기간). 이 모듈은 셈만 한다(무 DB·무부수효과).
 */

export interface StaffMember {
  id: string
  name?: string | null
  email?: string | null
  role: string
}

export interface SupervisionRow {
  id: string
  name: string
  role: string
  assignedCount: number // 담당 당사자 수
  actions: number // 최근 기간 감사로그 행위 건수
  lastActiveAt: string | null // 최근 행위 시각(ISO)
}

export function buildSupervision(
  staff: StaffMember[],
  participants: { assigned_supporter_id?: string | null }[],
  audit: { actor_user_id?: string | null; created_at?: string | null }[],
): SupervisionRow[] {
  const assignedBy = new Map<string, number>()
  for (const p of participants) {
    const s = p.assigned_supporter_id
    if (s) assignedBy.set(s, (assignedBy.get(s) ?? 0) + 1)
  }

  const actionsBy = new Map<string, number>()
  const lastBy = new Map<string, string>()
  for (const a of audit) {
    const actor = a.actor_user_id
    if (!actor) continue
    actionsBy.set(actor, (actionsBy.get(actor) ?? 0) + 1)
    const at = a.created_at ?? null
    if (at && at > (lastBy.get(actor) ?? '')) lastBy.set(actor, at)
  }

  const rows = staff.map((s): SupervisionRow => ({
    id: s.id,
    name: (s.name || s.email || '이름 미상') as string,
    role: s.role,
    assignedCount: assignedBy.get(s.id) ?? 0,
    actions: actionsBy.get(s.id) ?? 0,
    lastActiveAt: lastBy.get(s.id) ?? null,
  }))

  // 담당 많은 순 → 활동 많은 순 → 이름순(재현성).
  return rows.sort(
    (a, b) =>
      b.assignedCount - a.assignedCount ||
      b.actions - a.actions ||
      a.name.localeCompare(b.name, 'ko'),
  )
}
