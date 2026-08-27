import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { getServiceUsages } from '@/app/actions/serviceUsage'

/**
 * 거래장부 (GOAL축 A) — 당사자의 지출(seoul_service_usages) 목록. 실무자·본인 열람.
 * (기존 ComingSoon 스텁 대체. 지출 기록 폼(/new)·영수증·분류(domain) 연결은 이후 단계.)
 */

const STATUS_LABEL: Record<string, string> = {
  pending: '정산 대기',
  accepted: '정산 완료',
  rejected: '반려',
  recovered: '환수',
}
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
  recovered: 'bg-amber-50 text-amber-700',
}

function won(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

export const metadata = { title: '거래장부' }

export default async function TransactionsPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  const { usages, error } = await getServiceUsages(participantId)
  const total = usages.reduce((sum, u) => sum + Number(u.amount), 0)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center min-w-0">
          <Link
            href="/supporter/participants"
            aria-label="뒤로 가기"
            className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold tracking-tight truncate">{participant.name}님의 거래장부</h1>
        </div>
        <Link
          href={`/supporter/${participantId}/transactions/new`}
          className="px-4 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-colors min-h-[44px] flex items-center whitespace-nowrap"
        >
          + 지출 기록
        </Link>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
        )}

        <div className="p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200">
          <div className="text-xs text-zinc-400">전체 지출</div>
          <div className="text-2xl font-bold">{won(total)}</div>
          <div className="text-xs text-zinc-400 mt-1">{usages.length}건</div>
        </div>

        {usages.length === 0 ? (
          <p className="text-zinc-400 text-sm py-8 text-center leading-relaxed">아직 지출 기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {usages.map((u) => (
              <li
                key={u.id}
                className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex items-center justify-between gap-3"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-bold text-zinc-800 truncate">{u.description || '(내용 없음)'}</span>
                  <span className="text-xs text-zinc-400">{u.usage_date}</span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-bold">{won(Number(u.amount))}</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      STATUS_STYLE[u.settlement_status] ?? 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {STATUS_LABEL[u.settlement_status] ?? u.settlement_status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
