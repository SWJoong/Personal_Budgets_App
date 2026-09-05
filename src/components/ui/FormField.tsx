'use client'

import type { ReactNode } from 'react'

/**
 * 폼 필드 접근성 프리미티브 (KRDS/KWCAG). 계약: src/components/ui/FormField.test.tsx
 * 감사 결과 주 플로우(ReceiptClient 등)에 label 연결·aria-invalid·aria-describedby·required 시맨틱이 0건.
 * render-prop 로 임의 컨트롤을 감싼다:
 *   <FormField id label required error help>{(field) => <input {...field} />}</FormField>
 * - 보이는 <label htmlFor> 항상 렌더(플레이스홀더로 대체 금지)
 * - required → aria-required, error → aria-invalid + role=alert 오류문 + aria-describedby 연결
 * - help → aria-describedby 연결(오류와 공존 시 둘 다)
 */

export interface FieldProps {
  id: string
  'aria-required'?: 'true'
  'aria-invalid'?: 'true'
  'aria-describedby'?: string
}

export function FormField({
  id,
  label,
  required = false,
  error,
  help,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  help?: string
  children: (field: FieldProps) => ReactNode
}) {
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedby = [helpId, errorId].filter(Boolean).join(' ') || undefined

  const field: FieldProps = {
    id,
    ...(required ? { 'aria-required': 'true' } : {}),
    ...(error ? { 'aria-invalid': 'true' } : {}),
    ...(describedby ? { 'aria-describedby': describedby } : {}),
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-muted-foreground">
        {label}
        {required && (
          <span className="text-danger-fg" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      {children(field)}
      {help && (
        <p id={helpId} className="text-xs text-muted-foreground leading-relaxed">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-bold text-danger-fg leading-relaxed">
          {error}
        </p>
      )}
    </div>
  )
}
