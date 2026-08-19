import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'

/**
 * 당사자 목록 — 담당자가 당사자를 골라 욕구사정 등으로 들어가는 진입점.
 * (기존 ComingSoon 스텁을 대체. 상세 통합 현황은 이후 단계에서 확장.)
 */
export default async function ParticipantsOverviewPage() {
  const { supabase } = await requireStaff()

  const { data: participants, error } = await supabase
    .from('participants')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">당사자</h1>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-3">
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
                  href={`/supporter/${p.id}/assessment`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all min-h-[44px]"
                >
                  <span className="font-bold">{p.name ?? '이름 없음'}</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600">
                    욕구사정 →
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
