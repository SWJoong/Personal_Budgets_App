import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaceResult } from '@/app/actions/geocode'

vi.mock('@/app/actions/geocode', () => ({ searchPlaces: vi.fn() }))

import { searchPlaces } from '@/app/actions/geocode'
import { useReceiptPlace } from './useReceiptPlace'

const mockSearch = vi.mocked(searchPlaces)

function place(id: string, name: string, road = '서울 노원구 동일로 1234'): PlaceResult {
  return {
    id,
    place_name: name,
    road_address_name: road,
    address_name: '',
    category_name: '',
    lat: 37.65,
    lng: 127.06,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const CU = place('1', 'CU 노원역점')

beforeEach(() => {
  mockSearch.mockReset()
})

describe('useReceiptPlace', () => {
  it('처음에는 아무것도 보여 주지 않는다', () => {
    const { result } = renderHook(() => useReceiptPlace())
    expect(result.current.status).toBe('idle')
    expect(result.current.place).toBeNull()
  })

  it('찾으면 found 가 되고, 후보를 넉넉히(10개) 받아 온다', async () => {
    mockSearch.mockResolvedValue([CU])
    const { result } = renderHook(() => useReceiptPlace())

    await act(async () => {
      await result.current.detect({ store: 'CU 노원역점', address: null })
    })

    expect(result.current.status).toBe('found')
    expect(result.current.place?.id).toBe('1')
    expect(result.current.source).toBe('auto')
    expect(mockSearch).toHaveBeenCalledWith('CU 노원역점', 10)
  })

  it('찾는 동안은 searching, 직접 검색 칸에 넣을 상호를 기억해 둔다', async () => {
    const d = deferred<PlaceResult[]>()
    mockSearch.mockReturnValue(d.promise)
    const { result } = renderHook(() => useReceiptPlace())

    let detecting!: Promise<void>
    act(() => {
      detecting = result.current.detect({ store: 'CU 노원역점', address: null })
    })
    expect(result.current.status).toBe('searching')
    expect(result.current.hintName).toBe('CU 노원역점')

    await act(async () => {
      d.resolve([CU])
      await detecting
    })
    expect(result.current.status).toBe('found')
  })

  it('못 찾으면 notFound', async () => {
    mockSearch.mockResolvedValue([])
    const { result } = renderHook(() => useReceiptPlace())

    await act(async () => {
      await result.current.detect({ store: '카페 마리', address: '서울 노원구 동일로 1234' })
    })

    expect(result.current.status).toBe('notFound')
    expect(result.current.place).toBeNull()
  })

  it('상호도 주소도 못 읽었으면 검색 없이 notFound (직접 검색 칸)', async () => {
    const { result } = renderHook(() => useReceiptPlace())

    await act(async () => {
      await result.current.detect({ store: null, address: null })
    })

    expect(result.current.status).toBe('notFound')
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('검색이 오류로 실패해도 notFound 로 끝난다', async () => {
    mockSearch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useReceiptPlace())

    await act(async () => {
      await result.current.detect({ store: 'CU 노원역점', address: null })
    })

    expect(result.current.status).toBe('notFound')
  })

  it('찾는 도중 사진을 바꾸면(reset) 이전 결과를 버린다', async () => {
    const d = deferred<PlaceResult[]>()
    mockSearch.mockReturnValue(d.promise)
    const { result } = renderHook(() => useReceiptPlace())

    let detecting!: Promise<void>
    act(() => {
      detecting = result.current.detect({ store: 'CU 노원역점', address: null })
    })
    act(() => result.current.reset())

    await act(async () => {
      d.resolve([CU])
      await detecting
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.place).toBeNull()
  })

  it('영수증을 연달아 읽으면 마지막 영수증의 결과만 남는다', async () => {
    const first = deferred<PlaceResult[]>()
    const second = deferred<PlaceResult[]>()
    mockSearch.mockImplementation((query: string) =>
      query === 'A마트 노원점' ? first.promise : second.promise,
    )
    const { result } = renderHook(() => useReceiptPlace())

    let detectA!: Promise<void>
    let detectB!: Promise<void>
    act(() => {
      detectA = result.current.detect({ store: 'A마트 노원점', address: null })
    })
    act(() => {
      detectB = result.current.detect({ store: 'B마트 상계점', address: null })
    })

    await act(async () => {
      second.resolve([place('b', 'B마트 상계점')])
      await detectB
    })
    expect(result.current.place?.id).toBe('b')

    // 먼저 시작한 검색이 뒤늦게 끝나도 덮어쓰지 않는다
    await act(async () => {
      first.resolve([place('a', 'A마트 노원점')])
      await detectA
    })
    expect(result.current.place?.id).toBe('b')
  })

  it('못 찾은 뒤 직접 고르면 manual 로 found, 지우면 cleared', async () => {
    mockSearch.mockResolvedValue([])
    const { result } = renderHook(() => useReceiptPlace())
    await act(async () => {
      await result.current.detect({ store: '카페 마리', address: null })
    })
    expect(result.current.status).toBe('notFound')

    act(() => result.current.choose(place('9', '카페 마리 노원점')))
    expect(result.current.status).toBe('found')
    expect(result.current.source).toBe('manual')
    expect(result.current.place?.id).toBe('9')

    act(() => result.current.clear())
    expect(result.current.status).toBe('cleared')
    expect(result.current.place).toBeNull()
  })

  it('자동으로 찾는 도중 직접 고르면 직접 고른 장소를 지키고 자동 결과는 버린다', async () => {
    const d = deferred<PlaceResult[]>()
    mockSearch.mockReturnValue(d.promise)
    const { result } = renderHook(() => useReceiptPlace())

    let detecting!: Promise<void>
    act(() => {
      detecting = result.current.detect({ store: 'CU 노원역점', address: null })
    })
    act(() => result.current.choose(place('9', '내가 고른 곳')))

    await act(async () => {
      d.resolve([CU])
      await detecting
    })

    expect(result.current.place?.id).toBe('9')
    expect(result.current.source).toBe('manual')
  })
})
