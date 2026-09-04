import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import { getDocumentShelf } from '@/app/actions/document'
import { buildDocumentShelf } from '@/utils/documentShelf'
import DocumentShelfClient from './DocumentShelfClient'

export const metadata = { title: '서류 보관함' }

/**
 * 증빙/서류 보관함 (GOAL축 B, B2) — ComingSoon 스텁 대체. 담당 실무자/관리자가 담당 당사자 전원의
 * 신청서·동의서 원본을 당사자별로 열람. 설계 Plan&Source/goala_documents_shelf_W.md.
 * ★나열은 getDocumentShelf()=RLS(seoul_can_access) 스코프. 열람 URL 은 인가 후 admin 서명.
 */
export default async function SupporterDocumentsPage() {
  await requireStaff()
  const { rows, error } = await getDocumentShelf()
  const shelf = buildDocumentShelf(rows)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href="/supporter"
          aria-label="대시보드로 가기"
          className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight">서류 보관함</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        {error ? (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm leading-relaxed">
            {error}
          </div>
        ) : (
          <DocumentShelfClient shelf={shelf} />
        )}
      </main>
    </div>
  )
}
