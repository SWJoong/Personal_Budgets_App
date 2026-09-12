'use client'

import { useState } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import ImageLightbox from '@/components/ui/ImageLightbox'
import type { GalleryPhoto } from '@/utils/gallery'

/**
 * 활동 사진 그리드 — 당사자·실무자 갤러리 공용 컴포넌트. 순서는 호출측 mergeGalleryPhotos 가 정하고,
 * 여기선 프롭 순서대로 렌더한다. 빈 배열이면 EmptyState 로 정상 저하한다.
 * 각 사진은 누를 수 있는 버튼(접근명=label) — 클릭하면 ImageLightbox 로 크게 본다(저시력·인지 접근성,
 * 고아 컴포넌트 복원 §1). Modal 프리미티브가 포커스 트랩/복원(닫으면 눌렀던 사진으로 복귀)을 담당한다.
 * 서버 페이지의 자식으로 쓰이는 클라이언트 컴포넌트(상태=선택된 사진).
 */
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [selected, setSelected] = useState<GalleryPhoto | null>(null)

  if (photos.length === 0) {
    return (
      <EmptyState emoji="🖼️" title="아직 사진이 없어요." description="지출을 기록할 때 사진을 함께 남겨보세요." />
    )
  }
  return (
    <>
      <ul className="grid grid-cols-2 gap-3">
        {photos.map((p, i) => (
          <li key={`${p.kind}-${p.usageId}-${i}`} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setSelected(p)}
              aria-label={`${p.label} 크게 보기`}
              className="rounded-2xl ring-1 ring-border overflow-hidden hover:ring-2 hover:ring-primary transition"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.label}
                className="w-full aspect-square object-cover"
              />
            </button>
            <span className="text-xs text-muted-foreground font-medium truncate">{p.label}</span>
          </li>
        ))}
      </ul>
      {selected && (
        <ImageLightbox src={selected.url} alt={selected.label} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
