/**
 * 실무자 영역 공통 로딩 스켈레톤 (Suspense fallback).
 *
 * Next.js loading.tsx 는 계층 상속된다 — 이 파일은 supporter/ 세그먼트 아래에서 자체 loading.tsx 가
 * 없는 모든 라우트의 로딩 화면이 된다: 실무자 대시보드(supporter/), 당사자별 상세 화면
 * (supporter/[participantId]/{assessment,budget-execution,checkup,network,report,sis,transactions,gallery}),
 * budgets/[id], map 등. (applications·plans·participants·evaluations·transactions 등은 각자
 * 더 가까운 loading.tsx 가 우선한다.)
 *
 * 데이터 무거운 상세·집계 화면이 렌더를 기다리는 동안 빈 화면 대신 즉시 스켈레톤을 보여준다.
 * 순수 표현(색만 시맨틱 토큰 + animate-pulse) — 행위·데이터·문구 없음. 헤더+본문 카드 형태는
 * 실무자 화면 공통 레이아웃(sticky h-16 헤더 + max-w-2xl 본문)을 따른다.
 */
export default function SupporterLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="h-6 w-6 rounded bg-muted animate-pulse" />
        <div className="ml-3 h-6 w-40 rounded-lg bg-muted animate-pulse" />
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* 상단 요약/정보 카드 skeleton */}
        <div className="p-5 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-3 animate-pulse">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>

        {/* 목록/섹션 카드 skeleton */}
        <section className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-card ring-1 ring-border flex items-center gap-4 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-5 w-1/3 rounded bg-muted" />
                <div className="h-4 w-2/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
