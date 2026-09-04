import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * EmptyState — 빈 상태 프리미티브. 계약: src/components/ui/EmptyState.test.tsx.
 * '아직 …없어요' 문구 ~57개 + 시각 래퍼 ~14종(전체화면형 + 인라인 muted-card형)을 통일한다.
 * emoji 는 장식(aria-hidden) — 의미는 글자에. 가능하면 항상 다음 행동(G5)을 CTA 로 제시.
 */

export interface EmptyStateAction {
  label: string
  href: string
}

export interface EmptyStateProps {
  emoji?: string
  title: string
  description?: string
  action?: EmptyStateAction | ReactNode
  variant?: 'full' | 'inline'
}

function isActionObject(a: unknown): a is EmptyStateAction {
  return (
    typeof a === 'object' &&
    a !== null &&
    'label' in a &&
    'href' in a &&
    typeof (a as EmptyStateAction).label === 'string' &&
    typeof (a as EmptyStateAction).href === 'string'
  )
}

export function EmptyState({ emoji, title, description, action, variant = 'inline' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl bg-muted p-6 text-center ring-1 ring-border ${
        variant === 'full' ? 'min-h-[50vh] justify-center' : ''
      }`.trim()}
    >
      {emoji && (
        <span aria-hidden="true" className="text-3xl">
          {emoji}
        </span>
      )}
      <p className="font-bold text-foreground">{title}</p>
      {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {isActionObject(action) ? (
        <Link
          href={action.href}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground hover:bg-primary-hover"
        >
          {action.label}
        </Link>
      ) : (
        (action as ReactNode) ?? null
      )}
    </div>
  )
}
