'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

/**
 * 라이브 영역 프리미티브 (KRDS/KWCAG). 계약: src/components/ui/LiveRegion.test.tsx
 * 감사 결과 앱에 aria-live/status/alert 가 0건 → 폼 오류·저장 상태·OCR 진행이 스크린리더에 무음.
 * - Provider 는 polite(role=status)·assertive(role=alert) 영역을 **비어 있어도 상시 마운트**한다
 *   (동적 삽입을 보조기기가 읽으려면 영역이 announce 이전부터 DOM 에 있어야 한다).
 * - useToast().announce(msg, politeness='polite'): polite→status, assertive→alert.
 */

type Politeness = 'polite' | 'assertive'

interface ToastContextValue {
  announce: (message: string, politeness?: Politeness) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [politeMsg, setPoliteMsg] = useState('')
  const [assertiveMsg, setAssertiveMsg] = useState('')

  const announce = useCallback((message: string, politeness: Politeness = 'polite') => {
    if (politeness === 'assertive') setAssertiveMsg(message)
    else setPoliteMsg(message)
  }, [])

  return (
    <ToastContext.Provider value={{ announce }}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMsg}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMsg}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 는 <LiveRegionProvider> 안에서만 사용할 수 있어요.')
  return ctx
}
