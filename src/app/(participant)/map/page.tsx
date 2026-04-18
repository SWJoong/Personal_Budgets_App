import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EasyTerm } from '@/components/ui/EasyTerm'
import ParticipantMapClient from './ParticipantMapClient'
import type { MapPlan } from '@/components/map/KakaoMap'
import { getSignedImageUrls } from '@/app/actions/storage'
import NavDropdown from '@/components/layout/NavDropdown'

export default async function ParticipantMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 거래 중 장소 정보 있는 것만 조회
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, activity_name, amount, date, status, place_name, place_lat, place_lng, activity_image_url, receipt_image_url')
    .eq('participant_id', user.id)
    .not('place_lat', 'is', null)
    .order('date', { ascending: false })
    .limit(200)

  // 계획 중 장소 정보 있는 것만 조회
  const { data: plansWithLocation } = await supabase
    .from('plans')
    .select('id, activity_name, place_name, place_lat, place_lng, date, options, selected_option_index')
    .eq('participant_id', user.id)
    .not('place_lat', 'is', null)
    .order('date', { ascending: false })
    .limit(100)

  // NEXT_PUBLIC_ prefix ensures the key is available client-side too
  const mapApiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY ?? ''

  const signedUrls = await getSignedImageUrls(
    (transactions || []).map((t: any) => ({
      id: t.id,
      receiptUrl: t.receipt_image_url ?? null,
      activityUrl: t.activity_image_url ?? null,
    }))
  )
  const mapTx = (transactions || []).map((t: any) => ({
    id: t.id,
    activity_name: t.activity_name,
    amount: t.amount,
    date: t.date,
    status: t.status,
    place_name: t.place_name,
    place_lat: t.place_lat,
    place_lng: t.place_lng,
    activity_image_url: signedUrls[t.id]?.activity ?? t.activity_image_url ?? null,
    receipt_image_url: signedUrls[t.id]?.receipt ?? t.receipt_image_url ?? null,
  }))

  const mapPlans: MapPlan[] = (plansWithLocation || []).map((p: any) => {
    const opts: any[] = p.options || []
    const idx = p.selected_option_index ?? 0
    const cost = opts[idx]?.cost ?? undefined
    return {
      id: p.id,
      activity_name: p.activity_name,
      place_name: p.place_name,
      place_lat: p.place_lat,
      place_lng: p.place_lng,
      date: p.date,
      cost,
    }
  })

  const totalLocations = mapTx.length + mapPlans.length

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-xl">←</Link>
          <h1 className="text-lg font-bold tracking-tight">
            <EasyTerm formal="사용 장소 지도" easy="어디서 썼나요?" />
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400">📍 {totalLocations}개 장소</span>
          <NavDropdown />
        </div>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4">
        {totalLocations === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-16">
            <span className="text-5xl">🗺️</span>
            <p className="text-base font-bold text-zinc-600">
              <EasyTerm formal="아직 장소 정보가 없어요" easy="아직 지도에 표시할 곳이 없어요" />
            </p>
            <p className="text-sm text-zinc-400">
              계획 세울 때 장소를 선택하거나, 선생님이 영수증을 기록할 때 장소를 추가하면 여기에 표시돼요.
            </p>
          </div>
        ) : (
          <ParticipantMapClient apiKey={mapApiKey} transactions={mapTx} plans={mapPlans} />
        )}
      </main>
    </div>
  )
}
