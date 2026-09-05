import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P7 웨이브3 — 갤러리 이름 통일 (★사용자 결정) · 계약: gallery.naming (RED-fsscan)
 * 설계출처: Plan&Source/goala_p7_emptystate_W.md §6(갤러리 이름통일 + 정렬)
 *
 * 사용자 결정: 화면 이름 '활동 사진' 으로 통일. 현재 3중 불일치 —
 *   메뉴/metadata = '활동 사진'(이미), 헤더(×2, L19 무참여자 · L60 본문) = '영수증 모아보기', alt = '… 영수증'.
 *
 * 단언:
 *   (1) gallery/page.tsx 에 '영수증 모아보기' 가 0회(두 헤더 모두 '활동 사진' 으로).
 *   (2) img alt 가 '${desc} 영수증' 형태가 아니다(활동 중심 alt) → 소스에 '} 영수증' 잔여 0.
 *   (3) 빈상태/무데이터 문구가 '사진' 기준(영수증이 아닌).
 *   (4) 회귀락: uiPreferences.ts · ui-preferences.ts 는 여전히 '활동 사진' 라벨 유지(드리프트 방지).
 *
 * RED 이유: 오늘 '영수증 모아보기' 와 '} 영수증' 이 소스에 존재 → RED. U 리네임 시 초록.
 * 주의: 2소스 우선순위(활동사진 우선+영수증 폴백)는 범위 밖(gallery.two-source-priority, design-doc).
 */

const ROOT = process.cwd()
const GALLERY = 'src/app/(participant)/gallery/page.tsx'
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('P7-C gallery.naming — 이름 통일 (활동 사진)', () => {
  it("[RED] gallery/page.tsx 에 '영수증 모아보기' 헤더가 없다", () => {
    expect(read(GALLERY)).not.toContain('영수증 모아보기')
  })

  it("[RED] img alt 가 '…영수증' 형태가 아니다 (활동 중심 alt)", () => {
    // 현재: alt={`${p.description} 영수증`} → '} 영수증' 잔여. 리네임 시 소멸.
    expect(read(GALLERY)).not.toMatch(/}\s*영수증/)
  })

  it("[GREEN-lock] uiPreferences 메타데이터 라벨은 여전히 '활동 사진' (드리프트 방지)", () => {
    expect(read('src/utils/uiPreferences.ts')).toContain('활동 사진')
    expect(read('src/types/ui-preferences.ts')).toContain('활동 사진')
  })
})
