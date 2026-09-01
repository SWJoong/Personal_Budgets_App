import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PiiTerm } from '@/utils/deidentify'

/**
 * 가명처리 게이트 래퍼 — test-first 골든 계약 (W 작성, U 초록화).
 * 설계: Plan&Source/goala_privacy_deid_assignment_W.md §1-3.
 *
 * 목적: 요약·활동제안 등 텍스트를 AI 로 보내는 액션이 **원문을 직접 callAI 에 넘기지 않도록** 하는
 *   단일 경로. deidentify → callAI → reidentify 를 한 번에 묶는다. 액션은 이 래퍼만 부르면
 *   가명처리가 자동 보장된다(경계 테스트 aiGateBoundary.test.ts 가 직접 callAI 사용을 금지).
 *
 * U 구현 대상: src/utils/aiDeidentify.ts
 *   export async function callAIDeidentified(
 *     userText: string, terms: PiiTerm[], opts?: CallAIOptions
 *   ): Promise<string>
 *   — ★'@/utils/ai' 에서 **callAI 만** import 한다(그래야 이 골든이 Anthropic 생성 없이 목킹 가능).
 *     deidentify/reidentify 는 '@/utils/deidentify' 에서(실제 사용).
 *
 * ★계약 불변식:
 *   1) callAI 로 나가는 텍스트는 **치환된 토큰본** — 원문 식별자가 절대 나가지 않는다.
 *   2) AI 응답의 토큰은 **원문으로 복원**해서 반환(왕복). 토큰 없으면 응답 그대로(누출 없음).
 *   3) 빈 terms → 원문 그대로 전달·응답 그대로 반환(no-op 통과).
 *   4) opts 는 callAI 로 그대로 전달.
 *
 * RED: '@/utils/aiDeidentify' 미존재 → import 실패로 스위트 RED. U 가 구현하면 초록.
 */

// callAI 를 목킹 — 실제 Anthropic 생성/네트워크 없이 게이트 동작만 검증(vi.hoisted 로 팩토리에서 참조).
const { callAIMock } = vi.hoisted(() => ({ callAIMock: vi.fn() }))
vi.mock('@/utils/ai', () => ({ callAI: callAIMock }))

import { callAIDeidentified } from '@/utils/aiDeidentify'

const person = (value: string): PiiTerm => ({ value, kind: 'person' })
const agency = (value: string): PiiTerm => ({ value, kind: 'agency' })

describe('callAIDeidentified — 가명처리 게이트 래퍼 계약', () => {
  beforeEach(() => callAIMock.mockReset())

  it('★callAI 로는 치환된(토큰) 텍스트만 나가고 원문 식별자는 안 나간다', async () => {
    callAIMock.mockResolvedValue('응답')
    await callAIDeidentified('김지수님 이번 달 활동 요약', [person('김지수')])
    expect(callAIMock).toHaveBeenCalledTimes(1)
    const sentText = callAIMock.mock.calls[0][0] as string
    expect(sentText).toBe('[사람1]님 이번 달 활동 요약')
    expect(sentText).not.toContain('김지수')
  })

  it('★AI 응답의 토큰을 원문으로 복원해서 반환한다(왕복)', async () => {
    callAIMock.mockResolvedValue('[사람1]님은 [기관1] 활동을 잘 했어요')
    const out = await callAIDeidentified('김지수님과 아름드리', [person('김지수'), agency('아름드리')])
    expect(out).toBe('김지수님은 아름드리 활동을 잘 했어요')
  })

  it('빈 terms → 원문 그대로 전달, 응답 그대로 반환', async () => {
    callAIMock.mockResolvedValue('그대로 응답')
    const out = await callAIDeidentified('식별자 없는 문장', [])
    expect(callAIMock.mock.calls[0][0]).toBe('식별자 없는 문장')
    expect(out).toBe('그대로 응답')
  })

  it('opts 를 callAI 로 그대로 전달한다', async () => {
    callAIMock.mockResolvedValue('x')
    await callAIDeidentified('김지수님', [person('김지수')], { system: '지침', model: 'claude-x', json: true })
    expect(callAIMock.mock.calls[0][1]).toEqual({ system: '지침', model: 'claude-x', json: true })
  })

  it('응답에 토큰이 없으면 그대로 반환 — 원문 누출 없음', async () => {
    callAIMock.mockResolvedValue('일반 텍스트 응답')
    const out = await callAIDeidentified('김지수님', [person('김지수')])
    expect(out).toBe('일반 텍스트 응답')
  })
})
