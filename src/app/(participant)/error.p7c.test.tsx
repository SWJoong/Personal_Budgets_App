import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement } from 'react'

/**
 * P7 웨이브3 — 당사자 에러 바운더리 (A4) · 계약: error.participant.exists-and-render (RED-jsdom)
 * 설계출처: Plan&Source/goala_p7_emptystate_W.md §4(loading/error 대칭)
 *
 * 감사 근거(A4): (supporter) 라우트그룹엔 error.tsx 가 있으나 (participant) 엔 없다 →
 *   당사자 화면 오류 시 Next 기본(미다듬은) 화면. (supporter)/error.p6c.test.tsx 계약을 당사자로 이식.
 *
 * (1) fs: (participant)/error.tsx 존재.
 * (2) jsdom: 랜드마크 main#main-content + h1(유일, 앞에 h2 시작 금지) + 복구 컨트롤(button, '다시 시도' 류).
 * 단언 범위: 랜드마크·heading 레벨·복구 버튼만. 문구·색·토큰은 단언하지 않는다(easy-read 문구는 W 소유).
 *
 * RED 이유: 파일 부재 → dynamic import throw → RED. U 가 (supporter)/error.tsx 를 당사자 톤으로 이식 시 초록.
 */

const ROOT = process.cwd()
const ERR = 'src/app/(participant)/error.tsx'
// string 타입(리터럴 아님)으로 넓혀 tsc 정적 모듈해석을 우회 — 파일 부재 상태에서도 tsc 게이트는
// 초록 유지, 런타임(vitest)은 테스트 파일 기준 상대해석으로 부재 시 throw → RED.
const SPEC: string = './error'
type ErrComp = (p: { error: Error; reset: () => void }) => ReactElement
async function loadError(): Promise<ErrComp> {
  const mod = await import(/* @vite-ignore */ SPEC)
  return mod.default as ErrComp
}

describe('P7-C error — 당사자 에러 바운더리 (error.participant)', () => {
  it('[RED] (participant)/error.tsx 가 존재한다', () => {
    expect(existsSync(join(ROOT, ERR))).toBe(true)
  })

  it('[RED] 에러 화면이 main#main-content 랜드마크를 가진다', async () => {
    const ParticipantError = await loadError()
    const { container } = render(<ParticipantError error={new Error('boom')} reset={() => {}} />)
    expect(container.querySelector('#main-content')).not.toBeNull()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('[RED] 에러 화면의 최상위 제목이 h1 이다', async () => {
    const ParticipantError = await loadError()
    render(<ParticipantError error={new Error('boom')} reset={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('[RED] 에러 화면이 복구 버튼(다시 시도)을 가진다', async () => {
    const ParticipantError = await loadError()
    render(<ParticipantError error={new Error('boom')} reset={() => {}} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
