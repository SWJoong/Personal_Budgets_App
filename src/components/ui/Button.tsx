'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClasses, type ButtonVariant, type ButtonSize } from './buttonStyles'

/**
 * Button — 인터랙티브 컨트롤 프리미티브. 계약: src/components/ui/Button.test.tsx.
 * 손수 만든 primary ~39곳 + 승인/조건부/반려 3종을 표준화한다.
 * 터치44px·hover·disabled·focus-visible(전역)·비색큐 loading(스피너+글자)을 한 곳에 굽는다.
 * loading 은 aria-busy + 비대화(disabled) + 보이는 글자 라벨 유지 — 색/투명도 단독 상태표시 금지.
 * variant/size 토큰은 ./buttonStyles 공유(LinkButton 과 parity). 이 프리미티브는 <button> 전용.
 */

export type { ButtonVariant, ButtonSize }

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconOnly?: boolean
  children?: ReactNode
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
  return (
    <button
      type={type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${buttonClasses(variant, size, iconOnly)} disabled:bg-disabled-bg disabled:text-disabled-fg ${className}`.trim()}
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
