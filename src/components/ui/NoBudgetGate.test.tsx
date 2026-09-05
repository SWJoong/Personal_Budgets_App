import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

/**
 * P7 웨이브3 — no-budget 게이트 공유 컴포넌트 (A7·A8) · 계약: nobudget.gate.unit (RED-jsdom)
 * 설계출처: Plan&Source/goala_p7_emptystate_W.md §5(NoBudgetGate) + §3 STATE 3
 *
 * 감사 근거(A7): '아직 예산 정보가 없어요 / 담당 선생님에게 …' 게이트 본문이 7파일에 하드코딩 중복,
 *   시각 셸도 제각각, 이모지 aria-hidden 불일치(A8). 한 공유 컴포넌트로 통일한다.
 *
 * 시그니처(설계 §5): NoBudgetGate({ title, emoji?, body?, action?: {label,href}, variant?: 'page'|'inline' })
 *   · title 은 prop — '예산 정보가 없어요'(예산 없음) vs '예산이 정해지지 않았어요'(배정 없음, ReceiptClient).
 *   · body 기본값 = 문구표준 STATE 3 '담당 선생님에게 말해 주세요.'('말씀'→'말해' easy-read 단순화).
 *   · emoji 는 장식 → 강제 aria-hidden(A8 구조적 해소).
 *   · variant='page' 는 main#main-content 랜드마크 포함, 'inline' 은 카드만.
 *
 * 단언 범위: 문구·랜드마크·aria-hidden·role=link 만. 색·토큰·클래스 문자열은 단언하지 않는다.
 * RED 이유: 컴포넌트 미존재 → beforeAll 의 dynamic import 가 throw → 스위트 전체 RED. U 구현 시 초록.
 * 참고: 정적 import 대신 런타임 상대해석 dynamic import 를 써서 파일 부재 상태에서도 tsc 게이트는
 *   초록을 유지한다(모듈 미존재는 런타임 RED 로만 드러난다).
 */

// string 타입(리터럴 아님)으로 넓혀 tsc 정적 모듈해석을 우회.
const SPEC: string = './NoBudgetGate'
type GateProps = {
  title: string
  emoji?: string
  body?: string
  action?: { label: string; href: string }
  variant?: 'page' | 'inline'
}
type GateComp = (p: GateProps) => ReactElement
// 각 it 에서 로드해 모듈 부재 시 개별 테스트가 확실히 실패(RED)하도록 한다(beforeAll throw→skip 회피).
async function loadGate(): Promise<GateComp> {
  const mod = await import(/* @vite-ignore */ SPEC)
  return mod.NoBudgetGate as GateComp
}

describe('NoBudgetGate — no-budget 게이트 공유 컴포넌트 계약', () => {
  it('[RED] title(prop)과 기본 안내 본문을 렌더한다', async () => {
    const NoBudgetGate = await loadGate()
    render(<NoBudgetGate title="아직 예산 정보가 없어요." />)
    expect(screen.getByText('아직 예산 정보가 없어요.')).toBeInTheDocument()
    // 기본 본문: 담당 선생님에게 말해 주세요 (문구표준 STATE 3)
    expect(screen.getByText(/담당 선생님에게 말해 주세요/)).toBeInTheDocument()
  })

  it('[RED] title 로 배정없음 문구를 분기해 표현할 수 있다', async () => {
    const NoBudgetGate = await loadGate()
    render(<NoBudgetGate title="아직 예산이 정해지지 않았어요." />)
    expect(screen.getByText('아직 예산이 정해지지 않았어요.')).toBeInTheDocument()
  })

  it('[RED] emoji 는 장식 → aria-hidden 이다 (A8)', async () => {
    const NoBudgetGate = await loadGate()
    render(<NoBudgetGate title="아직 예산 정보가 없어요." emoji="👋" />)
    const emoji = screen.getByText('👋')
    expect(emoji.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("[RED] variant='page' 는 main#main-content 랜드마크를 포함한다", async () => {
    const NoBudgetGate = await loadGate()
    const { container } = render(<NoBudgetGate title="아직 예산 정보가 없어요." variant="page" />)
    expect(container.querySelector('#main-content')).not.toBeNull()
  })

  it("[RED] variant='inline' 은 main 랜드마크 없이 카드만 렌더한다", async () => {
    const NoBudgetGate = await loadGate()
    const { container } = render(<NoBudgetGate title="아직 예산 정보가 없어요." variant="inline" />)
    expect(container.querySelector('#main-content')).toBeNull()
  })

  it('[RED] action 제공 시 role=link CTA 를 렌더하고 href 가 일치한다', async () => {
    const NoBudgetGate = await loadGate()
    render(
      <NoBudgetGate title="아직 예산 정보가 없어요." action={{ label: '홈으로 가기', href: '/' }} />
    )
    expect(screen.getByRole('link', { name: '홈으로 가기' })).toHaveAttribute('href', '/')
  })

  it('[RED] action 생략 시 CTA 컨트롤이 없다', async () => {
    const NoBudgetGate = await loadGate()
    render(<NoBudgetGate title="아직 예산 정보가 없어요." />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
