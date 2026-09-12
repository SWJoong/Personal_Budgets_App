import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmojiPicker from './EmojiPicker'

/**
 * 이모지 선택기 계약 (W 레인). 고아 기능 복원 — emojiCatalog(검색·그룹)로 당사자가 잔액 위젯 이모지를 고름.
 * 설계: Plan&Source/goala_orphan_features_restore_W.md §1.
 *
 * 배경: emojiCatalog(loadEmojiCatalog/searchEmoji/getEmojisByGroup)는 만들어졌으나 소비처 0(선택기 UI 없음).
 *   → 당사자가 balance_emoji 를 못 고르고 기본 🪙 고정. 이 선택기가 그 공백을 채운다.
 *
 * catalog 는 비동기 동적 import 라 loadEmojiCatalog 만 목킹(searchEmoji/getEmojisByGroup 은 실제 순수 로직).
 * RED 사유: EmojiPicker 가 아직 없다.
 */

vi.mock('@/utils/emojiCatalog', async (orig) => {
  const actual = await (orig() as Promise<typeof import('@/utils/emojiCatalog')>)
  return {
    ...actual,
    loadEmojiCatalog: vi.fn().mockResolvedValue([
      { emoji: '☕', slug: 'hot_beverage', group: 'Food & Drink' },
      { emoji: '🍎', slug: 'red_apple', group: 'Food & Drink' },
      { emoji: '🐢', slug: 'turtle', group: 'Animals & Nature' },
      { emoji: '🎾', slug: 'tennis', group: 'Activities' },
    ]),
  }
})

beforeEach(() => vi.clearAllMocks())
afterEach(() => cleanup())

describe('EmojiPicker — 이모지 선택기', () => {
  it('카탈로그를 불러와 이모지 격자를 보여준다', async () => {
    render(<EmojiPicker value="🪙" onSelect={vi.fn()} />)
    // 기본 그룹(음식·음료)의 이모지가 로드 후 나타난다.
    await waitFor(() => expect(screen.getByRole('button', { name: /☕/ })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /🍎/ })).toBeInTheDocument()
  })

  it('이모지를 고르면 onSelect(이모지) 호출', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EmojiPicker value="🪙" onSelect={onSelect} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /☕/ })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /☕/ }))
    expect(onSelect).toHaveBeenCalledWith('☕')
  })

  it('검색하면 slug 로 걸러진다', async () => {
    const user = userEvent.setup()
    render(<EmojiPicker value="🪙" onSelect={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /☕/ })).toBeInTheDocument())
    await user.type(screen.getByRole('searchbox'), 'apple')
    await waitFor(() => expect(screen.getByRole('button', { name: /🍎/ })).toBeInTheDocument())
    // 검색 결과에 없는 이모지는 사라진다.
    expect(screen.queryByRole('button', { name: /🐢/ })).not.toBeInTheDocument()
  })

  it('그룹 탭이 있다(한글 라벨)', async () => {
    render(<EmojiPicker value="🪙" onSelect={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /음식·음료/ })).toBeInTheDocument())
  })
})
