import { describe, it, expect } from 'vitest'
import {
  AUDIT_ACTIONS,
  describeAuditAction,
  auditCategoryLabel,
  auditActionOptions,
} from './auditLabels'

/**
 * 감사 라벨 순수 로직 계약 — /admin/audit 대시보드용. 설계: docs/release/14 P1(#7).
 */

describe('describeAuditAction', () => {
  it('등록된 코드는 라벨·분류를 준다', () => {
    expect(describeAuditAction('receipt.view')).toEqual({ label: '영수증 열람', category: 'view' })
    expect(describeAuditAction('participant.preview')).toEqual({
      label: '당사자 화면 대리열람',
      category: 'view',
    })
    expect(describeAuditAction('role.change').category).toBe('change')
    expect(describeAuditAction('ai.summary').category).toBe('ai')
  })

  it('미등록 코드는 코드 원문을 라벨로·other 로 폴백(화면 무해)', () => {
    expect(describeAuditAction('some.new.action')).toEqual({
      label: 'some.new.action',
      category: 'other',
    })
  })

  it('열람 3종은 모두 view 분류(슈퍼비전 핵심)', () => {
    for (const a of ['receipt.view', 'document.view', 'participant.preview']) {
      expect(describeAuditAction(a).category).toBe('view')
    }
  })
})

describe('auditCategoryLabel', () => {
  it('분류를 한글로 표시한다', () => {
    expect(auditCategoryLabel('view')).toBe('열람')
    expect(auditCategoryLabel('change')).toBe('변경')
    expect(auditCategoryLabel('ai')).toBe('AI')
    expect(auditCategoryLabel('other')).toBe('기타')
  })
})

describe('auditActionOptions', () => {
  it('등록된 모든 action 을 라벨 가나다순으로 준다', () => {
    const opts = auditActionOptions()
    expect(opts).toHaveLength(Object.keys(AUDIT_ACTIONS).length)
    const labels = opts.map((o) => o.label)
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, 'ko'))
    expect(labels).toEqual(sorted)
    // 각 옵션은 code·label·category 를 갖는다
    for (const o of opts) {
      expect(o.code).toBeTruthy()
      expect(o.label).toBeTruthy()
      expect(['view', 'change', 'ai', 'other']).toContain(o.category)
    }
  })
})
