import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { getReceiptSignedUrl } from '@/app/actions/serviceUsage'
import { settlementLabel, settlementStyle } from '@/utils/settlementStatus'

export const metadata = { title: '거래 상세' }

const won = (n: number) => n.toLocaleString('ko-KR') + '원'

/**
 * 거래 상세 (GOAL축 A, §4-2) — 지출 1건 열람. ComingSoon 스텁 대체.
 * 금액·날짜·내용·영역·제공기관·정산상태·영수증(signed URL). RLS 로 담당분만. 편집은 이번 스코프 밖(열람 전용).
 * 진입: org 원장(A1) 그룹 펼침 행 · 당사자별 장부.
 */
export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireStaff()

  const { data: usage } = await supabase
    .from('seoul_service_usages')
    .select('id, participant_id, amount, usage_date, description, settlement_status, domain_id, provider_id')
    .eq('id', id)
    .maybeSingle()

  if (!usage) notFound()

  const [{ data: participant }, domainRes, providerRes, receipt] = await Promise.all([
    supabase.from('participants').select('name').eq('id', usage.participant_id).maybeSingle(),
    usage.domain_id
      ? supabase.from('seoul_service_domains').select('label').eq('id', usage.domain_id).maybeSingle()
      : null,
    usage.provider_id
      ? supabase.from('seoul_service_providers').select('name').eq('id', usage.provider_id).maybeSingle()
      : null,
    getReceiptSignedUrl(id),
  ])

  const domainLabel = domainRes?.data?.label ?? null
  const providerName = providerRes?.data?.name ?? null
  const receiptUrl = receipt.url

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href="/supporter/transactions"
          aria-label="거래장부로 가기"
          className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight truncate">{participant?.name ?? '당사자'}님의 지출</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* 금액 히어로 */}
        <section className="p-6 rounded-3xl bg-zinc-900 text-white text-center">
          <p className="text-sm text-zinc-300">쓴 돈</p>
          <p className="text-4xl font-black mt-1">{won(Number(usage.amount))}</p>
          <span
            className={`inline-block mt-3 text-xs font-bold px-3 py-1 rounded-full ${settlementStyle(usage.settlement_status)}`}
          >
            {settlementLabel(usage.settlement_status)}
          </span>
        </section>

        {/* 메타 */}
        <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-3">
          <Meta label="내용" value={usage.description || '(내용 없음)'} />
          <Meta label="날짜" value={usage.usage_date} />
          {domainLabel && <Meta label="영역" value={domainLabel} />}
          {providerName && <Meta label="제공기관" value={providerName} />}
        </section>

        {/* 영수증 */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">영수증</h2>
          {receiptUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 동적 signed URL(1시간 만료) 영수증이라 next/image 최적화 부적합
            <img src={receiptUrl} alt="영수증 사진" className="w-full h-auto rounded-2xl ring-1 ring-zinc-200" />
          ) : (
            <p className="text-sm text-zinc-500 leading-relaxed p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-100">
              영수증이 없어요.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-zinc-400 font-medium">{label}</span>
      <span className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{value}</span>
    </div>
  )
}
