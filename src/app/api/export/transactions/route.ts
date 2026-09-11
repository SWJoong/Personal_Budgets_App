import { NextResponse } from 'next/server'
import { assertStaff } from '@/utils/supabase/staff'
import { getServiceUsages } from '@/app/actions/serviceUsage'
import { buildLedgerCsv, type LedgerExportRow } from '@/utils/ledgerCsv'

/**
 * A5 회계 보강 — 거래장부 CSV 내려받기(Route Handler). 설계: goala_supporter_accounting_W.md §2 A5.
 *
 * 다운로드는 **사용자 브라우저**가 attachment 로 받는다(에이전트 대행 아님 — 안전). 담당 실무자/관리자만
 * 접근(assertStaff → 실패 시 403). 데이터 스코프는 getServiceUsages() 무인자 = RLS(담당 배정분).
 * 참여자명·영역·제공기관 라벨은 세션 client(RLS)로 조회해 붙인다. 직렬화는 순수 util buildLedgerCsv.
 *
 * 활성 필터(당사자·정산상태·기간)는 쿼리스트링으로 받아 원장 UI 와 동일 규칙으로 좁힌다(관리자 QA #2).
 * 각 파라미터는 비어있지 않을 때만 적용 — 파라미터가 없으면 전량 export(기존 동작).
 */
export async function GET(request: Request) {
  let supabase: Awaited<ReturnType<typeof assertStaff>>['supabase']
  try {
    ;({ supabase } = await assertStaff())
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = new URL(request.url).searchParams
  const participantParam = sp.get('participant')
  const statusParam = sp.get('status')
  const fromParam = sp.get('from')
  const toParam = sp.get('to')

  const { usages: allUsages } = await getServiceUsages()
  const usages = allUsages.filter(
    (u) =>
      (!participantParam || u.participant_id === participantParam) &&
      (!statusParam || u.settlement_status === statusParam) &&
      (!fromParam || u.usage_date >= fromParam) &&
      (!toParam || u.usage_date <= toParam),
  )

  // 라벨 배선용 distinct id 수집(null 제외).
  const participantIds = [...new Set(usages.map((u) => u.participant_id))]
  const domainIds = [...new Set(usages.map((u) => u.domain_id).filter((id): id is string => !!id))]
  const providerIds = [...new Set(usages.map((u) => u.provider_id).filter((id): id is string => !!id))]

  const nameById = new Map<string, string>()
  if (participantIds.length > 0) {
    const { data } = await supabase.from('participants').select('id, name').in('id', participantIds)
    for (const p of data ?? []) nameById.set(p.id, (p.name as string | null) ?? '이름 없음')
  }

  const domainById = new Map<string, string>()
  if (domainIds.length > 0) {
    const { data } = await supabase.from('seoul_service_domains').select('id, label').in('id', domainIds)
    for (const d of data ?? []) domainById.set(d.id, d.label)
  }

  const providerById = new Map<string, string>()
  if (providerIds.length > 0) {
    const { data } = await supabase.from('seoul_service_providers').select('id, name').in('id', providerIds)
    for (const p of data ?? []) providerById.set(p.id, p.name)
  }

  const exportRows: LedgerExportRow[] = usages.map((u) => ({
    usageDate: u.usage_date,
    participantName: nameById.get(u.participant_id) ?? '이름 없음',
    domainLabel: u.domain_id ? domainById.get(u.domain_id) ?? null : null,
    providerName: u.provider_id ? providerById.get(u.provider_id) ?? null : null,
    amount: u.amount,
    settlementStatus: u.settlement_status,
    description: u.description,
  }))

  const csv = buildLedgerCsv(exportRows)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="transactions.csv"',
    },
  })
}
