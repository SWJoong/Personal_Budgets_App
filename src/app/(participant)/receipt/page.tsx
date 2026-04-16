import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReceiptUploadForm from '@/components/transactions/ReceiptUploadForm'
import { EasyTerm } from '@/components/ui/EasyTerm'
import HelpButton from '@/components/help/HelpButton'
import HelpAutoTrigger from '@/components/help/HelpAutoTrigger'

export default async function ReceiptPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 당사자 본인의 재원 목록 조회
  const { data: participant } = await supabase
    .from('participants')
    .select('*, funding_sources(*)')
    .eq('id', user.id)
    .single()

  // 데이터가 없는 경우 (지원자가 아직 등록하지 않음)
  if (!participant) {
    return (
      <div className="flex flex-col min-h-dvh bg-background text-foreground p-4">
         <header className="flex h-14 items-center gap-3 mb-6">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">아름드리꿈터</span>
          </Link>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <span className="text-6xl">📋</span>
          <p className="text-zinc-500 font-bold">아직 예산 정보가 없어요.<br/>지원자 선생님에게 말씀해 주세요!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <HelpAutoTrigger sectionKey="receipt" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">아름드리꿈터</span>
          </Link>
        </div>
        <HelpButton sectionKey="receipt" />
      </header>

      <main className="flex-1 p-4 w-full">
        <div className="mb-6">
          <h2 className="text-base font-bold text-zinc-800"><EasyTerm formal="새로운 활동 기록" easy="오늘 한 일 적기" /></h2>
          <p className="text-sm text-zinc-500 font-medium mt-0.5">사용한 영수증 사진을 찍어서 보내주세요.</p>
        </div>

        <ReceiptUploadForm 
          participantId={user.id} 
          fundingSources={participant.funding_sources || []} 
        />
      </main>
    </div>
  )
}
