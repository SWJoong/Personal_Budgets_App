import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 미들웨어(프록시) 공개경로 회귀 가드 — 인증 경계 (W 레인). 대상: PR #167 `src/proxy.ts`.
 * 설계·근거: docs/release/11-p0-privacy-compliance.md §5 (「법적 문서=미인증·온보딩 중 열람 가능」).
 *
 * 왜 가드하나: `/privacy`(처리방침)·`/privacy/easy`(쉬운 말)는 로그인 전에도 열려야 하는 법적 문서다
 *   → proxy 가 공개 경로로 통과시켜야 한다(회귀 시 미인증 사용자가 처리방침을 못 봄 = 법적 결함).
 *   동시에 이 공개 예외가 **실제 앱 라우트로 새어나가면 인증 우회**가 되므로, 임의 보호경로는
 *   여전히 /login 으로 리다이렉트됨을 함께 못 박는다(경계의 양면).
 *
 * 방식: proxy() 함수 단위테스트. `@supabase/ssr` 만 목킹(세션 상태 주입), NextRequest/NextResponse 는 실물.
 *   - 미인증(user=null): 공개경로=통과 / 보호경로=/login 리다이렉트.
 *   - 인증+온보딩미완: 공개경로=통과(온보딩 강제 안 함) / 보호경로=/onboarding 리다이렉트.
 *   판정: NextResponse.redirect → status 307 + Location. 통과(NextResponse.next) → status 200 + Location 없음.
 */

/** 세션 상태(목) — 각 테스트에서 주입. vi.hoisted 로 hoisted mock 팩토리에서 참조 가능. */
const authState = vi.hoisted(() => ({
  user: null as null | { id: string },
  onboardingCompleted: true,
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: authState.user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: authState.user ? { onboarding_completed: authState.onboardingCompleted } : null,
          }),
        }),
      }),
    }),
  }),
}))

import { proxy } from '@/proxy'
import { NextRequest } from 'next/server'

const ORIGIN = 'http://localhost:3000'

async function visit(path: string) {
  return proxy(new NextRequest(new URL(path, ORIGIN)))
}

/** 응답이 지정 경로로의 리다이렉트인가(NextResponse.redirect → 3xx + Location pathname). */
function redirectsTo(res: Awaited<ReturnType<typeof proxy>>, pathname: string): boolean {
  const loc = res.headers.get('location')
  if (!loc) return false
  return res.status >= 300 && res.status < 400 && new URL(loc).pathname === pathname
}

/** 응답이 통과(NextResponse.next)인가 — 어떤 리다이렉트 Location 도 없다. */
function passesThrough(res: Awaited<ReturnType<typeof proxy>>): boolean {
  return res.headers.get('location') === null
}

describe('proxy — 공개경로(개인정보 처리방침) 인증 경계 가드', () => {
  beforeEach(() => {
    authState.user = null
    authState.onboardingCompleted = true
  })

  describe('미인증(user=null)', () => {
    it('/privacy 는 통과한다(로그인 없이 처리방침 열람 가능)', async () => {
      const res = await visit('/privacy')
      expect(passesThrough(res), '/privacy 가 /login 으로 리다이렉트됨(공개경로 회귀)').toBe(true)
      expect(redirectsTo(res, '/login')).toBe(false)
    })

    it('/privacy/easy 는 통과한다(쉬운 말판도 공개)', async () => {
      const res = await visit('/privacy/easy')
      expect(passesThrough(res)).toBe(true)
      expect(redirectsTo(res, '/login')).toBe(false)
    })

    it.each(['/', '/supporter/transactions', '/admin', '/gallery', '/calendar'])(
      '보호경로 %s 는 /login 으로 리다이렉트된다(공개 예외가 앱 라우트로 새지 않음)',
      async (path) => {
        const res = await visit(path)
        expect(redirectsTo(res, '/login'), `${path} 가 인증 없이 통과됨(인증 우회)`).toBe(true)
      }
    )
  })

  describe('인증됨 + 온보딩 미완료', () => {
    beforeEach(() => {
      authState.user = { id: 'user-1' }
      authState.onboardingCompleted = false
    })

    it('/privacy 는 통과한다(공개경로는 온보딩도 강제하지 않음)', async () => {
      const res = await visit('/privacy')
      expect(passesThrough(res), '/privacy 가 /onboarding 으로 리다이렉트됨(공개경로 회귀)').toBe(true)
      expect(redirectsTo(res, '/onboarding')).toBe(false)
    })

    it('보호경로(/supporter/transactions)는 /onboarding 으로 리다이렉트된다(온보딩 게이트 유지)', async () => {
      const res = await visit('/supporter/transactions')
      expect(redirectsTo(res, '/onboarding')).toBe(true)
    })
  })

  /**
   * 과다매칭 하드닝 — `startsWith('/privacy')` 는 `/privacyhack`·`/privacy-settings` 같은 경로도
   *   공개로 취급한다(미인증 통과). 현재 그런 형제 라우트는 없어 실 노출은 없으나, 향후 추가 시 조용히
   *   인증 우회가 된다(발견 S1, docs/release/11 §5-1 권고).
   *
   * ★현재는 SKIP(현 구현에 대해 RED). 저자(U)가 정확 매칭
   *   (`pathname === '/privacy' || pathname.startsWith('/privacy/')`)으로 수정하면 `.skip` 을 제거해
   *   가드를 활성화한다. (W 검증: 정확 매칭 적용 시 GREEN·현 구현에서 RED 됨을 확인함.)
   */
  describe('과다매칭 하드닝(정확 매칭 수정 후 활성화 — 발견 S1)', () => {
    it.each(['/privacyhack', '/privacy-settings', '/privacyzone'])(
      '유사 접두 보호경로 %s 는 /login 으로 리다이렉트된다(공개는 정확히 /privacy·/privacy/* 뿐)',
      async (path) => {
        const res = await visit(path)
        expect(redirectsTo(res, '/login')).toBe(true)
      }
    )
  })
})
