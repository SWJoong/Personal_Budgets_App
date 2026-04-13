'use client'

import dynamic from 'next/dynamic'
import type { MapTransaction } from '@/components/map/KakaoMap'

const KakaoMap = dynamic(() => import('@/components/map/KakaoMap'), { ssr: false })

export default function ParticipantMapClient({
  apiKey,
  transactions,
}: {
  apiKey: string
  transactions: MapTransaction[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <KakaoMap apiKey={apiKey} transactions={transactions} height="calc(100dvh - 160px)" />

      {/* 범례 */}
      <div className="flex gap-4 px-1 text-xs font-bold text-zinc-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          확정된 거래
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          확인 대기 중
        </div>
      </div>
    </div>
  )
}
