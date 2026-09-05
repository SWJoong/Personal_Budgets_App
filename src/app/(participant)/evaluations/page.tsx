import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getMonitoringRecords } from '@/app/actions/monitoring'
import { getSettlements } from '@/app/actions/settlement'

export const metadata = { title: '선생님이 남긴 기록' }

// 당사자 미러 — "선생님의 편지" 프레이밍 계승(설계 §3b). 모니터링은 읽기만(RLS 로 본인 것만).
// 행정 언어("정산·모니터링") 대신 쉬운 말(§4). 미사용액은 실패로 읽히지 않게 긍정 고정 문구.
const METHOD_EASY: Record<string, string> = {
  visit: '만났어요',
  phone: '전화했어요',
  app: '앱으로 봤어요',
  document: '서류로 봤어요',
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

export default async function ParticipantEvaluationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 인자 없이 호출 → RLS 가 본인 것만 반환(기존 시그니처 재사용).
  const [{ records }, { settlements }] = await Promise.all([
    getMonitoringRecords(),
    getSettlements(),
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
                    받은 돈 <b>{won(Number(s.accepted_amount))}</b>
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
