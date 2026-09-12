import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/utils/supabase/staff'
import { getMonitoringRecords } from '@/app/actions/monitoring'
import { getSettlements } from '@/app/actions/settlement'
import { getAppeals } from '@/app/actions/appeal'
import { enterParticipantView } from '@/app/actions/viewAs'
import ParticipantDetailClient from './ParticipantDetailClient'

export const metadata = { title: '당사자 상세' }

export default async function ParticipantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name, email, auth_user_id')
    .eq('id', id)
    .maybeSingle()

  if (!participant) notFound()

  const { data: allocation } = await supabase
    .from('seoul_budget_allocations')
    .select('id, allocated_amount, copay_amount, copay_status')
    .eq('participant_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [{ records }, { settlements }, { appeals }] = await Promise.all([
    getMonitoringRecords(id),
    allocation ? getSettlements(allocation.id) : Promise.resolve({ settlements: [] }),
    getAppeals(id),
  ])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link href="/admin/participants" aria-label="뒤로 가기" className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center">←</Link>
        <h1 className="text-xl font-bold tracking-tight">{participant.name}님 상세</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* 등록 정보(이름·이메일·담당자) 수정·삭제 */}
          <Link
            href={`/admin/participants/${participant.id}/edit`}
            aria-label="당사자 정보 수정"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-card ring-1 ring-border text-foreground font-bold text-sm hover:bg-muted-hover transition-colors"
          >
            ✏️ 정보 수정
          </Link>
          {/* 관리자 둘러보기(view-as) 진입 — 이 당사자의 당사자 화면 전체를 읽기전용으로 순회 */}
          <form action={enterParticipantView.bind(null, participant.id)}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-hero text-hero-foreground font-bold text-sm hover:bg-hero-hover transition-colors"
            >
              🔎 당사자 화면 둘러보기
            </button>
          </form>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6">
        <ParticipantDetailClient
          participantId={participant.id}
          allocationId={allocation?.id ?? null}
          allocatedAmount={allocation ? Number(allocation.allocated_amount) : null}
          copayAmount={allocation ? Number(allocation.copay_amount) : null}
          copayStatus={allocation?.copay_status ?? null}
          monitoringRecords={records}
          settlements={settlements}
          appeals={appeals}
        />
      </main>
    </div>
  )
}
