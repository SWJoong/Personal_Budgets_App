import { notFound } from 'next/navigation'
import { requireAdmin } from '@/utils/supabase/staff'
import { getUIPreferences } from '@/app/actions/preferences'
import { describeCopay } from '@/utils/copay'
import { buildBudgetByDomain, type PlannedServiceRow } from '@/utils/budgetByDomain'
import type { DomainSpine, DomainFlowRow } from '@/utils/domainAxisReport'
import ParticipantHomePreviewClient from '@/components/admin/ParticipantHomePreviewClient'

export const metadata = { title: '당사자 화면 미리보기' }

/**
 * 관리자 대리 렌더 — 당사자 홈(participant)/page.tsx 을 대상 participantId 로 그린다.
 * 설계: Plan&Source/goala_comingsoon_stubs_triage_W.md §4-8(B4).
 *
 * §4-8-1 은 공유 서버 컴포넌트(ParticipantHomeView) 추출을 권장하지만, (participant)/page.tsx 는
 * 별도 PR(#89)이 진행 중이라 이번 스코프는 데이터 조회·렌더를 이 라우트에 중복 유지한다(후속 과제로
 * #89 위에 스택). 렌더 자체(ParticipantHomePreviewClient)의 뮤테이션 안전 계약은 그대로 적용된다.
 *
 * 게이트: requireAdmin() = seoul_is_admin 전용. RLS 는 admin 이 전 당사자 행을 통과시키므로(§4-8-4),
 * 이 라우트는 권한 확장이 아니라 "표시 대상 전환"이다.
 */
export default async function ParticipantPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()

  if (!participant) notFound()

  const { data: allParticipantsRaw } = await supabase
    .from('participants')
    .select('id, name')
    .order('name', { ascending: true })

  const allParticipants = (allParticipantsRaw ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? '이름 미등록',
  }))

  const prefs = await getUIPreferences(participant.id)

  // 잔액 — (participant)/page.tsx 와 동일하게 v_seoul_budget_balance 에서 항상 계산(저장값 아님).
  const { data: balance } = await supabase
    .from('v_seoul_budget_balance')
    .select('*')
    .eq('participant_id', participant.id)
    .order('ends_on', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: recentUsagesRaw } = balance
    ? await supabase
        .from('seoul_service_usages')
        .select('id, usage_date, amount, description')
        .eq('allocation_id', balance.allocation_id)
        .order('usage_date', { ascending: false })
        .limit(5)
    : { data: [] as { id: string; usage_date: string; amount: number; description: string | null }[] }

  let budgetRows: ReturnType<typeof buildBudgetByDomain> = []
  if (balance) {
    const [{ data: alloc }, { data: domains }, { data: flow }] = await Promise.all([
      supabase.from('seoul_budget_allocations').select('plan_id').eq('id', balance.allocation_id).maybeSingle(),
      supabase.from('seoul_service_domains').select('id, label, sort_order').eq('program', 'seoul'),
      supabase.from('v_seoul_domain_flow').select('*').eq('participant_id', participant.id),
    ])
    let planned: PlannedServiceRow[] = []
    if (alloc?.plan_id) {
      const { data: requested } = await supabase
        .from('seoul_requested_services')
        .select('domain_id, estimated_cost')
        .eq('plan_id', alloc.plan_id)
      planned = (requested ?? []).map((r) => ({ domain_id: r.domain_id, estimated_cost: r.estimated_cost }))
    }
    budgetRows = buildBudgetByDomain(
      (domains ?? []) as DomainSpine[],
      planned,
      (flow ?? []) as DomainFlowRow[]
    )
  }
  const showDomains = budgetRows.some((r) => r.status !== 'none')
  const copay = balance ? describeCopay(balance.copay_status, Number(balance.copay_amount)) : null

  return (
    <ParticipantHomePreviewClient
      currentParticipant={{ id: participant.id, name: participant.name ?? '이름 미등록' }}
      allParticipants={allParticipants}
      prefs={prefs}
      balance={
        balance
          ? {
              remaining: Number(balance.remaining),
              allocatedAmount: Number(balance.allocated_amount),
              spent: Number(balance.spent),
            }
          : null
      }
      copay={copay}
      budgetRows={budgetRows}
      showDomains={showDomains}
      recentUsages={(recentUsagesRaw ?? []).map((u) => ({
        id: u.id,
        usageDate: u.usage_date,
        amount: Number(u.amount),
        description: u.description,
      }))}
    />
  )
}
