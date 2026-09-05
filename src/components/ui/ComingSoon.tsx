import Link from 'next/link'

interface ComingSoonProps {
  title: string
  emoji?: string
  description?: string
  homeHref?: string
  homeLabel?: string
}

/**
 * 서울형 리빌딩 Phase 1 임시 화면. 이 라우트는 기존(PCP·복지부형) 테이블에
 * 의존하던 화면이라 새 DB 에서는 그대로 쓸 수 없어 잠시 비워둔다.
 * Phase 2~3 로드맵에서 서울형 테이블(seoul_utilization_plans·seoul_service_usages 등)
 * 기반으로 다시 만든다.
 */
export default function ComingSoon({
  title,
  emoji = '🚧',
  description,
  homeHref = '/',
  homeLabel = '홈으로 가기',
}: ComingSoonProps) {
  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href={homeHref}
          className="text-muted-foreground hover:text-foreground transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={homeLabel}
        >
          ←
        </Link>
        <h1 className="text-sm font-black text-foreground">{title}</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4 max-w-sm mx-auto">
        <span className="text-7xl" aria-hidden="true">{emoji}</span>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold tracking-tight leading-relaxed">준비하고 있어요</h2>
          <p className="text-muted-foreground font-medium leading-relaxed">
            {description ?? '이 화면은 아직 다 만들지 못했어요. 나중에 다시 열어 볼게요.'}
          </p>
        </div>
        <Link
          href={homeHref}
          className="mt-2 px-8 py-3 min-h-[44px] bg-hero text-hero-foreground rounded-xl font-bold hover:opacity-90 transition-colors"
        >
          {homeLabel}
        </Link>
      </main>
    </div>
  )
}
