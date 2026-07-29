'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export type DemoRole = 'admin' | 'supporter' | 'participant'

// 데모 계정 자격증명은 서버 전용 환경변수에만 있다 — 클라이언트 번들에 들어가지 않는다.
// 데모 계정도 일반 계정과 동일한 세션·RLS 경로를 타므로 공개 URL 에 버튼을 두어도 안전하다.
const CREDENTIALS: Record<DemoRole, { email?: string; password?: string }> = {
  admin: { email: process.env.DEMO_ADMIN_EMAIL, password: process.env.DEMO_ADMIN_PASSWORD },
  supporter: { email: process.env.DEMO_SUPPORTER_EMAIL, password: process.env.DEMO_SUPPORTER_PASSWORD },
  participant: { email: process.env.DEMO_PARTICIPANT_EMAIL, password: process.env.DEMO_PARTICIPANT_PASSWORD },
}

const HOME_BY_ROLE: Record<DemoRole, string> = {
  admin: '/admin',
  supporter: '/supporter',
  participant: '/',
}

export async function demoSignIn(role: DemoRole): Promise<{ error: string } | never> {
  if (process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED !== 'true') {
    return { error: '데모 로그인이 비활성화되어 있습니다.' }
  }

  const { email, password } = CREDENTIALS[role]
  if (!email || !password) {
    return { error: '이 역할의 데모 계정이 아직 설정되지 않았습니다. (scripts/seed-demo-auth.mjs 참고)' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: '데모 로그인에 실패했습니다: ' + error.message }
  }

  redirect(HOME_BY_ROLE[role])
}
