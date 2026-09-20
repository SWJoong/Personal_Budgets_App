import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SpeakButton from './SpeakButton'

/**
 * 읽어주기 버튼 계약 — docs/release/14 P1(TTS). tts.speak/stopSpeaking 를 목킹해 배선만 검증
 * (Web Speech API 는 jsdom 에 없으므로 실제 발화는 검증 대상 아님).
 */

const { speakMock, stopMock } = vi.hoisted(() => ({ speakMock: vi.fn(), stopMock: vi.fn() }))
vi.mock('@/utils/tts', () => ({ speak: speakMock, stopSpeaking: stopMock }))

describe('SpeakButton', () => {
  beforeEach(() => {
    speakMock.mockReset()
    stopMock.mockReset()
  })

  it('label 을 접근성 이름으로 쓰고, 처음엔 눌리지 않은 상태다', () => {
    render(<SpeakButton text="남은 돈은 만원이에요." label="남은 돈 읽어주기" />)
    const btn = screen.getByRole('button', { name: '남은 돈 읽어주기' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('누르면 주어진 text 로 speak 를 부르고 눌린 상태가 된다', () => {
    render(<SpeakButton text="읽을 내용" label="읽어주기" />)
    fireEvent.click(screen.getByRole('button', { name: '읽어주기' }))
    expect(speakMock).toHaveBeenCalledTimes(1)
    expect(speakMock.mock.calls[0][0]).toBe('읽을 내용')
    // 재생 중이면 접근성 이름이 '정지' 를 포함하고 aria-pressed=true
    expect(screen.getByRole('button', { name: /정지/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('재생 중 다시 누르면 stopSpeaking 을 부르고 눌리지 않은 상태로 돌아온다', () => {
    render(<SpeakButton text="내용" label="읽어주기" />)
    const btn = () => screen.getByRole('button')
    fireEvent.click(btn()) // 재생 시작
    fireEvent.click(btn()) // 정지
    expect(stopMock).toHaveBeenCalledTimes(1)
    expect(btn()).toHaveAttribute('aria-pressed', 'false')
  })

  it('기본 label 은 "음성으로 듣기"', () => {
    render(<SpeakButton text="내용" />)
    expect(screen.getByRole('button', { name: '음성으로 듣기' })).toBeInTheDocument()
  })
})
