import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NetworkEditorClient from './NetworkEditorClient'
import {
  createNetworkEntity,
  updateNetworkEntity,
  deleteNetworkEntity,
  type NetworkEntityRow,
} from '@/app/actions/networkEntities'

/**
 * B3 관계망 — 편집 UI 계약 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_relationship_network_crud_W.md §2 B3.
 * 구현 대상: src/app/(supporter)/supporter/[participantId]/network/NetworkEditorClient.tsx.
 *
 * 배경: 실무자가 당사자 사회 관계망(가족/친구/유급지원/지역사회 4분면)을 CRUD 하는 화면.
 *   AssessmentClient 템플릿(useTransition·router.refresh·inline role="alert"·44px)에 **수정(edit)** 추가
 *   (욕구사정 UI엔 편집 없음). 라우트 /supporter/[participantId]/network(literal /supporter/network 분석
 *   그래프와 별개).
 *
 * RED 사유: NetworkEditorClient 가 아직 없다 → import 실패.
 * 단언 범위: 4분면 그룹 헤딩·엔티티 렌더·추가/수정/삭제 액션 배선만(배치·토큰·문구 정확표기 제외).
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/app/actions/networkEntities', () => ({
  createNetworkEntity: vi.fn(async () => ({ success: true, id: 'new' })),
  updateNetworkEntity: vi.fn(async () => ({ success: true })),
  deleteNetworkEntity: vi.fn(async () => ({ success: true })),
}))

const entities: NetworkEntityRow[] = [
  {
    id: 'e-fam', participant_id: 'p-1', relation_category: 'family', entity_name: '김엄마',
    relation_type: '엄마', closeness: 1, contact_frequency: '주 3회', last_contact_date: null,
    linked_profile_id: null, created_at: '2026-09-01',
  },
  {
    id: 'e-fri', participant_id: 'p-1', relation_category: 'friend', entity_name: '박친구',
    relation_type: '친구', closeness: 2, contact_frequency: null, last_contact_date: null,
    linked_profile_id: null, created_at: '2026-09-01',
  },
]

beforeEach(() => vi.clearAllMocks())

describe('NetworkEditorClient — 관계망 편집 (B3)', () => {
  it('4분면 그룹 헤딩과 각 분면의 엔티티가 렌더된다', () => {
    render(<NetworkEditorClient participantId="p-1" entities={entities} />)
    expect(screen.getByRole('heading', { name: /가족/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /친구/ })).toBeInTheDocument()
    expect(screen.getByText('김엄마')).toBeInTheDocument()
    expect(screen.getByText('박친구')).toBeInTheDocument()
  })

  it('이름·분면을 채우고 추가하면 createNetworkEntity 가 호출된다', async () => {
    render(<NetworkEditorClient participantId="p-1" entities={entities} />)
    fireEvent.change(screen.getByLabelText('관계 구분'), { target: { value: 'community' } })
    fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: '이웃김씨' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    await waitFor(() => expect(createNetworkEntity).toHaveBeenCalledTimes(1))
    expect(createNetworkEntity).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: 'p-1', entityName: '이웃김씨', relationCategory: 'community' }),
    )
  })

  it('수정을 누르면 프리필 폼이 열리고 저장 시 updateNetworkEntity 가 그 id 로 호출된다', async () => {
    render(<NetworkEditorClient participantId="p-1" entities={entities} />)
    fireEvent.click(screen.getByLabelText('김엄마 수정'))
    const nameInput = screen.getByDisplayValue('김엄마') // 편집 폼 프리필
    fireEvent.change(nameInput, { target: { value: '김어머니' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(updateNetworkEntity).toHaveBeenCalledTimes(1))
    expect(updateNetworkEntity).toHaveBeenCalledWith(
      'e-fam',
      expect.objectContaining({ entityName: '김어머니' }),
    )
  })

  it('지우기를 확인하면 deleteNetworkEntity 가 그 id 로 호출된다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<NetworkEditorClient participantId="p-1" entities={entities} />)
    fireEvent.click(screen.getByLabelText('김엄마 지우기'))
    await waitFor(() => expect(deleteNetworkEntity).toHaveBeenCalledWith('e-fam'))
    confirmSpy.mockRestore()
  })
})
