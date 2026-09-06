import { describe, it, expect } from 'vitest'
import { mergeGalleryPhotos, type GalleryPhoto } from '@/utils/gallery'

/**
 * 활동사진 Wave A — 갤러리 2소스 우선순위 병합 골든 (RED: src/utils/gallery.ts 미생성)
 * 설계출처: Plan&Source/goala_activity_photos_W.md §6-1
 *
 * 사용자 결정(2026-09-06): 활동사진 우선 → 영수증 후순위 → 영수증만인 usage 는 영수증만.
 * 정본 해석: 결과 = [...활동사진(date desc), ...영수증(date desc)].
 *   - 활동사진 블록이 항상 영수증 블록보다 앞선다(날짜 무관).
 *   - 활동사진 0장이면 영수증만("영수증만이면 영수증만" 자연 충족).
 *   - url falsy 항목은 버린다(파일 미업로드 = 조용히 필터, 2d 세션 동작과 호환).
 */

const ap = (usageId: string, date: string, extra: Partial<GalleryPhoto> = {}): GalleryPhoto => ({
  usageId, url: `https://s/${usageId}`, label: usageId, date, kind: 'activity', ...extra,
})
const rc = (usageId: string, date: string, extra: Partial<GalleryPhoto> = {}): GalleryPhoto => ({
  usageId, url: `https://s/${usageId}`, label: usageId, date, kind: 'receipt', ...extra,
})

describe('mergeGalleryPhotos — 갤러리 2소스 우선순위', () => {
  it('활동사진이 영수증보다 항상 앞선다 (날짜 무관)', () => {
    // 오래된 활동사진(1월)이 최신 영수증(5월)보다 앞서야 한다.
    const out = mergeGalleryPhotos([ap('a', '2026-01-01')], [rc('r', '2026-05-01')])
    expect(out.map((p) => p.kind)).toEqual(['activity', 'receipt'])
    expect(out.map((p) => p.usageId)).toEqual(['a', 'r'])
  })

  it('활동사진 그룹 내 date 내림차순', () => {
    const out = mergeGalleryPhotos([ap('old', '2026-01-01'), ap('new', '2026-03-01')], [])
    expect(out.map((p) => p.usageId)).toEqual(['new', 'old'])
  })

  it('영수증 그룹 내 date 내림차순', () => {
    const out = mergeGalleryPhotos([], [rc('old', '2026-01-01'), rc('new', '2026-03-01')])
    expect(out.map((p) => p.usageId)).toEqual(['new', 'old'])
  })

  it('활동사진이 없으면 영수증만 (영수증만이면 영수증만)', () => {
    const out = mergeGalleryPhotos([], [rc('r1', '2026-02-01'), rc('r2', '2026-04-01')])
    expect(out.map((p) => p.kind)).toEqual(['receipt', 'receipt'])
    expect(out.map((p) => p.usageId)).toEqual(['r2', 'r1'])
  })

  it('둘 다 있으면 둘 다 보인다', () => {
    const out = mergeGalleryPhotos([ap('a', '2026-02-01')], [rc('r', '2026-02-01')])
    expect(out).toHaveLength(2)
  })

  it('둘 다 비면 빈 배열', () => {
    expect(mergeGalleryPhotos([], [])).toEqual([])
  })

  it('url 이 falsy 인 항목은 버린다 (파일 미업로드 조용히 필터)', () => {
    const out = mergeGalleryPhotos(
      [ap('a', '2026-02-01', { url: '' }), ap('b', '2026-03-01')],
      [rc('r', '2026-01-01', { url: '' })],
    )
    expect(out.map((p) => p.usageId)).toEqual(['b'])
  })

  it('같은 날짜는 입력 순서 보존 (안정 정렬)', () => {
    const out = mergeGalleryPhotos(
      [ap('first', '2026-02-01'), ap('second', '2026-02-01')],
      [],
    )
    expect(out.map((p) => p.usageId)).toEqual(['first', 'second'])
  })

  it('입력 배열을 변형하지 않는다', () => {
    const activity = [ap('a', '2026-01-01'), ap('b', '2026-03-01')]
    const receipt = [rc('r', '2026-02-01')]
    const snapA = activity.map((p) => p.usageId)
    const snapR = receipt.map((p) => p.usageId)
    mergeGalleryPhotos(activity, receipt)
    expect(activity.map((p) => p.usageId)).toEqual(snapA)
    expect(receipt.map((p) => p.usageId)).toEqual(snapR)
  })

  it('kind 는 각 항목에 보존된다', () => {
    const out = mergeGalleryPhotos([ap('a', '2026-02-01')], [rc('r', '2026-01-01')])
    expect(out.find((p) => p.usageId === 'a')?.kind).toBe('activity')
    expect(out.find((p) => p.usageId === 'r')?.kind).toBe('receipt')
  })
})
