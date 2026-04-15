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
  activity_image_url?: string | null
  receipt_image_url?: string | null
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

    // ── 거래 마커: 같은 장소 클러스터링 (toFixed(4) ≈ 11m 정밀도) ──
    const clusterMap = new Map<string, MapTransaction[]>()
    validTx.forEach((tx) => {
      const key = `${tx.place_lat!.toFixed(4)},${tx.place_lng!.toFixed(4)}`
      if (!clusterMap.has(key)) clusterMap.set(key, [])
      clusterMap.get(key)!.push(tx)
    })

    clusterMap.forEach((txGroup) => {
      const lat = txGroup[0].place_lat!
      const lng = txGroup[0].place_lng!
      const position = new kakao.maps.LatLng(lat, lng)
      bounds.extend(position)

      if (txGroup.length === 1) {
        // ── 단일 거래 마커 ──
        const tx = txGroup[0]
        const marker = new kakao.maps.Marker({ position, map })
        markersRef.current.push(marker)

        const thumbUrl = tx.activity_image_url || tx.receipt_image_url || null
        const thumbLabel = tx.activity_image_url ? '활동' : tx.receipt_image_url ? '영수증' : ''

        const content = `
          <div style="
            padding:0;
            font-size:12px;
            line-height:1.6;
            width:200px;
            border-radius:12px;
            background:#fff;
            box-shadow:0 2px 12px rgba(0,0,0,.18);
            overflow:hidden;
            border-top:3px solid ${STATUS_COLOR[tx.status] ?? '#a1a1aa'};
          ">
            ${thumbUrl ? `
            <div style="position:relative;width:100%;height:90px;overflow:hidden;background:#f4f4f5;">
              <img
                src="${thumbUrl}"
                alt="${thumbLabel}"
                style="width:100%;height:100%;object-fit:cover;"
                onerror="this.parentElement.style.display='none'"
                crossorigin="anonymous"
              />
              <span style="
                position:absolute;bottom:5px;left:6px;
                font-size:9px;font-weight:800;
                background:rgba(0,0,0,.45);color:#fff;
                padding:1px 5px;border-radius:4px;
              ">${thumbLabel} 사진</span>
            </div>` : ''}
            <div style="padding:10px 12px;">
              <b style="font-size:13px;color:#18181b;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tx.activity_name}</b>
              ${tx.place_name && tx.place_name !== tx.activity_name
                ? `<span style="font-size:11px;color:#71717a;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tx.place_name}</span>`
                : ''}
              <div style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="color:#52525b;font-size:11px;">${tx.date}</span>
                <b style="color:#18181b;font-size:12px;">${formatCurrency(tx.amount)}원</b>
              </div>
              ${tx.participant_name ? `<span style="color:#a1a1aa;font-size:10px;">${tx.participant_name}</span>` : ''}
            </div>
          </div>
        `

        const infoWindow = new kakao.maps.InfoWindow({ content, removable: true })
        kakao.maps.event.addListener(marker, 'click', () => {
          infoWindowRef.current?.close()
          infoWindow.open(map, marker)
          infoWindowRef.current = infoWindow
        })
      } else {
        // ── 클러스터 마커 (숫자 배지 포함 SVG 핀) ──
        const count = txGroup.length
        const clusterSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
  <ellipse cx="20" cy="46" rx="7" ry="2.5" fill="rgba(0,0,0,0.15)"/>
  <path d="M20 0C11.163 0 4 7.163 4 16c0 11.25 16 30 16 30S36 27.25 36 16C36 7.163 28.837 0 20 0z" fill="#3b82f6"/>
  <circle cx="20" cy="16" r="10" fill="white"/>
  <text x="20" y="20" font-size="${count >= 10 ? '9' : '11'}" text-anchor="middle" fill="#2563eb" font-family="sans-serif" font-weight="bold">${count}</text>
</svg>`)

        const clusterImage = new kakao.maps.MarkerImage(
          `data:image/svg+xml;charset=utf-8,${clusterSvg}`,
          new kakao.maps.Size(40, 48),
          { offset: new kakao.maps.Point(20, 48) }
        )

        const marker = new kakao.maps.Marker({ position, map, image: clusterImage })
        markersRef.current.push(marker)

        // 클러스터 InfoWindow — 모든 거래 목록 + 썸네일
        const totalAmt = txGroup.reduce((s, t) => s + t.amount, 0)
        const placeName = txGroup[0].place_name ?? txGroup[0].activity_name

        const rows = txGroup.map((tx) => {
          const thumb = tx.activity_image_url || tx.receipt_image_url || null
          return `
            <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f4f4f5;">
              ${thumb ? `
                <img src="${thumb}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0;"
                  onerror="this.style.display='none'" crossorigin="anonymous"/>
              ` : `<div style="width:36px;height:36px;border-radius:6px;background:#e4e4e7;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px;">🧾</div>`}
              <div style="flex:1;min-width:0;">
                <div style="font-size:11px;font-weight:800;color:#18181b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tx.activity_name}</div>
                <div style="font-size:10px;color:#71717a;">${tx.date}</div>
              </div>
              <b style="font-size:11px;color:#2563eb;white-space:nowrap;">${formatCurrency(tx.amount)}원</b>
            </div>`
        }).join('')

        const content = `
          <div style="
            font-size:12px;
            line-height:1.5;
            width:240px;
            border-radius:12px;
            background:#fff;
            box-shadow:0 2px 12px rgba(0,0,0,.18);
            overflow:hidden;
            border-top:4px solid #3b82f6;
          ">
            <div style="padding:10px 12px 6px;">
              <b style="font-size:13px;color:#18181b;">${placeName}</b>
              <span style="margin-left:6px;font-size:10px;font-weight:800;background:#eff6ff;color:#2563eb;padding:1px 6px;border-radius:4px;">${count}회 방문</span>
              <div style="font-size:11px;color:#52525b;margin-top:2px;">합계 <b style="color:#18181b;">${formatCurrency(totalAmt)}원</b></div>
            </div>
            <div style="max-height:200px;overflow-y:auto;padding:0 12px 8px;">${rows}</div>
          </div>
        `

        const infoWindow = new kakao.maps.InfoWindow({ content, removable: true })
        kakao.maps.event.addListener(marker, 'click', () => {
          infoWindowRef.current?.close()
          infoWindow.open(map, marker)
          infoWindowRef.current = infoWindow
        })
      }
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
