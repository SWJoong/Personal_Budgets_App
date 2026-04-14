// 이 레이아웃은 상위 (supporter)/layout.tsx → SupporterLayoutClient에서
// 사이드바와 공통 레이아웃을 이미 제공하므로 children을 그대로 전달합니다.
export default function SupporterNestedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
