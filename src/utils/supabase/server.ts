import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 데모 모드에서 사용할 고정 UUID
// - admin: 데모 전용 UUID (migration 10에서 profiles 테이블에 삽입)
// - participant: seed.sql의 김지수 UUID
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000001'
const DEMO_PARTICIPANT_ID = '11e95b8b-6806-496d-9f36-88bd04e814b3'

export async function createClient() {
  const cookieStore = await cookies()

  // 데모 모드: 서비스 롤 클라이언트 반환 + auth.getUser() 스푸핑
  // demo_role 쿠키(login 페이지에서 설정)를 읽어 역할에 맞는 데모 유저 반환
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoRole = cookieStore.get('demo_role')?.value || 'admin'
    const demoUserId = demoRole === 'participant' ? DEMO_PARTICIPANT_ID : DEMO_ADMIN_ID
    const demoUser = {
      id: demoUserId,
      email: demoRole === 'admin' ? 'admin@demo.com' : 'participant@demo.com',
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
    }

    const adminClient = createAdminClient()
    // 스프레드 대신 직접 오버라이드: prototype 메서드(from, rpc 등)를 유지
    adminClient.auth.getUser = async () => ({ data: { user: demoUser as any }, error: null })
    return adminClient
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key_for_build',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
