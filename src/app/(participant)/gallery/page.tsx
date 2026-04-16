import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EasyTerm } from '@/components/ui/EasyTerm'
import GalleryClient from './GalleryClient'
import { getSignedImageUrls } from '@/app/actions/storage'

function getRecentMonths(count: number) {
  const months = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    months.push({ value, label })
  }
  return months
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const months = getRecentMonths(6)
  const currentMonth = params.month || months[0].value

  // 해당 월의 시작/끝 날짜 계산
  const [year, month] = currentMonth.split('-').map(Number)
  const startDate = `${currentMonth}-01`
  const nextMonthDate = new Date(year, month, 1) // month is 1-based so this gives next month day 1
  const endDate = nextMonthDate.toISOString().split('T')[0]

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, activity_name, date, amount, receipt_image_url, activity_image_url, category')
    .eq('participant_id', user.id)
    .gte('date', startDate)
    .lt('date', endDate)
    .or('receipt_image_url.not.is.null,activity_image_url.not.is.null')
    .order('date', { ascending: false })

  const rawItems = (transactions || []).filter(
    (t: any) => t.receipt_image_url || t.activity_image_url
  )
  const signedUrls = await getSignedImageUrls(
    rawItems.map((t: any) => ({
      id: t.id,
      receiptUrl: t.receipt_image_url ?? null,
      activityUrl: t.activity_image_url ?? null,
    }))
  )
  const items = rawItems.map((t: any) => ({
    id: t.id,
    activity_name: t.activity_name,
    date: t.date,
    amount: t.amount,
    receipt_image_url: signedUrls[t.id]?.receipt ?? t.receipt_image_url,
    activity_image_url: signedUrls[t.id]?.activity ?? t.activity_image_url,
    category: t.category,
  }))

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/more" className="text-zinc-400 hover:text-zinc-600 transition-colors text-xl">←</Link>
          <h1 className="text-lg font-bold tracking-tight">
            <EasyTerm formal="사진 모아보기" easy="내 사진들 보기" />
          </h1>
        </div>
      </header>

      <GalleryClient items={items} currentMonth={currentMonth} months={months} />
    </div>
  )
}
