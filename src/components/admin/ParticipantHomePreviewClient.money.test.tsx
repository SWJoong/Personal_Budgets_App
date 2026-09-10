import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ParticipantHomePreviewClient, {
  type PreviewBalance,
  type PreviewRecentUsage,
} from './ParticipantHomePreviewClient'
import type { UIPreferences } from '@/utils/uiPreferences'
import type { BudgetDomainRow } from '@/utils/budgetByDomain'
import type { CopayDisplay } from '@/utils/copay'

/**
 * 렌더 계약(W레인): 관리자 대리 렌더(당사자 홈 미리보기)의 금액 표시 = 정본 MoneyText 프리미티브로 고정.
 *
 * 배경: 이 컴포넌트의 지역 won() 헬퍼가 (participant)/page.tsx(PR #125)와 동일하게
 * MoneyText(단독 금액) / formatCurrency(문장 삽입 문자열)로 이관됐다. 이 계약은 그 이관이
 * (1) 같은 금액 문자열 (2) 같은 글자색을 보존함을 잠근다.
 * 누군가 MoneyText 를 맨 문자열({amount}원)로 되돌리면 tabular-nums 가 사라지거나(또는 문장으로
 * 병합돼 exact 조회가 깨지거나) 색 이관이 어긋나 이 테스트가 빨개진다. 구현 미수정(테스트 전용).
 *
 * 색 대응(정본 MoneyText): 히어로 잔액 = onHero → text-hero-foreground,
 * 본인부담금·영역별 남은 돈·최근 지출 = emphasis="body" → text-foreground(muted 아님).
 * 히어로 소제목·"…원 썼어요." 문장은 formatCurrency 문자열로 유지(부모의 /70·muted 색을 물려받음) —
 * MoneyText 로 새 span 을 만들지 않으므로 단독 텍스트 노드가 아니다.
 *
 * next/navigation 은 router.refresh()(편집→보기 전환)만 쓰므로 스텁. PreviewBanner(useRouter·Link)와
 * DisplaySettingsClient(서버 의존, 편집 모드에서만 렌더)는 금액 계약과 무관 → null 스텁.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('./PreviewBanner', () => ({ default: () => null }))
vi.mock('@/app/(participant)/settings/display/DisplaySettingsClient', () => ({
  default: () => null,
}))

// 금액 문자열이 서로 겹치지 않게 고른다(각 사이트가 유일한 exact 텍스트로 조회되도록).
const balance: PreviewBalance = { remaining: 123456, allocatedAmount: 500000, spent: 376544 }

const copay: CopayDisplay = {
  show: true,
  amount: 24000,
  title: '내가 낼 돈',
  note: '이 돈은 나중에 따로 내요.',
  pending: false,
}

// status:'ok' → canSpendMore=true → "남은 돈" MoneyText(body) 가 렌더된다.
const budgetRows: BudgetDomainRow[] = [
  {
    domainId: 'd1',
    label: '일상생활',
    plannedSum: 100000,
    usageSum: 40000,
    remaining: 60000,
    unplannedSum: 0,
    status: 'ok',
  },
]

const recentUsages: PreviewRecentUsage[] = [
  { id: 'r1', usageDate: '2026-09-01', amount: 7800, description: '간식' },
]

const prefs: UIPreferences = {
  enabled_blocks: ['domain_breakdown', 'recent_usages'],
  balance_widget_style: 'pie',
  balance_emoji: '🍎',
}

function renderPreview() {
  return render(
    <ParticipantHomePreviewClient
      currentParticipant={{ id: 'p1', name: '김지수' }}
      allParticipants={[{ id: 'p1', name: '김지수' }]}
      prefs={prefs}
      balance={balance}
      copay={copay}
      budgetRows={budgetRows}
      showDomains
      recentUsages={recentUsages}
    />,
  )
}

describe('ParticipantHomePreviewClient — 대리 렌더 금액 표시 계약(MoneyText 이관 고정)', () => {
  it('히어로 잔액은 MoneyText(onHero): "123,456원"이 tabular-nums·text-hero-foreground 로 렌더', () => {
    renderPreview()
    // 맨 문자열이면 바깥 래퍼 span 에 직접 텍스트가 붙어 tabular-nums 가 없다 → RED.
    const hero = screen.getByText('123,456원')
    expect(hero).toHaveClass('tabular-nums') // MoneyText 를 거쳤음
    expect(hero).toHaveClass('text-hero-foreground') // onHero 색 보존
    expect(hero).not.toHaveClass('text-foreground') // 본문색으로 새면 히어로에서 대비 깨짐
  })

  it('본인부담금 금액은 MoneyText(body): "24,000원"이 tabular-nums·text-foreground(muted 아님)', () => {
    renderPreview()
    const copayAmount = screen.getByText('24,000원')
    expect(copayAmount).toHaveClass('tabular-nums') // 반전 시(맨 {amount}원) 사라짐 → RED
    expect(copayAmount).toHaveClass('text-foreground') // body 색 보존
    expect(copayAmount).not.toHaveClass('text-muted-foreground') // muted 로 새지 않음
  })

  it('영역별 남은 돈은 MoneyText(body): "60,000원"이 tabular-nums·text-foreground', () => {
    renderPreview()
    const domainRemaining = screen.getByText('60,000원')
    expect(domainRemaining).toHaveClass('tabular-nums')
    expect(domainRemaining).toHaveClass('text-foreground')
    expect(domainRemaining).not.toHaveClass('text-muted-foreground')
  })

  it('최근 지출 금액은 MoneyText(body): "7,800원"이 tabular-nums·text-foreground', () => {
    renderPreview()
    const recent = screen.getByText('7,800원')
    expect(recent).toHaveClass('tabular-nums')
    expect(recent).toHaveClass('text-foreground')
    expect(recent).not.toHaveClass('text-muted-foreground')
  })

  it('히어로 소제목은 formatCurrency 문자열: 한 문장으로 병합(별도 MoneyText span 아님)', () => {
    renderPreview()
    // 문자열 사이트 → 문장 전체가 한 텍스트("전체 500,000원 중 376,544원 사용했어요")로 렌더된다.
    expect(
      screen.getByText('전체 500,000원 중 376,544원 사용했어요'),
    ).toBeInTheDocument()
    // 병합됐으므로 "500,000원" 단독 텍스트 노드는 없다(부모 /70 opacity 를 물려받는 문자열이라
    // MoneyText 로 새 span 을 만들지 않는다 — 이관 설계상 이 사이트는 문자열이어야 함).
    expect(screen.queryByText('500,000원')).toBeNull()
  })
})
