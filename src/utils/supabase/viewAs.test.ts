import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * ★view-as 보안 가드 계약 (W 작성 · 독립 계약 테스트). 구현: src/utils/supabase/viewAs.ts
 * 설계출처: 사용자 결정 2026-09-07(관리자 구글 계정 3역할 접근 = 둘러보기/view-as) +
 *           viewAs.ts 파일 헤더 「★보안」 주석(쿠키만으로는 권한 없음, 실제 admin 검증 필수).
 *
 * 이 테스트가 가두는 최고가치 스펙:
 *  ① resolveViewAs 는 '쿠키가 있어도' 로그인 사용자가 실제 admin(profiles.role='admin')일 때만
 *     active:true 를 낸다. 비관리자(supporter·participant)나 미로그인·프로필부재는 쿠키를 위조해도
 *     ★반드시 {active:false, participantId:null} — 표시대상이 새어 downstream 으로 흘러가면 안 된다.
 *  ② active 일 때만 participantId 가 그 쿠키 대상으로 채워진다(권한이 붙는 유일한 경로).
 *  ③ viewAsWriteBlock 은 active 일 때만 차단문구(뮤테이션 금지), 그 외엔 null(정상 쓰기 허용).
 *
 * 성격: 현 구현에 대해 GREEN 이어야 한다. RED 면 (a)테스트 모킹 오류 (b)실제 보안회귀 를 구분해 보고.
 * 단언은 의도(보안 불변식)를 겨냥하고 구현 문자열을 복사하지 않는다(동어반복 금지).
 */

const h = vi.hoisted(() => ({
  cfg: {
    /** view_as_participant 쿠키 raw 값. null = 쿠키 없음. */
    cookieId: null as string | null,
    /** true 면 cookies() 가 throw(요청 스코프 밖) — getViewAsParticipantId try/catch 검증용. */
    cookiesThrows: false,
    /** auth.getUser() 결과. null = 미로그인. */
    user: null as { id: string } | null,
    /** profiles.role. null 이면서 profileMissing=false 면 role 컬럼 null 행. */
    role: null as string | null,
    /** true 면 profiles 행 자체가 없음(maybeSingle → null). */
    profileMissing: false,
  },
}))

// next/headers: 실제 Next 는 요청 스코프 밖에서 cookies() 가 throw. 그 계약을 모킹으로 재현한다.
vi.mock('next/headers', () => ({
  cookies: async () => {
    if (h.cfg.cookiesThrows) throw new Error('cookies() called outside request scope')
    return {
      get: (name: string) =>
        name === 'view_as_participant' && h.cfg.cookieId != null
          ? { value: h.cfg.cookieId }
          : undefined,
    }
  },
}))

// supabase 서버 클라이언트: auth.getUser + profiles.select('role').eq(id).maybeSingle 만 사용.
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.cfg.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: h.cfg.profileMissing ? null : { role: h.cfg.role },
          }),
        }),
      }),
    }),
  }),
}))

import {
  getViewAsParticipantId,
  resolveViewAs,
  viewAsWriteBlock,
  VIEW_AS_ID_COOKIE,
} from './viewAs'

const TARGET = '11e95b8b-6806-496d-9f36-88bd04e814b3' // 데모 당사자(김지수) — 대상 participants.id 예시
const ADMIN = { id: '00000000-0000-0000-0000-000000000001' }

/** admin + 쿠키 있는 '정상 미리보기' 시나리오로 세팅. 각 테스트가 필요한 필드만 덮어쓴다. */
function baseline() {
  h.cfg.cookieId = TARGET
  h.cfg.cookiesThrows = false
  h.cfg.user = ADMIN
  h.cfg.role = 'admin'
  h.cfg.profileMissing = false
}

beforeEach(() => {
  baseline()
})

describe('viewAs 상수 재export', () => {
  it("VIEW_AS_ID_COOKIE 는 클라이언트/서버 공용 이름 'view_as_participant' 다", () => {
    // 쿠키 이름 계약이 깨지면 클라(배너/FAB/TabBar)와 서버 판정이 어긋나 보안 가드가 무력화된다.
    expect(VIEW_AS_ID_COOKIE).toBe('view_as_participant')
  })
})

describe('getViewAsParticipantId — 쿠키 raw 값 추출(검증 전)', () => {
  it('쿠키가 있으면 그 값을 그대로 돌려준다', async () => {
    h.cfg.cookieId = TARGET
    expect(await getViewAsParticipantId()).toBe(TARGET)
  })

  it('쿠키가 없으면 null', async () => {
    h.cfg.cookieId = null
    expect(await getViewAsParticipantId()).toBeNull()
  })

  it('요청 스코프 밖(cookies() throw)이면 던지지 않고 null (try/catch)', async () => {
    h.cfg.cookiesThrows = true
    // 단위테스트·비요청 컨텍스트에서 cookies() 는 throw → view-as 아님으로 안전 취급.
    await expect(getViewAsParticipantId()).resolves.toBeNull()
  })
})

describe('★resolveViewAs — 관리자 검증까지 마친 active 판정 (보안 최고가치)', () => {
  it('(a) 실제 admin + 쿠키 → active:true, participantId=쿠키 대상', async () => {
    h.cfg.user = ADMIN
    h.cfg.role = 'admin'
    h.cfg.cookieId = TARGET
    const ctx = await resolveViewAs()
    expect(ctx.active).toBe(true)
    // active 인 유일한 경로에서만 표시대상이 채워진다.
    expect(ctx.participantId).toBe(TARGET)
  })

  it('(b) supporter 가 쿠키를 위조해도 → active:false, participantId:null (★데이터 누수 방어)', async () => {
    h.cfg.user = { id: 'supporter-1' }
    h.cfg.role = 'supporter'
    h.cfg.cookieId = TARGET // 위조된 view_as_participant
    const ctx = await resolveViewAs()
    expect(ctx.active).toBe(false)
    // 쿠키 값이 존재해도 비관리자에겐 절대 표시대상이 새지 않아야 한다.
    expect(ctx.participantId).toBeNull()
  })

  it('(c) participant 가 쿠키를 위조해도 → active:false, participantId:null (★데이터 누수 방어)', async () => {
    h.cfg.user = { id: 'participant-1' }
    h.cfg.role = 'participant'
    h.cfg.cookieId = TARGET
    const ctx = await resolveViewAs()
    expect(ctx.active).toBe(false)
    expect(ctx.participantId).toBeNull()
  })

  it('(추가) 로그인했으나 profiles 행이 없으면 admin 으로 승격하지 않는다 → active:false', async () => {
    h.cfg.user = { id: 'ghost-1' }
    h.cfg.profileMissing = true // maybeSingle → null → role undefined !== 'admin'
    h.cfg.cookieId = TARGET
    const ctx = await resolveViewAs()
    expect(ctx.active).toBe(false)
    expect(ctx.participantId).toBeNull()
  })

  it('(d) 쿠키가 없으면 admin 이라도 → active:false, participantId:null', async () => {
    h.cfg.user = ADMIN
    h.cfg.role = 'admin'
    h.cfg.cookieId = null
    const ctx = await resolveViewAs()
    expect(ctx.active).toBe(false)
    expect(ctx.participantId).toBeNull()
  })

  it('(e) 미로그인 + 쿠키 위조 → active:false, participantId:null', async () => {
    h.cfg.user = null
    h.cfg.cookieId = TARGET
    const ctx = await resolveViewAs()
    expect(ctx.active).toBe(false)
    expect(ctx.participantId).toBeNull()
  })
})

describe('viewAsWriteBlock — 미리보기 중 뮤테이션 읽기전용 가드', () => {
  it('active(=admin 미리보기)면 사람이 읽을 한국어 차단문구를 돌려준다(=쓰기 금지 신호)', async () => {
    baseline() // admin + 쿠키 → active
    const blocked = await viewAsWriteBlock()
    // 호출부 패턴 `if (blocked) return { error: blocked }` 가 발동해야 하므로 truthy 문자열이어야 한다.
    expect(typeof blocked).toBe('string')
    expect(blocked).toBeTruthy()
    // 의도: '미리보기 중' 임을 사용자에게 알린다(정확한 문안은 단언하지 않음 — 동어반복 회피).
    expect(blocked).toMatch(/미리보기/)
  })

  it('supporter 가 쿠키를 위조한 경우엔 차단하지 않는다 → null (본인 데이터 쓰기는 정상 허용)', async () => {
    h.cfg.user = { id: 'supporter-1' }
    h.cfg.role = 'supporter'
    h.cfg.cookieId = TARGET
    // 비관리자는 애초에 view-as 가 아니므로 뮤테이션을 막을 이유가 없다(막으면 정상기능 마비).
    expect(await viewAsWriteBlock()).toBeNull()
  })

  it('쿠키가 없으면 → null (일반 세션은 자유롭게 쓴다)', async () => {
    h.cfg.cookieId = null
    expect(await viewAsWriteBlock()).toBeNull()
  })
})
