import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import { updateProfile } from '@/app/actions/profile'
import ProfileEditClient from './ProfileEditClient'

/**
 * P6 Phase B — 프리미티브 소비자 배선 계약: 프로필 편집 (ProfileEditClient).
 * 설계출처: Plan&Source/goala_p6_phaseB_W.md §LiveRegion 소비자 행위 + 쉬운말 문구.
 *
 * 버킷:
 *   [RED]   저장 성공 공지의 **쉬운말 문구** — 현재 수동태·격식체 '프로필이 저장되었습니다.'(L35).
 *           쉬운 정보 기준(능동태·짧게·~했어요체)의 '저장했어요.' 를 못박아 impl 이 문구를 고치게 강제.
 *   [GUARD] 저장 실패 공지가 role=alert 로 도달(announce assertive 는 이미 배선). 회귀잠금.
 *   [GUARD] label 도달·필수 aria-required. 프리미티브가 이미 제공.
 *
 * ★행위 자체(announce→region 반영)는 이미 초록(LiveRegionProvider 상시 마운트 + 소비자가 announce 호출).
 *   따라서 성공 경로의 유일한 RED 는 '문구'다. 이를 GUARD 와 명확히 분리한다(거짓 RED 금지).
 *
 * ★시퀀싱: Phase A(#103) 와 겹치지 않음 → rebase 불필요.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/app/actions/profile', () => ({
  updateProfile: vi.fn(),
}))

const profile = { id: 'u1', name: '김지수', role: 'participant', bio: null, avatar_url: null }

function renderClient() {
  return render(
    <LiveRegionProvider>
      <ProfileEditClient profile={profile} userEmail="jisu@example.com" isAdminEmail={false} />
    </LiveRegionProvider>,
  )
}

beforeEach(() => {
  vi.mocked(updateProfile).mockReset()
})

describe('ProfileEditClient p6 소비자 — LiveRegion 문구 + 배선', () => {
  it("[RED] 저장 성공 시 role=status 에 쉬운말 '저장했어요.' 가 노출된다", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ success: true })
    renderClient()

    fireEvent.click(screen.getByRole('button', { name: '프로필 저장' }))

    // RED: 현재 문구는 '프로필이 저장되었습니다.' → '저장했어요.' 가 status 영역에 없다.
    await waitFor(() => {
      expect(within(screen.getByRole('status')).getByText('저장했어요.')).toBeInTheDocument()
    })
  })

  it('[GUARD] 저장 실패 시 오류가 role=alert(assertive) 로 도달한다', async () => {
    vi.mocked(updateProfile).mockRejectedValue(new Error('저장에 실패했어요.'))
    renderClient()

    fireEvent.click(screen.getByRole('button', { name: '프로필 저장' }))

    await waitFor(() => {
      expect(within(screen.getByRole('alert')).getByText('저장에 실패했어요.')).toBeInTheDocument()
    })
  })

  it('[GUARD] 이름·소개 입력이 label 로 도달되고 이름은 aria-required 를 갖는다', () => {
    renderClient()
    expect(screen.getByLabelText(/이름/)).toBeInTheDocument()
    expect(screen.getByLabelText('나를 표현하는 한 마디')).toBeInTheDocument()
    expect(screen.getByLabelText(/이름/)).toHaveAttribute('aria-required', 'true')
  })
})
