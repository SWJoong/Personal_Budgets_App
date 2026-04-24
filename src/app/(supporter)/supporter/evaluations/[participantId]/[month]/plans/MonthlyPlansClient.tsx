'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteMonthlyPlan,
  upsertMonthlyPlan,
  type MonthlyPlan,
} from '@/app/actions/monthlyPlan'
import { copyMonthlyPlans } from '@/app/actions/copyPlan'
import { generateEasyReadSummary } from '@/app/actions/easyReadSummary'
import { uploadEasyReadImage } from '@/app/actions/storage'

interface Props {
  participantId: string
  month: string                         // 'YYYY-MM-01'
  initialPlans: MonthlyPlan[]
  fundingSources: { id: string; name: string }[]
  supportGoals?: { id: string; support_area: string; order_index: number }[]
}

interface Draft {
  id?: string
  order_index: number
  title: string
  description: string
  funding_source_id: string
  support_goal_id: string
  planned_budget: string
  target_count: string
  scheduled_dates: string                // 쉼표로 구분된 'YYYY-MM-DD'
  easy_description: string
  easy_image_url: string
  easy_image_file: File | null           // 로컬 미리보기용
  dirty: boolean
}

function toDraft(p?: MonthlyPlan, order_index = 1): Draft {
  return {
    id: p?.id,
    order_index: p?.order_index ?? order_index,
    title: p?.title ?? '',
    description: p?.description ?? '',
    funding_source_id: p?.funding_source_id ?? '',
    support_goal_id: p?.support_goal_id ?? '',
    planned_budget: p ? String(p.planned_budget ?? '') : '',
    target_count: p?.target_count != null ? String(p.target_count) : '',
    scheduled_dates: (p?.scheduled_dates || []).join(', '),
    easy_description: p?.easy_description ?? '',
    easy_image_url: p?.easy_image_url ?? '',
    easy_image_file: null,
    dirty: false,
  }
}

export default function MonthlyPlansClient({
  participantId,
  month,
  initialPlans,
  fundingSources,
  supportGoals = [],
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isAiPending, setIsAiPending] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  // 빠른 편집 / 상세 편집 토글 (기본: 빠른 편집)
  const [editMode, setEditMode] = useState<'quick' | 'detailed'>('quick')

  const [drafts, setDrafts] = useState<Draft[]>(
    () => initialPlans
      .sort((a, b) => a.order_index - b.order_index)
      .map((p) => toDraft(p))
  )

  const usedOrders = useMemo(() => new Set(drafts.map(d => d.order_index)), [drafts])
  const canAdd = drafts.length < 6

  const displayMonth = useMemo(() => {
    const [y, mo] = month.split('-').map(Number)
    return `${y}년 ${mo}월`
  }, [month])

  function nextOrderIndex(): number {
    for (let i = 1; i <= 6; i++) if (!usedOrders.has(i)) return i
    return drafts.length + 1
  }

  function updateDraft(idx: number, patch: Partial<Draft>) {
    setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, ...patch, dirty: true } : d))
  }

  function addDraft() {
    if (!canAdd) return
    setDrafts(prev => [...prev, toDraft(undefined, nextOrderIndex())])
  }

  async function handleSave(idx: number) {
    const d = drafts[idx]
    if (!d.title.trim()) {
      setError('제목을 입력하세요.')
      return
    }
    if (d.order_index < 1 || d.order_index > 6) {
      setError('계획 순서는 1~6 사이여야 합니다.')
      return
    }

    const scheduled = d.scheduled_dates
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(Boolean)

    setError('')
    setSuccessMsg('')
    startTransition(async () => {
      // 이미지 파일이 있으면 먼저 업로드
      let imageUrl = d.easy_image_url || null
      if (d.easy_image_file && d.id) {
        const uploadResult = await uploadEasyReadImage(d.easy_image_file, participantId, 'plan', d.id)
        if (uploadResult.error) {
          setError(`이미지 업로드 실패: ${uploadResult.error}`)
          return
        }
        imageUrl = uploadResult.path || null
      }

      const res = await upsertMonthlyPlan({
        id: d.id,
        participant_id: participantId,
        month,
        order_index: d.order_index,
        title: d.title,
        description: d.description || null,
        funding_source_id: d.funding_source_id || null,
        support_goal_id: d.support_goal_id || null,
        planned_budget: Number(d.planned_budget) || 0,
        target_count: d.target_count ? Number(d.target_count) : null,
        scheduled_dates: scheduled.length ? scheduled : null,
        easy_description: d.easy_description || null,
        easy_image_url: imageUrl,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setSuccessMsg(`${d.order_index}번 계획이 저장되었어요.`)
      router.refresh()
      setDrafts(prev => prev.map((x, i) => i === idx ? { ...x, dirty: false, easy_image_file: null } : x))
    })
  }

  async function handleCopyPrev() {
    if (!confirm('전월 계획을 이번 달로 복사할까요?\n이미 같은 순서의 계획이 있으면 건너뜁니다.')) return
    setError('')
    setSuccessMsg('')
    startTransition(async () => {
      const res = await copyMonthlyPlans(participantId, month)
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.copied === 0 && res.skipped > 0) {
        setSuccessMsg(`전월 계획 ${res.skipped}개가 이미 존재해 건너뛰었습니다.`)
      } else {
        setSuccessMsg(
          `전월 계획 ${res.copied}개를 복사했어요.` +
          (res.skipped > 0 ? ` (${res.skipped}개 순서 중복으로 건너뜀)` : '')
        )
        router.refresh()
      }
    })
  }

  async function handleDelete(idx: number) {
    const d = drafts[idx]
    if (!confirm(`${d.order_index}번 계획을 삭제할까요?`)) return

    if (!d.id) {
      setDrafts(prev => prev.filter((_, i) => i !== idx))
      return
    }

    setError('')
    setSuccessMsg('')
    startTransition(async () => {
      const res = await deleteMonthlyPlan(d.id!, participantId, month)
      if (res.error) {
        setError(res.error)
        return
      }
      setDrafts(prev => prev.filter((_, i) => i !== idx))
      setSuccessMsg(`${d.order_index}번 계획이 삭제되었어요.`)
      router.refresh()
    })
  }

  async function handleAiGenerate() {
    if (drafts.length === 0) {
      setError('계획이 없어 AI 자동 작성을 사용할 수 없습니다.')
      return
    }
    setError('')
    setSuccessMsg('')
    setIsAiPending(true)
    try {
      const res = await generateEasyReadSummary(participantId, month)
      if (res.error) {
        setError(`AI 자동 작성 실패: ${res.error}`)
        return
      }
      setSuccessMsg('AI가 쉬운 설명을 작성했어요. 저장된 내용을 확인하세요.')
      router.refresh()
    } finally {
      setIsAiPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 툴바 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-zinc-500">
            <strong className="text-zinc-900">{displayMonth}</strong> 실행 계획.
            {editMode === 'quick'
              ? ' 당사자 화면용 설명과 목표 횟수를 빠르게 수정합니다.'
              : ' 예산·예정일 등 모든 항목을 편집합니다.'}
          </p>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* 편집 모드 토글 */}
            <div className="flex rounded-xl overflow-hidden ring-1 ring-zinc-200 text-sm font-bold">
              <button
                type="button"
                onClick={() => setEditMode('quick')}
                className={`px-3 py-2 transition-colors ${editMode === 'quick' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
              >
                ⚡ 빠른 편집
              </button>
              <button
                type="button"
                onClick={() => setEditMode('detailed')}
                className={`px-3 py-2 transition-colors ${editMode === 'detailed' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
              >
                🔧 상세 편집
              </button>
            </div>
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={isAiPending || isPending}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isAiPending ? '생성 중...' : '✨ AI 자동 작성'}
            </button>
            {editMode === 'detailed' && (
              <>
                <button
                  type="button"
                  onClick={handleCopyPrev}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 font-bold text-sm hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                >
                  전월 복사
                </button>
                <button
                  type="button"
                  onClick={addDraft}
                  disabled={!canAdd}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
                >
                  + 계획 추가 ({drafts.length}/6)
                </button>
              </>
            )}
          </div>
        </div>

        {/* 빠른 편집 안내 */}
        {editMode === 'quick' && (
          <div className="px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 font-medium">
            💡 <strong>빠른 편집</strong>: 당사자 화면 "/plan"에 표시되는 <strong>쉬운 설명</strong>과 <strong>목표 횟수</strong>만 수정합니다.
            계획 추가·삭제·예산 변경은 <button type="button" onClick={() => setEditMode('detailed')} className="underline font-bold cursor-pointer hover:text-blue-900">상세 편집</button>에서 하세요.
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
          {successMsg}
        </div>
      )}

      {drafts.length === 0 && (
        <div className="p-10 rounded-2xl bg-white ring-1 ring-zinc-200 text-center">
          <p className="text-zinc-500 font-medium">아직 계획이 없어요.</p>
          <p className="text-zinc-400 text-sm mt-1">
            {editMode === 'quick'
              ? '"상세 편집"으로 전환해 계획을 추가해 보세요.'
              : '"+ 계획 추가" 버튼을 눌러 새 계획을 만들어 보세요.'}
          </p>
        </div>
      )}

      {/* ── 빠른 편집 모드 ── */}
      {editMode === 'quick' && drafts.length > 0 && (
        <div className="flex flex-col gap-3">
          {drafts.map((d, idx) => (
            <div
              key={`quick-${d.id ?? 'new'}-${idx}`}
              className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm p-4 flex flex-col gap-3"
            >
              {/* 계획 헤더 */}
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-zinc-900 text-white font-black text-sm flex items-center justify-center shrink-0">
                  {d.order_index}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-zinc-900 text-sm truncate">{d.title || '(제목 없음)'}</p>
                  {d.description && (
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{d.description}</p>
                  )}
                </div>
                {d.dirty && <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full shrink-0">미저장</span>}
              </div>

              {/* 빠른 편집 필드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-11">
                {/* 쉬운 설명 */}
                <div className="sm:col-span-2 bg-blue-50 rounded-xl p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">당사자용 쉬운 설명</label>
                    <span className={`text-[10px] font-bold tabular-nums ${d.easy_description.length > 30 ? 'text-red-500' : 'text-blue-400'}`}>
                      {d.easy_description.length}/30
                    </span>
                  </div>
                  <input
                    type="text"
                    value={d.easy_description}
                    onChange={(e) => updateDraft(idx, { easy_description: e.target.value.slice(0, 30) })}
                    placeholder="예) 이번 달에 카페에 4번 가요."
                    maxLength={30}
                    className="p-2.5 rounded-lg bg-white ring-1 ring-blue-200 text-sm text-zinc-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {!d.easy_description && (
                    <p className="text-[10px] text-amber-600 font-bold">설명 없음 — 당사자 화면에 제목이 그대로 표시됩니다</p>
                  )}
                </div>

                {/* 목표 횟수 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">목표 횟수</label>
                  <input
                    type="number"
                    value={d.target_count}
                    onChange={(e) => updateDraft(idx, { target_count: e.target.value })}
                    placeholder="예) 4"
                    min={0}
                    className="p-2.5 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-sm text-zinc-800 font-bold text-right focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                  />
                </div>

                {/* 저장 버튼 */}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleSave(idx)}
                    disabled={isPending || !d.dirty}
                    className="w-full p-2.5 rounded-lg bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
                  >
                    {d.dirty ? '저장' : '저장됨 ✓'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 상세 편집 모드 ── */}
      <div className={editMode === 'detailed' ? 'flex flex-col gap-5' : 'hidden'}>
        {drafts.map((d, idx) => {
          const previewUrl = d.easy_image_file
            ? URL.createObjectURL(d.easy_image_file)
            : null

          return (
            <section
              key={`${d.id ?? 'new'}-${idx}`}
              className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-zinc-900 text-white font-black flex items-center justify-center">
                    {d.order_index}
                  </span>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">계획 순서</p>
                    <select
                      value={d.order_index}
                      onChange={(e) => updateDraft(idx, { order_index: Number(e.target.value) })}
                      className="text-sm font-bold text-zinc-800 bg-transparent focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n}번</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    disabled={isPending}
                    className="px-3 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(idx)}
                    disabled={isPending || !d.dirty}
                    className="px-4 py-2 rounded-lg bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
                  >
                    {d.dirty ? '저장' : '저장됨'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <fieldset className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">계획 제목</label>
                  <input
                    type="text"
                    value={d.title}
                    onChange={(e) => updateDraft(idx, { title: e.target.value })}
                    placeholder="예) 카페 4회 가기"
                    className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                  />
                </fieldset>

                <fieldset className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">상세 설명</label>
                  <textarea
                    value={d.description}
                    onChange={(e) => updateDraft(idx, { description: e.target.value })}
                    rows={2}
                    placeholder="어떤 활동인지 구체적으로 적어주세요."
                    className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-2 focus:ring-zinc-900 focus:outline-none resize-none"
                  />
                </fieldset>

                <fieldset className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">재원 (돈주머니)</label>
                  <select
                    value={d.funding_source_id}
                    onChange={(e) => updateDraft(idx, { funding_source_id: e.target.value })}
                    className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                  >
                    <option value="">선택 안 함</option>
                    {fundingSources.map(fs => (
                      <option key={fs.id} value={fs.id}>{fs.name}</option>
                    ))}
                  </select>
                </fieldset>

                {supportGoals.length > 0 && (
                  <fieldset className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">연간 지원 목표 연결</label>
                    <select
                      value={d.support_goal_id}
                      onChange={(e) => updateDraft(idx, { support_goal_id: e.target.value })}
                      className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                    >
                      <option value="">연결 안 함</option>
                      {supportGoals.map(g => (
                        <option key={g.id} value={g.id}>{g.order_index}. {g.support_area}</option>
                      ))}
                    </select>
                  </fieldset>
                )}

                <fieldset className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">계획 예산 (원)</label>
                  <input
                    type="number"
                    value={d.planned_budget}
                    onChange={(e) => updateDraft(idx, { planned_budget: e.target.value })}
                    placeholder="0"
                    min={0}
                    className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold text-right focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                  />
                </fieldset>

                <fieldset className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">목표 횟수 (선택)</label>
                  <input
                    type="number"
                    value={d.target_count}
                    onChange={(e) => updateDraft(idx, { target_count: e.target.value })}
                    placeholder="예) 4"
                    min={0}
                    className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold text-right focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                  />
                </fieldset>

                <fieldset className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">예정일 (쉼표로 구분)</label>
                  <input
                    type="text"
                    value={d.scheduled_dates}
                    onChange={(e) => updateDraft(idx, { scheduled_dates: e.target.value })}
                    placeholder="예) 2026-04-05, 2026-04-12"
                    className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                  />
                </fieldset>
              </div>

              {/* 당사자용 쉬운 정보 */}
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-blue-700 uppercase tracking-wider">당사자용 쉬운 정보</p>
                  {!d.easy_description && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                      쉬운 설명 없음 — 제목이 표시됩니다
                    </span>
                  )}
                </div>

                <fieldset className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">쉬운 설명 (30자 이내)</label>
                    <span className={`text-[10px] font-bold tabular-nums ${d.easy_description.length > 30 ? 'text-red-500' : 'text-blue-400'}`}>
                      {d.easy_description.length}/30
                    </span>
                  </div>
                  <input
                    type="text"
                    value={d.easy_description}
                    onChange={(e) => updateDraft(idx, { easy_description: e.target.value.slice(0, 30) })}
                    placeholder="예) 이번 달에 카페에 4번 가요."
                    maxLength={30}
                    className="p-3 rounded-xl bg-white ring-1 ring-blue-200 text-zinc-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </fieldset>

                <fieldset className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">대표 이미지 (선택)</label>
                  <div className="flex items-center gap-3">
                    {(previewUrl || d.easy_image_url) && (
                      <img
                        src={previewUrl || d.easy_image_url}
                        alt="쉬운 정보 대표 이미지 미리보기"
                        className="w-16 h-16 rounded-xl object-cover ring-1 ring-blue-200"
                      />
                    )}
                    <label className="cursor-pointer px-3 py-2 rounded-xl bg-white ring-1 ring-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-50 transition-colors">
                      이미지 선택
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          updateDraft(idx, { easy_image_file: file })
                        }}
                      />
                    </label>
                    {(d.easy_image_file || d.easy_image_url) && (
                      <button
                        type="button"
                        onClick={() => updateDraft(idx, { easy_image_file: null, easy_image_url: '' })}
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </fieldset>
              </div>
            </section>
          )
        })}
      </div>
      {/* 상세 편집 모드에서 계획 추가 (빠른 편집에서는 숨김) */}
      {editMode === 'detailed' && canAdd && (
        <button
          type="button"
          onClick={addDraft}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-400 text-sm font-bold hover:border-zinc-500 hover:text-zinc-600 transition-colors"
        >
          + 계획 추가 ({drafts.length}/6)
        </button>
      )}
    </div>
  )
}
