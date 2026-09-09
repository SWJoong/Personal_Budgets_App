import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import NetworkGraphClient from './NetworkGraphClient'
import type { EgoGraph } from '@/utils/egoGraph'

/**
 * 관계망 그래프 — 키보드 노드 선택(§8 ⑤) 계약 (W 저작, sibling).
 * 설계출처: 관계망 관계도 키보드 접근 보강(노드 골라 보기 목록 버튼 = tap 동치 선택).
 *
 * ★ 핵심 계약: selectNode(NetworkGraphClient.tsx:201) 는 setSelected(React) 를
 *   cy 접근(cyRef.current) '전에' 수행한다(:204 → :205 guard). 따라서 cytoscape 스텁이
 *   아무 것도 안 해도(=cy 미로드여도) 키보드 선택 경로(상세 패널 + aria-live 안내)는 검증된다.
 *   cytoscape 는 브라우저(canvas) 전용이므로 최소 체인 스텁으로 모킹해 jsdom 에서 안전하게 렌더한다.
 */

// cytoscape 동적 import 최소 스텁 — 모든 메서드는 체인 가능하고 부작용 없음(브라우저 API 회피).
// vi.mock 은 호이스팅되므로 팩토리 내부에서 전부 자족적으로 구성한다(외부 변수 참조 금지).
vi.mock('cytoscape', () => {
  const makeChain = () => {
    const chain = {
      addClass() {
        return chain
      },
      removeClass() {
        return chain
      },
      connectedEdges() {
        return chain
      },
      unselect() {
        return chain
      },
      select() {
        return chain
      },
      filter() {
        return chain
      },
      length: 0,
    }
    return chain
  }
  const cyStub = {
    on() {},
    edges() {
      return makeChain()
    },
    nodes() {
      return makeChain()
    },
    elements() {
      return makeChain()
    },
    $id() {
      return makeChain()
    },
    animate() {},
    fit() {},
    destroy() {},
  }
  return { default: () => cyStub }
})

// 작은 ego 그래프: 당사자 p1 —(배정받음)→ 예산 b1 —(제공기관)→ 제공기관 s1
const GRAPH: EgoGraph = {
  rootId: 'p1',
  nodes: [
    { node_type: 'Participant', id: 'p1', label: '김지수', depth: 0, group: 'person' },
    { node_type: 'BudgetAllocation', id: 'b1', label: '올해 예산', depth: 1, group: 'money' },
    { node_type: 'ServiceProvider', id: 's1', label: '햇살복지관', depth: 2, group: 'asset' },
  ],
  edges: [
    {
      from_type: 'Participant',
      from_id: 'p1',
      edge_type: 'grants',
      edge_label: '배정받음',
      to_type: 'BudgetAllocation',
      to_id: 'b1',
      direction: 'by',
    },
    {
      from_type: 'BudgetAllocation',
      from_id: 'b1',
      edge_type: 'providedBy',
      edge_label: '제공기관',
      to_type: 'ServiceProvider',
      to_id: 's1',
      direction: 'neutral',
    },
  ],
}

// 렌더 후 남은 비동기(cytoscape 동적 import → setReady/토글 effect) 를 act 안에서 흘려보낸다.
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

// '노드 골라 보기' details 를 펼친다(키보드 사용자가 summary 를 Enter 로 여는 것에 상응).
const openNodePicker = () => {
  const details = screen.getByText(/노드 골라 보기/).closest('details') as HTMLDetailsElement
  details.open = true
  return details
}

afterEach(() => cleanup())

describe('NetworkGraphClient — 키보드 노드 선택(§8 ⑤)', () => {
  it('노드 골라 보기 details 안에 각 노드가 <button>(role=button, name=라벨)으로 존재', async () => {
    render(<NetworkGraphClient graph={GRAPH} participantName="김지수" />)
    openNodePicker()

    // 네이티브 button → role=button, 키보드 포커스·Enter/Space 활성 자동
    const 김지수 = screen.getByRole('button', { name: /김지수/ })
    const 예산 = screen.getByRole('button', { name: /올해 예산/ })
    const 기관 = screen.getByRole('button', { name: /햇살복지관/ })
    expect(김지수.tagName).toBe('BUTTON')
    expect(예산).toBeInTheDocument()
    expect(기관).toBeInTheDocument()
    // 44px 터치 영역
    expect(예산.className).toMatch(/min-h-\[44px\]/)
    await flush()
  })

  it('노드 버튼 클릭 → 선택 상세 패널에 라벨 + 연결관계(from—label→to) 표시, 그 버튼 aria-pressed=true', async () => {
    const { container } = render(<NetworkGraphClient graph={GRAPH} participantName="김지수" />)
    openNodePicker()

    const budgetBtn = screen.getByRole('button', { name: /올해 예산/ })
    expect(budgetBtn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(budgetBtn)

    // 선택 상세는 aria-live 영역 안 — 노드 목록의 동일 라벨과 구분하려 그 영역만 스코프한다.
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement
    expect(live).toBeInTheDocument()
    expect(live.textContent).toContain('올해 예산') // 선택 노드 라벨
    // b1 에 붙은 두 관계(p1→b1, b1→s1) 가 방향 표기로 나타난다.
    expect(live.textContent).toMatch(/김지수\s*—\s*배정받음\s*→\s*올해 예산/)
    expect(live.textContent).toMatch(/올해 예산\s*—\s*제공기관\s*→\s*햇살복지관/)

    // aria-pressed 로 선택 상태 표시
    expect(budgetBtn).toHaveAttribute('aria-pressed', 'true')
    await flush()
  })

  it('다른 노드 클릭 시 상세가 그 노드로 갱신되고 aria-pressed 가 이동', async () => {
    const { container } = render(<NetworkGraphClient graph={GRAPH} participantName="김지수" />)
    openNodePicker()

    const budgetBtn = screen.getByRole('button', { name: /올해 예산/ })
    const providerBtn = screen.getByRole('button', { name: /햇살복지관/ })

    fireEvent.click(budgetBtn)
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement
    expect(live.textContent).toContain('올해 예산')
    expect(budgetBtn).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(providerBtn)
    // 선택·aria-pressed 이동
    expect(providerBtn).toHaveAttribute('aria-pressed', 'true')
    expect(budgetBtn).toHaveAttribute('aria-pressed', 'false')
    // 상세가 s1 관계(b1→s1)로 갱신
    expect(live.textContent).toMatch(/올해 예산\s*—\s*제공기관\s*→\s*햇살복지관/)
    await flush()
  })

  it('cy 미로드(cyRef null)여도 선택 상세가 뜬다 — 키보드 경로가 cy 로딩에 비의존', async () => {
    // flush 전(cytoscape 동적 import 미완) 에 클릭 → setSelected 가 cy 접근 전에 실행됨을 검증.
    const { container } = render(<NetworkGraphClient graph={GRAPH} participantName="김지수" />)
    openNodePicker()
    fireEvent.click(screen.getByRole('button', { name: /김지수/ }))

    const live = container.querySelector('[aria-live="polite"]') as HTMLElement
    expect(live.textContent).toContain('김지수')
    expect(live.textContent).toMatch(/김지수\s*—\s*배정받음\s*→\s*올해 예산/)
    await flush() // 마무리 정리
  })

  it('선택 상세는 항상 존재하는 aria-live 래퍼 안(빈 지속 컨테이너 패턴) — 선택 전엔 비어있다', async () => {
    const { container } = render(<NetworkGraphClient graph={GRAPH} participantName="김지수" />)
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement
    expect(live).toBeInTheDocument()
    expect(live.textContent?.trim()).toBe('')
    await flush()
  })

  it('회귀: role="img" 그래프 + 토글(순환·방향·맞추기, aria-pressed) + 관계 목록 details 유지', async () => {
    render(<NetworkGraphClient graph={GRAPH} participantName="김지수" />)
    expect(screen.getByRole('img', { name: /김지수의 관계망 그림/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /순환 고리만/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /누가 했나/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /가운데 맞추기/ })).toBeInTheDocument()
    expect(screen.getByText(/관계 목록 보기/)).toBeInTheDocument()
    await flush()
  })
})
