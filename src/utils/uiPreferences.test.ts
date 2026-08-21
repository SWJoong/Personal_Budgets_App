import { describe, it, expect } from 'vitest'
import {
  sanitizeUIPreferences,
  OPTIONAL_BLOCKS,
  DEFAULT_PREFERENCES,
  type UIPreferences,
} from './uiPreferences'

/**
 * 화면 개인화(ui_preferences) 정규화 골든 — GOAL축 A.
 * 설계: Plan&Source/goala_ui_preferences_W.md. RLS 계약: verify_ui_preferences_rls.sql.
 *
 * ★ test-first(W)로 RED — src/utils/uiPreferences.ts 미존재. U 가 구현하면 green.
 *   participants.ui_preferences(JSONB)는 신뢰할 수 없는 클라이언트 입력이므로, 저장·읽기 모두
 *   이 순수함수로 정규화해 (a)알 수 없는 블록 제거 (b)중복 제거 (c)정본 순서 (d)잘못된 값→기본값 을 강제한다.
 */

describe('sanitizeUIPreferences — 신뢰할 수 없는 입력 정규화', () => {
  it('null·garbage 는 기본값', () => {
    expect(sanitizeUIPreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(sanitizeUIPreferences(undefined)).toEqual(DEFAULT_PREFERENCES)
    expect(sanitizeUIPreferences(42)).toEqual(DEFAULT_PREFERENCES)
    expect(sanitizeUIPreferences('x')).toEqual(DEFAULT_PREFERENCES)
    expect(sanitizeUIPreferences({})).toEqual(DEFAULT_PREFERENCES)
  })

  it('알 수 없는 블록은 제거하고 유효한 것만 남긴다', () => {
    const out = sanitizeUIPreferences({ enabled_blocks: [OPTIONAL_BLOCKS[0], 'hack_block', 'balance_widget'] })
    expect(out.enabled_blocks).toEqual([OPTIONAL_BLOCKS[0]]) // 'hack_block'·필수블록('balance_widget')은 제외
  })

  it('중복 블록은 한 번만', () => {
    const b = OPTIONAL_BLOCKS[0]
    const out = sanitizeUIPreferences({ enabled_blocks: [b, b, b] })
    expect(out.enabled_blocks).toEqual([b])
  })

  it('블록 순서는 정본(OPTIONAL_BLOCKS) 순서로 정규화(UI 결정성)', () => {
    const reversed = [...OPTIONAL_BLOCKS].reverse()
    const out = sanitizeUIPreferences({ enabled_blocks: reversed })
    expect(out.enabled_blocks).toEqual(OPTIONAL_BLOCKS) // 입력 역순이어도 정본 순서
  })

  it('enabled_blocks 가 배열이 아니면 기본값 블록', () => {
    const out = sanitizeUIPreferences({ enabled_blocks: 'all' })
    expect(out.enabled_blocks).toEqual(DEFAULT_PREFERENCES.enabled_blocks)
  })

  it('잔액 위젯 스타일 — 유효값 유지, 레거시 pouch→pie 이관, 그 외 기본 pie', () => {
    expect(sanitizeUIPreferences({ balance_widget_style: 'cash' }).balance_widget_style).toBe('cash')
    expect(sanitizeUIPreferences({ balance_widget_style: 'pouch' }).balance_widget_style).toBe('pie') // 구버전
    expect(sanitizeUIPreferences({ balance_widget_style: 'nonsense' }).balance_widget_style).toBe('pie')
    expect(sanitizeUIPreferences({}).balance_widget_style).toBe('pie')
  })

  it('유효한 부분집합은 보존(필수 블록은 enabled_blocks 에 섞이지 않음)', () => {
    const pick = [OPTIONAL_BLOCKS[1], OPTIONAL_BLOCKS[0]]
    const out = sanitizeUIPreferences({ enabled_blocks: pick, balance_widget_style: 'emoji', balance_emoji: '🐥' })
    expect(out.enabled_blocks).toEqual([OPTIONAL_BLOCKS[0], OPTIONAL_BLOCKS[1]]) // 정렬됨
    expect(out.balance_widget_style).toBe('emoji')
    expect(out.balance_emoji).toBe('🐥')
  })

  it('정규화 결과는 항상 같은 형태(멱등)', () => {
    const once = sanitizeUIPreferences({ enabled_blocks: [OPTIONAL_BLOCKS[2], 'junk'], balance_widget_style: 'water' })
    const twice = sanitizeUIPreferences(once as unknown)
    expect(twice).toEqual(once)
  })

  it('DEFAULT_PREFERENCES 자체가 유효(자기 정규화 불변)', () => {
    expect(sanitizeUIPreferences(DEFAULT_PREFERENCES as unknown)).toEqual(DEFAULT_PREFERENCES)
    // enabled_blocks 기본값은 전부 OPTIONAL 소속
    const optSet = new Set<string>(OPTIONAL_BLOCKS as unknown as string[])
    expect((DEFAULT_PREFERENCES.enabled_blocks as string[]).every((b) => optSet.has(b))).toBe(true)
  })
})

// 타입 계약(컴파일 시 확인) — U 구현 시그니처 고정
export const _typecheck = (p: UIPreferences): string[] => p.enabled_blocks
