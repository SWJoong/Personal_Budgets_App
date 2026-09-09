import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import ReceiptClient from './ReceiptClient'

/**
 * 계약(W레인·RED) : 영수증 저장 실패 경로의 당사자 중복지출 방지 — 기록화면(§8-1 ⑦ 후속).
 * 구현 대상: src/app/(participant)/receipt/ReceiptClient.tsx (handleSubmit)
 *
 * 배경(버그): recordServiceUsage 반환 계약(src/app/actions/serviceUsage.ts)은 세 갈래다
 *   1) { error }                         → 지출 자체가 저장 안 됨(인증·검증·insert 실패: L51/55/62/84)
 *   2) { success:true, usageId, error }  → ★지출은 저장됨, 영수증 이미지 저장만 실패(L96/106)
 *   3) { success:true, usageId }         → 완전 성공(L114)
 * 현재 handleSubmit 은 `if (result.error) { setError; return }` 하나로 1·2 를 똑같이 취급해
 * **폼 리셋·router.refresh 앞에서 bail** 한다. 그래서 (2) 경우 지출은 이미 저장됐는데도 폼이 그대로
 * 남고(금액 유지) 잠금이 없어, 당사자가 '기록하기'를 다시 누르면 recordServiceUsage 가 또 호출돼 중복지출이 난다.
 *
 * 올바른 동작(정본): 지출이 저장된 경우(success && usageId)는 error 가 있어도 **저장으로 취급** —
 * 폼을 리셋(금액 비움 = stale 폼 재제출로 같은 지출을 또 못 냄)하고 router.refresh 하며 영수증 문제는
 * setError+announce 로 알린다. 지출이 저장 안 된 경우(usageId 없음)만 폼을 유지해 재시도를 허용한다.
 * 즉 게이트를 `if (result.error)` → `if (!result.success)`(= usageId 없음)로 좁힌 뒤, 저장분기에서
 * 영수증 error 를 ⑦ 활동사진 부분실패와 같은 방식(refresh 후 announce)으로 합류시키면 된다.
 *
 * 불변식 표현: "지출 저장됨" 은 폼이 리셋됨(amount='')으로, "중복 방지" 는 그 리셋(빈 폼은 재제출돼도
 * 금액검증에 막힘)으로 잠근다 — 재제출 시뮬레이션 없이도 안전하게 검증된다.
 *
 * test-first: 현재 소스는 (2) 를 잘못 취급하므로 첫 케이스는 RED 다. U(구현)가 게이트를 좁혀 green.
 * 테스트 파일만 신설(구현 미수정).
 */

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}))
vi.mock('@/app/actions/serviceUsage', () => ({ recordServiceUsage: vi.fn() }))
vi.mock('@/app/actions/activityPhoto', () => ({ addActivityPhotos: vi.fn() }))
vi.mock('@/app/actions/ocr', () => ({ analyzeReceipt: vi.fn(async () => ({ success: true, data: {} })) }))
vi.mock('@/app/actions/geocode', () => ({ searchPlaces: vi.fn(async () => []) }))
vi.mock('@/app/actions/serviceProvider', () => ({ findOrCreateProvider: vi.fn(async () => ({ providerId: 'prov-1' })) }))

import { recordServiceUsage } from '@/app/actions/serviceUsage'
const recordMock = vi.mocked(recordServiceUsage)

const baseProps = {
  participantId: 'p1',
  allocationId: 'alloc-1',
  requestedServices: [],
  usages: [],
  remaining: 50000,
  spendingRules: [],
}

function renderClient() {
  return render(
    <LiveRegionProvider>
      <ReceiptClient {...baseProps} />
    </LiveRegionProvider>,
  )
}

function amountInput() {
  return screen.getByLabelText(/얼마 썼어요/) as HTMLInputElement
}

function submit() {
  const form = screen.getByRole('button', { name: '기록하기' }).closest('form') as HTMLFormElement
  fireEvent.submit(form)
}

beforeEach(() => {
  refreshMock.mockClear()
  recordMock.mockReset()
})

describe('ReceiptClient — 영수증 저장 실패 경로 중복지출 방지(당사자) §8-1 ⑦ 후속', () => {
  it('지출은 저장됨+영수증 실패(success+usageId+error): 저장으로 취급 → refresh + 폼 리셋(중복지출 차단) + 알림', async () => {
    // 지출은 기록됐고(usageId 있음) 영수증 이미지 저장만 실패한 좁은 경로.
    recordMock.mockResolvedValue({
      success: true,
      usageId: 'u1',
      error: '지출은 기록됐지만 영수증 저장에 실패했어요: storage 5xx',
    })
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })

    submit()

    // (a) 지출이 저장됐으니 목록을 갱신한다 — 현재 코드는 error 분기에서 bail → refresh 안 함 = RED.
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    // (b) 지출 기록은 정확히 1회.
    expect(recordMock).toHaveBeenCalledTimes(1)
    // (c) ★중복지출 차단의 핵심: 폼이 리셋돼 금액이 비워졌다 → 같은 지출을 재제출로 또 낼 수 없다.
    //     현재 코드는 bail 로 '5000' 이 그대로 남아 재클릭 시 중복지출이 나므로 이 단언이 RED.
    expect(amountInput().value).toBe('')
    // (d) 영수증 문제는 당사자에게 알린다(assertive 라이브영역 + 오류 표시).
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(alerts.some((n) => n.textContent?.includes('영수증'))).toBe(true)
    })
  })

  it('회귀: 지출 자체가 저장 안 됨(usageId 없는 error)은 폼을 유지해 다시 시도할 수 있다(과교정 방지)', async () => {
    // 저장된 게 없는 진짜 실패 → 폼을 지우면 안 된다(당사자가 다시 눌러 재시도해야 함).
    recordMock.mockResolvedValue({ error: '이미 기록된 지출이에요.' })
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })

    submit()

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(alerts.some((n) => n.textContent?.includes('이미 기록된 지출이에요'))).toBe(true)
    })
    // 저장된 게 없으니 목록 갱신 안 하고, 폼(금액)은 그대로 둔다 → 재시도 가능(중복위험 없음).
    expect(refreshMock).not.toHaveBeenCalled()
    expect(amountInput().value).toBe('5000')
  })
})
