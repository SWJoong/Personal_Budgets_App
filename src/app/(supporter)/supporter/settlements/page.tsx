import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import { getSettlements } from '@/app/actions/settlement'
import { buildSettlementLedger, type AllocationOwner } from '@/utils/settlementLedger'
import SettlementsLedgerClient from './SettlementsLedgerClient'

export const metadata = { title: '정산 원장' }

/**
 * 실무자 정산 원장 (GOAL축 A, A6 · Track A 마지막) — 담당 당사자의 정산(인정/반려/환수/미사용)을
 * 한 화면에서 열람. 설계: Plan&Source/goala_supporter_accounting_W.md §2 A6. 열람 전용(기록=관리자).
 * getSettlements() 무인자 = RLS 담당분. 정산은 allocation_id 로만 참여자에 묶여 배정(id→participant_id)
 * ·참여자명을 조회해 allocMap 을 만든 뒤 순수 buildSettlementLedger 로 집계한다. 미매핑 → '(알 수 없음)'.
 */
export default async function SettlementsPage() {
  const { supabase } = await requireStaff()
  const { settlements, error } = await getSettlements()

  // allocation → { participantId, participantName } 매핑 —
  // distinct allocation_id → seoul_budget_allocations(id, participant_id) → participants(id, name).
  const allocMap: Record<string, AllocationOwner> = {}
  const allocationIds = [...new Set(settlements.map((s) => s.allocation_id))]
  if (allocationIds.length > 0) {
    const { data: allocs } = await supabase
      .from('seoul_budget_allocations')
      .select('id, participant_id')
      .in('id', allocationIds)

    const participantIds = [...new Set((allocs ?? []).map((a) => a.participant_id))]
    const nameById = new Map<string, string>()
    if (participantIds.length > 0) {
      const { data: parts } = await supabase.from('participants').select('id, name').in('id', participantIds)
      for (const p of parts ?? []) nameById.set(p.id, (p.name as string | null) ?? '이름 없음')
    }

    for (const a of allocs ?? []) {
      allocMap[a.id] = {
        participantId: a.participant_id,
        participantName: nameById.get(a.participant_id) ?? '이름 없음',
      }
    }
  }

  const ledger = buildSettlementLedger(settlements, allocMap)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href="/supporter"
          aria-label="대시보드로 가기"
          className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight">정산 원장</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        {error ? (
          <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm leading-relaxed">
            {error}
          </div>
        ) : (
          <SettlementsLedgerClient ledger={ledger} />
        )}
      </main>
    </div>
  )
}
