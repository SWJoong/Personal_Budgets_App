import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPill } from '@/components/ui/StatusPill'

/**
 * StatusPill 프리미티브 RED 계약 — P3 재사용 UI 프리미티브 (W 작성, U 초록화).
 *
 * 감사 동기: rounded-full 배지 ~22곳 + 인라인 _STYLE/_LABEL/badge Record 딕셔너리 17파일.
 *   고대비 모드가 모든 status 토큰을 #fff/#000 으로 blank 처리 → 색이 사라진다.
 *   따라서 상태는 반드시 '글자 라벨'로 읽혀야 한다 = 비색큐(S5) 하중 프리미티브.
 *
 * props: label(string, 필수 · 보이는 상태 글자) · intent(success|info|warning|danger|neutral) ·
 *   icon?(장식용, aria-hidden).
 * 불변식(행위/시맨틱만 단언 — 토큰·색상 단언 금지):
 *   1) 어떤 intent 든 항상 label 텍스트를 렌더 → getByText(label) 가 5종 모두에서 해석됨
 *      (상태를 색이 아니라 글자로 전달 = 비색큐 계약을 행위로 표현).
 *   2) 5종 intent 를 가로질러도 label 텍스트(단서)는 불변(색/토큰만 달라짐).
 *   3) 장식 icon 은 aria-hidden 이고, 상태의 의미는 icon 이 아니라 label 에서 온다.
 *
 * RED: '@/components/ui/StatusPill' 미존재 → import 실패로 스위트 전체 RED. U 구현 시 초록.
 */

const INTENTS = ['success', 'info', 'warning', 'danger', 'neutral'] as const

describe('StatusPill — 상태 배지 프리미티브 계약(비색큐)', () => {
  it.each(INTENTS)(
    "intent=%s: label 텍스트가 항상 보인다(색만으로 상태 구분 금지 — 비색큐)",
    (intent) => {
      render(<StatusPill label="정산 대기" intent={intent} />)
      expect(screen.getByText('정산 대기')).toBeInTheDocument()
    }
  )

  it('같은 label 은 intent 가 달라도 그대로 유지된다(단서는 글자, 색은 부차)', () => {
    const { rerender } = render(<StatusPill label="쓰는 중이에요" intent="success" />)
    expect(screen.getByText('쓰는 중이에요')).toBeInTheDocument()
    rerender(<StatusPill label="쓰는 중이에요" intent="warning" />)
    expect(screen.getByText('쓰는 중이에요')).toBeInTheDocument()
  })

  it('장식 icon 은 aria-hidden 이고 상태 의미는 label 에서 온다', () => {
    render(<StatusPill label="정산 완료" intent="success" icon={<span>✅</span>} />)
    // label 텍스트는 항상 접근 가능(스크린리더가 읽는 단서).
    expect(screen.getByText('정산 완료')).toBeInTheDocument()
    // 아이콘은 aria-hidden 컨테이너 안 — 의미를 담지 않는다.
    const icon = screen.getByText('✅')
    expect(icon.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
