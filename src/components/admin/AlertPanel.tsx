import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'

interface Alert {
  type: 'low_balance' | 'pending_receipt' | 'missing_evaluation'
  participantId: string
  participantName: string
  message: string
}

export default async function AlertPanel() {
  const supabase = await createClient()
  const alerts: Alert[] = []

  // 1. 잔액 경고 — current_month_balance / monthly_budget < alert_threshold
  const { data: participants } = await supabase
    .from('participants')
    .select('id, name, alert_threshold, funding_sources(monthly_budget, current_month_balance)')

  for (const p of participants ?? []) {
    const threshold = (p as any).alert_threshold ?? 20
    const sources: any[] = (p as any).funding_sources ?? []
    for (const fs of sources) {
      const budget = Number(fs.monthly_budget)
      if (budget <= 0) continue
      const balance = Number(fs.current_month_balance)
      const ratio = Math.round((balance / budget) * 100)
      if (balance < threshold) {
        alerts.push({
          type: 'low_balance',
          participantId: p.id,
          participantName: (p as any).name,
          message: `이번 달 잔액 ${ratio}% 남음 (기준액 ${formatCurrency(threshold)}원 미만)`,
        })
      }
    }
  }

  // 2. 미확인 영수증
  const { data: pendingTxs } = await supabase
    .from('transactions')
    .select('participant_id, participants!transactions_participant_id_fkey(name)')
    .eq('status', 'pending')

  const pendingMap = new Map<string, { name: string; count: number }>()
  for (const tx of pendingTxs ?? []) {
    const pid = (tx as any).participant_id
    const name = (tx as any).participants?.name ?? '알 수 없음'
    const cur = pendingMap.get(pid)
    if (cur) cur.count++
    else pendingMap.set(pid, { name, count: 1 })
  }
  for (const [pid, { name, count }] of pendingMap.entries()) {
    alerts.push({
      type: 'pending_receipt',
      participantId: pid,
      participantName: name,
      message: `미확인 영수증 ${count}건`,
    })
  }

  // 3. 이번 달 평가 미작성
  const currentMonth = new Date().toISOString().slice(0, 7)
  const { data: evaluations } = await supabase
    .from('evaluations')
    .select('participant_id')
    .eq('month', currentMonth)

  const evaluatedIds = new Set((evaluations ?? []).map((e: any) => e.participant_id))

  for (const p of participants ?? []) {
    if (!evaluatedIds.has(p.id)) {
      alerts.push({
        type: 'missing_evaluation',
        participantId: p.id,
        participantName: (p as any).name,
        message: '이번 달 평가 미작성',
      })
    }
  }

  if (alerts.length === 0) return null

  const iconMap: Record<Alert['type'], string> = {
    low_balance: '💰',
    pending_receipt: '🧾',
    missing_evaluation: '📝',
  }
  const colorMap: Record<Alert['type'], string> = {
    low_balance: 'text-red-700 bg-red-50 border-red-200',
    pending_receipt: 'text-orange-700 bg-orange-50 border-orange-200',
    missing_evaluation: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  }

  const pendingTotal = Array.from(pendingMap.values()).reduce((s, v) => s + v.count, 0)

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-orange-200 bg-orange-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span className="font-black text-orange-800 text-sm">주의가 필요한 항목 {alerts.length}건</span>
        </div>
        {pendingTotal > 0 && (
          <Link
            href="/supporter/review"
            className="text-xs font-bold text-orange-700 hover:text-orange-900 underline underline-offset-2"
          >
            영수증 검토 바로가기 →
          </Link>
        )}
      </div>

      <div className="divide-y divide-orange-100">
        {alerts.slice(0, 6).map((alert, i) => (
          <Link
            key={i}
            href={
              alert.type === 'pending_receipt'
                ? '/supporter/review'
                : alert.type === 'missing_evaluation'
                ? `/supporter/evaluations/${alert.participantId}/${currentMonth}`
                : `/admin/participants/${alert.participantId}`
            }
            className={`flex items-center gap-3 px-5 py-3 transition-colors hover:brightness-95 ${colorMap[alert.type]}`}
          >
            <span className="text-base shrink-0">{iconMap[alert.type]}</span>
            <span className="font-bold text-sm shrink-0">{alert.participantName}</span>
            <span className="text-sm">— {alert.message}</span>
            <span className="ml-auto text-xs opacity-60">→</span>
          </Link>
        ))}
        {alerts.length > 6 && (
          <div className="px-5 py-2 text-xs font-bold text-orange-500">
            외 {alerts.length - 6}건 더 있어요
          </div>
        )}
      </div>
    </section>
  )
}
