import { requireStaff } from '@/utils/supabase/staff'
import { getRuleChecks } from '@/app/actions/ruleCheck'
import { getReceiptSignedUrl } from '@/app/actions/serviceUsage'
import ReviewQueueClient from './ReviewQueueClient'

export const metadata = { title: '영수증 검토' }

export default async function ReviewQueuePage() {
  const { supabase } = await requireStaff()
  const { ruleChecks, error } = await getRuleChecks(true)

  const usageIds = [...new Set(ruleChecks.map((rc) => rc.usage_id))]
  const ruleIds = [...new Set(ruleChecks.map((rc) => rc.rule_id))]

  const [{ data: usages }, { data: rules }] = await Promise.all([
    usageIds.length
      ? supabase.from('seoul_service_usages').select('id, participant_id, usage_date, amount, description, provider_id').in('id', usageIds)
      : Promise.resolve({ data: [] as { id: string; participant_id: string; usage_date: string; amount: number; description: string | null; provider_id: string | null }[] }),
    ruleIds.length
      ? supabase.from('seoul_spending_rules').select('id, label').in('id', ruleIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
  ])

  const participantIds = [...new Set((usages ?? []).map((u) => u.participant_id))]
  const providerIds = [...new Set((usages ?? []).map((u) => u.provider_id).filter((id): id is string => !!id))]

  const [{ data: participants }, { data: providers }] = await Promise.all([
    participantIds.length
      ? supabase.from('participants').select('id, name').in('id', participantIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    providerIds.length
      ? supabase.from('seoul_service_providers').select('id, name').in('id', providerIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  // 실무자가 사진·장소를 못 본 채 "그대로 인정"/"제외"를 누르는 것을 막는다 —
  // 검토 화면의 존재 이유가 바로 이 증거를 보고 판단하는 것이다.
  const receiptUrls = await Promise.all(usageIds.map((id) => getReceiptSignedUrl(id)))
  const receiptUrlByUsage = new Map(usageIds.map((id, i) => [id, receiptUrls[i]?.url ?? null]))

  const usageById = new Map((usages ?? []).map((u) => [u.id, u]))
  const ruleById = new Map((rules ?? []).map((r) => [r.id, r]))
  const participantById = new Map((participants ?? []).map((p) => [p.id, p.name]))
  const providerById = new Map((providers ?? []).map((p) => [p.id, p.name]))

  const items = ruleChecks.map((rc) => {
    const usage = usageById.get(rc.usage_id)
    return {
      id: rc.id,
      ruleLabel: rc.rule_id ? ruleById.get(rc.rule_id)?.label ?? '' : '',
      participantName: usage ? participantById.get(usage.participant_id) ?? '' : '',
      usageDate: usage?.usage_date ?? '',
      amount: usage?.amount ?? 0,
      description: usage?.description ?? null,
      placeName: usage?.provider_id ? providerById.get(usage.provider_id) ?? null : null,
      receiptUrl: receiptUrlByUsage.get(rc.usage_id) ?? null,
    }
  })

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">확인이 필요한 지출</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6">
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
        )}
        <ReviewQueueClient items={items} />
      </main>
    </div>
  )
}
