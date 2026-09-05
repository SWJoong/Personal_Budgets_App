import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import NewPlanClient from './NewPlanClient'

/**
 * 새 이용계획 만들기 — 수행기관 담당자(사회복지사)가 선정된 신청자를 골라 계획을 시작한다.
 * 기관 확인(2026-07-31): 계획 작성 주체는 담당자다. 당사자는 만들어진 계획을 열람만 한다.
 */
export const metadata = { title: '계획 작성' }

export default async function NewPlanPage() {
  const { supabase } = await requireStaff()

  // 선정된(status='selected') 신청서 중 아직 계획이 없는 것만 고를 수 있게 한다.
  const { data: selectedApps } = await supabase
    .from('seoul_applications')
    .select('id, participant_id')
    .eq('status', 'selected')

  const appList = selectedApps ?? []
  const participantIds = [...new Set(appList.map((a) => a.participant_id))]
  const planParticipantIds = new Set<string>()

  if (appList.length) {
    const { data: existingPlans } = await supabase
      .from('seoul_utilization_plans')
      .select('application_id')
      .in('application_id', appList.map((a) => a.id))
    for (const p of existingPlans ?? []) {
      const app = appList.find((a) => a.id === p.application_id)
      if (app) planParticipantIds.add(app.id)
    }
  }

  const { data: participants } = participantIds.length
    ? await supabase.from('participants').select('id, name').in('id', participantIds)
    : { data: [] as { id: string; name: string }[] }
  const nameById = new Map((participants ?? []).map((p) => [p.id, p.name]))

  // 계획이 아직 없는 신청서만 후보로 남긴다.
  const candidates = appList
    .filter((a) => !planParticipantIds.has(a.id))
    .map((a) => ({
      applicationId: a.id,
      participantId: a.participant_id,
      participantName: nameById.get(a.participant_id) ?? '이름 없음',
    }))

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link href="/supporter/plans" aria-label="뒤로 가기" className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center">←</Link>
        <h1 className="text-xl font-bold tracking-tight">새 이용계획 만들기</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <NewPlanClient candidates={candidates} />
      </main>
    </div>
  )
}
