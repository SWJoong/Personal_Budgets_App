import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import { EmptyState } from '@/components/ui/EmptyState'
import { NoBudgetGate } from '@/components/ui/NoBudgetGate'

export const metadata = { title: '활동 사진' }

export default async function GalleryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const participant = await getCurrentParticipant()

  if (!participant) {
    return (
      <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
        <header className="flex h-14 items-center px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
          <h1 className="text-sm font-black text-foreground">활동 사진</h1>
        </header>
        <NoBudgetGate title="아직 예산 정보가 없어요." emoji="🖼️" variant="page" />
      </div>
    )
  }

  const { data: usages } = await supabase
    .from('seoul_service_usages')
    .select('id, usage_date, description')
    .eq('participant_id', participant.id)

  const usageIds = (usages ?? []).map((u) => u.id)
  const { data: receipts } = usageIds.length
    ? await supabase.from('seoul_receipts').select('usage_id, storage_path').in('usage_id', usageIds)
    : { data: [] as { usage_id: string; storage_path: string }[] }

  const admin = createAdminClient()
  const photos = await Promise.all(
    (receipts ?? []).map(async (r) => {
      const usage = usages?.find((u) => u.id === r.usage_id)
      const { data } = await admin.storage.from('receipts').createSignedUrl(r.storage_path, 3600)
      return {
        usageId: r.usage_id,
        url: data?.signedUrl ?? null,
        description: usage?.description ?? '활동',
        date: usage?.usage_date ?? '',
      }
    })
  )
  // 결정적 정렬: usage_date 최신순(newest first). receipts 자체 날짜가 없어 조인된 usage_date 로 정렬.
  const validPhotos = photos.filter((p) => p.url).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="홈으로 가기">
          ←
        </Link>
        <h1 className="text-sm font-black text-foreground">활동 사진</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 max-w-sm mx-auto w-full">
        {validPhotos.length === 0 ? (
          <EmptyState emoji="🖼️" title="아직 사진이 없어요." description="지출을 기록할 때 사진을 함께 남겨보세요." />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {validPhotos.map((p) => (
              <li key={p.usageId} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url!}
                  alt={p.description}
                  className="w-full aspect-square object-cover rounded-2xl ring-1 ring-border"
                />
                <span className="text-xs text-muted-foreground font-medium truncate">{p.description}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
