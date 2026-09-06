import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 활동사진 Wave A — 갤러리 배선 fs-scan (RED: page.tsx 가 아직 영수증만 읽음)
 * 설계출처: Plan&Source/goala_activity_photos_W.md §6-2
 *
 * page.tsx 가 활동사진 소스(seoul_activity_photos 테이블 + activity-photos 버킷)를 읽고,
 * mergeGalleryPhotos 로 영수증과 병합한다. 영수증 소스는 폴백으로 계속 유지.
 * gallery.naming.p7c.test.ts:19 가 예고한 'gallery.two-source-priority' 계약의 배선 절반.
 */

const ROOT = process.cwd()
const GALLERY = 'src/app/(participant)/gallery/page.tsx'
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('gallery.wiring.ap — 활동사진 소스 배선', () => {
  it('[RED] page.tsx 가 seoul_activity_photos 테이블을 읽는다', () => {
    expect(read(GALLERY)).toContain('seoul_activity_photos')
  })

  it('[RED] page.tsx 가 activity-photos 버킷의 signed URL 을 만든다', () => {
    expect(read(GALLERY)).toContain('activity-photos')
  })

  it('[RED] page.tsx 가 mergeGalleryPhotos 로 2소스를 병합한다', () => {
    expect(read(GALLERY)).toContain('mergeGalleryPhotos')
  })

  it('[GREEN-lock] 영수증 소스(seoul_receipts)도 계속 읽는다 (폴백 보존)', () => {
    expect(read(GALLERY)).toContain('seoul_receipts')
  })
})
