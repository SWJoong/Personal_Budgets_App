import Link from 'next/link'

// 담당자 대시보드의 "자주 쓰는 기능" 바로가기. 일상 핵심 작업(영수증 검토·거래장부·정산·서류함·
// 이용계획·평가·지도·관계망)이 그동안 햄버거 메뉴에만 있던 것을 대시보드에 노출한다(F3 QA 발견).
// 라벨·href 는 AdminSidebar 메뉴와 동일 라우트를 가리키되, 대시보드 카드용 짧은 라벨로 정리했다.
// 표현 전용 컴포넌트('use client'·훅 없음) — 서버 컴포넌트 page.tsx 가 그대로 렌더한다.
type QuickTask = {
  href: string
  emoji: string
  label: string
  desc: string
}

const tasks: QuickTask[] = [
  { href: '/supporter/review',       emoji: '🧾', label: '영수증 검토',   desc: '당사자가 올린 지출을 확인해요' },
  { href: '/supporter/transactions', emoji: '📒', label: '거래장부',     desc: '돈이 오간 내역을 봐요' },
  { href: '/supporter/settlements',  emoji: '💰', label: '정산 원장',     desc: '예산과 정산을 관리해요' },
  { href: '/supporter/documents',    emoji: '📁', label: '서류 보관함',   desc: '증빙 서류를 모아 봐요' },
  { href: '/supporter/plans',        emoji: '🎯', label: '이용계획·심의', desc: '이용계획을 세우고 심의해요' },
  { href: '/supporter/evaluations',  emoji: '📋', label: '계획·평가',     desc: '계획과 평가를 기록해요' },
  { href: '/supporter/map',          emoji: '🗺️', label: '지도',         desc: '쓸 수 있는 곳을 찾아요' },
  { href: '/supporter/network',      emoji: '🕸️', label: '관계망',       desc: '당사자 관계망을 봐요' },
]

export default function SupporterQuickTasks() {
  return (
    <section aria-labelledby="supporter-quick-tasks" className="flex flex-col gap-3">
      <h2 id="supporter-quick-tasks" className="text-lg font-bold tracking-tight">자주 쓰는 기능</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tasks.map((task) => (
          <Link
            key={task.href}
            href={task.href}
            className="flex flex-col gap-1 min-h-[44px] p-4 rounded-2xl bg-card text-foreground ring-1 ring-border hover:bg-muted-hover transition-all active:scale-[0.98]"
          >
            <span aria-hidden="true" className="text-2xl">{task.emoji}</span>
            <span className="font-bold text-sm">{task.label}</span>
            <span className="text-xs text-muted-foreground leading-relaxed">{task.desc}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
