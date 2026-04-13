import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EasyTerm } from '@/components/ui/EasyTerm'
import ParticipantMapClient from './ParticipantMapClient'

export default async function ParticipantMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 이 사용자의 거래 중 장소 정보가 있는 것만 조회
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, activity_name, amount, date, status, place_name, place_lat, place_lng')
    .eq('participant_id', user.id)
    .not('place_lat', 'is', null)
    .order('date', { ascending: false })
    .limit(200)

  const mapApiKey = process.env.KAKAO_MAP_API_KEY ?? ''

  const mapTx = (transactions || []).map((t: any) => ({
    id: t.id,
    activity_name: t.activity_name,
    amount: t.amount,
    date: t.date,
    status: t.status,
    place_name: t.place_name,
    place_lat: t.place_lat,
    place_lng: t.place_lng,
  }))

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-xl">←</Link>
          <h1 className="text-lg font-bold tracking-tight">
            <EasyTerm formal="사용 장소 지도" easy="어디서 썼나요?" />
          </h1>
        </div>
        <span className="text-xs font-bold text-zinc-400">📍 {mapTx.length}개 장소</span>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4">
        {mapTx.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-16">
            <span className="text-5xl">🗺️</span>
            <p className="text-base font-bold text-zinc-600">
              <EasyTerm formal="아직 장소 정보가 없어요" easy="아직 지도에 표시할 곳이 없어요" />
            </p>
            <p className="text-sm text-zinc-400">
              선생님이 영수증을 기록할 때 장소를 추가하면 여기에 표시돼요.
            </p>
          </div>
        ) : (
          <ParticipantMapClient apiKey={mapApiKey} transactions={mapTx} />
        )}
      </main>
    </div>
  )
}
