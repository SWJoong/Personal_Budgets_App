import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { getSisAssessments } from '@/app/actions/sisAssessment'
import SisAssessmentClient from './SisAssessmentClient'

/**
 * SIS-A 지원요구척도 기록 화면 (관리자 QA #9 부활) — 수행기관 담당자가 6개 하위척도 원점수를 적으면
 * 표준점수·지원요구지수·백분위를 계산해 기록한다. 채점 로직은 src/utils/sis-a.ts(생존).
 * 참여자 허브의 "욕구사정(영역)" 과는 별도 진입점 — 설계 Plan&Source/goala_sis_a_revival_W.md ④.
 */
export const metadata = { title: 'SIS-A 척도' }

export default async function SisPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  const { assessments } = await getSisAssessments(participantId)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center min-w-0">
          <Link
            href={`/supporter/participants/${participantId}`}
            aria-label="뒤로 가기"
            className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold tracking-tight truncate">
            {participant.name ?? '이름 없음'}님의 SIS-A 지원요구척도
          </h1>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <SisAssessmentClient participantId={participantId} assessments={assessments ?? []} />
      </main>
    </div>
  )
}
