import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

/**
 * 개인정보 처리방침(전문 /privacy) 렌더 회귀 가드 (W 레인). 대상: PR #167.
 * 근거 콘텐츠: docs/release/11-p0-privacy-compliance.md §2 (수집항목·수탁자·국외이전·권리·안전조치).
 *
 * 두 축을 못 박는다:
 *  (A) PRIVACY_DRAFT 스위치 — true=초안 배너(role="note") 노출 / false=미노출. 확정 시 U 가 false 로
 *      바꿔도(그리고 그 전에도) 스위치 동작이 유지됨을 보장. 값은 모듈 목으로 양쪽 다 명시(실 상수값에
 *      의존하지 않음 → 확정 컷오버 후에도 이 가드는 유효).
 *  (B) 필수 법적 섹션·수탁자·접근성 표 구조가 초안 여부와 무관하게 항상 렌더됨(§30 필수기재의 회귀 방지):
 *      필수 헤딩(수집/처리위탁·국외이전/권리) · 수탁자명(Anthropic·Vercel) · 표 caption(sr-only) · 민감정보 배지.
 *
 *  (C) 처리위탁 표의 사실(fix/privacy-policy-facts) — 과거 초안의 사실 오류 재발 방지:
 *      Supabase=서울 리전(ap-northeast-2, docs/release/15 §3 확인) → 국외 이전 '아니오'(미확정 '확인 중' 금지) /
 *      Anthropic=OCR 은 영수증 이미지 원본 전송(ocr.ts callAI 직송·가명처리 불가)과 가명처리된 글(요약·제안·점검,
 *      callAIDeidentified)을 구분. 기관명 치환은 현재 어떤 액션도 terms 로 넘기지 않으므로 '기관명 가명처리' 주장 금지.
 *
 * 방식: PRIVACY_DRAFT 만 getter 로 목킹(나머지 콘텐츠는 실물). 헤딩은 번호 접두("1."·"4."·"5.")를
 *   허용하도록 정규식 이름 매칭. 서버 컴포넌트(순수·async 아님)라 RTL 로 직접 렌더 가능.
 */

/** 초안 스위치 상태(목) — 각 테스트에서 주입. */
const state = vi.hoisted(() => ({ draft: true }))

vi.mock('@/content/privacyPolicy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/content/privacyPolicy')>()
  return {
    ...actual,
    get PRIVACY_DRAFT() {
      return state.draft
    },
  }
})

import PrivacyPolicyPage from './page'

/** 초안 여부와 무관하게 항상 존재해야 하는 필수 법적 콘텐츠(§30 필수기재). */
function expectRequiredContent() {
  // 필수 헤딩 — 번호 접두 허용(정규식).
  expect(screen.getByRole('heading', { name: /수집하는 개인정보/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /처리위탁 및 국외이전/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /정보주체의 권리/ })).toBeInTheDocument()
  // 국외이전 수탁자명(고지 대상).
  expect(screen.getByText(/Anthropic/)).toBeInTheDocument()
  expect(screen.getByText(/Vercel/)).toBeInTheDocument()
  // 접근성 있는 표: <table> 안에 <caption> 이 있고 비어있지 않다(KWCAG 5.3.1 표 제목).
  const caption = document.querySelector('table > caption')
  expect(caption, '처리위탁 표에 caption 이 없다').not.toBeNull()
  expect(caption?.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  // 민감정보(건강·장애) 배지 — 비색큐로 민감정보 구분.
  expect(screen.getByText('민감정보')).toBeInTheDocument()
}

describe('/privacy 전문 — 초안 스위치 + 필수 섹션 렌더 가드', () => {
  beforeEach(() => {
    cleanup()
    state.draft = true
  })

  it('PRIVACY_DRAFT=true → 초안 배너(role="note")를 노출한다', () => {
    state.draft = true
    render(<PrivacyPolicyPage />)
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(/초안/)
  })

  it('PRIVACY_DRAFT=false → 초안 배너를 노출하지 않는다', () => {
    state.draft = false
    render(<PrivacyPolicyPage />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('초안(true)에서도 필수 법적 섹션·수탁자·표 caption·민감정보 배지가 모두 렌더된다', () => {
    state.draft = true
    render(<PrivacyPolicyPage />)
    expectRequiredContent()
  })

  it('확정본(false)에서도 필수 법적 섹션·수탁자·표 caption·민감정보 배지가 모두 렌더된다', () => {
    state.draft = false
    render(<PrivacyPolicyPage />)
    expectRequiredContent()
  })
})

/** 처리위탁 표에서 수탁자 행의 특정 열 텍스트 — 열 위치는 헤더 텍스트로 찾는다(열 순서 변경에 강함). */
function processorCell(processor: string, column: string): string {
  const table = screen.getByRole('table')
  const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim())
  const col = headers.indexOf(column)
  expect(col, `'${column}' 열 헤더가 없다`).toBeGreaterThanOrEqual(0)
  const row = within(table).getByRole('rowheader', { name: processor }).closest('tr')
  expect(row, `'${processor}' 행이 없다`).not.toBeNull()
  const cells = Array.from(row!.children)
  return cells[col]?.textContent ?? ''
}

describe('/privacy 전문 — 처리위탁·국외이전 사실 가드', () => {
  beforeEach(() => {
    cleanup()
    state.draft = true
  })

  it('Supabase: 처리 위치=서울, 국외 이전=아니오(리전 확인됨)', () => {
    render(<PrivacyPolicyPage />)
    expect(processorCell('Supabase', '처리 위치')).toMatch(/서울/)
    expect(processorCell('Supabase', '국외 이전').trim()).toBe('아니오')
  })

  it('Anthropic: OCR 영수증 이미지 원본 전송과 가명처리된 글 전송을 구분한다', () => {
    render(<PrivacyPolicyPage />)
    expect(processorCell('Anthropic (Claude)', '국외 이전').trim()).toBe('예')
    const safeguard = processorCell('Anthropic (Claude)', '보호 조치')
    // OCR = 이미지 원본(가명처리 불가) — '모두 가명처리 후 전송'으로 뭉뚱그리지 않는다.
    expect(safeguard).toMatch(/영수증[^.]*이미지 원본/)
    // 요약·제안·점검 = 이름을 가명처리한 글.
    expect(safeguard).toMatch(/요약[^.]*가명처리[^.]*글/)
    // 기관명 치환은 어떤 액션에도 배선돼 있지 않다 — 과장 주장 금지.
    expect(safeguard).not.toMatch(/기관명/)
    // 위탁 업무 = 실제 배선된 4개 AI 기능(ocr·easyReadSummary·activitySuggestion·staffReviewSuggestion).
    const purpose = processorCell('Anthropic (Claude)', '하는 일')
    for (const f of [/영수증/, /요약/, /활동 제안/, /점검 제안/]) expect(purpose).toMatch(f)
  })

  it('표 아래 설명도 이미지 원본 전송·국내 저장을 밝히고 기관명 가명처리를 주장하지 않는다', () => {
    render(<PrivacyPolicyPage />)
    const section = screen.getByRole('heading', { name: /처리위탁 및 국외이전/ }).closest('section')
    expect(section, '처리위탁 섹션이 없다').not.toBeNull()
    // 표 자체는 위 테스트가 본다 — 여기선 표를 뺀 설명 문단만.
    const tableText = within(section as HTMLElement).getByRole('table').textContent ?? ''
    const text = (section!.textContent ?? '').replace(tableText, '')
    expect(text).toMatch(/영수증[^.]*이미지 원본/)
    expect(text).toMatch(/국내\(서울\)/)
    expect(document.body.textContent ?? '').not.toMatch(/기관명/)
  })
})
