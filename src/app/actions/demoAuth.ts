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
    return { error: '지금은 데모 계정을 쓸 수 없어요.' }
  }

  const { email, password } = CREDENTIALS[role]
  if (!email || !password) {
    console.error(`demoSignIn: missing credentials for role="${role}" — run scripts/seed-demo-auth.mjs`)
    return { error: '이 데모 계정은 아직 준비되지 않았어요.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error(`demoSignIn failed for role="${role}":`, error.message)
    return { error: '들어가지 못했어요. 다시 눌러 주세요.' }
  }

  redirect(HOME_BY_ROLE[role])
}
