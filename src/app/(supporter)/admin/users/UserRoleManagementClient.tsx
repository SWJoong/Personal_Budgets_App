'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/LiveRegion'
import { updateUserRole } from '@/app/actions/admin'
import type { UserRole } from '@/types/database'

/**
 * 관리자 역할 관리 (고아 액션 getAllUsers/updateUserRole 배선 — 완성됐으나 호출 UI 가 없던 것).
 * 설계: Plan&Source/goala_admin_role_management_W.md · 계약: UserRoleManagementClient.test.tsx.
 * 초대(InvitationsClient)·당사자 수정(ParticipantEditClient) UX 미러 — ROLE_LABEL·useToast·인라인 확인.
 * 본인 행은 변경 컨트롤을 아예 내지 않아 락아웃을 UI 에서도 이중 방어(액션이 본인 변경을 막는다).
 * 역할 변경은 권한(민감정보 접근)을 바꾸는 결과가 커 실행 전 인라인 확인을 거친다(오조작 방지).
 */

const ROLE_LABEL: Record<UserRole, string> = {
  admin: '관리자',
  supporter: '실무자',
  participant: '당사자',
}

const ROLE_OPTIONS: UserRole[] = ['admin', 'supporter', 'participant']

// 역할별 한 줄 설명 (확인 단계에서 무엇을 할 수 있게 되는지 쉬운 말로 안내).
const ROLE_HELP: Record<UserRole, string> = {
  admin: '관리자는 모든 당사자 정보를 보고 설정을 바꿀 수 있어요.',
  supporter: '실무자는 맡은 당사자의 예산과 기록을 함께 관리해요.',
  participant: '당사자는 자기 예산과 지출만 볼 수 있어요.',
}

// 현재 역할 뱃지 색 — 범주 구분일 뿐 가치판단 아님(시맨틱 토큰).
const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-info-bg text-info-fg',
  supporter: 'bg-success-bg text-success-fg',
  participant: 'bg-warning-bg text-warning-fg',
}

export interface UserRow {
  id: string
  name: string | null
  email: string | null
  role: UserRole
  created_at: string
}

export default function UserRoleManagementClient({
  users,
  currentUserId,
}: {
  users: UserRow[]
  currentUserId: string
}) {
  const router = useRouter()
  const { announce } = useToast()
  const [pending, startTransition] = useTransition()

  // 행별 선택값(프리필=현재 역할) · 인라인 확인 중인 행(한 번에 한 행만).
  const [selected, setSelected] = useState<Record<string, UserRole>>(() =>
    Object.fromEntries(users.map((u) => [u.id, u.role])),
  )
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  function reset(id: string, role: UserRole) {
    setSelected((prev) => ({ ...prev, [id]: role }))
  }

  function handleConfirm(u: UserRow, displayName: string) {
    const to = selected[u.id]
    startTransition(async () => {
      const result = await updateUserRole(u.id, to)
      if (result?.error) {
        announce(result.error, 'assertive')
        reset(u.id, u.role) // 실패 → 선택값 현재 역할로 되돌림
        setConfirmingId(null)
        return
      }
      announce(`${displayName}님의 역할을 ${ROLE_LABEL[to]}(으)로 바꿨어요.`, 'polite')
      setConfirmingId(null)
      router.refresh()
    })
  }

  return (
    <ul className="flex flex-col gap-3">
      {users.map((u) => {
        const displayName = u.name || '(이름 미등록)'
        const isSelf = u.id === currentUserId
        const value = selected[u.id]
        const confirming = confirmingId === u.id

        return (
          <li key={u.id} className="flex flex-col gap-4 p-5 rounded-2xl bg-card ring-1 ring-border">
            {/* 머리: 이름 · 이메일 · 가입일 · 현재 역할 뱃지 */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col min-w-0 gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground truncate">{displayName}</span>
                  {isSelf && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-black bg-muted text-muted-foreground">
                      나
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground truncate">{u.email || '이메일 없음'}</span>
                <span className="text-xs text-muted-foreground">가입일 {u.created_at.slice(0, 10)}</span>
              </div>
              <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-black ${ROLE_BADGE[u.role]}`}>
                {ROLE_LABEL[u.role]}
              </span>
            </div>

            {/* 변경 영역: 본인 = 안내문 / 확인중 = 확인블록 / 그 외 = select+변경 */}
            {isSelf ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                자신의 역할은 바꿀 수 없어요.
              </p>
            ) : confirming ? (
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-muted ring-1 ring-border">
                <p role="alert" className="text-sm font-bold text-foreground leading-relaxed">
                  {displayName}님을 {ROLE_LABEL[value]}(으)로 바꿀까요?
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{ROLE_HELP[value]}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      reset(u.id, u.role)
                      setConfirmingId(null)
                    }}
                    disabled={pending}
                    className="flex-1 px-4 py-3 rounded-xl bg-card ring-1 ring-border text-muted-foreground font-bold text-sm hover:bg-muted-hover hover:text-foreground disabled:opacity-50 min-h-[44px]"
                  >
                    그대로 두기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirm(u, displayName)}
                    disabled={pending}
                    className="flex-1 px-4 py-3 rounded-xl bg-hero text-hero-foreground font-bold text-sm hover:bg-hero-hover disabled:opacity-50 min-h-[44px]"
                  >
                    {pending ? '바꾸고 있어요...' : '바꾸기'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-stretch gap-2">
                <select
                  id={`role-${u.id}`}
                  aria-label={`${displayName} 역할`}
                  value={value}
                  onChange={(e) => reset(u.id, e.target.value as UserRole)}
                  className="flex-1 min-w-0 p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium text-sm min-h-[44px]"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setConfirmingId(u.id)}
                  disabled={value === u.role}
                  className="shrink-0 px-4 rounded-xl bg-card ring-1 ring-border text-foreground font-bold text-sm hover:bg-muted-hover disabled:opacity-50 min-h-[44px]"
                >
                  변경
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
