'use client'

import { useEffect, useRef, useCallback } from 'react'
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

export interface MapPlan {
  id: string
  activity_name: string
  place_name: string
  place_lat: number
  place_lng: number
  date: string
  cost?: number
}

interface KakaoMapProps {
  apiKey: string
  transactions: MapTransaction[]
  plans?: MapPlan[]
  height?: string
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#22c55e',
  pending: '#f97316',
}

// 계획 핀용 인디고 원형 SVG 마커 이미지 (data URI)
const PLAN_MARKER_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <ellipse cx="16" cy="38" rx="6" ry="2" fill="rgba(0,0,0,0.15)"/>
  <path d="M16 0C9.373 0 4 5.373 4 12c0 9 12 26 12 26S28 21 28 12C28 5.373 22.627 0 16 0z" fill="#6366f1"/>
  <circle cx="16" cy="12" r="6" fill="white"/>
  <text x="16" y="16" font-size="8" text-anchor="middle" fill="#6366f1" font-family="sans-serif" font-weight="bold">📋</text>
</svg>`)

export default function KakaoMap({ apiKey, transactions, plans = [], height = '480px' }: KakaoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const markersRef = useRef<kakao.maps.Marker[]>([])
  const infoWindowRef = useRef<kakao.maps.InfoWindow | null>(null)

  const validTx = transactions.filter(
    (t) => t.place_lat !== null && t.place_lng !== null
  )
  const validPlans = plans.filter((p) => p.place_lat && p.place_lng)

  const drawMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map || !window.kakao?.maps) return

    // 기존 마커 제거
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    const hasAny = validTx.length > 0 || validPlans.length > 0
    if (!hasAny) return

    const bounds = new kakao.maps.LatLngBounds()

    // 거래 마커 (기존)
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

    // 계획 마커 (신규 — 인디고 핀)
    const planMarkerImage = new kakao.maps.MarkerImage(
      `data:image/svg+xml;charset=utf-8,${PLAN_MARKER_SVG}`,
      new kakao.maps.Size(32, 40),
      { offset: new kakao.maps.Point(16, 40) }
    )

    validPlans.forEach((plan) => {
      const position = new kakao.maps.LatLng(plan.place_lat, plan.place_lng)
      bounds.extend(position)

      const marker = new kakao.maps.Marker({ position, map, image: planMarkerImage })
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
          border-left:3px solid #6366f1;
        ">
          <span style="font-size:10px;font-weight:bold;color:#6366f1;background:#eef2ff;padding:2px 6px;border-radius:4px;">📋 계획</span>
          <br/>
          <b style="font-size:13px;color:#18181b;">${plan.activity_name}</b>
          <br/><span style="color:#71717a;">${plan.place_name}</span>
          <br/>
          <span style="color:#3f3f46;">${plan.date}</span>
          ${plan.cost ? `&nbsp;·&nbsp;<b style="color:#6366f1;">${formatCurrency(plan.cost)}원 예상</b>` : ''}
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
  }, [validTx, validPlans])

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

  // SDK 로드 및 지도 초기화 (중복 로드 방지)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any

    function onSDKLoad() {
      if (!w.kakao?.maps) return
      w.kakao.maps.load(initMap)
    }

    // 이미 초기화된 경우
    if (w.kakao?.maps) {
      w.kakao.maps.load(initMap)
      return
    }

    const key = apiKey || process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY
    if (!key) return

    // kakao-map-sdk-services 스크립트가 이미 있으면 그 로드 이벤트 재사용
    const servicesScript = document.getElementById('kakao-map-sdk-services')
    if (servicesScript) {
      if (w.kakao) {
        onSDKLoad()
      } else {
        servicesScript.addEventListener('load', onSDKLoad, { once: true })
      }
      return
    }

    // 기존 기본 SDK 스크립트가 이미 있으면 재사용
    const existingScript = document.getElementById('kakao-map-sdk')
    if (existingScript) {
      if (w.kakao) {
        onSDKLoad()
      } else {
        existingScript.addEventListener('load', onSDKLoad, { once: true })
      }
      return
    }

    // 새로 로드
    const script = document.createElement('script')
    script.id = 'kakao-map-sdk'
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`
    script.onload = onSDKLoad
    document.head.appendChild(script)
  }, [apiKey, initMap])

  // transactions 변경 시 마커 재렌더
  useEffect(() => {
    if (mapRef.current) drawMarkers()
  }, [drawMarkers])

  return (
    <div className="relative w-full rounded-2xl overflow-hidden ring-1 ring-zinc-200">
      <div ref={mapContainerRef} style={{ width: '100%', height }} />
      {validTx.length === 0 && validPlans.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50/90 gap-2">
          <span className="text-3xl">📍</span>
          <p className="text-sm font-bold text-zinc-500">장소 정보가 있는 내역이 없습니다.</p>
          <p className="text-xs text-zinc-400">계획 세울 때 장소를 검색하면 지도에 표시됩니다.</p>
        </div>
      )}
      {(validTx.length > 0 || validPlans.length > 0) && (
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-600 shadow-sm ring-1 ring-zinc-200">
          📍 {validTx.length + validPlans.length}개 장소
        </div>
      )}
    </div>
  )
}
