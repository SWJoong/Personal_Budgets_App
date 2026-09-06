import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * PageHeader — 상단바 프리미티브. 계약: src/components/ui/PageHeader.test.tsx.
 * sticky 상단바 ~51곳(h1 35 · 뒤로가기 18)을 표준화하되 skip-link 타깃은 건드리지 않는다:
 * PageHeader 는 <header>(banner)만 소유하고 id='main-content' 를 갖지 않는다
 * (skip-link 는 헤더를 건너뛰어 각 화면 <main id='main-content' tabIndex={-1}> 로 점프).
 */

export interface PageHeaderProps {
  title: string
  backHref?: string
  action?: ReactNode
}

export function PageHeader({ title, backHref, action }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-card px-4">
      {backHref && (
        <Link
          href={backHref}
          aria-label="뒤로 가기"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted-hover"
        >
          <span aria-hidden="true" className="text-xl">
            ←
          </span>
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-foreground">{title}</h1>
      {action != null && <div className="shrink-0">{action}</div>}
    </header>
  )
}
