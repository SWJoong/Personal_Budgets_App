import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return new Response('Forbidden', { status: 403 })
  }

  const sp = request.nextUrl.searchParams

  let query = supabase
    .from('transactions')
    .select(`
      id, date, activity_name, amount, category, payment_method, status, memo,
      participant:participants!transactions_participant_id_fkey ( name ),
      funding_source:funding_sources!transactions_funding_source_id_fkey ( name )
    `)
    .order('date', { ascending: false })
    .limit(5000)

  const participant = sp.get('participant')
  const status = sp.get('status')
  const category = sp.get('category')
  const paymentMethod = sp.get('paymentMethod')
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')
  const keyword = sp.get('keyword')

  if (participant) query = query.eq('participant_id', participant)
  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (paymentMethod) query = query.eq('payment_method', paymentMethod)
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)
  if (keyword) query = query.or(`activity_name.ilike.%${keyword}%,memo.ilike.%${keyword}%`)

  if (profile.role === 'supporter') {
    const { data: myPs } = await supabase
      .from('participants')
      .select('id')
      .eq('assigned_supporter_id', user.id)
    const ids = (myPs || []).map((p: any) => p.id)
    if (ids.length > 0) query = query.in('participant_id', ids)
  }

  const { data: transactions, error } = await query
  if (error) return new Response('Query failed', { status: 500 })

  // BOM(\uFEFF) 추가 — Excel에서 한글 깨짐 방지
  const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const headers = ['날짜', '당사자', '활동명', '금액', '카테고리', '결제수단', '재원', '상태', '메모']
  const rows = (transactions || []).map((t: any) => [
    csvCell(t.date),
    csvCell(t.participant?.name ?? ''),
    csvCell(t.activity_name),
    csvCell(t.amount),
    csvCell(t.category ?? ''),
    csvCell(t.payment_method ?? ''),
    csvCell(t.funding_source?.name ?? ''),
    csvCell(t.status === 'confirmed' ? '확정' : '대기'),
    csvCell(t.memo ?? ''),
  ].join(','))

  const csv = [headers.map(csvCell).join(','), ...rows].join('\r\n')
  const today = new Date().toISOString().slice(0, 10)

  return new Response('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions_${today}.csv"`,
    },
  })
}
