import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { createAdminClient } from '@/utils/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { PhotoGallery } from '@/components/ui/PhotoGallery'
import { mergeGalleryPhotos, type GalleryPhoto } from '@/utils/gallery'

export const metadata = { title: '활동 사진' }

/**
 * 실무자·관리자용 당사자 활동 사진 갤러리. 당사자 갤러리와 같은 2소스(활동사진 우선 → 영수증 후순위,
 * mergeGalleryPhotos 재사용)를 staff 스코프로 보여준다. 접근 제어는 (supporter) layout(staff 전용) +
 * RLS(seoul_can_access): supporter 는 담당 당사자만, admin 은 전체. URL 위조 participantId 는
 * participants 조회가 RLS 로 비어 notFound.
 */
export default async function StaffGalleryPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  const { data: usages } = await supabase
    .from('seoul_service_usages')
    .select('id, usage_date, description')
    .eq('participant_id', participantId)

  const usageIds = (usages ?? []).map((u) => u.id)
  const usageById = new Map((usages ?? []).map((u) => [u.id, u]))

  // 2소스: 활동사진(activity-photos) 우선 + 영수증(receipts) 폴백. 읽기는 user 스코프 RLS 로 스코프됨.
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

  // signed URL 은 admin(서명만 RLS 우회) — 어떤 행을 읽을지는 위 user 클라 RLS 가 이미 스코프했다.
  const [activity, receipt] = await Promise.all([
    Promise.all(
      (activityRows ?? []).map(async (a): Promise<GalleryPhoto> => {
        const usage = usageById.get(a.usage_id)
        const { data } = await admin.storage.from('activity-photos').createSignedUrl(a.storage_path, 3600)
        return {
          usageId: a.usage_id,
          url: data?.signedUrl ?? '',
          label: a.caption ?? usage?.description ?? '활동',
          date: a.taken_at ?? usage?.usage_date ?? '',
          kind: 'activity',
        }
      })
    ),
    Promise.all(
      (receipts ?? []).map(async (r): Promise<GalleryPhoto> => {
        const usage = usageById.get(r.usage_id)
        const { data } = await admin.storage.from('receipts').createSignedUrl(r.storage_path, 3600)
        return {
          usageId: r.usage_id,
          url: data?.signedUrl ?? '',
          label: usage?.description ?? '활동',
          date: usage?.usage_date ?? '',
          kind: 'receipt',
        }
      })
    ),
  ])

  const photos = mergeGalleryPhotos(activity, receipt)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <PageHeader
        title={`${participant.name ?? ''}님의 활동 사진`}
        backHref={`/supporter/${participantId}/transactions`}
      />
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <PhotoGallery photos={photos} />
      </main>
    </div>
  )
}
