'use server'

import { withTiming } from '@/utils/api-logger'

export interface PlaceResult {
  id: string
  place_name: string
  address_name: string
  road_address_name: string
  category_name: string
  lat: number
  lng: number
}

/**
 * 카카오 로컬 검색 API로 장소를 검색합니다.
 * 서버 액션 — KAKAO_REST_API_KEY (서버 전용, 클라이언트 미노출)
 *
 * @param size 가져올 후보 수 (기본 5, 카카오 최대 15). 영수증 장소 자동 찾기는 후보를 더 받아 주소로 고른다.
 */
export async function searchPlaces(query: string, size = 5): Promise<PlaceResult[]> {
  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey || !query.trim()) return []

  const count = Number.isInteger(size) ? Math.min(15, Math.max(1, size)) : 5

  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=${count}`
    const res = await withTiming('Kakao LocalSearch', () => fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      next: { revalidate: 0 },
    }))

    if (!res.ok) {
      console.error('Kakao Local Search error:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    return (data.documents ?? []).map((doc: any) => ({
      id: doc.id,
      place_name: doc.place_name,
      address_name: doc.address_name,
      road_address_name: doc.road_address_name,
      category_name: doc.category_name,
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
    }))
  } catch (e) {
    console.error('searchPlaces failed:', e)
    return []
  }
}
