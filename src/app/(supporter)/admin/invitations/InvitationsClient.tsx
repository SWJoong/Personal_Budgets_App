'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/LiveRegion'
import { createInvitation, deleteInvitation, type Invitation, type InvitationRole } from '@/app/actions/admin'

const ROLE_LABEL: Record<InvitationRole, string> = {
  admin: '관리자',
  supporter: '실무자',
  participant: '당사자',
}
const ROLE_OPTIONS: InvitationRole[] = ['supporter', 'participant', 'admin']

/**
 * 사용자 초대 CRUD (GOAL축 A, §4-4) — 관리자가 이메일+역할로 초대 등록/취소. 액션: admin.ts.
 * 실제 메일 발송 아님(DB user_invitations 레코드 = 가입 시 자동 역할부여용).
 * 프리미티브 소비: FormField(이메일 폼)·Modal(삭제 확인)·useToast(진행·결과 라이브 알림).
 */
export default function InvitationsClient({ invitations }: { invitations: Invitation[] }) {
  const router = useRouter()
  const { announce } = useToast()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InvitationRole>('supporter')
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState<Invitation | null>(null)

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    const trimmed = email.trim()
    if (!trimmed) {
      setError('이메일을 입력해 주세요.')
      return
    }
    startTransition(async () => {
      const result = await createInvitation({ email: trimmed, role })
      if (result.error) {
        setError(result.error)
        announce(result.error, 'assertive')
        return
      }
      setEmail('')
      announce(`${trimmed} 님을 ${ROLE_LABEL[role]}로 초대했어요.`, 'polite')
      router.refresh()
    })
  }

  function handleDelete() {
    const target = toDelete
    if (!target) return
    startTransition(async () => {
      const result = await deleteInvitation(target.id)
      setToDelete(null)
      if (result.error) {
        announce(result.error, 'assertive')
        return
      }
      announce('초대를 취소했어요.', 'polite')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 발급 폼 */}
      <form onSubmit={handleCreate} className="p-5 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-3">
        <h2 className="text-sm font-bold text-muted-foreground">새 초대 만들기</h2>

        <FormField
          id="invite-email"
          label="이메일"
          required
          error={error || undefined}
          help="이 이메일로 가입하면 아래 역할이 자동으로 정해져요."
        >
          {(field) => (
            <input
              {...field}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm"
            />
          )}
        </FormField>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-role" className="text-sm font-bold text-muted-foreground">역할</label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as InvitationRole)}
            className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm min-h-[44px]"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="p-3 rounded-xl bg-hero text-hero-foreground font-bold text-sm disabled:opacity-50 min-h-[44px]"
        >
          {pending ? '처리 중…' : '초대 만들기'}
        </button>
      </form>

      {/* 목록 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-muted-foreground">초대 목록 ({invitations.length})</h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed py-6 text-center">아직 초대가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invitations.map((inv) => {
              const used = inv.used_at != null
              return (
                <li key={inv.id} className="p-4 rounded-2xl bg-card ring-1 ring-border flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0 gap-0.5">
                    <span className="font-bold text-foreground truncate">{inv.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABEL[inv.role]} · {used ? '가입 완료' : '대기 중'} · {inv.created_at.slice(0, 10)}
                    </span>
                  </div>
                  {!used && (
                    <button
                      onClick={() => setToDelete(inv)}
                      disabled={pending}
                      className="shrink-0 px-3 min-h-[44px] rounded-xl bg-muted text-muted-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50"
                    >
                      취소
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 삭제 확인 */}
      <Modal open={toDelete != null} onClose={() => setToDelete(null)} label="초대 취소 확인">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">초대를 취소할까요?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {toDelete?.email} 님의 초대를 취소해요. 되돌릴 수 없어요.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setToDelete(null)}
              className="flex-1 p-3 rounded-xl bg-card ring-1 ring-border text-muted-foreground font-bold text-sm min-h-[44px]"
            >
              그대로 두기
            </button>
            <button
              onClick={handleDelete}
              disabled={pending}
              className="flex-1 p-3 rounded-xl bg-danger text-danger-foreground font-bold text-sm disabled:opacity-50 min-h-[44px]"
            >
              초대 취소
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
