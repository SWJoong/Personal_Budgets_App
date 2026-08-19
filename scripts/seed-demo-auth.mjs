#!/usr/bin/env node
// =====================================================================
// 데모 계정 3종(관리자·담당자·당사자)을 Supabase Auth 에 실제로 생성한다.
//
// 왜 SQL 로 auth.users 에 직접 INSERT 하지 않는가:
// GoTrue(Supabase Auth 서버)의 스키마는 공개 계약이 아니다. confirmation_token
// 등 여러 컬럼이 NULL 이 아니라 빈 문자열을 기대하고, 버전에 따라 auth.identities
// 행이 함께 있어야 로그인이 되기도 한다. Admin API 를 쓰면 이런 내부 구현을
// 몰라도 된다 — 실제로 이 방식이 안전하다고 검증된 패턴이다.
//
// 실행: node scripts/seed-demo-auth.mjs
// 필요 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//              DEMO_ADMIN_EMAIL/PASSWORD, DEMO_SUPPORTER_EMAIL/PASSWORD,
//              DEMO_PARTICIPANT_EMAIL/PASSWORD (.env.example 참조)
//
// 재실행 안전: 이미 있는 계정은 비밀번호만 재동기화한다(생성하지 않음).
// =====================================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const ACCOUNTS = [
  {
    label: '관리자',
    emailKey: 'DEMO_ADMIN_EMAIL',
    passwordKey: 'DEMO_ADMIN_PASSWORD',
    fullName: '데모 관리자',
  },
  {
    label: '담당자',
    emailKey: 'DEMO_SUPPORTER_EMAIL',
    passwordKey: 'DEMO_SUPPORTER_PASSWORD',
    fullName: '데모 담당자',
  },
  {
    label: '당사자',
    emailKey: 'DEMO_PARTICIPANT_EMAIL',
    passwordKey: 'DEMO_PARTICIPANT_PASSWORD',
    fullName: '데모 당사자',
  },
]

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(email) {
  // listUsers 는 페이지네이션이 있다. 데모 계정은 소수이므로 넉넉히 훑는다.
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < perPage) return null
    page += 1
  }
}

async function main() {
  for (const acc of ACCOUNTS) {
    const email = process.env[acc.emailKey]
    const password = process.env[acc.passwordKey]

    if (!email || !password) {
      console.log(`⏭  ${acc.label}: ${acc.emailKey}/${acc.passwordKey} 미설정 — 건너뜀`)
      continue
    }

    const existing = await findUserByEmail(email)

    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password })
      if (error) throw error
      console.log(`🔁 ${acc.label} (${email}): 이미 있음 — 비밀번호 재동기화`)
    } else {
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: acc.fullName },
      })
      if (error) throw error
      console.log(`✅ ${acc.label} (${email}): 새로 생성 — on_auth_user_created 트리거가 profiles 를 만듭니다`)
    }
  }

  console.log('\n다음 단계: supabase/seoul/08_seed_demo.sql 을 SQL Editor 에서 실행하세요.')
  console.log('(참여자 등록 → participants_autolink 트리거가 방금 만든 당사자 계정을 자동 연결합니다)')
}

main().catch((err) => {
  console.error('실패:', err.message || err)
  process.exit(1)
})
