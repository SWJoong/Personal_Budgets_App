import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import { getApplications, type ApplicationStatus } from '@/app/actions/application'

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: '작성 중',
  received: '접수됨',
  screening: '심사 중',
  selected: '선정됨',
  not_selected: '선정 안 됨',
  withdrawn: '철회됨',
}

export const metadata = { title: '신청 목록' }

export default async function ApplicationsPage() {
  const { supabase } = await requireStaff()
  const { applications, error } = await getApplications()

  const participantIds = [...new Set((applications ?? []).map((a) => a.participant_id))]
  const cohortIds = [...new Set((applications ?? []).map((a) => a.cohort_id))]

  const [{ data: participants }, { data: cohorts }] = await Promise.all([
    participantIds.length
      ? supabase.from('participants').select('id, name').in('id', participantIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    cohortIds.length
      ? supabase.from('seoul_cohorts').select('id, name').in('id', cohortIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const participantName = new Map((participants ?? []).map((p) => [p.id, p.name]))
  const cohortName = new Map((cohorts ?? []).map((c) => [c.id, c.name]))

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">신청서</h1>
        <Link
          href="/supporter/applications/new"
          className="min-h-[44px] px-4 flex items-center rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-colors"
        >
          + 신청서 접수
        </Link>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-3">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
        )}

        {(applications ?? []).length === 0 ? (
          <p className="text-zinc-400 text-sm py-8 text-center">아직 접수된 신청서가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(applications ?? []).map((app) => (
              <li key={app.id}>
                <Link
                  href={`/supporter/applications/${app.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-bold">{participantName.get(app.participant_id) ?? '이름 없음'}</span>
                    <span className="text-xs text-zinc-400">
                      {cohortName.get(app.cohort_id) ?? ''} · {app.application_date}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600">
                    {STATUS_LABEL[app.status as ApplicationStatus] ?? app.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
