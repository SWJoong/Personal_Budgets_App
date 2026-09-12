import ParticipantFab from '@/components/layout/ParticipantFab'
import { TabBar } from '@/components/layout/TabBar'
import { ViewAsBanner } from '@/components/layout/ViewAsBanner'
import SuperAdminSwitcherClientGate from '@/components/layout/SuperAdminSwitcherClientGate'

// ★이 레이아웃은 '동기 서버 컴포넌트'로 유지한다(layout.test.tsx jsdom 통합 렌더 계약). 그래서
// 슈퍼관리자 판정은 서버 await 가 아니라 클라 게이트(SuperAdminSwitcherClientGate)가 담당한다.
export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // 모바일: full-width / 태블릿·데스크탑: 중앙 정렬 "앱 프레임"
    <div className="min-h-dvh bg-muted/60 lg:flex lg:justify-center lg:items-start">
      <div className="participant-view w-full lg:max-w-[600px] min-h-dvh bg-background flex flex-col pb-20 lg:shadow-[0_0_60px_-12px_rgba(0,0,0,0.18)]">
        {/* 슈퍼관리자면 우측 상단에 역할 화면 전환기(아니면 null) — 클라 세션으로 판정. */}
        <SuperAdminSwitcherClientGate />
        {/* 관리자 둘러보기(view-as) 배너 — 미리보기 중일 때만 자체적으로 렌더된다(아니면 null). */}
        <ViewAsBanner />
        {children}
        {/* 하단 상시 탐색(TabBar 4탭) + 주 액션 FAB 공존(P4) — FAB 는 TabBar 위에 배치. */}
        <ParticipantFab />
        <TabBar />
      </div>
    </div>
  )
}
