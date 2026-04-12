import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EvaluationForm from '@/components/evaluations/EvaluationForm'
import { getEvalTemplateSetting } from '@/app/actions/evalTemplates'
import { resolveTemplateFields, EVAL_TEMPLATES, type EvalField } from '@/types/eval-templates'

interface Props {
  params: Promise<{ participantId: string; month: string }>
}

export default async function EvaluationDetailPage({ params }: Props) {
  const { participantId, month } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 당사자 정보 조회
  const { data: participant } = await supabase
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .single()

  if (!participant) redirect('/supporter/evaluations')

  // 해당 월의 거래 내역 요약 정보 조회 (평가 참고용)
  const startDate = month
  const nextMonth = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 1)
  const endDate = nextMonth.toISOString().split('T')[0]

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('participant_id', participantId)
    .gte('date', startDate)
    .lt('date', endDate)
    .eq('status', 'confirmed')

  const totalSpent = transactions?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0
  const count = transactions?.length || 0

  // 기존 평가 데이터 조회
  const { data: existingEvaluation } = await supabase
    .from('evaluations')
    .select('*')
    .eq('participant_id', participantId)
    .eq('month', month)
    .single()

  // 현재 기관 평가 양식 설정
  const evalSetting = await getEvalTemplateSetting()
  const templateFields = resolveTemplateFields(evalSetting)
  const templateId = evalSetting.active
  const templateName = templateId === 'custom'
    ? '자체 양식'
    : EVAL_TEMPLATES[templateId].name

  const displayMonth = `${new Date(month).getFullYear()}년 ${new Date(month).getMonth() + 1}월`

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8 pb-20">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/supporter/evaluations" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl font-bold">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{participant.name} 님 PCP 평가</h1>
          <p className="text-zinc-500 mt-1">{displayMonth} 활동 기록 및 분석</p>
        </div>
      </header>

      <main className="max-w-5xl flex flex-col lg:flex-row gap-8">
        {/* 좌측: 당월 활동 요약 (참고용) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">활동 요약 ({displayMonth})</h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <span className="text-sm text-zinc-500 font-medium">총 지출 금액</span>
                <span className="text-xl font-black text-zinc-900">{totalSpent.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-zinc-500 font-medium">확정된 활동 건수</span>
                <span className="text-xl font-black text-zinc-900">{count}건</span>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-zinc-100 flex flex-col gap-2">
              <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">주요 활동 내역</p>
              {transactions && transactions.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {transactions.slice(0, 5).map((t: any) => (
                    <li key={t.id} className="text-xs flex justify-between text-zinc-600">
                      <span className="truncate max-w-[120px]">{t.activity_name}</span>
                      <span className="font-bold">{Number(t.amount).toLocaleString()}원</span>
                    </li>
                  ))}
                  {transactions.length > 5 && <li className="text-[10px] text-zinc-400 text-center mt-1">... 외 {transactions.length - 5}건</li>}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400 italic py-2 text-center">활동 내역이 없습니다.</p>
              )}
            </div>
          </section>

          <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
            <h4 className="text-blue-800 font-bold text-sm mb-2">💡 작성 팁 (PCP 4+1)</h4>
            <p className="text-blue-700 text-xs leading-relaxed">
              당사자의 선택과 경험을 중심으로 기록해 주세요. 수치보다는 당사자가 무엇을 배우고 느꼈는지, 지원자가 무엇을 보았는지가 중요합니다.
            </p>
          </div>
        </div>

        {/* 우측: 평가 작성 폼 */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-zinc-200 text-zinc-600 uppercase tracking-wider">
              {templateName}
            </span>
            <span className="text-xs text-zinc-400">양식 기준으로 작성합니다</span>
          </div>
          <EvaluationForm
            participantId={participantId}
            month={month}
            initialData={existingEvaluation}
            templateId={templateId}
            templateFields={templateFields}
          />
        </div>
      </main>
    </div>
  )
}
