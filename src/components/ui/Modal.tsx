'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMounted } from '@/hooks/useMounted'

/**
 * 접근성 대화상자 프리미티브 (KRDS/KWCAG). 계약: src/components/ui/Modal.test.tsx
 * - role=dialog · aria-modal=true · aria-label(label) · portal · Esc 닫기 · body scroll-lock
 * - ★핵심: 포커스 관리 — 열림 시 대화상자 안으로 이동, 열려 있는 동안 Tab 트랩, 닫힘 시 트리거로 복원.
 * 기존 NavDropdown 포털/마운트 가드 패턴(useMounted)을 따른다.
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}) {
  const mounted = useMounted()
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  // 포커스 이동(열림) + 복원(닫힘). dialog DOM 이 실제로 그려진 뒤(mounted) 동작해야 하므로 mounted 도 의존.
  useEffect(() => {
    if (!open || !mounted) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(first ?? dialog)?.focus()
    return () => {
      restoreRef.current?.focus?.()
    }
  }, [open, mounted])

  // body 스크롤 잠금
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Esc 닫기 + Tab 포커스 트랩(capture 로 기본 포커스 이동 전에 가로챈다).
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusables.length === 0) {
        e.preventDefault()
        dialog.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || active === dialog) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl outline-none"
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
