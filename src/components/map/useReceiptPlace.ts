'use client'

import { useCallback, useRef, useState } from 'react'
import { searchPlaces } from '@/app/actions/geocode'
import type { PlaceResult } from '@/app/actions/geocode'
import { findReceiptPlace, type ReceiptPlaceInput } from '@/utils/receiptOcr/findReceiptPlace'

/**
 * idle      아직 영수증을 읽지 않았거나 읽기에 실패했어요 (아무것도 보이지 않음)
 * searching 상호·주소로 장소를 찾는 중
 * found     장소가 정해졌어요 (자동으로 찾았거나 직접 골랐어요)
 * notFound  자동으로 못 찾았어요 → 직접 검색 칸을 보여 줘요
 * cleared   사용자가 장소를 지웠어요 → 직접 검색 칸만 보여 줘요
 */
export type ReceiptPlaceStatus = 'idle' | 'searching' | 'found' | 'notFound' | 'cleared'
export type ReceiptPlaceSource = 'auto' | 'manual'

/** 자동 찾기에서는 후보를 넉넉히 받아 영수증 주소와 가장 가까운 곳을 고른다. */
const DETECT_RESULT_SIZE = 10

/**
 * 영수증 장소 자동 찾기 상태. 영수증 입력 화면(`/receipt`)과 홈 화면 창이 같이 쓴다.
 * 사진을 새로 고르거나 지우면 `reset()`, 글자 읽기가 끝나면 `detect()` 를 부른다.
 * 찾는 도중에 다른 사진을 골라도 이전 결과가 새 화면을 덮어쓰지 않는다.
 */
export function useReceiptPlace() {
  const [place, setPlace] = useState<PlaceResult | null>(null)
  const [source, setSource] = useState<ReceiptPlaceSource>('auto')
  const [status, setStatus] = useState<ReceiptPlaceStatus>('idle')
  // 직접 검색 칸에 미리 넣어 줄 상호
  const [hintName, setHintName] = useState('')
  const requestRef = useRef(0)

  const reset = useCallback(() => {
    requestRef.current += 1
    setPlace(null)
    setSource('auto')
    setStatus('idle')
    setHintName('')
  }, [])

  const detect = useCallback(async (input: ReceiptPlaceInput) => {
    const requestId = ++requestRef.current
    setPlace(null)
    setSource('auto')
    setHintName(input.store ?? '')
    setStatus('searching')

    let found: PlaceResult | null = null
    try {
      found = await findReceiptPlace(input, (query) => searchPlaces(query, DETECT_RESULT_SIZE))
    } catch (error) {
      console.error('장소 자동 찾기 실패:', error)
    }

    // 그 사이에 다른 사진을 골랐거나, 장소를 직접 고르거나 지웠으면 이 결과는 버린다
    if (requestRef.current !== requestId) return
    setPlace(found)
    setStatus(found ? 'found' : 'notFound')
  }, [])

  /** 직접 검색해서 고른 장소. */
  const choose = useCallback((picked: PlaceResult) => {
    requestRef.current += 1
    setPlace(picked)
    setSource('manual')
    setStatus('found')
  }, [])

  /** 장소 지우기. */
  const clear = useCallback(() => {
    requestRef.current += 1
    setPlace(null)
    setStatus('cleared')
  }, [])

  return { place, source, status, hintName, detect, choose, clear, reset }
}
