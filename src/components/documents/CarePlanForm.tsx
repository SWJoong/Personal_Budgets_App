"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertCarePlan, deleteCarePlan } from '@/app/actions/carePlan'
import type { CarePlanType, MohwPlanContent, SeoulPlanContent, MohwServicePlanRow } from '@/types/care-plans'
import { CARE_PLAN_LABELS, MOHW_NEEDS_CATEGORIES, emptyMohwPlanContent, emptySeoulPlanContent } from '@/types/care-plans'

interface Props {
  participantId: string
  participantName: string
  planType: CarePlanType
  planYear: number
  initialData?: { id: string; content: any } | null
}

// ──────────────────────────────────────────────────────────────────────────
// 공통 UI 헬퍼
// ──────────────────────────────────────────────────────────────────────────
function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-7 h-7 rounded-full bg-zinc-900 text-white text-xs font-black flex items-center justify-center shrink-0">{number}</span>
      <h3 className="text-base font-black text-zinc-800">{title}</h3>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-black text-zinc-500 uppercase tracking-wider ml-1">{children}</label>
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none text-sm leading-relaxed resize-y transition-all"
    />
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
        checked ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200'
      }`}
    >
      <span>{checked ? '✅' : '○'}</span>
      {label}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// 보건복지부형 폼
// ──────────────────────────────────────────────────────────────────────────
function MohwPlanFormInner({ data, onChange }: {
  data: MohwPlanContent
  onChange: (d: MohwPlanContent) => void
}) {
  function set<K extends keyof MohwPlanContent>(key: K, value: MohwPlanContent[K]) {
    onChange({ ...data, [key]: value })
  }

  function setNeeds(catKey: string, field: 'limitations' | 'wishes', value: string) {
    onChange({
      ...data,
      needs: {
        ...data.needs,
        [catKey]: { ...data.needs[catKey], [field]: value },
      },
    })
  }

  function addServiceRow() {
    const row: MohwServicePlanRow = { category: '', service_name: '', frequency: '', budget: null }
    set('service_plan', [...data.service_plan, row])
  }

  function updateServiceRow(index: number, field: keyof MohwServicePlanRow, value: string | number | null) {
    const updated = data.service_plan.map((row, i) => i === index ? { ...row, [field]: value } : row)
    set('service_plan', updated)
  }

  function removeServiceRow(index: number) {
    set('service_plan', data.service_plan.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 2절: 이용서비스 현황 */}
      <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200">
        <SectionHeader number="2" title="현재 이용서비스 현황" />
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <FieldLabel>활동지원서비스</FieldLabel>
            <div className="flex gap-2">
              <Toggle checked={data.activity_support_used} onChange={v => set('activity_support_used', v)} label="이용 중" />
              <Toggle checked={!data.activity_support_used} onChange={v => set('activity_support_used', !v)} label="미이용" />
            </div>
            {data.activity_support_used && (
              <Textarea
                value={data.activity_support_details}
                onChange={v => set('activity_support_details', v)}
                placeholder="이용 내용, 시간, 제공기관, 만족도 등을 자유롭게 기술해주세요."
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel>발달장애인 주간활동</FieldLabel>
            <div className="flex gap-2">
              <Toggle checked={data.day_activity_used} onChange={v => set('day_activity_used', v)} label="이용 중" />
              <Toggle checked={!data.day_activity_used} onChange={v => set('day_activity_used', !v)} label="미이용" />
            </div>
            {data.day_activity_used && (
              <Textarea
                value={data.day_activity_details}
                onChange={v => set('day_activity_details', v)}
                placeholder="이용 내용, 그룹유형, 제공형태, 제공기관, 만족도 등을 자유롭게 기술해주세요."
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel>기타 이용 서비스</FieldLabel>
            <Textarea
              value={data.other_services}
              onChange={v => set('other_services', v)}
              placeholder="복지관, 치료, 교육 등 기타 이용 중인 서비스가 있다면 기술해주세요."
            />
          </div>
        </div>
      </section>

      {/* 3절: 현재 일상생활 */}
      <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200">
        <SectionHeader number="3" title="현재 일상생활" />
        <div className="flex flex-col gap-4">
          {[
            { key: 'daily_routine' as const,      label: '내가 하루를 보내는 방식은?' },
            { key: 'important_people' as const,   label: '내게 가장 중요하거나, 가장 자주 만나는 사람은?' },
            { key: 'life_goals' as const,         label: '내가 내 삶에서 가장 원하는 것은?' },
            { key: 'daily_difficulties' as const, label: '현재 살아가는 데 가장 불편한 점은?' },
            { key: 'needed_support' as const,     label: '현재의 삶에서 변화를 가져오기 위해 필요한 지원은?' },
          ].map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-2">
              <FieldLabel>{label}</FieldLabel>
              <Textarea value={data[key]} onChange={v => set(key, v)} rows={3} />
            </div>
          ))}
        </div>
      </section>

      {/* 4절: 욕구사정 */}
      <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200">
        <SectionHeader number="4" title="개인예산 지원영역 욕구사정" />
        <p className="text-xs text-zinc-400 mb-5 -mt-2">인터뷰 내용을 자유롭게 기술해주세요.</p>
        <div className="flex flex-col gap-6">
          {MOHW_NEEDS_CATEGORIES.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-50 ring-1 ring-zinc-100">
              <p className="text-sm font-black text-zinc-700">{label}</p>
              <div className="flex flex-col gap-2">
                <FieldLabel>제한점</FieldLabel>
                <Textarea
                  value={data.needs[key]?.limitations ?? ''}
                  onChange={v => setNeeds(key, 'limitations', v)}
                  placeholder="현재 제한이 되는 상황이나 어려움을 기술해주세요."
                  rows={2}
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel>욕구와 희망</FieldLabel>
                <Textarea
                  value={data.needs[key]?.wishes ?? ''}
                  onChange={v => setNeeds(key, 'wishes', v)}
                  placeholder="원하는 것, 희망하는 지원 등을 기술해주세요."
                  rows={2}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5절: 이용계획 */}
      <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200">
        <SectionHeader number="5" title="개인예산 이용계획" />
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <FieldLabel>목표</FieldLabel>
            <Textarea
              value={data.plan_goal}
              onChange={v => set('plan_goal', v)}
              placeholder="이용계획의 전반적인 목표를 작성해주세요."
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <FieldLabel>서비스 계획 세부내역</FieldLabel>
              <button
                type="button"
                onClick={addServiceRow}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-700 transition-all"
              >
                + 행 추가
              </button>
            </div>

            {data.service_plan.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-50 text-center text-xs text-zinc-400">
                "+ 행 추가" 버튼을 눌러 서비스 계획을 입력해주세요.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.service_plan.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-100">
                    <input
                      value={row.category}
                      onChange={e => updateServiceRow(i, 'category', e.target.value)}
                      placeholder="대분류"
                      className="col-span-2 p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-xs outline-none"
                    />
                    <input
                      value={row.service_name}
                      onChange={e => updateServiceRow(i, 'service_name', e.target.value)}
                      placeholder="서비스 내용"
                      className="col-span-4 p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-xs outline-none"
                    />
                    <input
                      value={row.frequency}
                      onChange={e => updateServiceRow(i, 'frequency', e.target.value)}
                      placeholder="횟수/기간"
                      className="col-span-3 p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-xs outline-none"
                    />
                    <input
                      type="number"
                      value={row.budget ?? ''}
                      onChange={e => updateServiceRow(i, 'budget', e.target.value === '' ? null : Number(e.target.value))}
                      placeholder="예산(원)"
                      className="col-span-2 p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeServiceRow(i)}
                      className="col-span-1 p-2 rounded-lg bg-red-50 text-red-400 text-xs font-bold hover:bg-red-100 transition-all"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {data.service_plan.length > 0 && (
                  <p className="text-xs text-zinc-400 text-right mt-1">
                    총 예산: {data.service_plan.reduce((s, r) => s + (r.budget || 0), 0).toLocaleString()}원
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// 서울형 폼
// ──────────────────────────────────────────────────────────────────────────
function SeoulPlanFormInner({ data, onChange }: {
  data: SeoulPlanContent
  onChange: (d: SeoulPlanContent) => void
}) {
  function set<K extends keyof SeoulPlanContent>(key: K, value: SeoulPlanContent[K]) {
    onChange({ ...data, [key]: value })
  }

  function setService(index: 0 | 1 | 2, value: string) {
    const updated: [string, string, string] = [...data.desired_services] as [string, string, string]
    updated[index] = value
    set('desired_services', updated)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 보건복지부 시범사업 참여여부 */}
      <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200">
        <h3 className="text-sm font-black text-zinc-700 mb-4">보건복지부 장애인 개인예산제 시범사업 참여여부</h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-zinc-200 cursor-pointer hover:bg-zinc-50 transition-all">
            <input
              type="radio"
              name="mohw_participation"
              value="no"
              checked={data.mohw_participation === 'no'}
              onChange={() => set('mohw_participation', 'no')}
              className="w-4 h-4 accent-zinc-900"
            />
            <span className="text-sm font-bold text-zinc-800">미참여</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-zinc-200 cursor-pointer hover:bg-zinc-50 transition-all">
            <input
              type="radio"
              name="mohw_participation"
              value="yes"
              checked={data.mohw_participation === 'yes'}
              onChange={() => set('mohw_participation', 'yes')}
              className="w-4 h-4 accent-zinc-900"
            />
            <div>
              <span className="text-sm font-bold text-zinc-800">참여</span>
              <p className="text-xs text-red-600 mt-0.5">※ 보건복지부 시범사업 참여자의 경우, 서울형 시범사업 참여 불가</p>
            </div>
          </label>
        </div>
      </section>

      {/* 나의 상황 */}
      <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200">
        <SectionHeader number="1" title="나의 상황" />
        <div className="flex flex-col gap-4">
          {[
            { key: 'strengths' as const,       label: '나의 재능, 강점, 기술',                               placeholder: '잘 하는 것, 좋아하는 것, 강점 등을 기술해주세요.' },
            { key: 'difficulties' as const,    label: '장애로 인해 겪는 사회적 제한, 삶에서의 어려움',         placeholder: '일상에서 어려움을 겪는 상황을 기술해주세요.' },
            { key: 'desired_change' as const,  label: '내가 원하는 변화와 지원',                              placeholder: '어떤 부분이 달라지길 원하는지, 어떤 지원이 필요한지 기술해주세요.' },
            { key: 'desired_life' as const,    label: '내가 원하는 삶의 모습 (희망, 꿈, 바라는 바, 관심사 등)', placeholder: '희망하는 삶의 모습을 자유롭게 기술해주세요.' },
            { key: 'trial_goals' as const,     label: '시도하고 싶은 것 (1~2년 내 이루고자 하는 목표)',        placeholder: '구체적인 목표나 도전하고 싶은 것을 기술해주세요.' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex flex-col gap-2">
              <FieldLabel>{label}</FieldLabel>
              <Textarea value={data[key]} onChange={v => set(key, v)} placeholder={placeholder} rows={3} />
            </div>
          ))}
        </div>
      </section>

      {/* 지원받고 싶은 서비스 */}
      <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200">
        <SectionHeader number="2" title="지원받고 싶은 서비스" />
        <div className="flex flex-col gap-3">
          {([0, 1, 2] as (0 | 1 | 2)[]).map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-500 text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
              <input
                type="text"
                value={data.desired_services[i]}
                onChange={e => setService(i, e.target.value)}
                placeholder={`서비스명 ${i + 1}`}
                className="flex-1 p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none text-sm"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// 메인 래퍼
// ──────────────────────────────────────────────────────────────────────────
export default function CarePlanForm({ participantId, participantName, planType, planYear, initialData }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  // 초기 상태 설정
  const [mohwData, setMohwData] = useState<MohwPlanContent>(() => {
    if (planType === 'mohw_plan' && initialData?.content) {
      const c = initialData.content as Partial<MohwPlanContent>
      const base = emptyMohwPlanContent()
      // needs 병합: 저장된 값이 있으면 덮어씀
      const mergedNeeds = { ...base.needs }
      if (c.needs) {
        for (const key of Object.keys(c.needs)) {
          mergedNeeds[key] = c.needs[key]
        }
      }
      return { ...base, ...c, needs: mergedNeeds }
    }
    return emptyMohwPlanContent()
  })

  const [seoulData, setSeoulData] = useState<SeoulPlanContent>(() => {
    if (planType === 'seoul_plan' && initialData?.content) {
      return { ...emptySeoulPlanContent(), ...(initialData.content as Partial<SeoulPlanContent>) }
    }
    return emptySeoulPlanContent()
  })

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const content = planType === 'mohw_plan' ? mohwData : seoulData
      const result = await upsertCarePlan(participantId, planType, planYear, content)
      if (result.success) {
        setMessage('✅ 이용계획서가 저장되었습니다.')
      } else {
        setMessage('❌ ' + (result.error ?? '저장에 실패했습니다.'))
      }
    } catch (e: any) {
      setMessage('❌ 오류: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialData?.id) return
    if (!confirm('이용계획서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    setDeleting(true)
    try {
      const result = await deleteCarePlan(initialData.id)
      if (result.success) {
        router.push('/supporter/documents')
      } else {
        setMessage('❌ ' + (result.error ?? '삭제에 실패했습니다.'))
      }
    } catch (e: any) {
      setMessage('❌ 오류: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-100">
        <span className="text-2xl">📋</span>
        <div>
          <p className="font-black text-zinc-900">{participantName} 님</p>
          <p className="text-sm text-zinc-500">{CARE_PLAN_LABELS[planType]} — {planYear}년</p>
        </div>
        {initialData && (
          <span className="ml-auto px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">저장됨</span>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-bold ${
          message.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {planType === 'mohw_plan' ? (
        <MohwPlanFormInner data={mohwData} onChange={setMohwData} />
      ) : (
        <SeoulPlanFormInner data={seoulData} onChange={setSeoulData} />
      )}

      <div className="flex gap-3 mt-2 sticky bottom-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || deleting}
          className="flex-1 py-5 rounded-3xl bg-zinc-900 text-white text-lg font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all"
        >
          {saving ? '저장 중...' : '💾 이용계획서 저장하기'}
        </button>
        {initialData?.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="px-6 py-5 rounded-3xl bg-red-500 text-white font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all hover:bg-red-600"
          >
            {deleting ? '삭제 중...' : '🗑️'}
          </button>
        )}
      </div>
    </div>
  )
}
