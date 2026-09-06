/**
 * 갤러리 2소스 병합 — 활동사진 우선 → 영수증 후순위 (활동사진 백엔드 Wave A).
 * 계약: src/utils/gallery.test.ts · 설계: Plan&Source/goala_activity_photos_W.md §6-1.
 * 사용자 결정(2026-09-06): 활동사진 우선 → 영수증 후순위 → 영수증만인 usage 는 영수증만.
 */

export interface GalleryPhoto {
  usageId: string
  url: string
  /** caption(활동) 또는 usage.description(영수증) */
  label: string
  /** 정렬 키. usage_date 또는 taken_at (ISO). '' 허용(맨 뒤로) */
  date: string
  kind: 'activity' | 'receipt'
}

/** url 이 있는 항목만 남기고 date 내림차순으로 안정 정렬(입력 불변). */
function sortedByDateDesc(photos: GalleryPhoto[]): GalleryPhoto[] {
  return photos
    .filter((p) => p.url)
    .map((p, i) => ({ p, i })) // 인덱스 보존 → 같은 date 안정 정렬
    .sort((a, b) => (a.p.date < b.p.date ? 1 : a.p.date > b.p.date ? -1 : a.i - b.i))
    .map((x) => x.p)
}

/**
 * 갤러리 2소스 병합. 결과 = [...활동사진(date desc), ...영수증(date desc)].
 * 활동사진 블록이 항상 영수증 블록보다 앞선다(날짜 무관). url falsy 항목은 버린다.
 * 입력 배열은 변형하지 않는다.
 */
export function mergeGalleryPhotos(
  activity: GalleryPhoto[],
  receipt: GalleryPhoto[],
): GalleryPhoto[] {
  return [...sortedByDateDesc(activity), ...sortedByDateDesc(receipt)]
}
