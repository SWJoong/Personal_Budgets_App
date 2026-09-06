import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import { getApplications, type ApplicationStatus } from '@/app/actions/application'
import { EmptyState } from '@/components/ui/EmptyState'

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
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">신청서</h1>
        <Link
          href="/supporter/applications/new"
          className="min-h-[44px] px-4 flex items-center rounded-xl bg-hero text-hero-foreground font-bold text-sm hover:bg-hero-hover transition-colors"
        >
          + 신청서 접수
        </Link>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-3">
        {error && (
          <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm">{error}</div>
        )}

        {(applications ?? []).length === 0 ? (
          <EmptyState title="아직 신청서를 받지 않았어요." action={{ label: '새 신청서 받기', href: '/supporter/applications/new' }} />
        ) : (
          <ul className="flex flex-col gap-2">
            {(applications ?? []).map((app) => (
              <li key={app.id}>
                <Link
                  href={`/supporter/applications/${app.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-card ring-1 ring-border hover:ring-foreground transition-all"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-bold">{participantName.get(app.participant_id) ?? '이름 없음'}</span>
                    <span className="text-xs text-muted-foreground">
                      {cohortName.get(app.cohort_id) ?? ''} · {app.application_date}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-bg text-neutral-fg">
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
