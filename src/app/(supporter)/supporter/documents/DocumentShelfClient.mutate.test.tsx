import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DocumentShelfClient from './DocumentShelfClient'
import { deleteShelfDocument, uploadShelfDocument } from '@/app/actions/document'
import type { DocumentShelf } from '@/utils/documentShelf'

/**
 * A3 서류 보강 — 서류함 업로드/삭제 어포던스 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A3.
 * 구현 대상: src/app/(supporter)/supporter/documents/DocumentShelfClient.tsx.
 *
 * 배경: 셸프는 그동안 열람 전용([열기])이었다. 문서별 삭제 + 참여자 그룹별 서류 추가(업로드)를 붙인다.
 *   pending 같은 상태 가드는 없고(서류엔 정산상태 없음), 업로드는 그룹의 participantId 컨텍스트를 쓴다.
 *
 * RED 사유: deleteShelfDocument·uploadShelfDocument 가 아직 없고 셸프에 삭제/추가 컨트롤이 없다.
 * 단언 범위: 노출·배선만(배치·토큰·문구 정확표기 제외). 그룹을 펼쳐야 문서·컨트롤이 렌더된다.
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

const shelf: DocumentShelf = {
  totalDocuments: 1,
  participants: [
    {
      participantId: 'p-1',
      participantName: '김지수',
      count: 1,
      latestDate: '2026-09-01',
      docs: [
        {
          id: 'doc-1',
          docType: 'other',
          docTypeLabel: '기타',
          fileName: '영수증묶음.pdf',
          note: null,
          createdAt: '2026-09-01',
        },
      ],
    },
  ],
}

function renderAndExpand() {
  const view = render(<DocumentShelfClient shelf={shelf} />)
  // 그룹을 펼쳐야 문서·컨트롤이 렌더된다(참여자 이름 토글).
  fireEvent.click(screen.getByRole('button', { name: /김지수/ }))
  return view
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('A3 — DocumentShelfClient 삭제/업로드 어포던스', () => {
  it('펼친 그룹의 문서에 삭제 컨트롤이 있다', () => {
    renderAndExpand()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('삭제를 확인하면 deleteShelfDocument 가 문서 id 로 호출된다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAndExpand()
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(deleteShelfDocument).toHaveBeenCalledWith('doc-1'))
    confirmSpy.mockRestore()
  })

  it('그룹에 "서류 추가" 어포던스가 있고, 누르면 파일 입력이 나타난다', () => {
    const { container } = renderAndExpand()
    fireEvent.click(screen.getByRole('button', { name: /서류 추가/ }))
    expect(container.querySelector('input[type="file"]')).not.toBeNull()
  })

  it('파일을 고르고 올리면 uploadShelfDocument 가 그룹 participantId 로 호출된다', async () => {
    const { container } = renderAndExpand()
    fireEvent.click(screen.getByRole('button', { name: /서류 추가/ }))
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['hello'], '동의서.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    // 업로드 폼 안의 제출 버튼(올리기).
    fireEvent.click(screen.getByRole('button', { name: '올리기' }))
    await waitFor(() =>
      expect(uploadShelfDocument).toHaveBeenCalledWith(
        expect.objectContaining({ participantId: 'p-1', fileName: '동의서.pdf' }),
      ),
    )
  })
})
