import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { getNeedsAssessments, getServiceDomains } from '@/app/actions/needsAssessment'
import AssessmentClient from './AssessmentClient'

/**
 * 욕구사정 화면 (GOAL축 B) — 수행기관 담당자가 당사자의 지원영역별 욕구를 적는다.
 * 사정(needs_assessment)은 분류축(사정→목표→예산→지출→평가)의 시작점이다.
 * 서울형(program='seoul')은 6개 대분류가 flat 이라 중분류 없이 대분류만 고른다.
 */
export default async function AssessmentPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  const [{ assessments }, { domains }] = await Promise.all([
    getNeedsAssessments(participantId),
    getServiceDomains('seoul'),
  ])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href="/supporter/participants"
          aria-label="뒤로 가기"
          className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight">{participant.name}님의 욕구사정</h1>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <AssessmentClient
          participantId={participantId}
          assessments={assessments ?? []}
          domains={domains ?? []}
        />
      </main>
    </div>
  )
}
