'use client'

import { useEffect, useState } from 'react'

/**
 * createPortal SSR 마운트 가드 — 서버 렌더에는 포털을 그리지 않고, 클라 마운트 후 true 로 바꾼다.
 * set-state-in-effect(마운트 1회 동기화)는 이 한 곳에서만 사유와 함께 허용하고, 사용처는 훅만 부른다.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- createPortal SSR 마운트 가드(마운트 1회)
    setMounted(true)
  }, [])
  return mounted
}
