import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import { type MapTransaction } from '@/components/map/KakaoMap'
import { getDiscoveryAssets } from '@/app/actions/serviceProvider'
import MapTabsClient from './MapTabsClient'

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const participant = await getCurrentParticipant()

  if (!participant) {
    return (
      <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
        <header className="flex h-14 items-center px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
          <h1 className="text-sm font-black text-zinc-800">사용 장소 지도</h1>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
          <span className="text-6xl">🗺️</span>
          <p className="text-zinc-500 font-medium leading-relaxed">아직 예산 정보가 없어요.<br />담당 선생님에게 말씀해 주세요.</p>
        </main>
      </div>
    )
  }

  const { data: usages } = await supabase
    .from('seoul_service_usages')
    .select('id, usage_date, amount, description, settlement_status, provider_id')
    .eq('participant_id', participant.id)
    .not('provider_id', 'is', null)

  const providerIds = [...new Set((usages ?? []).map((u) => u.provider_id).filter((id): id is string => !!id))]
  const { data: providers } = providerIds.length
    ? await supabase.from('seoul_service_providers').select('id, name, lat, lng').in('id', providerIds)
    : { data: [] as { id: string; name: string; lat: number | null; lng: number | null }[] }

  const providerById = new Map((providers ?? []).map((p) => [p.id, p]))

  const transactions: MapTransaction[] = (usages ?? [])
    .map((u) => {
      const provider = u.provider_id ? providerById.get(u.provider_id) : null
      return {
        id: u.id,
        activity_name: u.description ?? '활동',
        amount: u.amount,
        date: u.usage_date,
        status: u.settlement_status === 'accepted' ? 'confirmed' : 'pending',
        place_name: provider?.name ?? null,
        place_lat: provider?.lat ?? null,
        place_lng: provider?.lng ?? null,
      }
    })
    .filter((t) => t.place_lat !== null && t.place_lng !== null)

  // 쓸 수 있는 곳(발견) — 전역 RPC. 함수 미배포 시 error 폴백(지도는 '내가 쓴 곳' 탭으로 계속 동작).
  const discovery = await getDiscoveryAssets()

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="홈으로 가기">
          ←
        </Link>
        <h1 className="text-sm font-black text-zinc-800">사용 장소 지도</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 max-w-sm mx-auto w-full">
        <MapTabsClient
          apiKey={process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY || ''}
          transactions={transactions}
          discoveryMarkers={discovery.markers}
          domains={discovery.domains}
          domainLabelById={discovery.domainLabelById}
          discoveryError={discovery.error}
        />
      </main>
    </div>
  )
}
