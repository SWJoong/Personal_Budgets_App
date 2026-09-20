/**
 * 감사 로그 action 코드 → 한글 라벨·분류. 순수 함수. 계약: src/utils/auditLabels.test.ts.
 * 대상 화면: /admin/audit(관리자 감사 열람 대시보드). action 코드는 src/utils/audit.ts auditLog 호출부 정본.
 *
 * category: view=민감정보 열람(누가 누구 정보를 봤나) · change=변경·비가역 · ai=AI 호출 · other=기타.
 * 새 action 을 배선하면 여기에 라벨을 추가한다(미등록은 코드 원문 노출·other 로 폴백 — 화면이 깨지지 않음).
 */

export type AuditCategory = 'view' | 'change' | 'ai' | 'other'

export interface AuditActionMeta {
  label: string
  category: AuditCategory
}

export const AUDIT_ACTIONS: Record<string, AuditActionMeta> = {
  // 열람(민감정보) — 슈퍼비전 핵심
  'receipt.view': { label: '영수증 열람', category: 'view' },
  'document.view': { label: '서류 열람', category: 'view' },
  'participant.preview': { label: '당사자 화면 대리열람', category: 'view' },
  // 변경·비가역
  'role.change': { label: '역할 변경', category: 'change' },
  'participant.delete': { label: '당사자 삭제', category: 'change' },
  'usage.update': { label: '지출 수정', category: 'change' },
  'usage.delete': { label: '지출 삭제', category: 'change' },
  'document.upload': { label: '서류 올림', category: 'change' },
  'document.delete': { label: '서류 삭제', category: 'change' },
  'settlement.record': { label: '정산 기록', category: 'change' },
  'plan.review': { label: '이용계획 심의', category: 'change' },
  'invitation.create': { label: '초대 만듦', category: 'change' },
  'invitation.delete': { label: '초대 지움', category: 'change' },
  // AI 호출
  'ai.summary': { label: 'AI 쉬운 요약', category: 'ai' },
  'ai.suggest': { label: 'AI 활동 제안', category: 'ai' },
  'ai.review': { label: 'AI 점검 제안', category: 'ai' },
}

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  view: '열람',
  change: '변경',
  ai: 'AI',
  other: '기타',
}

/** action 코드 → 라벨·분류. 미등록 코드는 코드 원문을 라벨로(other) — 화면 무해 폴백. */
export function describeAuditAction(action: string): AuditActionMeta {
  return AUDIT_ACTIONS[action] ?? { label: action, category: 'other' }
}

/** 분류 → 한글 표시. */
export function auditCategoryLabel(category: AuditCategory): string {
  return CATEGORY_LABEL[category]
}

/** 필터 드롭다운용 — 라벨 가나다순 정렬된 (code,label,category) 목록. */
export function auditActionOptions(): { code: string; label: string; category: AuditCategory }[] {
  return Object.entries(AUDIT_ACTIONS)
    .map(([code, meta]) => ({ code, label: meta.label, category: meta.category }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
}
