'use client'

import { useEffect, useRef, useCallback } from 'react'
import Script from 'next/script'
import { formatCurrency } from '@/utils/budget-visuals'

export interface MapTransaction {
  id: string
  activity_name: string
  amount: number
  date: string
  status: string
  place_name: string | null
  place_lat: number | null
  place_lng: number | null
  participant_name?: string
}

interface KakaoMapProps {
  apiKey: string
  transactions: MapTransaction[]
  height?: string
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#22c55e',
  pending: '#f97316',
}

export default function KakaoMap({ apiKey, transactions, height = '480px' }: KakaoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const markersRef = useRef<kakao.maps.Marker[]>([])
  const infoWindowRef = useRef<kakao.maps.InfoWindow | null>(null)

  const validTx = transactions.filter(
    (t) => t.place_lat !== null && t.place_lng !== null
  )

  const drawMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map || !window.kakao?.maps) return

    // 기존 마커 제거
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    if (validTx.length === 0) return

    const bounds = new kakao.maps.LatLngBounds()

    validTx.forEach((tx) => {
      const position = new kakao.maps.LatLng(tx.place_lat!, tx.place_lng!)
      bounds.extend(position)

      const marker = new kakao.maps.Marker({ position, map })
      markersRef.current.push(marker)

      const content = `
        <div style="
          padding:10px 14px;
          font-size:12px;
          line-height:1.6;
          max-width:220px;
          border-radius:10px;
          background:#fff;
          box-shadow:0 2px 8px rgba(0,0,0,.15);
          border-left:3px solid ${STATUS_COLOR[tx.status] ?? '#a1a1aa'};
        ">
          <b style="font-size:13px;color:#18181b;">${tx.activity_name}</b>
          ${tx.place_name && tx.place_name !== tx.activity_name ? `<br/><span style="color:#71717a;">${tx.place_name}</span>` : ''}
          <br/>
          <span style="color:#3f3f46;">${tx.date}</span>
          &nbsp;·&nbsp;
          <b style="color:#18181b;">${formatCurrency(tx.amount)}원</b>
          ${tx.participant_name ? `<br/><span style="color:#a1a1aa;font-size:11px;">${tx.participant_name}</span>` : ''}
        </div>
      `

      const infoWindow = new kakao.maps.InfoWindow({ content, removable: true })

      kakao.maps.event.addListener(marker, 'click', () => {
        infoWindowRef.current?.close()
        infoWindow.open(map, marker)
        infoWindowRef.current = infoWindow
      })
    })

    map.setBounds(bounds, 60, 60, 60, 60)
  }, [validTx])

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.kakao?.maps) return

    const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780) // 서울 기본
    const map = new kakao.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      level: 7,
    })
    mapRef.current = map
    drawMarkers()
  }, [drawMarkers])

  // 카카오 SDK 이미 로드된 경우 (페이지 이동 후 재진입)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.kakao?.maps) {
      window.kakao.maps.load(initMap)
    }
  }, [initMap])

  // transactions 변경 시 마커 재렌더
  useEffect(() => {
    if (mapRef.current) drawMarkers()
  }, [drawMarkers])

  return (
    <div className="relative w-full rounded-2xl overflow-hidden ring-1 ring-zinc-200">
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => window.kakao.maps.load(initMap)}
      />
      <div ref={mapContainerRef} style={{ width: '100%', height }} />
      {validTx.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50/90 gap-2">
          <span className="text-3xl">📍</span>
          <p className="text-sm font-bold text-zinc-500">장소 정보가 있는 거래가 없습니다.</p>
          <p className="text-xs text-zinc-400">거래 등록 시 장소를 검색하면 지도에 표시됩니다.</p>
        </div>
      )}
      {validTx.length > 0 && (
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-600 shadow-sm ring-1 ring-zinc-200">
          📍 {validTx.length}개 장소
        </div>
      )}
    </div>
  )
}
