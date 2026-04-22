'use client'

import { useState, useTransition } from 'react'
import EvaluationForm from './EvaluationForm'
import {
  EVAL_TEMPLATES,
  resolveTemplateFields,
  type EvalTemplateId,
  type OrgEvalSetting,
} from '@/types/eval-templates'
import { getPrevMonthEvaluation } from '@/app/actions/copyPlan'

interface Props {
  participantId: string
  month: string
  initialData?: any
  orgSetting: OrgEvalSetting
  initialTemplateId: EvalTemplateId
}

const TEMPLATE_OPTIONS: {
  id: EvalTemplateId
  label: string
  badge: string
  desc: string
  color: string
  activeColor: string
}[] = [
  {
    id: 'pcp',
    label: 'PCP 4+1',
    badge: '기본',
    desc: '개인중심계획 표준',
    color: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    activeColor: 'bg-zinc-900 text-white border-zinc-900',
  },
  {
    id: 'seoul',
    label: '서울시형',
    badge: '서울시',
    desc: '서울시 개인예산',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    activeColor: 'bg-blue-600 text-white border-blue-600',
  },
  {
    id: 'mohw',
    label: '보건복지부형',
    badge: '복지부',
    desc: '복지부 시범사업',
    color: 'bg-green-50 text-green-700 border-green-200',
    activeColor: 'bg-green-600 text-white border-green-600',
  },
  {
    id: 'custom',
    label: '자체 양식',
    badge: '기관',
    desc: '기관 자체 정의',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    activeColor: 'bg-purple-600 text-white border-purple-600',
  },
]

export default function EvaluationPageClient({
  participantId,
  month,
  initialData,
  orgSetting,
  initialTemplateId,
}: Props) {
  const [templateId, setTemplateId] = useState<EvalTemplateId>(initialTemplateId)
  const [formData, setFormData] = useState<any>(initialData)
  const [formKey, setFormKey] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [copyMsg, setCopyMsg] = useState('')

  const effectiveSetting: OrgEvalSetting = {
    active: templateId,
    custom_fields: orgSetting.custom_fields,
  }
  const templateFields = resolveTemplateFields(effectiveSetting)

  function handleLoadPrev() {
    if (formData?.id && !confirm('현재 입력된 내용이 있습니다. 전월 내용으로 덮어쓸까요?')) return
    setCopyMsg('')
    startTransition(async () => {
      const prev = await getPrevMonthEvaluation(participantId, month)
      if (!prev) {
        setCopyMsg('전월 평가 내용이 없습니다.')
        return
      }
      // strip id/month so it's treated as new content for this month
      const { id: _id, month: _month, published_at: _pub, ...rest } = prev
      setFormData({ ...rest })
      setTemplateId((prev.evaluation_template as EvalTemplateId) || 'pcp')
      setFormKey(k => k + 1)
      setCopyMsg('전월 내용을 불러왔습니다. 저장하면 이번 달에 반영돼요.')
    })
  }

  const hasExistingData = !!formData?.id
  const templateChanged = templateId !== initialTemplateId

  return (
    <div className="flex flex-col gap-5">
      {/* 양식 선택 */}
      <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            평가 양식 선택
          </p>
          <button
            type="button"
            onClick={handleLoadPrev}
            disabled={isPending}
            className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 font-bold text-xs hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {isPending ? '불러오는 중...' : '전월 내용 불러오기'}
          </button>
        </div>
        {copyMsg && (
          <p className="mb-3 text-xs text-blue-600 font-medium">{copyMsg}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_OPTIONS.map((opt) => {
            const isActive = templateId === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTemplateId(opt.id)}
                title={opt.desc}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                  isActive ? opt.activeColor + ' shadow-sm' : opt.color + ' hover:opacity-80'
                }`}
              >
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-white/20 text-inherit' : 'bg-white/60'
                  }`}
                >
                  {opt.badge}
                </span>
                {opt.label}
              </button>
            )
          })}
        </div>

        {templateId !== 'custom' && (
          <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed">
            {EVAL_TEMPLATES[templateId as Exclude<EvalTemplateId, 'custom'>].description}
          </p>
        )}
        {templateId === 'custom' && (
          <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed">
            기관 설정에서 정의한 자체 평가 항목으로 작성합니다.
          </p>
        )}

        {hasExistingData && templateChanged && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-base shrink-0">⚠️</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              양식을 변경하면 이전에 저장된 내용과 다른 항목이 표시될 수 있습니다.
              저장하면 새 양식으로 덮어쓰여집니다.
            </p>
          </div>
        )}
      </div>

      <EvaluationForm
        key={formKey}
        participantId={participantId}
        month={month}
        initialData={formData}
        templateId={templateId}
        templateFields={templateFields}
      />
    </div>
  )
}
