import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 활동사진 Wave C — 실무자 갤러리 배선 fs-scan (RED: 실무자 gallery 페이지 미생성)
 * 설계출처: Plan&Source/goala_activity_photos_waveC_W.md §2·§3·§4
 *
 * 렌더 동작은 PhotoGallery.test.tsx 가, 여기서는 실무자 라우트 배선·DRY 교체·진입점을 잡는다.
 */
const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const STAFF = 'src/app/(supporter)/supporter/[participantId]/gallery/page.tsx'
const PART = 'src/app/(participant)/gallery/page.tsx'
const TX = 'src/app/(supporter)/supporter/[participantId]/transactions/page.tsx'

describe('gallery.staff.wiring.ap — 실무자 갤러리 배선', () => {
  it('[RED] 실무자 gallery/page.tsx 가 requireStaff·participantId·활동사진·merge·PhotoGallery 를 쓴다', () => {
    const s = read(STAFF)
    expect(s).toContain('requireStaff')
    expect(s).toContain('participantId')
    expect(s).toContain('seoul_activity_photos')
    expect(s).toContain('mergeGalleryPhotos')
    expect(s).toContain('PhotoGallery')
  })

  it('[RED] 당사자 gallery/page.tsx 가 공용 PhotoGallery 를 쓴다 (DRY 교체)', () => {
    expect(read(PART)).toContain('PhotoGallery')
  })

  it('[RED] transactions/page.tsx 가 실무자 갤러리로 링크한다 (진입점)', () => {
    expect(read(TX)).toMatch(/\/supporter\/\$\{participantId\}\/gallery/)
  })
})
