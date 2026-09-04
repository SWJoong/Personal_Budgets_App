import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentParticipant } from '@/utils/supabase/participant'

export const metadata = { title: '해보고 싶은 것' }

/**
 * B5 — 해보고 싶은 것 (participant/plan). ComingSoon 스텁 대체.
 * 당사자가 이용계획에 이미 적은 seoul_self_narratives.goal_to_try 를 쉬운말로 보여주는 읽기 우선 경량 화면.
 * 편집은 /my-plan 이 정본 — 이 화면은 표시 + 그리로 안내. 설계 Plan&Source/goala_comingsoon_stubs_triage_W.md §4-9.
 * ★my-plan/page.tsx 와 동일 조회 재사용(RLS 가 본인 것만) — 신규 테이블·백엔드 없음. 순수 로직 없음(골든 없음).
 */
export default async function PlanPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const participant = await getCurrentParticipant()

  // 최신 이용계획 → 그 계획의 "나의 이야기" goal_to_try. my-plan 과 같은 경로(본인 RLS).
  let goalToTry: string | null = null
  if (participant) {
    const { data: plan } = await supabase
      .from('seoul_utilization_plans')
      .select('id')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (plan) {
      const { data: narrative } = await supabase
        .from('seoul_self_narratives')
        .select('goal_to_try')
        .eq('plan_id', (plan as { id: string }).id)
        .maybeSingle()
      const raw = (narrative as { goal_to_try: string | null } | null)?.goal_to_try
      goalToTry = raw && raw.trim() ? raw.trim() : null
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <header className="flex h-14 items-center gap-2 px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href="/"
          aria-label="홈으로 가기"
          className="flex items-center justify-center min-w-[44px] min-h-[44px] text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <span className="text-xl" aria-hidden="true">←</span>
        </Link>
        <h1 className="text-base font-black text-zinc-800">무엇을 해볼까요?</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        {goalToTry ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500 leading-relaxed">이용계획에 적은 일이에요.</p>
            <div className="p-6 rounded-3xl bg-white ring-1 ring-zinc-200 shadow-sm">
              <p className="text-xl font-bold text-zinc-800 leading-relaxed whitespace-pre-wrap">{goalToTry}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center gap-5 py-16">
            <span className="text-6xl" aria-hidden="true">📝</span>
            <p className="text-lg font-bold text-zinc-700 leading-relaxed">아직 없어요.</p>
            <Link
              href="/my-plan"
              className="inline-flex items-center justify-center min-h-[44px] px-6 rounded-2xl bg-zinc-900 text-white text-base font-bold hover:bg-zinc-800 transition-colors"
            >
              이용계획에서 적어요
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
