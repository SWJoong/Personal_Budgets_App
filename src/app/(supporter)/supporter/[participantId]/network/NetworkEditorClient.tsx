'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createNetworkEntity,
  updateNetworkEntity,
  deleteNetworkEntity,
  type NetworkEntityRow,
} from '@/app/actions/networkEntities'
import type { RelationCategory } from '@/utils/networkEntity'

/**
 * 관계망 편집 UI (Track B, B3) — 실무자가 당사자의 사회 관계망을 CRUD 한다.
 * 설계출처: Plan&Source/goala_relationship_network_crud_W.md §2 B3.
 *
 * AssessmentClient 템플릿(useTransition + router.refresh · inline role="alert" · 44px)에
 * **수정(edit)** 을 더한 화면. 4분면(가족/친구/유급지원/지역사회)으로 묶어 보여 주고
 * 각 항목을 추가·수정·삭제한다. 라우트 /supporter/[participantId]/network 는 읽기전용 분석
 * 그래프(literal /supporter/network)와 별개.
 */

type Quadrant = { category: RelationCategory; label: string }

const QUADRANTS: Quadrant[] = [
  { category: 'family', label: '가족' },
  { category: 'friend', label: '친구' },
  { category: 'paid_support', label: '유급지원' },
  { category: 'community', label: '지역사회' },
]

const CLOSENESS_OPTIONS = [
  { value: '1', label: '1 · 가장 가까움' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4 · 가장 멀음' },
]

const inputClass =
  'p-3 rounded-xl bg-muted ring-1 ring-border text-foreground leading-relaxed min-h-[44px] w-full'
const selectClass =
  'p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium min-h-[44px] w-full'
const labelClass = 'text-xs text-muted-foreground font-medium'

/** 친밀도 select 의 문자열 값을 액션 입력(number|null)으로 변환한다. */
function closenessToNumber(value: string): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

export default function NetworkEditorClient({
  participantId,
  entities,
}: {
  participantId: string
  entities: NetworkEntityRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // 새 관계 추가 폼 상태
  const [category, setCategory] = useState<RelationCategory>('family')
  const [name, setName] = useState('')
  const [relationType, setRelationType] = useState('')
  const [closeness, setCloseness] = useState('')
  const [contactFrequency, setContactFrequency] = useState('')
  const [lastContactDate, setLastContactDate] = useState('')

  function resetAddForm() {
    setCategory('family')
    setName('')
    setRelationType('')
    setCloseness('')
    setContactFrequency('')
    setLastContactDate('')
  }

  function handleCreate() {
    if (!name.trim()) {
      setError('이름을 입력해 주세요.')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await createNetworkEntity({
        participantId,
        relationCategory: category,
        entityName: name.trim(),
        relationType: relationType.trim() || undefined,
        closeness: closenessToNumber(closeness),
        contactFrequency: contactFrequency.trim() || undefined,
        lastContactDate: lastContactDate || null,
      })
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      resetAddForm()
      router.refresh()
    })
  }

  function handleUpdate(id: string, patch: NetworkEntityPatch) {
    setError('')
    startTransition(async () => {
      const result = await updateNetworkEntity(id, patch)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      setEditingId(null)
      router.refresh()
    })
  }

  function handleDelete(entity: NetworkEntityRow) {
    if (!window.confirm(`'${entity.entity_name}'을(를) 관계망에서 지울까요?`)) return
    setError('')
    startTransition(async () => {
      const result = await deleteNetworkEntity(entity.id)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium"
        >
          {error}
        </div>
      )}

      {/* 4분면 목록 */}
      <div className="flex flex-col gap-5">
        {QUADRANTS.map((q) => {
          const list = entities.filter((e) => e.relation_category === q.category)
          return (
            <section key={q.category} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-base font-bold text-foreground">{q.label}</h3>
                {list.length > 0 && (
                  <span className="text-xs text-muted-foreground">{list.length}명</span>
                )}
              </div>

              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 leading-relaxed">아직 없어요.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {list.map((entity) =>
                    editingId === entity.id ? (
                      <li key={entity.id}>
                        <EditRow
                          entity={entity}
                          pending={pending}
                          onSave={(patch) => handleUpdate(entity.id, patch)}
                          onCancel={() => setEditingId(null)}
                        />
                      </li>
                    ) : (
                      <li
                        key={entity.id}
                        className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-muted ring-1 ring-border"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-foreground truncate">
                            {entity.entity_name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {[
                              entity.relation_type,
                              entity.closeness ? `친밀도 ${entity.closeness}` : null,
                              entity.contact_frequency,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '자세한 정보 없음'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setError('')
                              setEditingId(entity.id)
                            }}
                            disabled={pending}
                            aria-label={`${entity.entity_name} 수정`}
                            className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entity)}
                            disabled={pending}
                            aria-label={`${entity.entity_name} 지우기`}
                            className="text-muted-foreground hover:text-danger-fg transition-colors text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
                          >
                            지우기
                          </button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {/* 새 관계 추가 */}
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-sm font-bold text-muted-foreground">새 관계 추가</h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="network-category" className={labelClass}>
            관계 구분
          </label>
          <select
            id="network-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as RelationCategory)}
            className={selectClass}
          >
            {QUADRANTS.map((q) => (
              <option key={q.category} value={q.category}>
                {q.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="network-name" className={labelClass}>
            이름 *
          </label>
          <input
            id="network-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="network-relation-type" className={labelClass}>
            관계 (안 적어도 돼요)
          </label>
          <input
            id="network-relation-type"
            value={relationType}
            onChange={(e) => setRelationType(e.target.value)}
            placeholder="예: 엄마, 이웃, 활동지원사"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="network-closeness" className={labelClass}>
              친밀도 (1=가장 가까움)
            </label>
            <select
              id="network-closeness"
              value={closeness}
              onChange={(e) => setCloseness(e.target.value)}
              className={selectClass}
            >
              <option value="">안 정함</option>
              {CLOSENESS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="network-last-contact" className={labelClass}>
              마지막 연락 (안 적어도 돼요)
            </label>
            <input
              id="network-last-contact"
              type="date"
              value={lastContactDate}
              onChange={(e) => setLastContactDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="network-contact-frequency" className={labelClass}>
            연락 빈도 (안 적어도 돼요)
          </label>
          <input
            id="network-contact-frequency"
            value={contactFrequency}
            onChange={(e) => setContactFrequency(e.target.value)}
            placeholder="예: 주 1회"
            className={inputClass}
          />
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={pending || !name.trim()}
          className="p-4 rounded-2xl bg-hero text-hero-foreground font-bold text-base hover:bg-hero-hover transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px]"
        >
          {pending ? '저장하고 있어요...' : '추가'}
        </button>
      </section>
    </div>
  )
}

type NetworkEntityPatch = {
  entityName: string
  relationType: string
  closeness: number | null
  contactFrequency: string
  lastContactDate: string | null
}

/** 한 관계망 항목의 인라인 수정 폼 — 현재 값으로 프리필한다. */
function EditRow({
  entity,
  pending,
  onSave,
  onCancel,
}: {
  entity: NetworkEntityRow
  pending: boolean
  onSave: (patch: NetworkEntityPatch) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(entity.entity_name)
  const [relationType, setRelationType] = useState(entity.relation_type ?? '')
  const [closeness, setCloseness] = useState(entity.closeness != null ? String(entity.closeness) : '')
  const [contactFrequency, setContactFrequency] = useState(entity.contact_frequency ?? '')
  const [lastContactDate, setLastContactDate] = useState(entity.last_contact_date ?? '')
  const [localError, setLocalError] = useState('')

  function submit() {
    if (!name.trim()) {
      setLocalError('이름을 입력해 주세요.')
      return
    }
    setLocalError('')
    onSave({
      entityName: name.trim(),
      relationType: relationType.trim(),
      closeness: closenessToNumber(closeness),
      contactFrequency: contactFrequency.trim(),
      lastContactDate: lastContactDate || null,
    })
  }

  return (
    <div className="flex flex-col gap-3 p-3 rounded-2xl bg-card ring-1 ring-border">
      {localError && (
        <p role="alert" className="text-danger-fg text-sm font-medium">
          {localError}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-name-${entity.id}`} className={labelClass}>
          이름
        </label>
        <input
          id={`edit-name-${entity.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-relation-type-${entity.id}`} className={labelClass}>
          관계
        </label>
        <input
          id={`edit-relation-type-${entity.id}`}
          value={relationType}
          onChange={(e) => setRelationType(e.target.value)}
          placeholder="예: 엄마, 이웃, 활동지원사"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`edit-closeness-${entity.id}`} className={labelClass}>
            친밀도 (1=가장 가까움)
          </label>
          <select
            id={`edit-closeness-${entity.id}`}
            value={closeness}
            onChange={(e) => setCloseness(e.target.value)}
            className={selectClass}
          >
            <option value="">안 정함</option>
            {CLOSENESS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`edit-last-contact-${entity.id}`} className={labelClass}>
            마지막 연락
          </label>
          <input
            id={`edit-last-contact-${entity.id}`}
            type="date"
            value={lastContactDate}
            onChange={(e) => setLastContactDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-contact-frequency-${entity.id}`} className={labelClass}>
          연락 빈도
        </label>
        <input
          id={`edit-contact-frequency-${entity.id}`}
          value={contactFrequency}
          onChange={(e) => setContactFrequency(e.target.value)}
          placeholder="예: 주 1회"
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex-1 p-3 rounded-xl bg-hero text-hero-foreground font-bold text-sm hover:bg-hero-hover transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px]"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="flex-1 p-3 rounded-xl bg-muted ring-1 ring-border text-muted-foreground font-bold text-sm hover:ring-foreground transition-colors disabled:opacity-50 min-h-[44px]"
        >
          취소
        </button>
      </div>
    </div>
  )
}
