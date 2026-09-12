import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import { EmptyState } from '@/components/ui/EmptyState'
import PlanAffordability from '@/components/home/PlanAffordability'

export const metadata = { title: '해보고 싶은 것' }

/**
 * B5 — 해보고 싶은 것 (participant/plan). ComingSoon 스텁 대체.
 * 이용계획의 요청 서비스(seoul_requested_services)를 "해보고 싶은 것" 옵션으로 보여주고, 각각을 고르면
 * 잔액(v_seoul_budget_balance)에서 얼마가 남는지 물컵으로 미리 본다(고아 컴포넌트 복원 §2, 인지 접근성).
 * "나의 이야기" goal_to_try 가 있으면 위에 함께 보여준다(편집 정본은 /my-plan). 조회는 my-plan 과 동일 경로(본인 RLS).
 * 요청 서비스·예산이 아직 없으면 부드러운 빈 상태로 안내(크래시 없음).
 */
export default async function PlanPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const participant = await getCurrentParticipant()

  let goalToTry: string | null = null
  let options: { name: string; cost: number }[] = []
  let currentBalance = 0
  let totalBudget = 0
  let hasBalance = false

  if (participant) {
    // 최신 이용계획 + 잔액을 병렬로(잔액은 계획과 무관하게 배정 기준으로 조회).
    const [{ data: plan }, { data: balance }] = await Promise.all([
      supabase
        .from('seoul_utilization_plans')
        .select('id')
        .eq('participant_id', participant.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('v_seoul_budget_balance')
        .select('allocated_amount, remaining')
        .eq('participant_id', participant.id)
        .order('ends_on', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (balance) {
      hasBalance = true
      currentBalance = Number(balance.remaining ?? 0)
      totalBudget = Number(balance.allocated_amount ?? 0)
    }

    if (plan) {
      // 계획의 "나의 이야기"(goal_to_try) + 요청 서비스(우선순위 순)를 함께.
      const [{ data: narrative }, { data: services }] = await Promise.all([
        supabase.from('seoul_self_narratives').select('goal_to_try').eq('plan_id', plan.id).maybeSingle(),
        supabase
          .from('seoul_requested_services')
          .select('service_name, estimated_cost')
          .eq('plan_id', plan.id)
          .order('priority'),
      ])
      const raw = narrative?.goal_to_try
      goalToTry = raw && raw.trim() ? raw.trim() : null
      options = (services ?? []).map((s) => ({
        name: s.service_name,
        cost: Number(s.estimated_cost ?? 0),
      }))
    }
  }

  // 요청 서비스와 예산이 모두 있어야 미리보기가 의미가 있다.
  const showPreview = hasBalance && options.length > 0

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center gap-2 px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href="/"
          aria-label="홈으로 가기"
          className="flex items-center justify-center min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="text-xl" aria-hidden="true">←</span>
        </Link>
        <h1 className="text-base font-black text-foreground">무엇을 해볼까요?</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        {showPreview ? (
          <div className="flex flex-col gap-4">
            {goalToTry && (
              <div className="p-5 rounded-3xl bg-card ring-1 ring-border shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">이용계획에 적은 일이에요.</p>
                <p className="text-lg font-bold text-foreground leading-relaxed whitespace-pre-wrap">{goalToTry}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              하고 싶은 것을 골라 보세요. 돈이 얼마나 남는지 보여줄게요.
            </p>
            <PlanAffordability currentBalance={currentBalance} totalBudget={totalBudget} options={options} />
          </div>
        ) : goalToTry ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground leading-relaxed">이용계획에 적은 일이에요.</p>
            <div className="p-6 rounded-3xl bg-card ring-1 ring-border shadow-sm">
              <p className="text-xl font-bold text-foreground leading-relaxed whitespace-pre-wrap">{goalToTry}</p>
            </div>
          </div>
        ) : (
          <EmptyState emoji="📝" title="아직 아무것도 안 적었어요." action={{ label: '이용계획에서 적어요', href: '/my-plan' }} />
        )}
      </main>
    </div>
  )
}
