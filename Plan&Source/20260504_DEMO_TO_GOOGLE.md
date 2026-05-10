# 데모 모드 → Google OAuth 전환 구현 계획서

**작성일**: 2026-05-04  
**최종 수정**: 2026-05-10 (아름드리꿈터 단일 기관으로 범위 확정)  
**프로젝트**: 아름드리꿈터 자기주도 개인예산 관리 앱  
**전환 목적**: 외부 공개 데모 앱을 실제 Google 인증 기반 운영 앱으로 전환  

---

## 전환 배경

### 인증 시스템 변경 이력 (`AUTHENTICATION_CHANGES.md` 참조)

```
main 브랜치     → Google OAuth (원래 운영 버전)
commit 91275a3  → Google OAuth 제거, 이메일/비밀번호 인증으로 전환
commit 2a832c5  → 이메일 인증까지 제거, 역할 선택 데모 모드 (현재 상태)
브랜치명: remove-google-auth (main에 이미 병합됨)
```

현재 `main` 브랜치는 데모 모드가 병합된 상태다.  
`NEXT_PUBLIC_DEMO_MODE=true` 환경변수로 쿠키 기반 가짜 인증을 사용한다:
- 로그인 없이 역할(관리자/당사자)만 선택하면 진입 가능
- 고정 UUID로 데이터 스푸핑 (`00000000-0000-0000-0000-000000000001` = 관리자)
- 실제 Supabase DB에는 접근하지만 Auth 세션은 없음
- **실무자(supporter) 역할 진입 경로가 데모 모드에서 완전히 제거됨**

### 전환 전략: 하이브리드 모드 (AUTHENTICATION_CHANGES.md Option 3)

git 롤백 대신 **환경변수 하나로 모드 전환**하는 방식을 채택한다.  
`NEXT_PUBLIC_DEMO_MODE=false`로 바꾸면 Google OAuth 경로가 활성화된다.  
롤백 시에도 `NEXT_PUBLIC_DEMO_MODE=true`로 즉시 데모 모드로 복귀 가능하다.

---

## 권한 계층 구조 (3단계)

```
슈퍼 관리자 (super admin)
  └── cheese0318@nowondaycare.org (최중호)
  └── 전체 데이터 접근·수정 가능
  └── profiles.is_super_admin = true, role = 'admin'

관리자 (admin)
  └── 사전 등록된 @nowondaycare.org 계정
  └── 당사자·실무자 관리, 예산 설정
  └── profiles.role = 'admin'

실무자 (supporter)
  └── @nowondaycare.org 도메인 → 로그인 시 자동 부여
  └── profiles.role = 'supporter'

당사자 (participant)
  └── 사전 등록 필수 (관리자가 Gmail 등록)
  └── profiles.role = 'participant', participants.auth_user_id 연결
```

## 역할별 계정 분류

| 역할 | 이메일 조건 | 기본 role | 배정 방식 |
|------|-----------|---------|---------|
| 슈퍼 관리자 | `cheese0318@nowondaycare.org` | admin + `is_super_admin=true` | SUPER_ADMIN_EMAIL 환경변수 |
| 관리자 | `user_invitations`에 `admin`으로 등록된 이메일 | admin | 사전 등록 후 자동 |
| 실무자 | @nowondaycare.org 도메인 전체 | supporter | 도메인 감지 자동 배정 |
| 당사자 | `user_invitations`에 `participant`로 등록된 Gmail | participant | 사전 등록 후 자동 |

---

## 📋 PM 관점 — 일정 및 리스크 관리

### 전환 단계 (Phase)

```
Phase 0 (선행)    DB — user_invitations 테이블, is_super_admin 컬럼 마이그레이션
Phase 1 (1일차)   환경 설정 — Supabase Google OAuth 활성화, Vercel 환경변수 변경
Phase 2 (1~2일차) 코드 변경 — 로그인 UI, 레이아웃 인증 체크, 콜백 로직 보강
Phase 3 (2일차)   계정 설정 — 슈퍼 관리자 설정, 관리자·당사자 사전 등록
Phase 4 (2~3일차) 검증 및 배포 — 3가지 역할 로그인 테스트, 프로덕션 반영
```

### 마일스톤

- [ ] M0: `user_invitations` 테이블 및 `is_super_admin` 컬럼 마이그레이션 실행
- [ ] M1: Supabase Google OAuth 활성화 완료
- [ ] M2: Vercel 환경변수 `NEXT_PUBLIC_DEMO_MODE=false`
- [ ] M3: 코드 변경 및 빌드 성공 (`npm run build`)
- [ ] M4: 슈퍼 관리자(`cheese0318@nowondaycare.org`) 로그인 → `/admin` 접근 확인
- [ ] M5: 실무자(@nowondaycare.org) 로그인 → supporter 자동 부여 확인
- [ ] M6: 당사자 Gmail 로그인 → 당사자 홈 접근 확인
- [ ] M7: 프로덕션 배포 완료

### 리스크

| 리스크 | 가능성 | 대응 방안 |
|--------|------|---------|
| Google Cloud OAuth 앱 승인 지연 | 낮음 | Test 모드로 우선 운영 (100명 제한) |
| 실무자가 participant로 로그인되는 문제 | 낮음 | @nowondaycare.org 도메인 감지로 자동 supporter 배정 |
| 당사자 Gmail 계정 미보유 | 중간 | 기관 계정 생성 또는 보호자 대리 로그인 검토 |
| 기존 데모 데이터와 충돌 | 낮음 | 데모 UUID 프로필은 실 운영과 무관, 별도 정리 가능 |
| is_super_admin 설정 누락 | 중간 | 배포 후 즉시 SQL로 설정 (Step 3) |

### 이해관계자 커뮤니케이션

- 전환 전: 실무자들에게 **새 로그인 방법(기관 이메일로 Google 로그인)** 안내
- 전환 전: 당사자 담당 지원자가 **당사자 Gmail 수집** (user_invitations 등록용)
- 전환 후: 관리자가 Admin UI에서 당사자 이메일 사전 등록
- 전환 후: 담당 지원자가 `participants.auth_user_id` 연결 작업 수행

---

## 🏗️ PL 관점 — 아키텍처 결정 및 기술 스펙

### 변경 범위 요약

```
신규 마이그레이션 파일 1개:
  supabase/migrations/31_user_invitations.sql  ← user_invitations 테이블 + is_super_admin 컬럼

변경 파일 5개:
  1. src/app/(auth)/login/page.tsx             ← UI 교체 (Google 로그인 버튼)
  2. src/app/(supporter)/layout.tsx            ← isDemoMode 하드코딩 제거
  3. src/app/(auth)/auth/callback/route.ts     ← user_invitations 조회, 도메인 자동 배정
  4. src/app/actions/admin.ts                  ← ADMIN_EMAILS 하드코딩 제거, 초대 관리 함수 추가
  5. src/app/(supporter)/admin/invitations/    ← 사전 등록 관리 UI (신규 페이지)

환경변수 변경 (Vercel):
  - NEXT_PUBLIC_DEMO_MODE: true → false (또는 삭제)
  - SUPER_ADMIN_EMAIL: cheese0318@nowondaycare.org  ← 신규
  - ALLOWED_EMAIL_DOMAINS: nowondaycare.org         ← 유지
  - NEXT_PUBLIC_SITE_URL: 실제 Vercel 도메인
  ※ ADMIN_EMAILS 환경변수 → user_invitations 테이블로 대체
  ※ PARTICIPANT_EMAILS 환경변수 → user_invitations 테이블로 대체

변경 없는 파일:
  - src/utils/supabase/server.ts (NEXT_PUBLIC_DEMO_MODE 체크 이미 구현됨)
  - 기존 페이지 컴포넌트 전체 (역할 기반 RLS 그대로 유지)
  - supabase/migrations/01~30 (기존 RLS 정책 유지)
```

### 핵심 아키텍처 원칙

1. **데모 모드 코드 제거 X** — 환경변수로만 제어. `NEXT_PUBLIC_DEMO_MODE=true` 시 즉시 롤백 가능
2. **사전 등록 방식** — `user_invitations` DB 테이블로 관리자·당사자 이메일·역할 등록. Admin UI에서 처리
3. **@nowondaycare.org 도메인 자동 처리** — OAuth 콜백에서 도메인 감지 → supporter 역할 자동 배정
4. **슈퍼 관리자 분리** — `SUPER_ADMIN_EMAIL` 환경변수 + `is_super_admin=true` 플래그. 코드 하드코딩 없음
5. **기존 RLS 유지** — 단일 기관 운영이므로 role 기반 기존 RLS 정책 그대로 사용

### 코드 검토 포인트

- [`(supporter)/layout.tsx:16`](src/app/(supporter)/layout.tsx#L16) — `isDemoMode = true` 하드코딩. **이 한 줄이 가장 큰 보안 취약점**
- [`auth/callback/route.ts:24-31`](src/app/(auth)/auth/callback/route.ts#L24) — 허용 이메일 로직. user_invitations 조회로 교체
- [`admin.ts:7-15`](src/app/actions/admin.ts#L7) — ADMIN_EMAILS 하드코딩. 환경변수·DB 방식으로 교체

---

## 🎨 UX/UI 관점 — 로그인 화면 재설계

### 현재 vs 목표 화면

**현재 (데모 모드)**
```
┌─────────────────────────┐
│  💰 아름드리꿈터         │
│  🎭 역할을 선택해주세요  │
│                         │
│  [👔 관리자로 접속]      │
│  [👤 당사자로 접속]      │
└─────────────────────────┘
```

**목표 (Google OAuth)**
```
┌─────────────────────────┐
│  💰 아름드리꿈터         │
│  자기주도 개인예산 관리   │
│                         │
│  [G  구글로 로그인하기]  │
│                         │
│  선생님: 기관 이메일 사용│
│  이용자: 담당 선생님 문의│
└─────────────────────────┘
```

### UI 설계 방향

- **버튼 1개 원칙**: Google 로그인 버튼 하나로 모든 역할 통합 (역할은 서버가 자동 판단)
- **로그인 후 리다이렉션**:
  - `admin` role → `/admin`
  - `supporter` role → `/supporter`
  - `participant` role → `/` (당사자 홈)
- **실패 안내**: 미등록 이메일 접속 시 명확한 한국어 안내문 표시
- **접근성**: Easy Read 기준 — 큰 버튼(min 48px), 명확한 설명 문구, Pretendard 폰트

### 사전 등록 관리 UI (`/admin/invitations`)

관리자가 당사자·관리자 이메일을 미리 등록하는 화면:

```
┌───────────────────────────────────────┐
│  사용자 초대 관리                       │
│                                       │
│  [+ 새 사용자 초대]                     │
│                                       │
│  이메일              역할      상태    │
│  ─────────────────────────────────── │
│  abc@gmail.com     당사자    미사용   │
│  def@gmail.com     관리자    사용됨   │
│                                       │
└───────────────────────────────────────┘
```

- 슈퍼 관리자·관리자만 접근 가능
- 초대 등록 시 이메일·역할 입력 (당사자 이름 메모 가능)
- `used_at` NULL → "미사용", 날짜 → "로그인 완료"
- `@nowondaycare.org` 실무자는 별도 등록 불필요 (도메인 자동 배정)

### 오류 화면 메시지 (쉬운 말)

```
이 앱에 들어올 수 없는 이메일이에요.
아름드리꿈터 선생님이라면 기관 이메일로 로그인해주세요.
이용자라면 담당 선생님께 문의해주세요.
```

---

## 🖥️ Frontend 관점 — 코드 변경 상세

### 변경 1: `src/app/(auth)/login/page.tsx` — 전면 교체

**현재**: 역할 선택 UI (handleRoleSelect → cookie 저장 → 라우팅)  
**변경 후**: Google OAuth 로그인 시작 버튼

```typescript
import { createClient } from '@/utils/supabase/client'

const handleGoogleLogin = async () => {
  const supabase = createClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}
```

**제거할 요소**:
- `handleRoleSelect()` 함수 전체
- `localStorage.setItem('demo_role', ...)` 코드
- `document.cookie = 'demo_role=...'` 코드
- "역할을 선택해주세요" 배너
- 관리자/당사자 선택 버튼 2개

**추가할 요소**:
- Google 로그인 버튼 (공식 Google 브랜딩 가이드 준수)
- 역할 안내 텍스트 (선생님: 기관 이메일, 이용자: 담당 선생님 문의)
- `?error=InvalidDomain` 파라미터 처리 → 친절한 오류 메시지

**유지할 요소**:
- 로고(💰 + 아름드리꿈터), 앱 설명, 이스터에그(선택)

### 변경 2: `src/app/(supporter)/layout.tsx` — 1줄 수정

```typescript
// Before (line 16)
const isDemoMode = true

// After
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
```

### 변경 3: `src/app/(auth)/auth/callback/route.ts` — 허용 로직 교체

```typescript
const email = user.email ?? ''
const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim()
const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? 'nowondaycare.org')
  .split(',').map(d => d.trim())

// 1. 슈퍼 관리자
const isSuperAdmin = email === superAdminEmail

// 2. 도메인 기반 실무자 (@nowondaycare.org)
const isAllowedDomain = allowedDomains.some(d => email.endsWith('@' + d))

// 3. user_invitations 사전 등록 여부 (당사자·관리자)
const adminSupabase = createAdminClient()  // RLS 우회 필요
const { data: invitation } = await adminSupabase
  .from('user_invitations')
  .select('role, used_at')
  .eq('email', email)
  .is('used_at', null)
  .maybeSingle()

const isAllowed = isSuperAdmin || isAllowedDomain || !!invitation

if (!isAllowed) {
  await supabase.auth.signOut()
  return NextResponse.redirect(`${baseUrl}/login?error=InvalidDomain`)
}

// 역할 배정은 handle_new_user 트리거에서 자동 처리
// (초대 사용 처리도 트리거에서 used_at 업데이트)
```

### 역할 리다이렉션 — 기존 코드 활용

[`(participant)/page.tsx`](src/app/(participant)/page.tsx#L27-L31)에 이미 구현됨:
```typescript
if (profile?.role === 'admin') redirect('/admin')
if (profile?.role === 'supporter') redirect('/supporter')
```
→ 추가 변경 불필요

---

## 🗄️ Backend 관점 — Supabase 설정 및 DB 변경

### Step 0: 마이그레이션 (`31_user_invitations.sql`)

```sql
-- 1. 사전 등록 테이블
CREATE TABLE public.user_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'participant',  -- 'admin' | 'supporter' | 'participant'
  invited_by UUID REFERENCES public.profiles(id),
  note       TEXT,              -- 당사자 이름 등 메모
  used_at    TIMESTAMPTZ,       -- NULL이면 미사용, 로그인 시 자동 설정
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. profiles에 is_super_admin 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- 3. user_invitations RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_admin_read_write" ON public.user_invitations
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_super_admin = true)
  )
);
```

### Step 1: Supabase Google OAuth 활성화

**Supabase 대시보드** > Authentication > Providers > Google:
1. Enable Google Provider 체크
2. Google Cloud Console에서 OAuth 2.0 클라이언트 생성:
   - 승인된 JavaScript 원본: `https://[프로젝트].supabase.co`
   - 승인된 리디렉션 URI: `https://[프로젝트].supabase.co/auth/v1/callback`
3. Client ID / Client Secret 입력
4. Supabase > Authentication > URL Configuration:
   - Site URL: `https://[Vercel 도메인]`
   - Redirect URLs: `https://[Vercel 도메인]/auth/callback`

### Step 2: handle_new_user 트리거 업데이트

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation RECORD;
  v_role       TEXT;
BEGIN
  -- 1. user_invitations 사전 등록 확인
  SELECT * INTO v_invitation
  FROM public.user_invitations
  WHERE email = NEW.email AND used_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    v_role := v_invitation.role;
    -- 초대 사용 처리
    UPDATE public.user_invitations SET used_at = now() WHERE id = v_invitation.id;
  -- 2. @nowondaycare.org 도메인 → supporter 자동 배정
  ELSIF NEW.email LIKE '%@nowondaycare.org' THEN
    v_role := 'supporter';
  ELSE
    v_role := 'participant';  -- 기본값 (미등록 이메일은 콜백에서 차단됨)
  END IF;

  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 3: 슈퍼 관리자 설정 (배포 후 1회 실행)

```sql
-- cheese0318@nowondaycare.org 로그인 완료 후 실행
UPDATE public.profiles p
SET role = 'admin', is_super_admin = true
FROM auth.users u
WHERE p.id = u.id
AND u.email = 'cheese0318@nowondaycare.org';
```

### Step 4: 관리자·당사자 사전 등록 (Admin UI 또는 SQL)

```sql
-- 관리자 사전 등록
INSERT INTO public.user_invitations (email, role, note) VALUES
  ('ahreum217@nowondaycare.org', 'admin', '관리자'),
  ('valuesh@nowondaycare.org',   'admin', '관리자');

-- 당사자 Gmail 사전 등록
INSERT INTO public.user_invitations (email, role, note) VALUES
  ('당사자1@gmail.com', 'participant', '김지수'),
  ('당사자2@gmail.com', 'participant', '이철수');
```

### Step 5: 당사자 auth_user_id 연결 (로그인 완료 후)

```sql
-- 당사자가 Google 로그인 후 auth.users에 생성됨 → participants와 연결
UPDATE public.participants p
SET auth_user_id = u.id
FROM auth.users u
WHERE u.email = '당사자1@gmail.com'
AND p.name = '김지수';
```

### RLS 정책 변경 요약

| 테이블 | 변경 여부 | 내용 |
|--------|---------|------|
| profiles | 유지 | 기존 role 기반 정책 그대로 |
| participants | 유지 | 기존 role 기반 정책 그대로 |
| transactions | 유지 | 기존 정책 그대로 |
| user_invitations | **신규** | admin + is_super_admin만 접근 |

---

## ⚙️ DevOps 관점 — 환경변수 및 배포 설정

### Vercel 환경변수 변경 목록

| 변수명 | 현재 값 | 변경 후 값 |
|--------|--------|----------|
| `NEXT_PUBLIC_DEMO_MODE` | `true` | `false` 또는 삭제 |
| `SUPER_ADMIN_EMAIL` | (없음) | `cheese0318@nowondaycare.org` |
| `ALLOWED_EMAIL_DOMAINS` | nowondaycare.org | `nowondaycare.org` (유지) |
| `NEXT_PUBLIC_SITE_URL` | (없거나 임시) | `https://[실제 Vercel 도메인]` |
| ~~`ADMIN_EMAILS`~~ | 하드코딩 목록 | user_invitations 테이블로 대체 |
| ~~`PARTICIPANT_EMAILS`~~ | (없음) | user_invitations 테이블로 대체 |

### 배포 절차

```
1. Supabase: Google OAuth 활성화 (Google Cloud Console → 대시보드)
2. Vercel: 환경변수 변경 후 저장
3. 코드 변경 5개 파일 → git commit & push → Vercel 자동 배포
4. 배포 완료 후 슈퍼 관리자 로그인 → Step 3 SQL 실행
5. 관리자·당사자 사전 등록 (Admin UI 또는 Step 4 SQL)
6. 3가지 역할 로그인 검증
```

### 롤백 계획

```
1. Vercel: NEXT_PUBLIC_DEMO_MODE=true 로 변경
2. src/app/(supporter)/layout.tsx: isDemoMode = true 복원
3. Vercel: Instant Rollback (이전 배포로 즉시 복귀 가능)
※ 원본 데모 커밋: 2a832c5
```

### 로컬 개발 환경 (.env.local)

```bash
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=https://[프로젝트].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
SUPER_ADMIN_EMAIL=cheese0318@nowondaycare.org
ALLOWED_EMAIL_DOMAINS=nowondaycare.org
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 🧪 QA 관점 — 테스트 케이스

### 시나리오 0: 슈퍼 관리자

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 0-1 | `cheese0318@nowondaycare.org` Google 로그인 | `/admin` 이동, `is_super_admin=true` | P0 |
| 0-2 | 슈퍼 관리자로 user_invitations 등록 | 성공 | P0 |
| 0-3 | 슈퍼 관리자로 당사자 생성·수정·삭제 | 성공 | P1 |

### 시나리오 1: 관리자

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 1-1 | user_invitations에 admin으로 등록된 이메일 로그인 | `/admin` 이동 | P0 |
| 1-2 | 관리자로 당사자 생성·수정 | 성공 | P1 |
| 1-3 | 관리자로 실무자 role 변경 | 성공 | P1 |

### 시나리오 2: 실무자

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 2-1 | @nowondaycare.org 이메일 Google 로그인 | supporter 자동 배정, `/supporter` 이동 | P0 |
| 2-2 | 실무자로 `/admin` 직접 접근 | `/supporter`로 리다이렉트 | P0 |
| 2-3 | 실무자로 거래 생성 | 성공 | P1 |
| 2-4 | 실무자로 거래 삭제 시도 | RLS 차단 실패 | P1 |

### 시나리오 3: 당사자

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 3-1 | user_invitations에 등록된 Gmail 로그인 | `/` 당사자 홈 이동 | P0 |
| 3-2 | auth_user_id 연결 후 자기 데이터 조회 | 자신의 예산·거래 표시 | P0 |
| 3-3 | 당사자로 `/admin` 또는 `/supporter` 접근 | `/`로 리다이렉트 | P0 |

### 시나리오 4: 거부 케이스

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 4-1 | 미등록 Gmail 로그인 시도 | `/login?error=InvalidDomain` + 오류 메시지 | P0 |
| 4-2 | 로그아웃 후 `/admin` 접근 | `/login`으로 리다이렉트 | P0 |
| 4-3 | 세션 만료 후 접근 | `/login`으로 리다이렉트 | P1 |

### 빌드 검증

```bash
npm run build    # TypeScript·빌드 오류 없어야 함
npm run lint     # ESLint 경고 없어야 함
```

---

## ♿ Easy Read 관점 — 쉬운 정보 기준 검토

### 새 로그인 화면 문구

| 항목 | 제안 문구 |
|------|---------|
| 로그인 버튼 | "구글로 로그인하기" |
| 부가 설명 | "아름드리꿈터 선생님과 이용자를 위한 앱이에요" |
| 실패 메시지 | "이 앱에 들어올 수 없는 이메일이에요. 담당 선생님께 문의해주세요." |

**Easy Read 체크리스트**:
- [ ] 한 문장에 한 가지 정보만
- [ ] 어려운 단어 없음 (OAuth, 도메인, 인증 등 비표시)
- [ ] 버튼 크기 최소 48×48px
- [ ] 색상 대비 WCAG AA 이상
- [ ] 오류 메시지에 해결 방법 포함

---

## 구현 순서 요약 (실행 체크리스트)

### Phase 0: DB 마이그레이션 (선행)
- [ ] `supabase/migrations/31_user_invitations.sql` 파일 작성
- [ ] Supabase SQL Editor에서 실행 (`user_invitations` 테이블, `is_super_admin` 컬럼, RLS)
- [ ] `handle_new_user` 트리거 업데이트 (Step 2 SQL)

### Phase 1: Supabase + Vercel 설정
- [ ] Google Cloud Console에서 OAuth 2.0 앱 생성
- [ ] Supabase 대시보드 Google OAuth 활성화 (Client ID/Secret 입력)
- [ ] Supabase URL Configuration (Site URL, Redirect URLs)
- [ ] Vercel: `NEXT_PUBLIC_DEMO_MODE=false`, `SUPER_ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL` 설정

### Phase 2: 코드 변경
- [ ] [`src/app/(supporter)/layout.tsx:16`](src/app/(supporter)/layout.tsx#L16): `isDemoMode = true` → `process.env.NEXT_PUBLIC_DEMO_MODE === 'true'`
- [ ] [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx): 역할 선택 UI → Google 로그인 버튼
- [ ] [`src/app/(auth)/auth/callback/route.ts`](src/app/(auth)/auth/callback/route.ts): user_invitations 조회 + 도메인 배정 로직
- [ ] [`src/app/actions/admin.ts`](src/app/actions/admin.ts): ADMIN_EMAILS 하드코딩 제거, 초대 관리 함수 추가
- [ ] `src/app/(supporter)/admin/invitations/page.tsx`: 사전 등록 관리 UI 신규 작성

### Phase 3: 배포 및 계정 설정
- [ ] `npm run build` 로컬 검증
- [ ] git push → Vercel 자동 배포
- [ ] `cheese0318@nowondaycare.org` 로 첫 로그인
- [ ] SQL Editor로 슈퍼 관리자 설정 (Step 3 SQL)
- [ ] Admin UI 또는 SQL로 관리자·당사자 사전 등록 (Step 4 SQL)

### Phase 4: 검증
- [ ] 슈퍼 관리자 로그인 → `/admin` 접근 확인
- [ ] 실무자(@nowondaycare.org) 로그인 → supporter 자동 배정 확인
- [ ] 당사자 Gmail 로그인 → 당사자 홈 접근 확인
- [ ] 미등록 이메일 → 오류 메시지 확인
- [ ] `npm run build` 최종 빌드 확인

---

*이 계획서는 2026-05-04 기준 코드베이스를 분석하여 작성되었으며, 2026-05-10 아름드리꿈터 단일 기관으로 범위를 확정하여 전면 단순화되었습니다.*
