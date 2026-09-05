import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P7 웨이브3 — 로딩 스켈레톤 대칭성 (A3) · 계약: loading.exists / loading.render.supporter-lists
 * 설계출처: Plan&Source/goala_p7_emptystate_W.md §4(loading/error 대칭)
 *
 * 감사 근거(A3): 실무자 목록 라우트들에 loading.tsx 가 없다 → 서버 fetch 중 빈 화면.
 *   admin/participants·transactions/[id] 등 일부만 loading.tsx 를 가진 비대칭.
 * budgets 는 목록 라우트(page.tsx)가 없고 [id] 상세만 있어 이 계약에서 제외(7종).
 *
 * (1) RED-fsscan: 7개 loading.tsx 파일 존재.
 * (2) RED-jsdom: 각 loading 이 #main-content(전역 skip-link 목적지, P6-C 불변식) + .animate-pulse
 *     스켈레톤 노드 ≥1 을 가진다. 스켈레톤의 정확한 모양·색은 단언하지 않는다(각 목록 모양은 U 재량).
 *
 * 파일 부재 시 dynamic import 가 throw → 해당 라우트 테스트 RED. U 가 loading.tsx 추가 시 초록.
 * 선례: (participant)/loading.p6c.test.tsx (#main-content) + admin/participants/loading.tsx 모양 템플릿.
 */

const ROOT = process.cwd()
const B = 'src/app/(supporter)/supporter'
const ROUTES = [
  'transactions',
  'participants',
  'plans',
  'applications',
  'evaluations',
  'network',
  'documents',
]

describe('P7-C loading — 실무자 목록 loading.tsx 존재 (loading.exists)', () => {
  it.each(ROUTES)('[RED] %s/loading.tsx 가 존재한다', (r) => {
    expect(existsSync(join(ROOT, B, r, 'loading.tsx'))).toBe(true)
  })
})

describe('P7-C loading — 실무자 목록 loading 렌더 (loading.render)', () => {
  it.each(ROUTES)('[RED] %s/loading 이 #main-content + 스켈레톤(.animate-pulse)을 렌더한다', async (r) => {
    // 파일 부재면 import throw → RED. @vite-ignore 로 정적 글롭분석을 막고 런타임 해석에 맡긴다.
    const mod = await import(/* @vite-ignore */ `./${r}/loading`)
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container.querySelector('#main-content')).not.toBeNull()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(1)
  })
})
