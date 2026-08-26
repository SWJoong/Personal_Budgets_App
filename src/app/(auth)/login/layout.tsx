import type { ReactNode } from 'react'

export const metadata = { title: '로그인' }

// 클라이언트 page.tsx 는 metadata 를 export 할 수 없어, 제목만 지정하는 서버 layout 을 둔다(KWCAG 2.4.2).
export default function TitleLayout({ children }: { children: ReactNode }) {
  return children
}
