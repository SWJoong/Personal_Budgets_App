import { EmptyState } from '@/components/ui/EmptyState'
import type { GalleryPhoto } from '@/utils/gallery'

/**
 * 활동 사진 그리드 — 당사자·실무자 갤러리 공용 프레젠테이셔널 컴포넌트.
 * 순서는 호출측 mergeGalleryPhotos 가 정하고, 여기선 프롭 순서대로 렌더한다(순수 = 훅 없음, 서버 컴포넌트 OK).
 * 빈 배열이면 EmptyState 로 정상 저하한다.
 */
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  if (photos.length === 0) {
    return (
      <EmptyState emoji="🖼️" title="아직 사진이 없어요." description="지출을 기록할 때 사진을 함께 남겨보세요." />
    )
  }
  return (
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
  )
}
