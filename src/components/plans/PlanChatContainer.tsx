'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { suggestActivities, savePlan } from '@/app/actions/plan'
import PlanComparison from './PlanComparison'
import { formatCurrency } from '@/utils/budget-visuals'

interface PlanContext {
  activity: string
  when: string
  where: string
  who: string
  why: string
}

interface PlanOption {
  name: string
  cost: number
  time: string
  icon: string
  description?: string
}

interface Message {
  role: 'bot' | 'user'
  text: string
}

// 채팅 단계
type Step = 'activity' | 'when' | 'where' | 'who' | 'why' | 'choose' | 'comparison' | 'manual' | 'done'

const STEP_QUESTIONS: Record<Exclude<Step, 'choose' | 'comparison' | 'manual' | 'done'>, string> = {
  activity: '안녕하세요! 오늘은 무엇을 하고 싶으세요? 🤔',
  when: '언제 할 예정인가요? (예: 오늘 오후, 이번 주말)',
  where: '어디서 할 예정인가요? (예: 집 근처, 시내)',
  who: '혼자 하나요, 아니면 누구와 함께 하나요?',
  why: '왜 이것을 하고 싶으세요? (선택사항)',
}

const STEP_CHIPS: Partial<Record<Step, string[]>> = {
  when: ['오늘 오전', '오늘 오후', '오늘 저녁', '이번 주말'],
  where: ['집 근처', '시내', '공원', '쇼핑센터'],
  who: ['혼자', '부모님과', '친구와', '지원자 선생님과'],
  why: ['즐거움을 위해', '운동하고 싶어서', '기분 전환하고 싶어서', '건너뛰기'],
}

const STEPS: Step[] = ['activity', 'when', 'where', 'who', 'why', 'choose']

export default function PlanChatContainer({
  totalBalance,
  participantId,
}: {
  totalBalance: number
  participantId: string
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: STEP_QUESTIONS.activity },
  ])
  const [step, setStep] = useState<Step>('activity')
  const [input, setInput] = useState('')
  const [context, setContext] = useState<Partial<PlanContext>>({})
  const [loading, setLoading] = useState(false)
  const [planData, setPlanData] = useState<{ activityName: string; options: PlanOption[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null)

  // 수기 입력 모드
  const [manualActivity, setManualActivity] = useState('')
  const [manualCost, setManualCost] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (role: 'bot' | 'user', text: string) => {
    setMessages(prev => [...prev, { role, text }])
  }

  const handleUserAnswer = (answer: string) => {
    if (!answer.trim()) return
    addMessage('user', answer)
    setInput('')
    processStep(step, answer.trim())
  }

  const processStep = (currentStep: Step, answer: string) => {
    const newContext = { ...context }

    if (currentStep === 'activity') newContext.activity = answer
    else if (currentStep === 'when') newContext.when = answer
    else if (currentStep === 'where') newContext.where = answer
    else if (currentStep === 'who') newContext.who = answer
    else if (currentStep === 'why') {
      if (answer !== '건너뛰기') newContext.why = answer
    }

    setContext(newContext)

    const stepIndex = STEPS.indexOf(currentStep)
    const nextStep = STEPS[stepIndex + 1]

    if (nextStep === 'choose') {
      // 모든 질문 완료 → 선택지 제공
      const summary = [
        `활동: ${newContext.activity}`,
        newContext.when && `언제: ${newContext.when}`,
        newContext.where && `어디서: ${newContext.where}`,
        newContext.who && `누구와: ${newContext.who}`,
        newContext.why && `이유: ${newContext.why}`,
      ].filter(Boolean).join(' · ')

      setTimeout(() => {
        addMessage('bot', `좋아요! 정리해 드릴게요.\n${summary}\n\nAI 추천을 받을까요, 아니면 직접 금액을 입력하시겠어요?`)
        setStep('choose')
      }, 300)
    } else if (nextStep && STEP_QUESTIONS[nextStep as keyof typeof STEP_QUESTIONS]) {
      setTimeout(() => {
        addMessage('bot', STEP_QUESTIONS[nextStep as keyof typeof STEP_QUESTIONS])
        setStep(nextStep)
      }, 300)
    }
  }

  const handleGetAI = async () => {
    setLoading(true)
    addMessage('user', 'AI 추천 받기')
    try {
      const result = await suggestActivities(totalBalance, context as PlanContext)
      if (result.success && result.data) {
        setPlanData(result.data)
        setStep('comparison')
        addMessage('bot', `"${result.data.activityName}"로 두 가지 방법을 추천드려요! 아래에서 비교해 보세요.`)
      } else {
        addMessage('bot', '추천을 가져오지 못했어요. 직접 입력을 이용해 주세요.')
        setStep('manual')
      }
    } catch {
      addMessage('bot', '오류가 발생했어요. 직접 입력해 주세요.')
      setStep('manual')
    } finally {
      setLoading(false)
    }
  }

  const handleManual = () => {
    addMessage('user', '직접 입력하기')
    addMessage('bot', '활동 이름과 예상 비용을 입력해 주세요.')
    setStep('manual')
  }

  const handleManualSave = async () => {
    if (!manualActivity.trim() || !manualCost.trim()) return
    setSaving(true)
    try {
      await savePlan({
        participantId,
        activityName: manualActivity,
        date: new Date().toISOString().split('T')[0],
        options: [{ name: manualActivity, cost: Number(manualCost), time: '미정', icon: '📝' }],
        selectedOptionIndex: 0,
        details: context as PlanContext,
      })
      addMessage('bot', `"${manualActivity}" 계획이 저장되었어요!`)
      setStep('done')
      router.refresh()
    } catch {
      addMessage('bot', '저장 중 오류가 발생했어요.')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectPlan = async (selectedIndex: number) => {
    if (!planData) return
    setSaving(true)
    try {
      await savePlan({
        participantId,
        activityName: planData.activityName,
        date: new Date().toISOString().split('T')[0],
        options: planData.options,
        selectedOptionIndex: selectedIndex,
        details: context as PlanContext,
      })
      const selectedOption = planData.options[selectedIndex]
      addMessage('bot', `"${selectedOption.name}" 계획을 저장했어요! (${formatCurrency(selectedOption.cost)}원)`)
      setStep('done')
      router.refresh()
    } catch {
      addMessage('bot', '저장 중 오류가 발생했어요.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setMessages([{ role: 'bot', text: STEP_QUESTIONS.activity }])
    setStep('activity')
    setInput('')
    setContext({})
    setPlanData(null)
    setManualActivity('')
    setManualCost('')
    setSavedPlanId(null)
  }

  const currentChips = STEP_CHIPS[step] || []
  const isInputStep = ['activity', 'when', 'where', 'who', 'why'].includes(step)

  return (
    <div className="flex flex-col bg-white rounded-[2rem] ring-1 ring-zinc-100 shadow-sm overflow-hidden">
      {/* 채팅 헤더 */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-lg">🤝</div>
        <div>
          <p className="font-black text-zinc-800 text-sm">계획 세우기</p>
          <p className="text-[10px] text-zinc-400 font-medium">지원자와 함께 오늘의 계획을 만들어요</p>
        </div>
        {step !== 'activity' && (
          <button onClick={handleReset} className="ml-auto text-xs text-zinc-400 font-bold hover:text-zinc-600">
            처음부터
          </button>
        )}
      </div>

      {/* 채팅 메시지 영역 */}
      <div className="flex flex-col gap-3 p-4 max-h-80 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'bot' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm mr-2 mt-1 shrink-0">🤝</div>
            )}
            <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-pre-wrap leading-relaxed ${
              msg.role === 'user'
                ? 'bg-zinc-900 text-white rounded-br-sm'
                : 'bg-zinc-100 text-zinc-800 rounded-bl-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm mr-2 mt-1 shrink-0">🤝</div>
            <div className="bg-zinc-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-zinc-100 p-4 flex flex-col gap-3">

        {/* 빠른 선택 칩 */}
        {currentChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {currentChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleUserAnswer(chip)}
                className="px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* 텍스트 입력 */}
        {isInputStep && (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUserAnswer(input)}
              placeholder="직접 입력..."
              className="flex-1 px-4 py-3 rounded-2xl bg-zinc-100 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => handleUserAnswer(input)}
              disabled={!input.trim()}
              className="px-4 py-3 rounded-2xl bg-zinc-900 text-white text-sm font-bold disabled:bg-zinc-200 disabled:text-zinc-400 transition-all"
            >
              전송
            </button>
          </div>
        )}

        {/* AI / 직접입력 선택 */}
        {step === 'choose' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleGetAI}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-zinc-900 text-white font-black text-sm flex items-center justify-center gap-2 disabled:bg-zinc-200"
            >
              <span>✨</span> AI가 추천해 줘
            </button>
            <button
              type="button"
              onClick={handleManual}
              className="w-full py-3.5 rounded-2xl bg-zinc-100 text-zinc-700 font-black text-sm flex items-center justify-center gap-2"
            >
              <span>✏️</span> 직접 금액 입력하기
            </button>
          </div>
        )}

        {/* 수기 입력 폼 */}
        {step === 'manual' && (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={manualActivity}
              onChange={(e) => setManualActivity(e.target.value)}
              placeholder="활동 이름 (예: 카페 가기)"
              className="w-full px-4 py-3 rounded-2xl bg-zinc-100 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={manualCost}
                onChange={(e) => setManualCost(e.target.value)}
                placeholder="예상 비용"
                className="w-full px-4 py-3 pr-10 rounded-2xl bg-zinc-100 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">원</span>
            </div>
            <button
              type="button"
              onClick={handleManualSave}
              disabled={!manualActivity.trim() || !manualCost.trim() || saving}
              className="w-full py-3.5 rounded-2xl bg-zinc-900 text-white font-black text-sm disabled:bg-zinc-200"
            >
              {saving ? '저장 중...' : '계획 저장하기'}
            </button>
          </div>
        )}

        {/* 완료 후 */}
        {step === 'done' && (
          <button
            type="button"
            onClick={handleReset}
            className="w-full py-3.5 rounded-2xl bg-zinc-100 text-zinc-700 font-black text-sm"
          >
            새 계획 만들기
          </button>
        )}
      </div>

      {/* AI 추천 결과 비교 (채팅 아래에 표시) */}
      {step === 'comparison' && planData && (
        <div className="border-t border-zinc-100 p-4">
          <PlanComparison
            activityName={planData.activityName}
            initialOptions={planData.options}
            currentBalance={totalBalance}
            participantId={participantId}
            planContext={context as PlanContext}
            onSaved={() => {
              addMessage('bot', '계획이 저장되었어요!')
              setStep('done')
              router.refresh()
            }}
          />
        </div>
      )}
    </div>
  )
}
