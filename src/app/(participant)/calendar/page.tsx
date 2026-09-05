import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import CalendarClient from './CalendarClient'

export const metadata = { title: '달력' }

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const participant = await getCurrentParticipant()

  if (!participant) {
    return (
      <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
        <header className="flex h-14 items-center px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
          <h1 className="text-sm font-black text-foreground">달력</h1>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
          <span aria-hidden="true" className="text-6xl">📅</span>
          <p className="text-muted-foreground font-medium leading-relaxed">아직 예산 정보가 없어요.<br />담당 선생님에게 말씀해 주세요.</p>
        </main>
      </div>
    )
  }

  const { data: usages } = await supabase
    .from('seoul_service_usages')
    .select('id, usage_date, amount, description')
    .eq('participant_id', participant.id)
    .order('usage_date', { ascending: false })

  return <CalendarClient usages={usages ?? []} />
}
