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

export default async function SupporterMapPage() {
  const { supabase } = await requireStaff()

  const [{ providers, error }, { data: usages }, { data: domains }] = await Promise.all([
    getProviders(),
    supabase.from('seoul_service_usages').select('provider_id, domain_id, amount'),
    supabase.from('seoul_service_domains').select('id, label, sort_order').eq('program', 'seoul'),
  ])

  const markers = buildProviderAssets(providers, (usages ?? []) as UsageRow[])
  const sortedDomains = [...(domains ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((d) => ({ id: d.id, label: d.label }))
  const domainLabelById = Object.fromEntries((domains ?? []).map((d) => [d.id, d.label]))

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href="/supporter"
          aria-label="뒤로 가기"
          className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight">지도 · 쓸 수 있는 곳</h1>
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
          />
        )}
      </main>
    </div>
  )
}
