import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import { getUIPreferences } from '@/app/actions/preferences'
import DisplaySettingsClient from './DisplaySettingsClient'

/**
 * 화면 설정 — 당사자 본인이 홈 구성을 고른다(설계 goala_ui_preferences_W.md §7).
 * 담당자 대리 설정은 후속(participants/[id]).
 */
export const metadata = { title: '화면 설정' }

export default async function DisplaySettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const participant = await getCurrentParticipant()
  if (!participant) redirect('/')

  const prefs = await getUIPreferences(participant.id)

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-28">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href="/more"
          aria-label="뒤로 가기"
          className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          ←
        </Link>
        <h1 className="text-sm font-black text-zinc-800">화면 설정</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 max-w-sm mx-auto w-full flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-black text-zinc-900">무엇을 볼지 골라요.</h2>
          <p className="text-sm text-zinc-500 mt-1 leading-relaxed">이 칸을 보여줄까요? 켜고 끌 수 있어요.</p>
        </div>
        <DisplaySettingsClient participantId={participant.id} initial={prefs} />
      </main>
    </div>
  )
}
