import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/utils/supabase/staff'
import ParticipantEditClient from './ParticipantEditClient'

export const metadata = { title: '당사자 수정' }

export default async function ParticipantEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name, email, assigned_supporter_id')
    .eq('id', id)
    .maybeSingle()

  if (!participant) notFound()

  const { data: supporters } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'supporter')

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href={`/admin/participants/${id}`}
          aria-label="뒤로 가기"
          className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-xl font-bold tracking-tight">당사자 수정</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <ParticipantEditClient
          participant={{
            id: participant.id,
            name: participant.name ?? '',
            email: participant.email ?? '',
            assigned_supporter_id: participant.assigned_supporter_id ?? null,
          }}
          supporters={supporters ?? []}
        />
      </main>
    </div>
  )
}
