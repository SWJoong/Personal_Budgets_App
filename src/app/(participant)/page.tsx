import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import { describeCopay } from '@/utils/copay'
import {
  buildBudgetByDomain,
  type BudgetStatus,
  type PlannedServiceRow,
} from '@/utils/budgetByDomain'
import type { DomainSpine, DomainFlowRow } from '@/utils/domainAxisReport'
import { getUIPreferences } from '@/app/actions/preferences'
import { BLOCK_METADATA, type BlockId } from '@/utils/uiPreferences'
import { EmptyState } from '@/components/ui/EmptyState'
import { NoBudgetGate } from '@/components/ui/NoBudgetGate'

export const metadata = { title: '홈' }

/** 선택 블록 중 바로가기(shortcut) 카드의 라우트. domain_breakdown·recent_usages 는 홈 내 섹션이라 제외. */
const SHORTCUT_HREF: Partial<Record<BlockId, string>> = {
  calendar_shortcut: '/calendar',
  plan_shortcut: '/plan',
  map_shortcut: '/map',
  gallery: '/gallery',
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

/**
 * 당사자용 영역 상태 라벨 — 담당자용(budgetStatusLabel, 골든 고정)과 목적이 달라 별도로 둔다.
 * over/unplanned 를 붉은 경고 대신 부드럽게(설계 §5·§6, validate_easy_read pass).
 */
const PARTICIPANT_STATUS: Record<BudgetStatus, { label: string; cls: string }> = {
  ok: { label: '쓰는 중이에요', cls: 'bg-success-bg text-success-fg ring-success-fg/20' },
  unused: { label: '아직 안 썼어요', cls: 'bg-info-bg text-info-fg ring-info-fg/20' },
  over: { label: '조금 넘게 썼어요', cls: 'bg-warning-bg text-warning-fg ring-warning-fg/20' },
  unplanned: { label: '계획에 없이 썼어요', cls: 'bg-warning-bg text-warning-fg ring-warning-fg/20' },
  none: { label: '아직 없어요', cls: 'bg-neutral-bg text-neutral-fg ring-neutral-fg/20' },
}

/** 서울형 6영역 아이콘(seed label 기준, program='seoul'). */
const DOMAIN_ICON: Record<string, string> = {
  일상생활: '🧺',
  사회생활: '🤝',
  '취·창업활동': '💼',
  자기개발: '📚',
  '건강·안전': '🩺',
  주거환경개선: '🏠',
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 역할 조회 — profiles.id = auth.users.id 는 올바른 설계이므로 그대로 둔다.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin')
  if (profile?.role === 'supporter') redirect('/supporter')

  // 참여자 조회 — auth_user_id 경유. participants.id 와 로그인 id 는 다른 값이다.
  const participant = await getCurrentParticipant()

  if (!participant) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
          <h1 className="text-xl font-bold tracking-tight">서울형 개인예산</h1>
        </header>
        <NoBudgetGate title="아직 예산 정보가 없어요." emoji="👋" variant="page" />
      </div>
    )
  }

  // 화면 개인화 — 켜진 선택 블록만 렌더(설계 goala_ui_preferences_W.md). 필수 블록(잔액·부담금·FAB)은 항상.
  const prefs = await getUIPreferences(participant.id)
  const enabled = new Set(prefs.enabled_blocks)

  // 가장 최근(종료일 기준) 예산 배정과 잔액을 함께 조회한다.
  // 잔액은 저장하지 않고 v_seoul_budget_balance 뷰에서 항상 계산한다.
  const { data: balance } = await supabase
    .from('v_seoul_budget_balance')
    .select('*')
    .eq('participant_id', participant.id)
    .order('ends_on', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: recentUsages } = balance
    ? await supabase
        .from('seoul_service_usages')
        .select('id, usage_date, amount, description')
        .eq('allocation_id', balance.allocation_id)
        .order('usage_date', { ascending: false })
        .limit(5)
    : { data: [] as { id: string; usage_date: string; amount: number; description: string | null }[] }

  // 어디에 썼는지(§6) — 히어로와 같은 배정 기준. 계획합계는 requested_services 그레인(§8-5),
  // 집행은 v_seoul_domain_flow, 둘 다 domain_id 로 스파인에 귀속(라벨 조인 금지 §8-4).
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
  // 계획·집행이 하나도 없으면(전부 none) 6개 빈 카드는 소음이라 섹션을 감춘다.
  const showDomains = budgetRows.some((r) => r.status !== 'none')

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-28">
      <header className="flex h-16 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">{participant.name ?? profile?.name ?? '나'}님의 예산</h1>
        {/* 더보기(설정 등)를 상단 헤더로 이관 — 하단은 단일 FAB 만(§6). */}
        <Link
          href="/more"
          aria-label="더보기"
          className="w-11 h-11 -mr-2 flex items-center justify-center text-2xl text-muted-foreground hover:text-foreground transition-colors"
        >
          ⚙
        </Link>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col gap-6 max-w-sm mx-auto w-full">
        {!balance ? (
          <EmptyState title="아직 정해진 예산이 없어요." description="선생님들이 확인하면 여기에 나와요." />
        ) : (
          <>
            <section className="p-8 rounded-3xl bg-hero text-hero-foreground flex flex-col gap-2">
              <span className="text-sm font-bold text-hero-foreground/70">지금 쓸 수 있는 돈</span>
              <span className="text-4xl font-black tracking-tight">{won(Number(balance.remaining))}</span>
              <span className="text-xs font-medium text-hero-foreground/70 leading-relaxed">
                {/* 기준은 차수 상한이 아니라 이 사람에게 승인된 금액이다 — remaining 과 같은 축이어야
                    "전체 240만인데 왜 150만만 남았지?" 같은 혼란이 생기지 않는다. */}
                전체 {won(Number(balance.allocated_amount))} 중 {won(Number(balance.spent))} 사용했어요
              </span>
            </section>

            {(() => {
              const copay = describeCopay(balance.copay_status, Number(balance.copay_amount))
              if (!copay.show) return null
              return (
                <section
                  className={`p-6 rounded-3xl flex flex-col gap-1.5 ring-1 ${
                    copay.pending ? 'bg-warning-bg ring-warning-fg/20' : 'bg-card ring-border'
                  }`}
                >
                  <span className="text-sm font-bold text-muted-foreground">{copay.title}</span>
                  {copay.amount > 0 && (
                    <span className="text-2xl font-black tracking-tight">{won(copay.amount)}</span>
                  )}
                  <span className="text-xs font-medium text-muted-foreground leading-relaxed">{copay.note}</span>
                </section>
              )
            })()}

            {showDomains && enabled.has('domain_breakdown') && (
              <section className="flex flex-col gap-3">
                <div>
                  <h2 className="text-sm font-bold text-muted-foreground">어디에 썼는지</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">무엇에 얼마나 썼는지 봐요.</p>
                </div>
                <ul className="flex flex-col gap-3">
                  {budgetRows.map((r) => {
                    const st = PARTICIPANT_STATUS[r.status]
                    const icon = DOMAIN_ICON[r.label] ?? '📁'
                    const dim = r.status === 'none'
                    const canSpendMore = r.status === 'ok' || r.status === 'unused'
                    return (
                      <li
                        key={r.domainId}
                        className={`p-5 rounded-3xl ring-1 flex flex-col gap-2 ${dim ? 'bg-muted ring-border' : 'bg-card ring-border'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-bold flex items-center gap-2 ${dim ? 'text-muted-foreground' : 'text-foreground'}`}>
                            <span aria-hidden="true" className="text-lg">
                              {icon}
                            </span>
                            {r.label}
                          </span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${st.cls}`}>{st.label}</span>
                        </div>
                        {canSpendMore ? (
                          <div>
                            <span className="text-2xl font-black tracking-tight">{won(Math.max(0, r.remaining))}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">이만큼 더 쓸 수 있어요.</p>
                          </div>
                        ) : dim ? null : (
                          <p className="text-sm text-muted-foreground">{won(r.usageSum)} 썼어요.</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </>
        )}

        {/* 바로 가기 — 켜진 shortcut 블록만(달력·계획·지도·사진). */}
        {(() => {
          const shortcuts = (Object.keys(SHORTCUT_HREF) as BlockId[]).filter((b) => enabled.has(b))
          if (shortcuts.length === 0) return null
          return (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-muted-foreground">바로 가기</h2>
              <div className="grid grid-cols-2 gap-2">
                {shortcuts.map((b) => (
                  <Link
                    key={b}
                    href={SHORTCUT_HREF[b]!}
                    className="p-4 rounded-2xl bg-card ring-1 ring-border flex items-center gap-3 hover:bg-muted-hover transition-colors min-h-[44px]"
                  >
                    <span aria-hidden="true" className="text-2xl">
                      {BLOCK_METADATA[b].icon}
                    </span>
                    <span className="font-bold text-foreground">{BLOCK_METADATA[b].label}</span>
                  </Link>
                ))}
              </div>
            </section>
          )
        })()}

        {enabled.has('recent_usages') && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-muted-foreground">최근에 쓴 돈</h2>
            {recentUsages && recentUsages.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {recentUsages.map((u) => (
                  <li key={u.id} className="p-4 rounded-2xl bg-card ring-1 ring-border flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-bold leading-relaxed">{u.description ?? '활동'}</span>
                      <span className="text-xs text-muted-foreground">{u.usage_date}</span>
                    </div>
                    <span className="font-bold">{won(Number(u.amount))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="아직 쓴 돈이 없어요." action={{ label: '처음으로 돈을 써 보세요', href: '/receipt' }} />
            )}
          </section>
        )}
      </main>
    </div>
  )
}
