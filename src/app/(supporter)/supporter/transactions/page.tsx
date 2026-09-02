import { requireStaff } from '@/utils/supabase/staff'
import { getServiceUsages } from '@/app/actions/serviceUsage'
import OrgLedgerClient, { type LedgerRow } from './OrgLedgerClient'

export const metadata = { title: '거래장부' }

/**
 * org 거래장부 (GOAL축 A, ComingSoon 스텁 대체) — 담당 실무자/관리자가 자기 담당 당사자 **전체** 지출을 한 화면에서.
 * 설계: Plan&Source/goala_comingsoon_stubs_triage_W.md §4-1.
 * getServiceUsages() 무인자 = RLS 스코프(admin=전체 · supporter=배정분). 이름은 참여자 조회로 붙인다.
 * 집계·필터는 OrgLedgerClient(buildOrgLedger). 각 당사자 그룹 → supporter/[pid]/transactions.
 */
export default async function TransactionsPage() {
  const { supabase } = await requireStaff()
  const { usages, error } = await getServiceUsages()

  // 당사자 이름(그룹 라벨) — RLS 로 스코프된 참여자만 조회.
  const ids = [...new Set(usages.map((u) => u.participant_id))]
  const nameById = new Map<string, string>()
  if (ids.length > 0) {
    const { data: parts } = await supabase.from('participants').select('id, name').in('id', ids)
    for (const p of parts ?? []) nameById.set(p.id, (p.name as string | null) ?? '이름 없음')
  }

  const rows: LedgerRow[] = usages.map((u) => ({
    id: u.id,
    participantId: u.participant_id,
    participantName: nameById.get(u.participant_id) ?? '이름 없음',
    amount: u.amount,
    settlementStatus: u.settlement_status,
    usageDate: u.usage_date,
    description: u.description,
  }))

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">거래장부</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        {error ? (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm leading-relaxed">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-600 leading-relaxed py-12 text-center">아직 지출 기록이 없어요.</p>
        ) : (
          <OrgLedgerClient rows={rows} />
        )}
      </main>
    </div>
  )
}
