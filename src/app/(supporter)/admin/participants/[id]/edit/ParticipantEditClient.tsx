'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { updateParticipant, deleteParticipant } from '@/app/actions/admin'
import { FormField } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/LiveRegion'

interface EditParticipant {
  id: string
  name: string
  email: string
  assigned_supporter_id: string | null
}

interface SupporterOption {
  id: string
  name: string | null
}

/**
 * 관리자 당사자 수정·삭제 폼 (고아 액션 updateParticipant/deleteParticipant 배선).
 * 설계: Plan&Source/goala_admin_participant_edit_W.md · 계약: ParticipantEditClient.test.tsx.
 * 등록 폼(new/page.tsx) UX 미러 — FormField·useToast·현재값 프리필. 삭제는 되돌릴 수 없어 인라인 2단계 확인.
 */
export default function ParticipantEditClient({
  participant,
  supporters,
}: {
  participant: EditParticipant
  supporters: SupporterOption[]
}) {
  const router = useRouter()
  const { announce } = useToast()

  const [name, setName] = useState(participant.name)
  const [email, setEmail] = useState(participant.email)
  const [supporterId, setSupporterId] = useState(participant.assigned_supporter_id ?? '')

  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fail = (msg: string) => {
    setError(msg)
    announce(msg, 'assertive')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setNameError('')
    setEmailError('')
    setError('')

    if (!name.trim()) {
      setNameError('꼭 채워 주세요.')
      announce('이름을 입력해 주세요.', 'assertive')
      return
    }
    if (!email.trim()) {
      setEmailError('꼭 채워 주세요.')
      announce('이메일을 입력해 주세요.', 'assertive')
      return
    }

    setSaving(true)
    try {
      const result = await updateParticipant(participant.id, {
        name: name.trim(),
        email: email.trim(),
        supporterId: supporterId || null,
      })
      if ('error' in result && result.error) {
        fail(result.error)
      } else {
        announce('저장했어요.', 'polite')
        router.push(`/admin/participants/${participant.id}`)
        router.refresh()
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : '저장하지 못했어요. 잠시 후 다시 해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    setDeleting(true)
    setError('')
    try {
      const result = await deleteParticipant(participant.id)
      if ('error' in result && result.error) {
        fail(result.error)
        setConfirmingDelete(false)
      } else {
        router.push('/admin/participants')
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : '삭제하지 못했어요. 잠시 후 다시 해 주세요.')
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <div role="alert" className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium leading-relaxed">
            {error}
          </div>
        )}

        <fieldset className="flex flex-col gap-4 p-5 rounded-2xl bg-card ring-1 ring-border">
          <legend className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">당사자 정보</legend>

          <FormField id="edit-name" label="이름" error={nameError || undefined}>
            {(field) => (
              <input
                {...field}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="당사자 이름"
                className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium min-h-[44px]"
              />
            )}
          </FormField>

          <FormField id="edit-email" label="이메일" error={emailError || undefined} help="당사자가 이 이메일로 구글 로그인하면 자동으로 이 등록 정보와 연결됩니다.">
            {(field) => (
              <input
                {...field}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="participant@example.com"
                className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium min-h-[44px]"
              />
            )}
          </FormField>

          <FormField id="edit-supporter" label="담당자">
            {(field) => (
              <select
                {...field}
                value={supporterId}
                onChange={(e) => setSupporterId(e.target.value)}
                className="p-4 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium min-h-[44px]"
              >
                <option value="">담당자 없음</option>
                {supporters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="p-4 rounded-2xl bg-hero text-hero-foreground font-bold text-base hover:bg-hero-hover transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg min-h-[44px]"
        >
          {saving ? '저장하고 있어요...' : '저장하기'}
        </button>
      </form>

      {/* 위험 구역 — 삭제(되돌릴 수 없음). 인라인 2단계 확인. */}
      <section aria-labelledby="danger-heading" className="flex flex-col gap-3 p-5 rounded-2xl bg-danger-bg ring-1 ring-border">
        <h2 id="danger-heading" className="text-sm font-black text-danger-fg">
          당사자 삭제
        </h2>
        {!confirmingDelete ? (
          <>
            <p className="text-sm text-danger-fg leading-relaxed">
              이 당사자와 관련된 정보가 모두 사라져요. 되돌릴 수 없어요.
            </p>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="self-start px-4 py-3 rounded-xl bg-card ring-1 ring-border text-danger-fg font-bold text-sm hover:bg-danger-bg-hover disabled:opacity-50 min-h-[44px]"
            >
              당사자 삭제하기
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-sm font-bold text-danger-fg leading-relaxed">
              정말 삭제할까요? 되돌릴 수 없어요.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl bg-card ring-1 ring-border text-muted-foreground font-bold text-sm hover:bg-muted-hover disabled:opacity-50 min-h-[44px]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl bg-danger text-danger-foreground font-bold text-sm hover:bg-danger-hover disabled:opacity-50 min-h-[44px]"
              >
                {deleting ? '삭제하고 있어요...' : '네, 삭제할래요'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
