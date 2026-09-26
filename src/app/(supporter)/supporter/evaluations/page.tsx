import { requireStaff } from '@/utils/supabase/staff'
import { EmptyState } from '@/components/ui/EmptyState'
import { periodInKST } from '@/utils/evaluation'
import EvaluationsAccordionClient, { type EvaluationParticipantRow } from './EvaluationsAccordionClient'

/**
 * 계획·평가 — 당사자별로 펼쳐서 이번 달 평가(예산 사용·계획 항목별 이행도·당사자 평가 대필·종합 소견)를
 * 바로 작성한다(사용자 요청 2026-09-25). 설계: supabase/seoul/20_evaluations.sql.
 * 모니터링·정산 전체 타임라인은 상세(evaluations/[participantId])에서 본다.
 */
export const metadata = { title: '계획과 평가' }

/** 오늘이 속한 한국 달 — 렌더 본문에서 new Date() 를 직접 부르지 않도록 모듈 헬퍼로 둔다(react-compiler). */
function currentPeriod(): string {
  return periodInKST(new Date())
}

export default async function EvaluationsPage() {
  const { supabase } = await requireStaff()

  const [{ data: participants, error }, { data: evaluations }] = await Promise.all([
    supabase.from('participants').select('id, name').order('name', { ascending: true }),
    // 당사자별 최근 평가 달 — 당사자당 1행 뷰(전 평가 행을 읽으면 max_rows 에 잘림). RLS 는 뷰에도 적용
    // (security_invoker). 뷰가 아직 없으면(20 미적용) data=null → '평가 없음'으로 무해 폴백.
    supabase.from('v_seoul_latest_evaluation').select('participant_id, period'),
  ])

  const latestByParticipant = new Map<string, string>(
    (evaluations ?? []).map((e) => [e.participant_id as string, e.period as string]),
  )

  const rows: EvaluationParticipantRow[] = (participants ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? '이름 없음',
    latestPeriod: latestByParticipant.get(p.id) ?? null,
  }))

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">계획과 평가</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-3">
        {error && (
          <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm">
            목록을 불러오지 못했어요: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState title="아직 등록된 당사자가 없어요." action={{ label: '당사자 보러 가기', href: '/supporter/participants' }} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              당사자 이름을 누르면 펼쳐져요. 달마다 예산 사용, 계획 이행 정도, 당사자의 평가를 적을 수 있어요.
            </p>
            <EvaluationsAccordionClient participants={rows} defaultPeriod={currentPeriod()} />
          </>
        )}
      </main>
    </div>
  )
}
