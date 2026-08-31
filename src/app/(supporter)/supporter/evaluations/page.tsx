import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'

/**
 * 정산·평가 목록 — 담당자가 당사자를 골라 통합 정산·평가 뷰로 들어가는 진입점.
 * (구 4+1/월간 ComingSoon 스텁 대체. 상세는 evaluations/[participantId].)
 */
export const metadata = { title: '정산·평가' }

export default async function EvaluationsPage() {
  const { supabase } = await requireStaff()

  const { data: participants, error } = await supabase
    .from('participants')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">정산·평가</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-3">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            목록을 불러오지 못했어요: {error.message}
          </div>
        )}

        {(participants ?? []).length === 0 ? (
          <p className="text-zinc-400 text-sm py-8 text-center">아직 등록된 당사자가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(participants ?? []).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/supporter/evaluations/${p.id}`}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all"
                >
                  <span className="font-bold truncate">{p.name ?? '이름 없음'}</span>
                  <span className="text-xs font-bold text-zinc-400 shrink-0">정산·평가 보기 →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
