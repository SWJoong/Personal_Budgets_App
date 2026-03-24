import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DocumentManagerClient from '@/components/documents/DocumentManagerClient'

export default async function SupporterDocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 지원자 정보 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    redirect('/')
  }

  // 담당 당사자 목록 조회
  let participantsQuery = supabase
    .from('participants')
    .select('id, profiles!participants_id_fkey ( name )')

  if (profile.role === 'supporter') {
    participantsQuery = participantsQuery.eq('assigned_supporter_id', user.id)
  }

  const { data: participants } = await participantsQuery

  // 기존 등록된 모든 서류 조회
  const { data: documents } = await supabase
    .from('file_links')
    .select('*, participant:participants!file_links_participant_id_fkey ( profiles!participants_id_fkey ( name ) )')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">증빙 및 서류 관리</h1>
        <p className="text-zinc-500 mt-1">당사자별 계획서, 평가서, 참고자료를 업로드하거나 링크를 공유합니다.</p>
      </header>

      <main className="max-w-6xl flex flex-col gap-8">
        <DocumentManagerClient 
          participants={(participants || []) as any} 
          initialDocuments={(documents || []) as any} 
        />
      </main>
    </div>
  )
}
