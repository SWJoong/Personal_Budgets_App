/**
 * 감사 로그 기록 헬퍼 — 서버액션이 민감·비가역 행위 성공 직후 1줄로 호출한다.
 * 설계: Plan&Source/goala_audit_log_W.md §3·§4. DB: supabase/seoul/12_audit_log.sql (seoul_audit definer 함수).
 *
 * ★실패 격리: 감사 기록 실패가 본 동작을 되돌리지 않게 try/catch(감사 손실 < 기능 마비). 실패는 서버 로그로만.
 * ★actor 는 인자로 받지 않는다 — DB 함수가 auth.uid() 로 강제 스탬프(위조 불가). 세션 클라이언트로 호출해야 함.
 * ★metadata 는 코드·id·수치만(이름·자유서술 등 원문 PII 금지 — §1 원칙3).
 */

/** rpc 만 쓰는 최소 구조(세션 Supabase 클라이언트). */
type AuditableClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<unknown>
}

export interface AuditOptions {
  targetType?: string
  targetId?: string | null
  /** 당사자 스코프(있으면). 단 참여자 삭제처럼 대상이 사라지는 경우엔 targetId 만 쓴다(FK). */
  participantId?: string | null
  /** 코드·id·수치만. 원문 PII 금지. */
  metadata?: Record<string, unknown>
}

export async function auditLog(
  supabase: AuditableClient,
  action: string,
  opts: AuditOptions = {},
): Promise<void> {
  try {
    await supabase.rpc('seoul_audit', {
      p_action: action,
      p_target_type: opts.targetType ?? null,
      p_target_id: opts.targetId ?? null,
      p_participant_id: opts.participantId ?? null,
      p_metadata: opts.metadata ?? {},
    })
  } catch (e) {
    console.error('[audit] seoul_audit 실패:', action, e)
  }
}
