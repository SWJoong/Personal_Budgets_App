/**
 * 슈퍼관리자(운영자) 이메일 판정 — auth 콜백(src/app/(auth)/auth/callback/route.ts)에서
 * role='admin' 자동승격 대상을 정하는 순수 로직. 라우트 인라인에서 분리해 계약 테스트를
 * 가능하게 함(08 §9 C3). 계약: src/utils/superAdmin.test.ts.
 *
 * ★내장 슈퍼관리자(BUILTIN): 사용자 명시 요구(2026-09-07) — 이 계정은 배포 환경변수
 * (SUPER_ADMIN_EMAIL) 설정 여부와 무관하게 '항상' 슈퍼관리자로 인식한다(Vercel 변수를
 * 깜빡해도 로그인만 하면 관리자 접근 보장). env 만으로 관리하려면 이 배열을 비우면 된다.
 */
const BUILTIN_SUPER_ADMINS = ['cheese0318@gmail.com']

/**
 * BUILTIN + `SUPER_ADMIN_EMAIL`(콤마로 여러 개 가능) 을 병합해 trim·소문자·빈값 제거한 목록.
 * @param envValue process.env.SUPER_ADMIN_EMAIL (미설정이면 undefined)
 */
export function parseSuperAdminEmails(envValue: string | undefined): string[] {
  return [
    ...BUILTIN_SUPER_ADMINS,
    ...(envValue ?? '').split(','),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * email 이 슈퍼관리자인가(대소문자 무관).
 * @param envValue process.env.SUPER_ADMIN_EMAIL
 */
export function isSuperAdminEmail(email: string, envValue: string | undefined): boolean {
  return parseSuperAdminEmails(envValue).includes(email.toLowerCase())
}
