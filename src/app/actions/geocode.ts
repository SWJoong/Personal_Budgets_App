'use server'

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
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey || !query.trim()) return []

  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      next: { revalidate: 0 },
    })

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
