import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DocumentShelfClient from './DocumentShelfClient'
import { deleteShelfDocument, uploadShelfDocument } from '@/app/actions/document'
import type { DocumentShelf } from '@/utils/documentShelf'

/**
 * 서류함 삭제 + 당사자 선택 업로드 계약 (A3 + F1 후속, W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A3(+F1 후속).
 * 구현 대상: src/app/(supporter)/supporter/documents/DocumentShelfClient.tsx.
 *
 * F1 변경: 업로드를 "참여자 그룹 안"에서만 하던 것(서류 0건이면 진입점 부재)을, **상단 당사자-선택
 *   업로드**로 통일한다 — 서류가 하나도 없어도(빈 셸프) 담당 당사자를 골라 첫 서류를 올릴 수 있다.
 *   삭제(문서별)는 그대로. 업로드는 이제 그룹 컨텍스트가 아니라 선택한 당사자(participantId)를 쓴다.
 *
 * RED 사유: 빈 셸프에 업로드 폼이 없고(getByLabelText('당사자') throw), assignableParticipants prop 부재.
 * 단언 범위: 노출·배선만.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/components/ui/LiveRegion', () => ({
  useToast: () => ({ announce: vi.fn() }),
}))
vi.mock('@/app/actions/document', () => ({
  getDocumentSignedUrl: vi.fn(async () => ({ url: 'https://example/x' })),
  deleteShelfDocument: vi.fn(async () => ({ success: true })),
  uploadShelfDocument: vi.fn(async () => ({ success: true, documentId: 'new-doc' })),
}))

const assignable = [
  { id: 'p-1', name: '김지수' },
  { id: 'p-2', name: '박준호' },
]

const shelf: DocumentShelf = {
  totalDocuments: 1,
  participants: [
    {
      participantId: 'p-1',
      participantName: '김지수',
      count: 1,
      latestDate: '2026-09-01',
      docs: [
        { id: 'doc-1', docType: 'other', docTypeLabel: '기타', fileName: '영수증묶음.pdf', note: null, createdAt: '2026-09-01' },
      ],
    },
  ],
}

const emptyShelf: DocumentShelf = { totalDocuments: 0, participants: [] }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DocumentShelfClient — 삭제 + 당사자 선택 업로드 (A3·F1)', () => {
  it('펼친 그룹의 문서에 삭제 컨트롤이 있다', () => {
    render(<DocumentShelfClient shelf={shelf} assignableParticipants={assignable} />)
    fireEvent.click(screen.getByRole('button', { name: /김지수/ }))
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('삭제를 확인하면 deleteShelfDocument 가 문서 id 로 호출된다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<DocumentShelfClient shelf={shelf} assignableParticipants={assignable} />)
    fireEvent.click(screen.getByRole('button', { name: /김지수/ }))
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(deleteShelfDocument).toHaveBeenCalledWith('doc-1'))
    confirmSpy.mockRestore()
  })

  it('★서류가 하나도 없어도(빈 셸프) 당사자 선택 + 파일 업로드 폼이 있다', () => {
    const { container } = render(<DocumentShelfClient shelf={emptyShelf} assignableParticipants={assignable} />)
    expect(screen.getByLabelText('당사자')).toBeInTheDocument() // 참여자 picker
    expect(container.querySelector('input[type="file"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: '올리기' })).toBeInTheDocument()
  })

  it('당사자를 고르고 올리면 그 participantId 로 uploadShelfDocument 가 호출된다', async () => {
    const { container } = render(<DocumentShelfClient shelf={emptyShelf} assignableParticipants={assignable} />)
    fireEvent.change(screen.getByLabelText('당사자'), { target: { value: 'p-2' } })
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['x'], '동의서.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: '올리기' }))
    await waitFor(() => expect(uploadShelfDocument).toHaveBeenCalledTimes(1))
    expect(uploadShelfDocument).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: 'p-2', fileName: '동의서.pdf' }),
    )
  })
})
