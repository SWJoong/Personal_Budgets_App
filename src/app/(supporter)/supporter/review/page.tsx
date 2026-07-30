import { requireStaff } from '@/utils/supabase/staff'
import { getRuleChecks } from '@/app/actions/ruleCheck'
import ReviewQueueClient from './ReviewQueueClient'

export default async function ReviewQueuePage() {
  const { supabase } = await requireStaff()
  const { ruleChecks, error } = await getRuleChecks(true)

  const usageIds = [...new Set(ruleChecks.map((rc) => rc.usage_id))]
  const ruleIds = [...new Set(ruleChecks.map((rc) => rc.rule_id))]

  const [{ data: usages }, { data: rules }] = await Promise.all([
    usageIds.length
      ? supabase.from('seoul_service_usages').select('id, participant_id, usage_date, amount, description').in('id', usageIds)
      : Promise.resolve({ data: [] as { id: string; participant_id: string; usage_date: string; amount: number; description: string | null }[] }),
    ruleIds.length
      ? supabase.from('seoul_spending_rules').select('id, label').in('id', ruleIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
  ])

  const participantIds = [...new Set((usages ?? []).map((u) => u.participant_id))]
  const { data: participants } = participantIds.length
    ? await supabase.from('participants').select('id, name').in('id', participantIds)
    : { data: [] as { id: string; name: string }[] }

  const usageById = new Map((usages ?? []).map((u) => [u.id, u]))
  const ruleById = new Map((rules ?? []).map((r) => [r.id, r]))
  const participantById = new Map((participants ?? []).map((p) => [p.id, p.name]))

  const items = ruleChecks.map((rc) => {
    const usage = usageById.get(rc.usage_id)
    return {
      id: rc.id,
      ruleLabel: rc.rule_id ? ruleById.get(rc.rule_id)?.label ?? '' : '',
      participantName: usage ? participantById.get(usage.participant_id) ?? '' : '',
      usageDate: usage?.usage_date ?? '',
      amount: usage?.amount ?? 0,
      description: usage?.description ?? null,
    }
  })

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">확인이 필요한 지출</h1>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6">
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
        )}
        <ReviewQueueClient items={items} />
      </main>
    </div>
  )
}
