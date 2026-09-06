import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 활동사진 Wave B — 업로드 배선 fs-scan (RED: 기록화면이 아직 addActivityPhotos 를 호출 안 함)
 * 설계출처: Plan&Source/goala_activity_photos_waveB_W.md §3
 *
 * 두 기록화면(당사자 receipt · 실무자 new-transaction)이 usage 생성 후 활동사진을 올리도록
 * addActivityPhotos 를 호출해야 한다. 액션 로직 자체는 activityPhoto.test.ts 가 검증.
 */
const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const ACTION = 'src/app/actions/activityPhoto.ts'
const RECEIPT = 'src/app/(participant)/receipt/ReceiptClient.tsx'
const NEWTX = 'src/app/(supporter)/supporter/[participantId]/transactions/new/NewTransactionClient.tsx'

describe('activityPhoto.wiring.ap — 업로드 배선', () => {
  it('[RED] activityPhoto.ts 가 addActivityPhotos 를 export 한다', () => {
    expect(read(ACTION)).toMatch(
      /export\s+(async\s+)?function\s+addActivityPhotos|export\s+const\s+addActivityPhotos/,
    )
  })

  it('[RED] 당사자 기록화면(ReceiptClient)이 addActivityPhotos 를 호출한다', () => {
    expect(read(RECEIPT)).toContain('addActivityPhotos')
  })

  it('[RED] 실무자 기록화면(NewTransactionClient)이 addActivityPhotos 를 호출한다', () => {
    expect(read(NEWTX)).toContain('addActivityPhotos')
  })
})
