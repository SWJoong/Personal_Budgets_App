import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import { EmptyState } from '@/components/ui/EmptyState'
import { NoBudgetGate } from '@/components/ui/NoBudgetGate'
import { mergeGalleryPhotos, type GalleryPhoto } from '@/utils/gallery'

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
  const usageById = new Map((usages ?? []).map((u) => [u.id, u]))

  // 2소스: 활동사진(activity-photos 버킷) 우선 + 영수증(receipts 버킷) 폴백. 둘 다 usage 로 조인.
  const [{ data: activityRows }, { data: receipts }] = usageIds.length
    ? await Promise.all([
        supabase
          .from('seoul_activity_photos')
          .select('usage_id, storage_path, caption, taken_at')
          .in('usage_id', usageIds),
        supabase.from('seoul_receipts').select('usage_id, storage_path').in('usage_id', usageIds),
      ])
    : [
        { data: [] as { usage_id: string; storage_path: string; caption: string | null; taken_at: string | null }[] },
        { data: [] as { usage_id: string; storage_path: string }[] },
      ]

  const admin = createAdminClient()

  // 활동사진 — activity-photos 버킷. 라벨=caption 우선, 정렬키=taken_at 우선(없으면 usage_date).
  const activity: GalleryPhoto[] = await Promise.all(
    (activityRows ?? []).map(async (a) => {
      const usage = usageById.get(a.usage_id)
      const { data } = await admin.storage.from('activity-photos').createSignedUrl(a.storage_path, 3600)
      return {
        usageId: a.usage_id,
        url: data?.signedUrl ?? '',
        label: a.caption ?? usage?.description ?? '활동',
        date: a.taken_at ?? usage?.usage_date ?? '',
        kind: 'activity' as const,
      }
    })
  )

  // 영수증 — receipts 버킷(활동사진이 없던 usage 의 폴백). 라벨=description, 정렬키=usage_date.
  const receipt: GalleryPhoto[] = await Promise.all(
    (receipts ?? []).map(async (r) => {
      const usage = usageById.get(r.usage_id)
      const { data } = await admin.storage.from('receipts').createSignedUrl(r.storage_path, 3600)
      return {
        usageId: r.usage_id,
        url: data?.signedUrl ?? '',
        label: usage?.description ?? '활동',
        date: usage?.usage_date ?? '',
        kind: 'receipt' as const,
      }
    })
  )

  // 활동사진 우선 → 영수증 후순위. url falsy(파일 미업로드) 는 mergeGalleryPhotos 가 조용히 필터.
  const photos = mergeGalleryPhotos(activity, receipt)

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="홈으로 가기">
          ←
        </Link>
        <h1 className="text-sm font-black text-foreground">활동 사진</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 max-w-sm mx-auto w-full">
        {photos.length === 0 ? (
          <EmptyState emoji="🖼️" title="아직 사진이 없어요." description="지출을 기록할 때 사진을 함께 남겨보세요." />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {photos.map((p, i) => (
              <li key={`${p.kind}-${p.usageId}-${i}`} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.label}
                  className="w-full aspect-square object-cover rounded-2xl ring-1 ring-border"
                />
                <span className="text-xs text-muted-foreground font-medium truncate">{p.label}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
