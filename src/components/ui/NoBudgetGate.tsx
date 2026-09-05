import Link from 'next/link'

/**
 * NoBudgetGate — '아직 예산 정보가 없어요' 게이트 공유 컴포넌트 (P7 웨이브3 A7·A8).
 * 계약: src/components/ui/NoBudgetGate.test.tsx · 설계: Plan&Source/goala_p7_emptystate_W.md §5.
 * 7파일에 중복되던 게이트 본문을 통일한다. 이모지는 장식(aria-hidden). 본문은 easy-read 표준
 * '담당 선생님에게 말해 주세요.'('말씀'→'말해' 단순화). title 로 예산없음/배정없음을 분기.
 */

export interface NoBudgetGateAction {
  label: string
  href: string
}

export interface NoBudgetGateProps {
  title: string
  emoji?: string
  body?: string
  action?: NoBudgetGateAction
  variant?: 'page' | 'inline'
}

export function NoBudgetGate({
  title,
  emoji,
  body = '담당 선생님에게 말해 주세요.',
  action,
  variant = 'inline',
}: NoBudgetGateProps) {
  const card = (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted p-8 text-center ring-1 ring-border">
      {emoji && (
        <span aria-hidden="true" className="text-6xl">
          {emoji}
        </span>
      )}
      <p className="text-lg font-bold text-foreground leading-relaxed">{title}</p>
      <p className="text-muted-foreground font-medium leading-relaxed">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-5 font-bold text-primary-foreground hover:bg-primary-hover transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )

  if (variant === 'page') {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 p-6 flex flex-col items-center justify-center max-w-sm mx-auto w-full"
      >
        {card}
      </main>
    )
  }
  return card
}
