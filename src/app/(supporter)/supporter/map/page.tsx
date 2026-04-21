import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { MapTransaction } from '@/components/map/KakaoMap'
import { getSignedImageUrls } from '@/app/actions/storage'
import AdminHelpButton from '@/components/help/AdminHelpButton'
import MapPageClient from './MapPageClient'

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    redirect('/')
  }

  let txQuery = supabase
    .from('transactions')
    .select('id, activity_name, amount, date, status, place_name, place_lat, place_lng, activity_image_url, receipt_image_url, participant:participants!transactions_participant_id_fkey ( name )')
    .not('place_lat', 'is', null)
    .order('date', { ascending: false })
    .limit(500)

  if (profile.role === 'supporter') {
    const { data: myParticipants } = await supabase
      .from('participants')
      .select('id')
      .eq('assigned_supporter_id', user.id)
    const ids = (myParticipants || []).map((p: any) => p.id)
    if (ids.length > 0) txQuery = txQuery.in('participant_id', ids)
  }

  const { data: locatedTx } = await txQuery

  const signedUrls = await getSignedImageUrls(
    (locatedTx || []).map((t: any) => ({
      id: t.id,
      receiptUrl: t.receipt_image_url ?? null,
      activityUrl: t.activity_image_url ?? null,
    }))
  )

  const mapTransactions: MapTransaction[] = (locatedTx || []).map((t: any) => ({
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
    participant_name: (t.participant as any)?.name,
  }))

  const mapApiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY ?? ''

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-4 sm:p-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">활동 지도</h1>
          <p className="text-zinc-500 mt-1 text-sm">장소 정보가 있는 거래 {mapTransactions.length}건을 지도에서 확인합니다.</p>
        </div>
        <AdminHelpButton pageKey="map" />
      </header>

      <main className="w-full max-w-6xl">
        <MapPageClient apiKey={mapApiKey} transactions={mapTransactions} />
      </main>
    </div>
  )
}
