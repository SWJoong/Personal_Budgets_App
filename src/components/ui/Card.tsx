import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Card — 토큰 표면 프리미티브. 계약: src/components/ui/Card.test.tsx.
 * `bg-white ring-1 ring-zinc-200` 표면 블록 ~84곳 + 오류배너(bg-red-50 …) 23회 +
 * none-state(bg-zinc-50)·hero 반전·틴티드 콜아웃을 표준화한다. 반경/heading 슬롯 통일.
 * 색은 전부 P2 시맨틱 토큰 — 컴포넌트 안에서 다크/고대비 분기 금지(html.* 가 토큰만 교체).
 */

export type CardVariant =
  | 'default'
  | 'muted'
  | 'hero'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'neutral'

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'section' | 'article' | 'div'
  variant?: CardVariant
  title?: ReactNode
  headingLevel?: 2 | 3
  children: ReactNode
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: 'bg-card ring-1 ring-border',
  muted: 'bg-muted ring-1 ring-border',
  hero: 'bg-hero text-hero-foreground',
  success: 'bg-success-bg text-success-fg ring-1 ring-success-fg/20',
  info: 'bg-info-bg text-info-fg ring-1 ring-info-fg/20',
  warning: 'bg-warning-bg text-warning-fg ring-1 ring-warning-fg/20',
  danger: 'bg-danger-bg text-danger-fg ring-1 ring-danger-fg/20',
  neutral: 'bg-neutral-bg text-neutral-fg ring-1 ring-neutral-fg/20',
}

export function Card({
  as = 'section',
  variant = 'default',
  title,
  headingLevel = 2,
  children,
  className = '',
  ...rest
}: CardProps) {
  const Tag = as
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  return (
    <Tag className={`rounded-2xl p-4 ${VARIANT_CLASS[variant]} ${className}`.trim()} {...rest}>
      {title != null && <Heading className="mb-2 text-base font-bold">{title}</Heading>}
      {children}
    </Tag>
  )
}
