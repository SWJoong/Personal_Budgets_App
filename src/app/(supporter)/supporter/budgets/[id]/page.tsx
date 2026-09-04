import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import {
  buildBudgetByDomain,
  budgetStatusLabel,
  type BudgetStatus,
  type PlannedServiceRow,
} from '@/utils/budgetByDomain'
import type { DomainFlowRow } from '@/utils/domainAxisReport'
import { copayIntent } from '@/utils/copay'
import { PageHeader } from '@/components/ui/PageHeader'
import { LinkButton } from '@/components/ui/LinkButton'
import { MoneyText } from '@/components/ui/MoneyText'
import { StatusPill, type Intent } from '@/components/ui/StatusPill'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * 예산(이용계획) 화면 — GOAL축 A "돈" 뷰. 설계: Plan&Source/goala_budget_screen_ux_W.md.
 * 사정(축B report) → 계획(이 화면) → 지출(#39) 을 같은 domain_id 축으로 잇는다.
 *
 * 읽기 우선 대시보드 + 길목(계획·지출·정산으로 분기). 라우트 [id] = participant_id
 * (W 설계 §1 이 허용한 선택 — 최신 배정 1행을 해석하고, 배정이 없으면 §5 빈 상태를 낸다).
 * 상호작용이 없어(링크·표시뿐) 서버 컴포넌트로 둔다(sibling report/page.tsx 와 동일).
 */

// BudgetStatus(5종) → StatusPill intent + 이모지. 원본 색 의미 보존:
// ok=emerald→success · unused=sky→info · over=rose→danger · unplanned=amber→warning · none=zinc→neutral.
const STATUS_STYLE: Record<BudgetStatus, { intent: Intent; emoji: string }> = {
  ok: { intent: 'success', emoji: '✅' },
  unused: { intent: 'info', emoji: '💤' },
  over: { intent: 'danger', emoji: '⚠️' },
  unplanned: { intent: 'warning', emoji: '📌' },
  none: { intent: 'neutral', emoji: '·' },
}

export const metadata = { title: '예산' }

function fmtDate(d: string | null | undefined): string {
  if (!d) return '-'
  return d.slice(0, 10).replace(/-/g, '.')
}

/** copay_status → 쉬운 말 배지(§5). not_applicable 은 배지를 숨긴다. */
function copayBadge(status: string): { label: string; warn: boolean } | null {
  switch (status) {
    case 'unverified':
      return { label: '확인 전', warn: true }
    case 'charged':
      return { label: '부과', warn: false }
    case 'exempt_basic_livelihood':
    case 'exempt_near_poor':
      return { label: '면제', warn: false }
    default:
      return null // not_applicable
  }
}

export default async function BudgetDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  // 최신 배정 1행(플랜당 UNIQUE 이지만 참여자는 차수마다 여러 배정 가능 → created_at 최신).
  const { data: allocation } = await supabase
    .from('seoul_budget_allocations')
    .select('*')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const backHref = '/supporter/participants'

  // §5 빈 상태 — 배정이 아직 없을 때(계획 미승인).
  if (!allocation) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <PageHeader title={`${participant.name}님의 예산`} backHref={backHref} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full max-w-lg mx-auto p-6 flex flex-col justify-center"
        >
          <EmptyState
            emoji="💰"
            title="아직 예산이 정해지지 않았어요."
            description="계획이 정해지면 여기에 보여요."
            action={{ label: '계획 보러 가기', href: '/supporter/plans' }}
            variant="full"
          />
        </main>
      </div>
    )
  }

  const planId = allocation.plan_id as string

  // 계획(영역별 = requested_services 그레인, §8-5) · 집행(v_seoul_domain_flow) · 도메인 스파인 병렬 로드.
  const [{ data: requested }, { data: flow }, { data: domains }] = await Promise.all([
    supabase
      .from('seoul_requested_services')
      .select('id, priority, service_name, domain_id, estimated_cost, approved_for_service, review_note')
      .eq('plan_id', planId)
      .order('priority', { ascending: true }),
    supabase.from('v_seoul_domain_flow').select('*').eq('participant_id', participantId),
    supabase.from('seoul_service_domains').select('id, label, sort_order').eq('program', 'seoul'),
  ])

  const planned: PlannedServiceRow[] = (requested ?? []).map((r) => ({
    domain_id: r.domain_id,
    estimated_cost: r.estimated_cost,
  }))
  const flowRows = (flow ?? []) as DomainFlowRow[]
  const rows = buildBudgetByDomain(domains ?? [], planned, flowRows)

  // 봉투 레벨: 쓴 돈 = Σ 모든 지출(미분류 포함) → flow 전체 합. 남은 돈 = 배정액 − 쓴 돈.
  const allocated = Number(allocation.allocated_amount ?? 0)
  const usedTotal = flowRows.reduce((s, r) => s + Number(r.금액 ?? 0), 0)
  const remainingTotal = allocated - usedTotal
  const overspent = usedTotal > allocated
  const pct = allocated > 0 ? Math.min(100, Math.round((usedTotal / allocated) * 100)) : 0
  const barColor = overspent ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-positive'

  const copay = Number(allocation.copay_amount ?? 0)
  const copayStatus = String(allocation.copay_status ?? 'not_applicable')
  const copayInfo = copayBadge(copayStatus)

  // 계획외 지출(§3 ③) — 영역 집계에서 합산.
  const unplannedSum = rows.reduce((s, r) => s + r.unplannedSum, 0)
  const unplannedCount = flowRows.reduce((s, r) => s + Number(r.계획외_건수 ?? 0), 0)

  const domainLabelById = new Map((domains ?? []).map((d) => [d.id, d.label]))

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <PageHeader title={`${participant.name}님의 예산`} backHref={backHref} />

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* ① 예산 봉투 카드 */}
        <Card variant="default" className="flex flex-col gap-4">
          <div>
            <div className="text-sm text-muted-foreground">남은 돈</div>
            <div className="text-4xl font-black tracking-tight">
              <MoneyText value={remainingTotal} emphasis="hero" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">
                쓴 돈{' '}
                <b>
                  <MoneyText value={usedTotal} emphasis="body" />
                </b>
              </span>
              <span className="text-muted-foreground">
                배정된 돈 <MoneyText value={allocated} emphasis="muted" />
              </span>
            </div>
            <div
              className="h-3 w-full rounded-full bg-muted overflow-hidden"
              role="img"
              aria-label={`배정된 돈의 ${pct}%를 썼어요`}
            >
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            {overspent && <p className="text-xs font-bold text-danger">배정된 돈보다 많이 썼어요.</p>}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">쓸 수 있는 기간</dt>
              <dd className="text-foreground font-medium">
                {fmtDate(allocation.starts_on)} ~ {fmtDate(allocation.ends_on)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">한 달 한도</dt>
              <dd className="text-foreground font-medium">
                <MoneyText value={Number(allocation.monthly_ceiling ?? 0)} emphasis="body" />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">내가 낼 돈</dt>
              <dd className="text-foreground font-medium flex items-center gap-2">
                {copayInfo ? <MoneyText value={copay} emphasis="body" /> : '없음'}
                {copayInfo && <StatusPill label={copayInfo.label} intent={copayIntent(copayStatus)} />}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">남은 돈 이월</dt>
              <dd className="text-foreground font-medium">{allocation.carry_over_allowed ? '가능' : '불가'}</dd>
            </div>
          </dl>
          {copayInfo?.warn && (
            <p className="text-xs text-warning-fg bg-warning-bg rounded-xl px-3 py-2 leading-relaxed">
              내가 낼 돈은 아직 정해지지 않았어요.
            </p>
          )}
        </Card>

        {/* ② 영역별로 보기 */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-muted-foreground px-1">영역별로 보기</h2>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const s = STATUS_STYLE[r.status]
              const dim = r.status === 'none'
              return (
                <li
                  key={r.domainId}
                  className={`p-4 rounded-2xl ring-1 flex flex-col gap-2 ${dim ? 'bg-muted ring-border' : 'bg-card ring-border'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-bold ${dim ? 'text-muted-foreground' : 'text-foreground'}`}>{r.label}</span>
                    <StatusPill
                      label={budgetStatusLabel(r.status)}
                      intent={s.intent}
                      icon={<span aria-hidden="true">{s.emoji}</span>}
                    />
                  </div>
                  {!dim && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        <span className="text-muted-foreground">계획한 돈 </span>
                        <MoneyText value={r.plannedSum} emphasis="body" />
                      </span>
                      <span>
                        <span className="text-muted-foreground">쓴 돈 </span>
                        <MoneyText value={r.usageSum} emphasis="body" />
                      </span>
                      <span>
                        <span className="text-muted-foreground">남은 돈 </span>
                        <MoneyText value={r.remaining} emphasis="body" />
                      </span>
                      {r.unplannedSum > 0 && (
                        <span>
                          <span className="text-warning-fg">계획 밖 </span>
                          <MoneyText value={r.unplannedSum} emphasis="body" />
                        </span>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {/* ③ 계획에 없던 지출 콜아웃 */}
        {unplannedSum > 0 && (
          <Card variant="warning" className="flex flex-col gap-1">
            <p className="text-sm font-bold">
              계획에 없던 지출 {unplannedCount}건 · <MoneyText value={unplannedSum} emphasis="body" />
            </p>
            <p className="text-xs leading-relaxed">검토가 필요해요. 계획에 없이 쓴 돈이에요(거절은 아니에요).</p>
          </Card>
        )}

        {/* ④ 받기로 한 서비스 (읽기전용) */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-muted-foreground">받기로 한 서비스</h2>
            <LinkButton href={`/supporter/plans/${planId}`} variant="ghost" size="sm">
              계획 고치기 →
            </LinkButton>
          </div>
          {(requested ?? []).length === 0 ? (
            <EmptyState title="아직 받기로 한 서비스가 없어요." variant="inline" />
          ) : (
            <ul className="flex flex-col gap-2">
              {(requested ?? []).map((r) => (
                <li key={r.id} className="p-4 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-black flex items-center justify-center">
                        {r.priority}
                      </span>
                      <span className="font-bold text-foreground truncate">{r.service_name}</span>
                    </div>
                    {r.approved_for_service === true ? (
                      <span className="shrink-0">
                        <StatusPill label="승인" intent="success" />
                      </span>
                    ) : r.approved_for_service === false ? (
                      <span className="shrink-0">
                        <StatusPill label="보류" intent="neutral" />
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground pl-8">
                    {r.domain_id && domainLabelById.get(r.domain_id) && (
                      <span>{domainLabelById.get(r.domain_id)}</span>
                    )}
                    {r.estimated_cost != null && (
                      <span>
                        계획 <MoneyText value={Number(r.estimated_cost)} emphasis="muted" />
                      </span>
                    )}
                  </div>
                  {r.review_note && (
                    <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 leading-relaxed ml-8">
                      심의 메모: {r.review_note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 길목 버튼 */}
        <div className="flex gap-2 pt-2">
          <LinkButton
            href={`/supporter/${participantId}/transactions`}
            variant="primary"
            className="flex-1"
          >
            💳 지출 적기
          </LinkButton>
          <LinkButton
            href={`/supporter/evaluations/${participantId}`}
            variant="secondary"
            className="flex-1"
          >
            📋 정산 보기
          </LinkButton>
        </div>
      </main>
    </div>
  )
}
