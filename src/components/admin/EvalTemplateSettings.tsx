'use client'

import { useState, useTransition } from 'react'
import { saveEvalTemplateSetting } from '@/app/actions/evalTemplates'
import {
  EVAL_TEMPLATES,
  DEFAULT_CUSTOM_FIELDS,
  type EvalTemplateId,
  type EvalField,
  type OrgEvalSetting,
} from '@/types/eval-templates'

interface Props {
  initialSetting: OrgEvalSetting
}

const TEMPLATE_ORDER: EvalTemplateId[] = ['pcp', 'seoul', 'mohw', 'custom']

const BADGE_COLORS: Record<string, string> = {
  기본: 'bg-zinc-100 text-zinc-600',
  서울시: 'bg-blue-100 text-blue-700',
  복지부: 'bg-purple-100 text-purple-700',
  자체: 'bg-emerald-100 text-emerald-700',
}

export default function EvalTemplateSettings({ initialSetting }: Props) {
  const [active, setActive] = useState<EvalTemplateId>(initialSetting.active)
  const [customFields, setCustomFields] = useState<EvalField[]>(
    initialSetting.custom_fields?.length ? initialSetting.custom_fields : DEFAULT_CUSTOM_FIELDS
  )
  const [previewId, setPreviewId] = useState<EvalTemplateId | null>(null)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleSave() {
    setMessage(null)
    const setting: OrgEvalSetting = {
      active,
      ...(active === 'custom' ? { custom_fields: customFields } : {}),
    }
    startTransition(async () => {
      const result = await saveEvalTemplateSetting(setting)
      if (result.success) {
        setMessage({ type: 'success', text: '평가 양식이 저장되었습니다.' })
      } else {
        setMessage({ type: 'error', text: result.error || '저장에 실패했습니다.' })
      }
    })
  }

  function addCustomField() {
    if (customFields.length >= 6) return
    const newId = `field_${customFields.length + 1}`
    setCustomFields([...customFields, { id: newId, label: `항목 ${customFields.length + 1}`, placeholder: '내용을 입력해주세요.', rows: 4 }])
  }

  function removeCustomField(idx: number) {
    setCustomFields(customFields.filter((_, i) => i !== idx))
  }

  function updateCustomField(idx: number, key: keyof EvalField, value: string | number) {
    setCustomFields(customFields.map((f, i) => i === idx ? { ...f, [key]: value } : f))
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">평가 양식 설정</h2>
        <p className="text-xs text-zinc-500 mt-1 ml-1">기관에서 사용하는 개인예산제 평가 양식 유형을 선택하세요.</p>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm font-medium text-center ${
          message.type === 'success' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* 템플릿 카드 선택 */}
      <div className="flex flex-col gap-2">
        {TEMPLATE_ORDER.map(id => {
          const tmpl = id === 'custom'
            ? { id: 'custom' as const, name: '자체 양식', badge: '자체', description: '기관에서 직접 평가 항목을 정의합니다. 최대 6개 항목을 설정할 수 있습니다.' }
            : EVAL_TEMPLATES[id]

          const isSelected = active === id
          const isPreviewing = previewId === id

          return (
            <div key={id} className={`rounded-2xl ring-1 transition-all overflow-hidden ${
              isSelected ? 'ring-zinc-900 bg-zinc-900' : 'ring-zinc-200 bg-white hover:ring-zinc-400'
            }`}>
              <button
                type="button"
                onClick={() => setActive(id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left"
              >
                <div className={`w-5 h-5 rounded-full ring-2 flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'ring-white bg-white' : 'ring-zinc-300 bg-transparent'
                }`}>
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-zinc-900" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : (BADGE_COLORS[tmpl.badge] ?? 'bg-zinc-100 text-zinc-600')
                    }`}>{tmpl.badge}</span>
                    <span className={`font-black text-sm ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{tmpl.name}</span>
                  </div>
                  <p className={`text-xs ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>{tmpl.description}</p>
                </div>
                {id !== 'custom' && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setPreviewId(isPreviewing ? null : id) }}
                    className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 transition-colors ${
                      isSelected ? 'text-zinc-300 hover:text-white hover:bg-white/10' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {isPreviewing ? '접기' : '미리보기'}
                  </button>
                )}
              </button>

              {/* 필드 미리보기 */}
              {isPreviewing && id !== 'custom' && (
                <div className={`px-5 pb-4 flex flex-col gap-2 border-t ${isSelected ? 'border-white/10' : 'border-zinc-100'}`}>
                  {EVAL_TEMPLATES[id].fields.map((f, i) => (
                    <div key={f.id} className={`text-xs ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      <span className="font-bold">{f.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 자체 양식 필드 편집기 */}
              {isSelected && id === 'custom' && (
                <div className="px-5 pb-5 border-t border-white/10 flex flex-col gap-3 mt-2">
                  <p className="text-xs text-zinc-400">평가 항목을 직접 정의하세요 (최대 6개).</p>
                  {customFields.map((f, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="text"
                          value={f.label}
                          onChange={e => updateCustomField(idx, 'label', e.target.value)}
                          placeholder={`항목 ${idx + 1} 이름`}
                          className="w-full px-3 py-2 rounded-xl bg-white/10 text-white text-sm font-bold placeholder-zinc-500 outline-none focus:bg-white/20 transition-colors"
                        />
                        <input
                          type="text"
                          value={f.placeholder}
                          onChange={e => updateCustomField(idx, 'placeholder', e.target.value)}
                          placeholder="입력 안내 문구"
                          className="w-full px-3 py-2 rounded-xl bg-white/5 text-zinc-300 text-xs placeholder-zinc-600 outline-none focus:bg-white/10 transition-colors"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomField(idx)}
                        disabled={customFields.length <= 1}
                        className="mt-1 w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500/40 text-zinc-400 hover:text-white text-sm flex items-center justify-center transition-colors disabled:opacity-30"
                      >✕</button>
                    </div>
                  ))}
                  {customFields.length < 6 && (
                    <button
                      type="button"
                      onClick={addCustomField}
                      className="py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 text-sm font-bold transition-colors"
                    >
                      + 항목 추가
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="py-3.5 rounded-2xl bg-zinc-900 text-white font-black text-sm hover:bg-zinc-800 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending
          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />저장 중...</>
          : '📋 평가 양식 저장'}
      </button>
    </section>
  )
}
