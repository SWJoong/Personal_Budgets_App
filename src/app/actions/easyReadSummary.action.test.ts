import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * 쉬운말 요약 액션 — 당사자 이름 가명처리 배선 가드.
 *
 * 배경: 액션이 당사자 이름을 profiles(id = auth.users.id)에서 plan.participant_id(= participants.id,
 *   기관 발급 키)로 찾아 항상 빈값이었다 → 이름 term 이 빠져 자기서술 속 당사자 이름이 가명처리 없이
 *   국외(Anthropic) 전송. 처리방침(privacyPolicy.ts·/privacy·/privacy/easy)은 "당사자·대리인 이름을
 *   가린 글만 전송"이라 적으므로, 이 테스트가 그 문구를 코드로 받친다.
 *
 * 잠금 계약:
 *  (1) 당사자 이름은 participants.name(id = plan.participant_id)에서 가져와 가명처리 term 에 넣는다.
 *  (2) callAI 로 실제 나가는 본문에 당사자·대리인 실명이 없다(토큰으로 치환).
 *  (3) 당사자 행을 못 읽거나 대리인 조회가 실패하면 AI 를 부르지 않는다(fail-closed).
 * callAI 만 목킹하고 callAIDeidentified·deidentify 는 실물 — 게이트 전체를 통과한 전송본을 본다.
 */

const PARTICIPANT_ID = 'p-1'
const NAME = '김지수'
const PROXY = '박보호'

const h = vi.hoisted(() => ({
  participant: { data: null as unknown, error: null as unknown },
  proxies: { data: [] as unknown, error: null as unknown },
  queries: [] as { table: string; eqs: [string, unknown][] }[],
  sent: [] as string[],
}))

vi.mock('@/utils/audit', () => ({ auditLog: vi.fn(async () => {}) }))
vi.mock('@/utils/ai', () => ({
  AI_MODELS: { summary: 'test-summary-model' },
  callAI: vi.fn(async (text: string) => {
    h.sent.push(text)
    return '요약이에요.'
  }),
}))

function result(table: string) {
  switch (table) {
    case 'seoul_utilization_plans':
      return {
        data: {
          id: 'plan-1',
          participant_id: PARTICIPANT_ID,
          plan_period_start: '2026-01-01',
          plan_period_end: '2026-12-31',
        },
        error: null,
      }
    case 'seoul_self_narratives':
      return {
        data: {
          strengths_talents: `저는 ${NAME}예요. 그림을 잘 그려요.`,
          social_barriers: null,
          desired_change: `${PROXY} 님과 함께 도서관에 가고 싶어요.`,
          desired_life: null,
          goal_to_try: null,
        },
        error: null,
      }
    case 'seoul_requested_services':
      return { data: [], error: null }
    case 'participants':
      return h.participant
    case 'seoul_proxies':
      return h.proxies
    default:
      // profiles 등 다른 테이블로 당사자 이름을 찾으면 빈값 — 옛 오배선을 그대로 재현한다.
      return { data: null, error: null }
  }
}

function sessionClient() {
  return {
    from: (table: string) => {
      const q = { table, eqs: [] as [string, unknown][] }
      h.queries.push(q)
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (col: string, val: unknown) => {
          q.eqs.push([col, val])
          return b
        },
        maybeSingle: async () => result(table),
        then: (resolve: (v: unknown) => void) => resolve(result(table)),
      }
      return b
    },
  }
}

vi.mock('@/utils/supabase/staff', () => ({
  assertStaff: async () => ({ supabase: sessionClient(), user: { id: 'staff-1' } }),
}))

import { generateEasyReadSummary } from './easyReadSummary'

beforeEach(() => {
  h.participant = { data: { name: NAME }, error: null }
  h.proxies = { data: [{ proxy_name: PROXY }], error: null }
  h.queries = []
  h.sent = []
})

describe('generateEasyReadSummary — 당사자 이름 가명처리', () => {
  it('당사자 이름을 participants 에서 plan.participant_id 로 찾는다', async () => {
    await generateEasyReadSummary('plan-1')
    const q = h.queries.find((x) => x.table === 'participants')
    expect(q, 'participants 조회가 없다(이름 term 누락)').toBeDefined()
    expect(q!.eqs).toContainEqual(['id', PARTICIPANT_ID])
  })

  it('AI 로 보내는 글에 당사자·대리인 실명이 없고 토큰으로 바뀐다', async () => {
    const res = await generateEasyReadSummary('plan-1')
    expect(res).toEqual({ summary: '요약이에요.' })
    expect(h.sent).toHaveLength(1)
    const sent = h.sent[0]
    expect(sent).not.toContain(NAME)
    expect(sent).not.toContain(PROXY)
    expect(sent).toContain('[사람1]')
    expect(sent).toContain('[사람2]')
  })

  it('당사자 행을 못 읽으면 AI 를 부르지 않는다(fail-closed)', async () => {
    h.participant = { data: null, error: null }
    const res = await generateEasyReadSummary('plan-1')
    expect(res).toHaveProperty('error')
    expect(h.sent).toHaveLength(0)
  })

  it('대리인 조회가 실패하면 AI 를 부르지 않는다(fail-closed)', async () => {
    h.proxies = { data: null, error: { message: 'boom' } }
    const res = await generateEasyReadSummary('plan-1')
    expect(res).toHaveProperty('error')
    expect(h.sent).toHaveLength(0)
  })
})
