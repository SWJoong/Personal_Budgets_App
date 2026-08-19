import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { getApplicationDocuments } from '@/app/actions/application'
import ApplicationDetailClient from './ApplicationDetailClient'

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profile } = await requireStaff()

  const { data: application } = await supabase
    .from('seoul_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!application) notFound()

  const [{ data: participant }, { data: cohort }, { data: consents }, { data: decision }, { data: benefit }] = await Promise.all([
    supabase.from('participants').select('id, name, email').eq('id', application.participant_id).maybeSingle(),
    supabase.from('seoul_cohorts').select('name, code').eq('id', application.cohort_id).maybeSingle(),
    supabase.from('seoul_consent_records').select('*').eq('application_id', id),
    supabase.from('seoul_selection_decisions').select('*').eq('application_id', id).maybeSingle(),
    // 복지부 중복은 앱이 막지 않고 선정 화면에서 경고만 한다(기관 확인) — 그 판단 재료.
    supabase.from('seoul_benefit_status').select('participates_in_mohw_pilot').eq('participant_id', application.participant_id).maybeSingle(),
  ])

  // 서식 문항을 앱에 복제하지 않고 원본 파일만 보관한다(기관 확인).
  const { documents } = await getApplicationDocuments(id)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/supporter/applications" aria-label="뒤로 가기" className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center">←</Link>
        <h1 className="text-xl font-bold tracking-tight">{participant?.name ?? '당사자'}님의 신청서</h1>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <ApplicationDetailClient
          applicationId={id}
          participantId={application.participant_id}
          participantName={participant?.name ?? '당사자'}
          cohortName={cohort ? `${cohort.name} (${cohort.code})` : ''}
          status={application.status}
          isAdmin={profile.role === 'admin'}
          initialConsents={consents ?? []}
          initialDecision={decision ?? null}
          documents={documents}
          participatesInMohwPilot={benefit?.participates_in_mohw_pilot ?? false}
        />
      </main>
    </div>
  )
}
