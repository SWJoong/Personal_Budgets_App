import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import { getProviders } from '@/app/actions/serviceProvider'
import { buildProviderAssets, type UsageRow } from '@/utils/assetMap'
import SupporterMapClient from './MapClient'

/**
 * 지원자 자산 지도 — 예산 쓸 수 있는 장소(제공기관)를 영역별로. 설계: goala_asset_map_ux_W.md §6.
 * 영역 태그는 지출 이력(seoul_can_access 스코프)에서 파생(assetMap). providers 읽기는 전원 허용(RLS 04).
 */
export const metadata = { title: '지도' }

export default async function SupporterMapPage({ searchParams }: { searchParams: Promise<{ participant?: string }> }) {
  const { supabase } = await requireStaff()
  const { participant } = await searchParams

  // 당사자 허브에서 ?participant=pid 로 오면 그 당사자가 '쓴 곳'만(허브 컨텍스트 유지, 08 §8 ④).
  // 사이드바 '지도'는 파라미터 없이 = 전체 자산지도(쓸 수 있는 곳). RLS 가 담당범위로 스코프.
  const usageQuery = supabase.from('seoul_service_usages').select('provider_id, domain_id, amount')
  const [{ providers, error }, { data: usages }, { data: domains }] = await Promise.all([
    getProviders(),
    participant ? usageQuery.eq('participant_id', participant) : usageQuery,
    supabase.from('seoul_service_domains').select('id, label, sort_order').eq('program', 'seoul'),
  ])

  let scopedName: string | null = null
  if (participant) {
    const { data: sp } = await supabase.from('participants').select('name').eq('id', participant).maybeSingle()
    scopedName = (sp as { name: string | null } | null)?.name ?? null
  }

  const allMarkers = buildProviderAssets(providers, (usages ?? []) as UsageRow[])
  // 스코프 모드면 이 당사자가 실제로 쓴 곳(usageCount>0)만, 전체 모드면 모든 자산.
  const markers = participant ? allMarkers.filter((m) => m.usageCount > 0) : allMarkers
  const sortedDomains = [...(domains ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((d) => ({ id: d.id, label: d.label }))
  const domainLabelById = Object.fromEntries((domains ?? []).map((d) => [d.id, d.label]))

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href={participant ? `/supporter/participants/${participant}` : '/supporter'}
          aria-label="뒤로 가기"
          className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight truncate min-w-0">
          {participant ? `${scopedName ?? '이 당사자'}님 · 지출 위치` : '지도 · 쓸 수 있는 곳'}
        </h1>
        {participant && (
          <Link
            href="/supporter/map"
            className="ml-auto shrink-0 text-xs font-bold text-muted-foreground hover:text-foreground px-2 min-h-[44px] flex items-center whitespace-nowrap"
          >
            전체 지도
          </Link>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        {error ? (
          <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm">
            장소를 불러오지 못했어요: {error}
          </div>
        ) : (
          <SupporterMapClient
            apiKey={process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY || ''}
            markers={markers}
            domains={sortedDomains}
            domainLabelById={domainLabelById}
            emptyLabel={participant ? '아직 쓴 곳이 없어요.' : undefined}
          />
        )}
      </main>
    </div>
  )
}
