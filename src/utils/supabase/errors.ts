/**
 * Supabase/PostgreSQL 에러를 사용자에게 보여줘도 되는 한국어 문구로 바꾼다.
 *
 * '23505'(unique_violation)·'42501'(RLS 위반)는 원문이 기술 용어("new row
 * violates row-level security policy...")라 그대로 보여주면 안 된다 —
 * demoAuth.ts 에서 같은 문제(원문 에러 노출)를 이미 한 번 고쳤다.
 */
export function friendlyDbError(
  error: { code?: string; message: string } | null,
  duplicateMessage = '이미 등록된 내용이에요.'
): string {
  if (!error) return '오류가 발생했어요.'
  if (error.code === '23505') return duplicateMessage
  if (error.code === '42501') return '지금은 이 항목을 처리할 수 없어요. 상태가 바뀌었을 수 있어요.'
  return error.message
}
