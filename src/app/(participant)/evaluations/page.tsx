import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getMonitoringRecords } from '@/app/actions/monitoring'
import { getSettlements } from '@/app/actions/settlement'
import { resolveViewAs } from '@/utils/supabase/viewAs'
import { MoneyText } from '@/components/ui/MoneyText'

export const metadata = { title: '선생님이 남긴 기록' }

// 당사자 미러 — "선생님의 편지" 프레이밍 계승(설계 §3b). 모니터링은 읽기만(RLS 로 본인 것만).
// 행정 언어("정산·모니터링") 대신 쉬운 말(§4). 미사용액은 실패로 읽히지 않게 긍정 고정 문구.
const METHOD_EASY: Record<string, string> = {
  visit: '만났어요',
  phone: '전화했어요',
  app: '앱으로 봤어요',
  document: '서류로 봤어요',
}

export default async function ParticipantEvaluationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 관리자 둘러보기(view-as)면 대상 당사자 id 로 조회한다(인자 없는 RLS 조회는 로그인 사용자=
  // 관리자 기준이라 view-as 에서 빈 화면이 된다). 일반 당사자는 view-as 아님 → 인자 없이 RLS self.
  // resolveViewAs 는 쿠키 없으면 .from 호출 전에 조기반환하므로 서버컴포넌트 단위테스트 안전.
  const viewAs = await resolveViewAs()
  // view-as 면 대상 당사자의 정산도 '그 사람 것만' 보이도록 대상의 allocation 으로 스코프해 넘긴다.
  // (인자 없이 부르면 관리자 세션의 RLS 상 전체 당사자 정산이 섞여 나온다.) 일반 당사자는
  // view-as 아님 → 이 supabase.from 블록을 건너뛰므로 서버컴포넌트 단위테스트에서도 안전하다.
  let allocationIds: string[] | undefined
  if (viewAs.active && viewAs.participantId) {
    // 대상 참여자의 **모든** allocation 을 스코프한다 — 다건 배정 당사자의 과거 정산까지 포함해
    // 당사자 본인 화면(RLS self=자기 모든 정산)과 동일한 충실도를 보장한다(C2). 빈 배열(신규 당사자)은
    // getSettlements 가 유출 방지 sentinel 로 처리하므로 관리자 RLS 전체유출이 나지 않는다.
    const { data: allocs } = await supabase
      .from('seoul_budget_allocations')
      .select('id')
      .eq('participant_id', viewAs.participantId)
    allocationIds = (allocs ?? []).map((a) => a.id as string)
  }
  const [{ records }, { settlements }] = await Promise.all([
    getMonitoringRecords(viewAs.participantId ?? undefined),
    getSettlements(allocationIds),
  ])

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href="/more"
          className="text-muted-foreground hover:text-foreground transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="더보기로 가기"
        >
          ←
        </Link>
        <h1 className="text-sm font-black text-foreground">💌 선생님이 남긴 기록</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col gap-6 max-w-sm mx-auto w-full">
        {/* 모니터링 = 선생님이 남긴 편지 */}
        {records.length === 0 ? (
          <section className="p-8 rounded-3xl bg-muted text-center">
            <p className="text-muted-foreground font-medium leading-relaxed">
              아직 남긴 기록이 없어요.<br />선생님을 만나면 여기에 나와요.
            </p>
          </section>
        ) : (
          <ul className="flex flex-col gap-3">
            {records.map((r) => (
              <li key={r.id} className="p-5 rounded-3xl bg-card ring-1 ring-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">
                    {r.method ? METHOD_EASY[r.method] ?? '' : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.monitoring_date}</span>
                </div>
                {r.observed_change && (
                  <p className="text-base text-foreground leading-relaxed">{r.observed_change}</p>
                )}
                {r.participant_voice && (
                  <div className="rounded-2xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground font-bold mb-1">내가 한 말</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">“{r.participant_voice}”</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* 정산 = 쓴 돈은 어떻게 됐나요 (미사용은 긍정 프레이밍 고정 문구) */}
        {settlements.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-muted-foreground">쓴 돈은 어떻게 됐나요</h2>
            <ul className="flex flex-col gap-3">
              {settlements.map((s) => (
                <li key={s.id} className="p-5 rounded-3xl bg-card ring-1 ring-border flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">{s.settled_period}</span>
                  <p className="text-base text-foreground leading-relaxed">
                    받은 돈 <b><MoneyText value={Number(s.accepted_amount)} emphasis="body" /></b>
                  </p>
                  {Number(s.unused_amount) > 0 && (
                    <p className="text-sm text-muted-foreground bg-success-bg rounded-2xl p-3 leading-relaxed">
                      아직 다 안 쓴 돈이 있어요. 괜찮아요, 잘못한 게 아니에요.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
