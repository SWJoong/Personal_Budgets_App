'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Button — 인터랙티브 컨트롤 프리미티브. 계약: src/components/ui/Button.test.tsx.
 * 손수 만든 primary ~39곳 + 승인/조건부/반려 3종을 표준화한다.
 * 터치44px·hover·disabled·focus-visible(전역)·비색큐 loading(스피너+글자)을 한 곳에 굽는다.
 * loading 은 aria-busy + 비대화(disabled) + 보이는 글자 라벨 유지 — 색/투명도 단독 상태표시 금지.
 * next/link 형태 액션은 형제 컴포넌트로(이 프리미티브는 <button> 전용).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'positive' | 'warning'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconOnly?: boolean
  children?: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-card text-foreground ring-1 ring-border hover:bg-muted',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
  danger: 'bg-danger text-primary-foreground hover:opacity-90',
  positive: 'bg-positive text-primary-foreground hover:opacity-90',
  warning: 'bg-warning text-primary-foreground hover:opacity-90',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3 text-sm',
  md: 'min-h-[44px] px-4 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconOnly = false,
  disabled,
  type,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  const sizeClass = iconOnly ? 'min-h-[44px] min-w-[44px] px-0' : SIZE_CLASS[size]
  return (
    <button
      type={type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:opacity-50 ${sizeClass} ${VARIANT_CLASS[variant]} ${className}`.trim()}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
