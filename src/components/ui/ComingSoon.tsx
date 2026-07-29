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
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href={homeHref}
          className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={homeLabel}
        >
          ←
        </Link>
        <h1 className="text-sm font-black text-zinc-800">{title}</h1>
      </header>
      <main className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4 max-w-sm mx-auto">
        <span className="text-7xl" aria-hidden="true">{emoji}</span>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold tracking-tight leading-relaxed">준비하고 있어요</h2>
          <p className="text-zinc-500 font-medium leading-relaxed">
            {description ?? '이 화면은 곧 새로운 모습으로 다시 찾아와요. 조금만 기다려 주세요.'}
          </p>
        </div>
        <Link
          href={homeHref}
          className="mt-2 px-8 py-3 min-h-[44px] bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition-colors"
        >
          {homeLabel}
        </Link>
      </main>
    </div>
  )
}
