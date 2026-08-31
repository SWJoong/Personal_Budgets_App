import { describe, it, expect } from 'vitest'
import { deidentify, reidentify, type PiiTerm } from '@/utils/deidentify'

/**
 * 가명처리 게이트웨이 — test-first 골든 계약 (W 작성, U 초록화).
 * 설계: Plan&Source/goala_privacy_deid_assignment_W.md §1 · 로드맵 harness-plan §8.3 B5.
 *
 * AI(callAI) 로 텍스트를 보내기 전 이름·기관명 등 식별자를 안정 토큰으로 치환하고,
 * AI 응답을 원문으로 복원한다. 토큰 맵은 요청 스코프 메모리에만 두고 저장·로깅하지 않는다(설계 §1-1).
 *
 * ★계약이 못박는 불변식:
 *   - 토큰 형식 = `[사람N]`·`[기관N]`·`[장소N]`. 넘버링은 terms **입력 순서**(카이별 1부터) — 호출부가 예측 가능.
 *   - 안정성: 같은 value 는 한 호출 안에서 항상 같은 토큰(여러 번 등장해도 하나).
 *   - 겹침 안전: 긴 value 를 먼저 치환한다('김지수'가 '김' 토큰에 깨지지 않는다).
 *   - 왕복 무손실: reidentify(deidentify(t, terms).text, map) === t.
 *   - 텍스트에 나타나지 않은 term 은 토큰·map 을 만들지 않는다(불필요 토큰 금지).
 *
 * RED: '@/utils/deidentify' 미존재 → import 실패로 스위트 전체 RED. U 가 계약대로 구현하면 초록.
 */

const person = (value: string): PiiTerm => ({ value, kind: 'person' })
const agency = (value: string): PiiTerm => ({ value, kind: 'agency' })
const place = (value: string): PiiTerm => ({ value, kind: 'place' })

describe('deidentify — 식별자 → 토큰 치환 계약', () => {
  it('빈 terms → 원문 그대로, 빈 map', () => {
    expect(deidentify('오늘 활동이 즐거웠어요', [])).toEqual({ text: '오늘 활동이 즐거웠어요', map: {} })
  })

  it('기본 치환: 이름을 [사람1] 로 바꾸고 map 에 복원쌍을 담는다', () => {
    const r = deidentify('김지수님이 카페에 갔어요', [person('김지수')])
    expect(r.text).toBe('[사람1]님이 카페에 갔어요')
    expect(r.map).toEqual({ '[사람1]': '김지수' })
  })

  it('kind별 카운터 + 입력 순서 넘버링(사람/기관/장소)', () => {
    const r = deidentify('김지수님은 아름드리에서 은평구청 담당자를 만났다', [
      person('김지수'),
      agency('아름드리'),
      place('은평구청'),
    ])
    expect(r.text).toBe('[사람1]님은 [기관1]에서 [장소1] 담당자를 만났다')
    expect(r.map).toEqual({ '[사람1]': '김지수', '[기관1]': '아름드리', '[장소1]': '은평구청' })
  })

  it('안정성: 같은 이름이 여러 번 나와도 토큰은 하나(모두 같은 토큰)', () => {
    const r = deidentify('김지수님과 김지수님의 활동', [person('김지수')])
    expect(r.text).toBe('[사람1]님과 [사람1]님의 활동')
    expect(r.map).toEqual({ '[사람1]': '김지수' })
  })

  it('겹침 안전: 긴 value 를 먼저 치환한다(부분 파괴 없음)', () => {
    // 입력 순서 넘버링: 김지수=사람1, 김=사람2. 치환은 긴 것(김지수) 먼저라 통째로 바뀐다.
    const r = deidentify('김지수 님, 김 선생님', [person('김지수'), person('김')])
    expect(r.text).toBe('[사람1] 님, [사람2] 선생님')
    expect(r.map).toEqual({ '[사람1]': '김지수', '[사람2]': '김' })
  })

  it('텍스트에 없는 term 은 토큰·map 을 만들지 않는다', () => {
    const r = deidentify('오늘은 조용했어요', [person('박영희'), agency('든든복지관')])
    expect(r).toEqual({ text: '오늘은 조용했어요', map: {} })
  })

  it('같은 value 중복 term → 토큰 하나', () => {
    const r = deidentify('김지수님', [person('김지수'), person('김지수')])
    expect(r.text).toBe('[사람1]님')
    expect(Object.keys(r.map)).toEqual(['[사람1]'])
  })
})

describe('reidentify — 토큰 → 원문 복원 계약', () => {
  it('map 의 토큰을 전역 복원한다(여러 번 등장해도 전부)', () => {
    const restored = reidentify('[사람1]님과 [사람1]님, [기관1] 방문', {
      '[사람1]': '김지수',
      '[기관1]': '아름드리',
    })
    expect(restored).toBe('김지수님과 김지수님, 아름드리 방문')
  })

  it('★왕복 무손실: deidentify → reidentify 가 원문을 복원한다', () => {
    const original = '김지수님이 아름드리에서 은평구청 담당자와 김지수님 계획을 논의했어요'
    const terms = [person('김지수'), agency('아름드리'), place('은평구청')]
    const { text, map } = deidentify(original, terms)
    // 치환된 텍스트엔 원문 식별자가 남지 않는다.
    expect(text).not.toContain('김지수')
    expect(text).not.toContain('아름드리')
    expect(reidentify(text, map)).toBe(original)
  })
})
