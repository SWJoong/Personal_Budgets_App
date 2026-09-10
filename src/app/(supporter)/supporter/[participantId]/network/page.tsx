import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { getNetworkEntities } from '@/app/actions/networkEntities'
import NetworkEditorClient from './NetworkEditorClient'

/**
 * 관계망 편집 화면 (Track B, B3) — 실무자가 당사자의 사회 관계망(가족/친구/유급지원/지역사회)을
 * CRUD 한다. 관계망(친밀도·고립 신호)은 사정성 정보라 RLS(supabase/seoul/13)가 실무자 전용으로 제한.
 * 설계출처: Plan&Source/goala_relationship_network_crud_W.md §2 B3.
 * ★읽기전용 분석 그래프(literal /supporter/network)와 별개인 참여자 스코프 라우트.
 */
export const metadata = { title: '관계망' }

export default async function NetworkPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  // 당사자 — RLS 가 담당범위 밖이면 행이 안 보인다 → notFound.
  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  const { entities } = await getNetworkEntities(participantId)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center min-w-0">
          <Link
            href="/supporter/participants"
            aria-label="뒤로 가기"
            className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold tracking-tight truncate">{participant.name ?? '이름 없음'}님의 관계망</h1>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <NetworkEditorClient participantId={participantId} entities={entities} />
      </main>
    </div>
  )
}
