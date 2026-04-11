'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { suggestActivityOptions, suggestMethodOptions, savePlan } from '@/app/actions/plan'
import { formatCurrency } from '@/utils/budget-visuals'
import { speak } from '@/utils/tts'

type WizardStage = 'loading' | 'activity' | 'method' | 'when' | 'confirm' | 'feedback' | 'done'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const ACTIVITY_FALLBACK = { a: '카페 음료 마시기', b: '편의점 간식 사기' }
const METHOD_FALLBACK = { a: '간단하게', b: '조금 더 여유있게', a_cost: 5000, b_cost: 10000 }

const ACTIVITY_ICONS: Record<string, string> = {
  a: '🧁',
  b: '🛒',
}
const METHOD_ICONS: Record<string, string> = {
  a: '🏃',
  b: '🪑',
}

interface OptionData {
  a: string
  b: string
}
interface MethodData extends OptionData {
  a_cost: number
  b_cost: number
}

export default function PlanChatContainer({
  totalBalance,
  participantId,
}: {
  totalBalance: number
  participantId: string
}) {
  const router = useRouter()
  const [stage, setStage] = useState<WizardStage>('loading')
  const [activityOptions, setActivityOptions] = useState<OptionData>(ACTIVITY_FALLBACK)
  const [methodOptions, setMethodOptions] = useState<MethodData>(METHOD_FALLBACK)
  const [selectedActivity, setSelectedActivity] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('')
  const [selectedCost, setSelectedCost] = useState(0)
  const [selectedWhen, setSelectedWhen] = useState('')
  // 직접 입력
  const [customActivity, setCustomActivity] = useState('')
  const [customCost, setCustomCost] = useState('')
  const [customWhen, setCustomWhen] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  // 로딩·저장
  const [saving, setSaving] = useState(false)

  // 컴포넌트 마운트 시 활동 추천 로드
  useEffect(() => {
    loadActivityOptions()
  }, [])

  async function loadActivityOptions() {
    setStage('loading')
    const now = new Date()
    const day = DAY_NAMES[now.getDay()]
    const month = now.getMonth() + 1
    const result = await suggestActivityOptions(totalBalance, day, month)
    if (result.success && result.data) {
      setActivityOptions(result.data)
    } else {
      setActivityOptions(ACTIVITY_FALLBACK)
    }
    setStage('activity')
  }

  async function handleSelectActivity(label: string) {
    setSelectedActivity(label)
    setShowCustom(false)
    setStage('loading')
    const result = await suggestMethodOptions(label, totalBalance)
    if (result.success && result.data) {
      setMethodOptions(result.data)
    } else {
      setMethodOptions(METHOD_FALLBACK)
    }
    setStage('method')
  }

  function handleCustomActivitySubmit() {
    if (!customActivity.trim()) return
    handleSelectActivity(customActivity.trim())
  }

  function handleSelectMethod(label: string, cost: number) {
    setSelectedMethod(label)
    setSelectedCost(cost)
    setShowCustom(false)
    setStage('when')
  }

  function handleCustomMethodSubmit() {
    if (!customCost.trim()) return
    setSelectedMethod(selectedActivity)
    setSelectedCost(Number(customCost))
    setShowCustom(false)
    setStage('when')
  }

  function handleSelectWhen(label: string) {
    setSelectedWhen(label)
    setShowCustom(false)
    setStage('confirm')
  }

  function handleCustomWhenSubmit() {
    if (!customWhen.trim()) return
    setSelectedWhen(customWhen.trim())
    setShowCustom(false)
    setStage('confirm')
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      const date = new Date().toISOString().split('T')[0]
      await savePlan({
        participantId,
        activityName: selectedActivity,
        date,
        options: [
          { name: selectedMethod, cost: selectedCost, time: selectedWhen, icon: '📝' },
        ],
        selectedOptionIndex: 0,
        details: { activity: selectedActivity, when: selectedWhen },
      })
      router.refresh()
      setStage('feedback')
    } catch {
      // 저장 실패해도 피드백으로 이동
      setStage('feedback')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setSelectedActivity('')
    setSelectedMethod('')
    setSelectedCost(0)
    setSelectedWhen('')
    setCustomActivity('')
    setCustomCost('')
    setCustomWhen('')
    setShowCustom(false)
    loadActivityOptions()
  }

  function handleSpeakPlan() {
    speak(
      `오늘 계획이에요. ${selectedActivity}. ${selectedMethod}. ${selectedWhen}. ${formatCurrency(selectedCost)}원 예상이에요.`
    )
  }

  const remainingAfter = totalBalance - selectedCost

  return (
    <div className="flex flex-col bg-white rounded-[2rem] ring-1 ring-zinc-100 shadow-sm overflow-hidden">

      {/* 로딩 */}
      {stage === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="flex gap-1.5">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-3 h-3 bg-zinc-300 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          <p className="text-sm font-bold text-zinc-400">추천을 불러오고 있어요</p>
        </div>
      )}

      {/* 단계 1 — 활동 선택 */}
      {stage === 'activity' && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🤔</span>
            <h2 className="text-lg font-black text-zinc-900">오늘 뭐 하고 싶어요?</h2>
          </div>

          {!showCustom ? (
            <>
              <OptionButton
                icon={ACTIVITY_ICONS.a}
                label={activityOptions.a}
                badge="A"
                onClick={() => handleSelectActivity(activityOptions.a)}
              />
              <OptionButton
                icon={ACTIVITY_ICONS.b}
                label={activityOptions.b}
                badge="B"
                onClick={() => handleSelectActivity(activityOptions.b)}
              />
              <OptionButton
                icon="✏️"
                label="직접 입력할게요"
                badge="C"
                onClick={() => setShowCustom(true)}
                muted
              />
            </>
          ) : (
            <CustomInput
              placeholder="활동 이름을 입력해요"
              value={customActivity}
              onChange={setCustomActivity}
              onSubmit={handleCustomActivitySubmit}
              onBack={() => setShowCustom(false)}
            />
          )}
        </div>
      )}

      {/* 단계 2 — 방법·비용 선택 */}
      {stage === 'method' && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🙂</span>
            <div>
              <p className="text-xs font-bold text-zinc-400">{selectedActivity}</p>
              <h2 className="text-lg font-black text-zinc-900">어떻게 할까요?</h2>
            </div>
          </div>

          {!showCustom ? (
            <>
              <OptionButton
                icon={METHOD_ICONS.a}
                label={methodOptions.a}
                cost={methodOptions.a_cost}
                badge="A"
                onClick={() => handleSelectMethod(methodOptions.a, methodOptions.a_cost)}
              />
              <OptionButton
                icon={METHOD_ICONS.b}
                label={methodOptions.b}
                cost={methodOptions.b_cost}
                badge="B"
                onClick={() => handleSelectMethod(methodOptions.b, methodOptions.b_cost)}
              />
              <OptionButton
                icon="✏️"
                label="직접 입력할게요"
                badge="C"
                onClick={() => setShowCustom(true)}
                muted
              />
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={customCost}
                  onChange={(e) => setCustomCost(e.target.value)}
                  placeholder="예상 비용"
                  className="w-full px-4 py-4 pr-12 rounded-2xl bg-zinc-50 text-base font-bold outline-none focus:ring-2 focus:ring-zinc-900 border border-zinc-200"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">원</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex-1 py-4 rounded-2xl bg-zinc-100 text-zinc-500 font-black text-sm"
                >
                  뒤로
                </button>
                <button
                  onClick={handleCustomMethodSubmit}
                  disabled={!customCost.trim()}
                  className="flex-1 py-4 rounded-2xl bg-zinc-900 text-white font-black text-sm disabled:bg-zinc-200 disabled:text-zinc-400"
                >
                  다음 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 단계 3 — 언제 */}
      {stage === 'when' && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📅</span>
            <h2 className="text-lg font-black text-zinc-900">언제 갈 거예요?</h2>
          </div>

          {!showCustom ? (
            <>
              <OptionButton icon="🌅" label="오전 (지금 바로)" badge="A" onClick={() => handleSelectWhen('오전')} />
              <OptionButton icon="🌇" label="오후" badge="B" onClick={() => handleSelectWhen('오후')} />
              <OptionButton icon="✏️" label="직접 입력" badge="C" onClick={() => setShowCustom(true)} muted />
            </>
          ) : (
            <CustomInput
              placeholder="언제 할지 입력해요"
              value={customWhen}
              onChange={setCustomWhen}
              onSubmit={handleCustomWhenSubmit}
              onBack={() => setShowCustom(false)}
            />
          )}
        </div>
      )}

      {/* 단계 4 — 확인 */}
      {stage === 'confirm' && (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">📋</span>
            <h2 className="text-lg font-black text-zinc-900">오늘 계획이에요!</h2>
          </div>

          <div className="flex flex-col gap-3 p-5 rounded-2xl bg-zinc-50 ring-1 ring-zinc-100">
            <SummaryRow icon="🎯" label={selectedActivity} />
            <SummaryRow icon="📌" label={selectedMethod} />
            <SummaryRow icon="📅" label={selectedWhen} />
            <SummaryRow
              icon="💰"
              label={`${formatCurrency(selectedCost)}원 예상`}
              sub={remainingAfter >= 0 ? `쓰고 나면 ${formatCurrency(remainingAfter)}원이 남아요` : undefined}
            />
          </div>

          <button
            onClick={handleSpeakPlan}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-zinc-100 text-zinc-600 font-bold text-sm active:scale-95 transition-transform"
          >
            <span>🔊</span> 읽어주기
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-5 rounded-2xl bg-zinc-100 text-zinc-600 font-black text-sm active:scale-95 transition-transform"
            >
              🔄 다시 짜기
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-[2] py-5 rounded-2xl bg-zinc-900 text-white font-black text-sm active:scale-95 transition-transform disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              {saving ? '저장 중...' : '✅ 이렇게 할게요!'}
            </button>
          </div>
        </div>
      )}

      {/* 단계 5 — 피드백 */}
      {stage === 'feedback' && (
        <div className="flex flex-col items-center gap-6 py-10 px-6">
          <p className="text-lg font-black text-zinc-800 text-center">계획 세우기 어떠셨어요?</p>
          <div className="flex gap-8">
            <button
              onClick={() => setStage('done')}
              className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
            >
              <span className="text-6xl">😊</span>
              <span className="text-sm font-bold text-zinc-600">좋았어요</span>
            </button>
            <button
              onClick={() => setStage('done')}
              className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
            >
              <span className="text-6xl">😔</span>
              <span className="text-sm font-bold text-zinc-600">어려웠어요</span>
            </button>
          </div>
        </div>
      )}

      {/* 완료 */}
      {stage === 'done' && (
        <div className="flex flex-col items-center gap-4 py-10 px-6">
          <span className="text-5xl">🎉</span>
          <p className="text-base font-black text-zinc-800 text-center">계획이 저장됐어요!</p>
          <button
            onClick={handleReset}
            className="w-full py-4 rounded-2xl bg-zinc-100 text-zinc-700 font-black text-sm active:scale-95 transition-transform"
          >
            새 계획 만들기
          </button>
        </div>
      )}
    </div>
  )
}

// ── 서브 컴포넌트 ────────────────────────────────────────────────────────────

function OptionButton({
  icon,
  label,
  cost,
  badge,
  onClick,
  muted = false,
}: {
  icon: string
  label: string
  cost?: number
  badge: string
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 w-full py-5 px-5 rounded-2xl text-left transition-all active:scale-[0.97] ${
        muted
          ? 'bg-zinc-50 ring-1 ring-zinc-100 hover:bg-zinc-100'
          : 'bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 shadow-sm hover:shadow'
      }`}
    >
      <span className="text-2xl shrink-0">{icon}</span>
      <span className={`flex-1 text-base font-black ${muted ? 'text-zinc-400' : 'text-zinc-800'}`}>
        {label}
      </span>
      {cost !== undefined && (
        <span className="text-sm font-bold text-zinc-500 shrink-0">
          {cost.toLocaleString()}원
        </span>
      )}
      <span className={`text-xs font-black px-2 py-1 rounded-lg shrink-0 ${
        muted ? 'bg-zinc-200 text-zinc-400' : 'bg-zinc-900 text-white'
      }`}>
        {badge}
      </span>
    </button>
  )
}

function SummaryRow({
  icon,
  label,
  sub,
}: {
  icon: string
  label: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div className="flex flex-col">
        <span className="text-base font-black text-zinc-800">{label}</span>
        {sub && <span className="text-xs font-bold text-zinc-400 mt-0.5">{sub}</span>}
      </div>
    </div>
  )
}

function CustomInput({
  placeholder,
  value,
  onChange,
  onSubmit,
  onBack,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        placeholder={placeholder}
        className="w-full px-4 py-4 rounded-2xl bg-zinc-50 text-base font-bold outline-none focus:ring-2 focus:ring-zinc-900 border border-zinc-200"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-2xl bg-zinc-100 text-zinc-500 font-black text-sm"
        >
          뒤로
        </button>
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="flex-1 py-4 rounded-2xl bg-zinc-900 text-white font-black text-sm disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          다음 →
        </button>
      </div>
    </div>
  )
}
