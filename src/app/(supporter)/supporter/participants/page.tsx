import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * 당사자 목록 — 담당자가 당사자를 골라 욕구사정 등으로 들어가는 진입점.
 * (기존 ComingSoon 스텁을 대체. 상세 통합 현황은 이후 단계에서 확장.)
 */
export const metadata = { title: '당사자 목록' }

export default async function ParticipantsOverviewPage() {
  const { supabase } = await requireStaff()

  const { data: participants, error } = await supabase
    .from('participants')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">당사자</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-3">
        {error && (
          <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm">
            목록을 불러오지 못했어요: {error.message}
          </div>
        )}

        {(participants ?? []).length === 0 ? (
          <EmptyState title="아직 등록된 당사자가 없어요." action={{ label: '당사자 추가하기', href: '/admin/participants/new' }} />
        ) : (
          <ul className="flex flex-col gap-2">
            {(participants ?? []).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-card ring-1 ring-border"
              >
                <Link
                  href={`/supporter/participants/${p.id}`}
                  className="font-bold truncate text-foreground hover:underline min-h-[44px] flex items-center"
                >
                  {p.name ?? '이름 없음'}
                </Link>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/supporter/${p.id}/assessment`}
                    className="text-xs font-bold px-3 rounded-full bg-muted text-muted-foreground hover:bg-muted-hover hover:text-foreground transition-colors min-h-[44px] flex items-center"
                  >
                    욕구사정
                  </Link>
                  <Link
                    href={`/supporter/${p.id}/transactions`}
                    className="text-xs font-bold px-3 rounded-full bg-muted text-muted-foreground hover:bg-muted-hover hover:text-foreground transition-colors min-h-[44px] flex items-center"
                  >
                    거래장부
                  </Link>
                  <Link
                    href={`/supporter/budgets/${p.id}`}
                    className="text-xs font-bold px-3 rounded-full bg-muted text-muted-foreground hover:bg-muted-hover hover:text-foreground transition-colors min-h-[44px] flex items-center"
                  >
                    예산
                  </Link>
                  <Link
                    href={`/supporter/network?participant=${p.id}`}
                    className="text-xs font-bold px-3 rounded-full bg-muted text-muted-foreground hover:bg-muted-hover hover:text-foreground transition-colors min-h-[44px] flex items-center"
                  >
                    관계망
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
