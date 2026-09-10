import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SupporterQuickTasks from './SupporterQuickTasks'

/**
 * F3 담당자 QA — 대시보드 일상 작업 바로가기 (RED 계약, W 레인).
 * 설계출처: 담당자 QA 발견 F3(대시보드가 당사자목록·지도·관계망 3개만 — 영수증 검토·거래장부·정산·
 *   서류함 같은 일상 핵심 작업이 대시보드에 없고 햄버거 메뉴에만).
 * 구현 대상: src/app/(supporter)/supporter/SupporterQuickTasks.tsx(신규 표현 컴포넌트) +
 *   /supporter/page.tsx 가 렌더.
 *
 * 계약: 담당자 일상 작업으로 바로 가는 링크가 대시보드에 있다(영수증 검토·거래장부·정산 원장·서류 보관함).
 * RED 사유: SupporterQuickTasks 가 아직 없다 → import 실패. 단언 범위: 링크 존재·href 만(배치·문구 제외).
 */

describe('SupporterQuickTasks (F3)', () => {
  it('일상 담당자 작업 바로가기 링크가 있다(영수증 검토·거래장부·정산 원장·서류 보관함)', () => {
    render(<SupporterQuickTasks />)
    const linkHref = (name: RegExp, href: string) => {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    }
    linkHref(/영수증 검토/, '/supporter/review')
    linkHref(/거래장부/, '/supporter/transactions')
    linkHref(/정산 원장/, '/supporter/settlements')
    linkHref(/서류 보관함/, '/supporter/documents')
  })
})
