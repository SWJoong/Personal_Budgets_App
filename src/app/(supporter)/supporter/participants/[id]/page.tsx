import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { settlementLabel, settlementIntent } from '@/utils/settlementStatus'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { MoneyText } from '@/components/ui/MoneyText'
import { LinkButton } from '@/components/ui/LinkButton'
import { EmptyState } from '@/components/ui/EmptyState'

export const metadata = { title: '당사자 통합 현황' }

/**
 * 당사자 통합 현황 허브 (GOAL축 B, B1) — ComingSoon 대체. 설계 §4-3
 * (Plan&Source/goala_comingsoon_stubs_triage_W.md). 한 당사자의 모든 축 진입점을 한 화면에.
 * ★허브 = 집계 요약 + 링크(각 화면은 전부 구현됨). 신규 백엔드 최소. RLS(seoul_can_access)가 담당범위로 스코프.
 * 라우트 규약: budgets/[id]=participant_id · network?participant=pid · evaluations/[pid] · [pid]/{transactions,assessment,report}.
 */

type Balance = {
  allocation_id: string
  cohort_id: string | null
  allocated_amount: number
  remaining: number
  spent: number
  copay_amount: number | null
  copay_status: string
  starts_on: string | null
  ends_on: string | null
}
type Usage = { id: string; usage_date: string; amount: number; description: string | null; settlement_status: string }

const COPAY_LABEL: Record<string, string> = {
  not_applicable: '해당 없음',
  exempt_basic_livelihood: '면제 (기초수급)',
  exempt_near_poor: '면제 (차상위)',
  charged: '부과',
  unverified: '확인 전',
}

export default async function ParticipantHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireStaff()

  // 당사자 — RLS 가 담당범위 밖이면 행이 안 보인다 → notFound.
  const { data: participant } = await supabase.from('participants').select('id, name').eq('id', id).maybeSingle()
  if (!participant) notFound()
  const pid = (participant as { id: string }).id
  const name = (participant as { name: string | null }).name ?? '이름 없음'

  // 최신 배정의 예산 잔액(v_seoul_budget_balance) — 배정이 없으면 아직 선정·배정 전.
  const { data: balRows } = await supabase
    .from('v_seoul_budget_balance')
    .select('allocation_id, cohort_id, allocated_amount, remaining, spent, copay_amount, copay_status, starts_on, ends_on')
    .eq('participant_id', pid)
    .order('starts_on', { ascending: false })
    .limit(1)
  const balance = ((balRows ?? []) as Balance[])[0] ?? null

  let cohortName: string | null = null
  if (balance?.cohort_id) {
    const { data: cohort } = await supabase.from('seoul_cohorts').select('name').eq('id', balance.cohort_id).maybeSingle()
    cohortName = (cohort as { name: string } | null)?.name ?? null
  }

  const { data: usageRows } = await supabase
    .from('seoul_service_usages')
    .select('id, usage_date, amount, description, settlement_status')
    .eq('participant_id', pid)
    .order('usage_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5)
  const usages = (usageRows ?? []) as Usage[]

  // 바로가기 — 각 축의 기구현 화면으로. 라우트 규약은 파일 상단 주석 참조.
  const cards: { href: string; icon: string; label: string; desc: string }[] = [
    { href: `/supporter/budgets/${pid}`, icon: '💰', label: '예산', desc: '이용계획·잔액' },
    { href: `/supporter/plans`, icon: '🎯', label: '이용계획·심의', desc: '계획 목록' },
    { href: `/supporter/${pid}/transactions`, icon: '🧾', label: '거래장부', desc: '지출 내역' },
    { href: `/supporter/evaluations/${pid}`, icon: '📋', label: '정산·평가', desc: '월별 평가' },
    { href: `/supporter/${pid}/assessment`, icon: '🧭', label: '욕구사정', desc: 'SIS-A' },
    { href: `/supporter/${pid}/report`, icon: '📊', label: '월간보고서', desc: '리포트' },
    { href: `/supporter/network?participant=${pid}`, icon: '🕸️', label: '관계망', desc: '지원 관계' },
    { href: `/supporter/map`, icon: '🗺️', label: '활동 지도', desc: '지출 위치' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <PageHeader title={`${name}님`} backHref="/supporter/participants" />

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-5">
        {/* ① 상태 요약 */}
        <Card>
          {balance ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {cohortName && <StatusPill label={cohortName} intent="info" />}
                <StatusPill label="예산 배정됨" intent="success" />
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">남은 예산</p>
                  <p className="text-2xl font-bold">
                    <MoneyText value={balance.remaining} emphasis="hero" />
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  승인 <MoneyText value={balance.allocated_amount} emphasis="muted" /> · 쓴 돈 <MoneyText value={balance.spent} emphasis="muted" />
                </p>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">본인부담금</span>
                <span className="text-foreground font-medium">
                  {balance.copay_amount ? <MoneyText value={balance.copay_amount} emphasis="body" /> : '0원'}
                  <span className="text-muted-foreground font-normal"> · {COPAY_LABEL[balance.copay_status] ?? balance.copay_status}</span>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">아직 예산이 배정되지 않았어요. 신청·선정 절차를 확인해 주세요.</p>
          )}
        </Card>

        {/* ② 바로가기 카드 */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground mb-2 px-1">바로가기</h2>
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="flex items-center gap-3 p-4 rounded-2xl bg-card ring-1 ring-border hover:ring-foreground hover:shadow-sm transition-all min-h-[44px]"
              >
                <span aria-hidden="true" className="text-2xl shrink-0">{c.icon}</span>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-foreground truncate">{c.label}</span>
                  <span className="text-xs text-muted-foreground truncate">{c.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ③ 최근 활동 */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground mb-2 px-1">최근 지출</h2>
          {usages.length === 0 ? (
            <EmptyState title="아직 기록된 지출이 없어요." variant="inline" />
          ) : (
            <ul className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
              {usages.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border first:border-t-0">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-foreground truncate">{u.description || '내용 없음'}</span>
                    <span className="text-xs text-muted-foreground">{u.usage_date}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill label={settlementLabel(u.settlement_status)} intent={settlementIntent(u.settlement_status)} />
                    <span className="text-sm font-bold">
                      <MoneyText value={u.amount} emphasis="body" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <LinkButton href={`/supporter/${pid}/transactions`} variant="ghost" className="mt-2 w-full">
            거래장부에서 모두 보기 →
          </LinkButton>
        </section>
      </main>
    </div>
  )
}
