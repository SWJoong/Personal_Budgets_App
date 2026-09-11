import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import type { UsageForBucket } from '@/utils/usageBuckets'
import type { DomainFlowRow } from '@/utils/domainAxisReport'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import BudgetExecutionClient, { type ExecutionBalance } from './BudgetExecutionClient'

/**
 * 예산 실행 통합 뷰 (관리자 QA #4) — 편성→심의→계획 대비 실제→사용내역(자부담)을 한 화면에.
 * 설계·계약: Plan&Source/goala_budget_execution_view_W.md. 조각 데이터(기존 뷰·표)를 그대로 재사용해
 * 신규 백엔드 없이 묶는다. 상호작용(시간버킷 토글)은 자식 클라이언트가 담당하고 이 서버는 병렬 로드만.
 * 라우트 [participantId] = participant_id (report/·transactions/ 형제와 동일 규약).
 */

export const metadata = { title: '예산 실행' }

export default async function BudgetExecutionPage({
  params,
}: {
  params: Promise<{ participantId: string }>
}) {
  const { participantId: pid } = await params
  const { supabase } = await requireStaff()

  // 이름·잔액(편성/심의)·영역흐름(계획 대비 실제)·사용내역(시간버킷 원천)·도메인 라벨 스파인을 병렬로.
  const [
    { data: participant },
    { data: balanceRow },
    { data: flow },
    { data: usageRows },
    { data: domains },
  ] = await Promise.all([
    supabase.from('participants').select('id, name').eq('id', pid).maybeSingle(),
    supabase
      .from('v_seoul_budget_balance')
      .select(
        'allocated_amount, spent, remaining, total_ceiling, monthly_ceiling, copay_amount, copay_status, unplanned_count',
      )
      .eq('participant_id', pid)
      .order('starts_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('v_seoul_domain_flow').select('*').eq('participant_id', pid),
    supabase
      .from('seoul_service_usages')
      .select('id, usage_date, amount, description, settlement_status, domain_id')
      .eq('participant_id', pid)
      .order('usage_date', { ascending: false }),
    supabase.from('seoul_service_domains').select('id, label').eq('program', 'seoul'),
  ])

  if (!participant) notFound()
  const name = (participant as { name: string | null }).name ?? '이름 없음'

  const backHref = `/supporter/participants/${pid}`
  const balance = (balanceRow ?? null) as ExecutionBalance | null

  // §5 빈 상태 — 배정(승인)이 아직 없으면 편성·실제·자부담 모두 그릴 근거가 없다.
  if (!balance) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <PageHeader title={`${name}님의 예산 실행`} backHref={backHref} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full max-w-lg mx-auto p-6 flex flex-col justify-center"
        >
          <EmptyState
            emoji="💰"
            title="아직 예산이 정해지지 않았어요."
            description="계획이 승인되면 편성·사용 내역을 여기서 한눈에 볼 수 있어요."
            action={{ label: '계획 보러 가기', href: '/supporter/plans' }}
            variant="full"
          />
        </main>
      </div>
    )
  }

  // 지출 행에 영역 라벨을 붙인다(domain_id → label). 라벨 조인이 아니라 UUID 키로 안전하게(스펙 §8-4).
  const domainLabelById = new Map((domains ?? []).map((d) => [d.id as string, d.label as string]))
  const usages: UsageForBucket[] = (usageRows ?? []).map((u) => ({
    id: u.id,
    usage_date: u.usage_date,
    amount: Number(u.amount ?? 0),
    description: u.description,
    settlement_status: u.settlement_status,
    domainLabel: u.domain_id ? domainLabelById.get(u.domain_id) ?? null : null,
  }))

  const domainFlow = (flow ?? []) as DomainFlowRow[]

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <PageHeader title={`${name}님의 예산 실행`} backHref={backHref} />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-4"
      >
        <BudgetExecutionClient
          participantName={name}
          balance={balance}
          domainFlow={domainFlow}
          usages={usages}
        />
      </main>
    </div>
  )
}
