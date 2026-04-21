'use client'

import dynamic from 'next/dynamic'
import type { MapTransaction } from '@/components/map/KakaoMap'

const KakaoMap = dynamic(() => import('@/components/map/KakaoMap'), { ssr: false })

interface Props {
  apiKey: string
  transactions: MapTransaction[]
}

export default function MapPageClient({ apiKey, transactions }: Props) {
  return <KakaoMap apiKey={apiKey} transactions={transactions} height="calc(100vh - 200px)" />
}
