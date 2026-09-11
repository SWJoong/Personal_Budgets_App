import Link from 'next/link'

/**
 * G1 관리자 대시보드 보강 — 상태카운트 + 빠른실행 그리드 (프리젠테이션).
 * 설계출처: Plan&Source/goala_admin_dashboard_G1_W.md.
 * 계약: src/app/(supporter)/admin/AdminDashboardCards.test.tsx (W 레인).
 *
 * props → JSX 만 하는 정적 컴포넌트(훅·async·데이터패칭 없음). 카운트 쿼리는
 * admin/page.tsx(서버)에서 하고 여기로 내려준다. 카드/타일 전체가 링크라
 * 링크의 접근성 이름에 라벨이, 텍스트에 카운트가 함께 들어간다(이모지는 aria-hidden).
 */

interface AdminDashboardCardsProps {
  name: string
  participantCount: number
  pending: { review: number; screening: number; planReview: number }
}

// 오늘 할 일 3카드 — 라벨·링크는 각 워크리스트 pending 필터와 정확히 일치해야 한다(설계 §상태 카운트).
const TODO_CARDS = [
  { key: 'review', href: '/supporter/review', emoji: '🧾', label: '검토 대기', hint: '영수증을 확인해요' },
  { key: 'screening', href: '/supporter/applications', emoji: '📝', label: '심사 대기', hint: '새 신청을 살펴봐요' },
  { key: 'planReview', href: '/supporter/plans', emoji: '📋', label: '심의 대기', hint: '이용계획을 살펴봐요' },
] as const

// 빠른 실행 8타일 — 무쿼리 링크만(설계 §빠른 실행 그리드).
const QUICK_LINKS = [
  { href: '/admin/participants/new', emoji: '➕', label: '당사자 등록' },
  { href: '/admin/participants', emoji: '👥', label: '당사자 관리' },
  { href: '/supporter/transactions', emoji: '📒', label: '거래장부' },
  { href: '/supporter/settlements', emoji: '🧮', label: '정산 원장' },
  { href: '/supporter/documents', emoji: '📁', label: '서류 보관함' },
  { href: '/supporter/network', emoji: '🕸️', label: '관계망' },
  { href: '/admin/invitations', emoji: '✉️', label: '사용자 초대' },
  { href: '/admin/settings', emoji: '⚙️', label: '시스템 설정' },
] as const

export default function AdminDashboardCards({ name, participantCount, pending }: AdminDashboardCardsProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 히어로 */}
      <section className="p-6 rounded-2xl bg-hero text-hero-foreground shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl" aria-hidden="true">👋</span>
          <h2 className="text-xl font-black leading-relaxed">안녕하세요, {name}님</h2>
        </div>
        <p className="text-sm text-hero-foreground/70 font-medium leading-relaxed">
          등록된 당사자 {participantCount}명을 서울형 개인예산제로 지원하고 있어요.
        </p>
      </section>

      {/* 오늘 할 일 — 상태 카운트 카드 3 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">오늘 할 일</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TODO_CARDS.map((card) => {
            const count = pending[card.key]
            const active = count > 0
            return (
              <Link
                key={card.key}
                href={card.href}
                className={`group flex flex-col gap-1 p-5 rounded-2xl shadow-sm transition-all active:scale-95 ${
                  active
                    ? 'bg-card ring-2 ring-primary hover:bg-muted-hover'
                    : 'bg-card ring-1 ring-border hover:ring-foreground'
                }`}
              >
                <div className="flex items-center justify-between min-h-7">
                  <span className="text-2xl" aria-hidden="true">{card.emoji}</span>
                  {active && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-primary text-primary-foreground">
                      확인 필요
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span
                    className={`text-4xl font-black tabular-nums ${active ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {count}
                  </span>
                  <span className="text-sm font-bold text-muted-foreground">건</span>
                </div>
                <span className={`text-base font-black ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {card.label}
                </span>
                <span className="text-xs text-muted-foreground font-medium leading-relaxed">{card.hint}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* 빠른 실행 — 무쿼리 링크 그리드 8 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">빠른 실행</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-card ring-1 ring-border hover:ring-foreground hover:bg-muted-hover transition-all shadow-sm active:scale-95"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform" aria-hidden="true">
                {link.emoji}
              </span>
              <span className="text-sm font-black text-foreground text-center leading-relaxed">{link.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
