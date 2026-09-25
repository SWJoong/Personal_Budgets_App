import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransactionsLedgerClient, { type LedgerTxRow } from './TransactionsLedgerClient'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import { updateServiceUsage, deleteServiceUsage } from '@/app/actions/serviceUsage'

/**
 * 거래장부 표 인라인 편집 — 오류 안내 채널 계약(실제 LiveRegionProvider 사용).
 * 한 오류는 한 채널로만 읽는다: 표 위 인라인 role=alert. 전역 알림 영역까지 쓰면 스크린리더가 두 번 읽는다
 * (LiveRegion 은 같은 문구도 매번 새 노드로 넣어 다시 읽히므로, 반복 오류마다 두 번 읽히게 된다).
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/actions/serviceUsage', () => ({
  updateServiceUsage: vi.fn(),
  deleteServiceUsage: vi.fn(),
}))

const ERR = '정산 대기 중인 지출만 고칠 수 있어요.'
const ROWS: LedgerTxRow[] = [
  { id: 'u1', usageDate: '2026-09-10', description: '미술 재료', amount: 15000, settlementStatus: 'pending' },
]

/** 오류 문구가 든 role=alert 들 — 인라인(p)과 전역 영역(span 을 담은 div)을 구분해 센다. */
function alertsWith(text: string) {
  return screen.getAllByRole('alert').filter((el) => el.textContent?.includes(text))
}
function globalAlert() {
  return screen.getAllByRole('alert').find((el) => el.getAttribute('aria-live') === 'assertive')!
}

function renderLedger() {
  return render(
    <LiveRegionProvider>
      <TransactionsLedgerClient rows={ROWS} />
    </LiveRegionProvider>,
  )
}

beforeEach(() => {
  vi.mocked(updateServiceUsage).mockReset()
  vi.mocked(deleteServiceUsage).mockReset()
})

describe('TransactionsLedgerClient — 오류는 인라인 한 채널로만', () => {
  it('수정 저장 실패: 오류가 든 alert 는 인라인 1개뿐이고, 같은 오류로 다시 실패하면 인라인이 새로 들어간다', async () => {
    vi.mocked(updateServiceUsage).mockResolvedValue({ error: ERR })
    const user = userEvent.setup()
    renderLedger()
    await user.click(screen.getByRole('button', { name: '수정' }))

    await user.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(alertsWith(ERR)).toHaveLength(1))
    const first = alertsWith(ERR)[0]
    expect(first.tagName).toBe('P')
    expect(globalAlert()).toHaveTextContent('')

    // 저장 버튼은 전환 중 disabled — 다시 켜진 뒤 누른다(비활성 클릭 no-op 방지).
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(vi.mocked(updateServiceUsage)).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(alertsWith(ERR)).toHaveLength(1))
    expect(alertsWith(ERR)[0]).not.toBe(first)
    expect(globalAlert()).toHaveTextContent('')
  })

  it('삭제 실패도 인라인 1개만 — 전역 알림 영역은 비어 있다', async () => {
    vi.mocked(deleteServiceUsage).mockResolvedValue({ error: ERR })
    const user = userEvent.setup()
    renderLedger()
    await user.click(screen.getByRole('button', { name: '수정' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제' })) // 2단계 확인

    await waitFor(() => expect(alertsWith(ERR)).toHaveLength(1))
    expect(alertsWith(ERR)[0].tagName).toBe('P')
    expect(globalAlert()).toHaveTextContent('')
  })

  it('성공 안내는 전역(polite) 영역으로 읽는다', async () => {
    vi.mocked(updateServiceUsage).mockResolvedValue({ success: true })
    const user = userEvent.setup()
    renderLedger()
    await user.click(screen.getByRole('button', { name: '수정' }))
    await user.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('지출을 수정했어요.'))
  })
})
