import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlaceSearch from './PlaceSearch'
import type { PlaceResult } from '@/app/actions/geocode'

/**
 * P6 Phase C — touch44: PlaceSearch '변경' 버튼 (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §touch-label (contract touch-label.placesearch.change-touch)
 *
 * 선택된 장소가 있을 때 나타나는 '변경' 버튼은 텍스트 라벨은 green 이나
 * className 이 'px-2 py-1 text-xs'(~24px)라 44px 터치 영역 미달.
 * line90 '검색' 버튼은 이미 px-4 py-3(~44px) green(대상 아님).
 *
 * 렌더 게이트: 'use client'. 서버 액션 모듈(geocode)은 모킹하여 selectedPlace 분기만 렌더.
 * 단언: 터치 크기 클래스 문자열 존재. 렌더 px 아님.
 */
vi.mock('@/app/actions/geocode', () => ({
  searchPlaces: vi.fn(),
}))

const selectedPlace = {
  place_name: '교보문고 광화문점',
  road_address_name: '서울 종로구 종로 1',
  address_name: '서울 종로구 세종로',
} as unknown as PlaceResult

describe('P6-C touch44 — PlaceSearch 변경 버튼 (placesearch-change-touch)', () => {
  it("[RED] '변경' 버튼이 44px 터치 크기 클래스를 가진다", () => {
    render(
      <PlaceSearch
        onSelect={() => {}}
        onClear={() => {}}
        selectedPlace={selectedPlace}
      />,
    )
    const change = screen.getByRole('button', { name: '변경' })
    // RED: 현재 className 이 'px-2 py-1 text-xs' — 최소 터치 크기 클래스 없음
    expect(change.className).toMatch(/min-h-11|min-h-\[44px\]/)
  })
})
