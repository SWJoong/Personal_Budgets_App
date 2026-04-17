import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlanChatContainer from '@/components/plans/PlanChatContainer'
import { formatCurrency } from '@/utils/budget-visuals'
import HelpButton from '@/components/help/HelpButton'
import HelpAutoTrigger from '@/components/help/HelpAutoTrigger'
import NavDropdown from '@/components/layout/NavDropdown'

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 당사자의 현재 잔액 조회
  const { data: fundingSources } = await supabase
    .from('funding_sources')
    .select('current_month_balance')
    .eq('participant_id', user.id)

  const totalBalance = fundingSources?.reduce((acc: number, fs: any) => acc + Number(fs.current_month_balance), 0) || 0

  // 저장된 계획 목록 조회 (최근 5개)
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('participant_id', user.id)
    .order('date', { ascending: false })
    .limit(5)

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <HelpAutoTrigger sectionKey="plan" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">아름드리꿈터</span>
          </Link>
          <span className="text-zinc-300">·</span>
          <h1 className="text-sm font-black text-zinc-800">🤔 오늘 계획</h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton sectionKey="plan" />
          <NavDropdown />
        </div>
      </header>

      <main className="flex-1 p-4 w-full flex flex-col gap-6">
        {/* 현재 잔액 요약 */}
        <div className="p-6 rounded-[2rem] bg-white ring-1 ring-zinc-200 shadow-sm flex justify-between items-center relative overflow-hidden">
          <div className="flex flex-col z-10 relative">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">사용 가능한 돈</span>
            <span className="text-3xl font-black text-zinc-900">
              {totalBalance.toLocaleString()}원
            </span>
          </div>
          <span className="text-5xl z-10 relative">💰</span>
          <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] rotate-12">💰</div>
        </div>

        {/* 저장된 계획 목록 */}
        {plans && plans.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">나의 계획</h2>
            <div className="flex flex-col gap-2">
              {plans.map((plan: any) => {
                const selectedOption = plan.options?.[plan.selected_option_index]
                return (
                  <div key={plan.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedOption?.icon || '📝'}</span>
                      <div>
                        <p className="font-black text-zinc-800 text-sm">{plan.activity_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-zinc-400">{plan.date}</span>
                          {selectedOption && (
                            <span className="text-[10px] font-bold text-zinc-500">
                              · {selectedOption.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {selectedOption && (
                        <p className="font-black text-zinc-800 text-sm">{formatCurrency(selectedOption.cost)}원</p>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">계획됨</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 채팅형 계획 세우기 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">새 계획 만들기</h2>
          <PlanChatContainer totalBalance={totalBalance} participantId={user.id} />
        </section>

        {/* 도움말 */}
        <div className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 flex gap-4 items-start">
          <span className="text-2xl mt-1">💡</span>
          <div className="flex flex-col gap-1">
            <h4 className="text-blue-800 font-bold">도움말</h4>
            <p className="text-blue-600 text-sm leading-relaxed font-medium">
              비용이 적은 방법을 선택하면 나중에 다른 활동을 더 많이 할 수 있어요!
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
