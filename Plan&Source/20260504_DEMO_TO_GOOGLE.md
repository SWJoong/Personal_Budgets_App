# 데모 모드 → Google OAuth 전환 구현 계획서

**작성일**: 2026-05-04  
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
코드에서 `NEXT_PUBLIC_DEMO_MODE` 체크가 이미 구현되어 있으므로, 환경변수를 `false`로 바꾸면 Google OAuth 경로가 활성화된다.  
롤백 시에도 `NEXT_PUBLIC_DEMO_MODE=true`로 즉시 데모 모드로 복귀 가능하다.

전환 후에는 **Google OAuth** 로그인 → Supabase Auth 세션 → 역할(role) 기반 접근 제어가 동작한다.

---

## 역할별 계정 분류

| 역할 | 이메일 조건 | 로그인 방법 | 기본 role | 비고 |
|------|-----------|-----------|---------|------|
| 관리자(admin) | ADMIN_EMAILS 목록 | Google OAuth | admin (자동 승격) | 데모 모드에도 존재했던 역할 |
| 실무자(supporter) | @nowondaycare.org | Google OAuth | participant → supporter (수동 설정 필요) | **데모 모드에서 진입 경로 없었음** — 이번 전환의 핵심 |
| 당사자(participant) | 개별 Gmail 허용 목록 | Google OAuth | participant (participants 테이블 연결 필요) | 데모에서는 고정 UUID `11e95b8b-...` 사용 |

---

## 📋 PM 관점 — 일정 및 리스크 관리

### 전환 단계 (Phase)

```
Phase 1 (1일차)   환경 설정 — Supabase Google OAuth 활성화, Vercel 환경변수 변경
Phase 2 (1~2일차) 코드 변경 — 로그인 UI, 레이아웃 인증 체크, 콜백 로직 보강
Phase 3 (2일차)   계정 설정 — 관리자/실무자/당사자 계정 역할 수동 설정
Phase 4 (2~3일차) 검증 및 배포 — 3가지 역할 로그인 테스트, 프로덕션 반영
```

### 마일스톤

- [ ] M1: Supabase Google OAuth 활성화 완료 (Google Cloud Console + Supabase 대시보드)
- [ ] M2: Vercel 환경변수 `NEXT_PUBLIC_DEMO_MODE` 제거 또는 `false` 설정
- [ ] M3: 코드 4개 파일 변경 및 빌드 성공 (`npm run build` 오류 없음)
- [ ] M4: 관리자 계정 1개 로그인 성공 + `/admin` 접근 확인
- [ ] M5: 실무자 계정 1개 로그인 성공 + `/supporter` 접근 확인
- [ ] M6: 당사자 계정 1개 로그인 성공 + `/` 접근 확인
- [ ] M7: 프로덕션 배포 완료

### 리스크

| 리스크 | 가능성 | 대응 방안 |
|--------|------|---------|
| Google Cloud OAuth 앱 승인 지연 | 낮음 | Test 모드로 우선 운영 (100명 제한) |
| 실무자가 participant로 로그인되는 문제 | 높음 | 로그인 후 관리자가 role 수동 변경 필요 (admin 설정 화면 활용) |
| 당사자 Gmail 계정 미보유 | 중간 | 기관 계정 생성 또는 Guardian 대리 로그인 검토 |
| 데모 데이터와 실운영 데이터 충돌 | 낮음 | 데모 프로필(UUID 고정) 삭제 마이그레이션 실행 |
| 이메일 도메인 화이트리스트 누락 | 중간 | 전환 전 ADMIN_EMAILS, ALLOWED_EMAIL_DOMAINS 목록 최종 확인 |

### 이해관계자 커뮤니케이션

- 전환 전: 실무자들에게 **새 로그인 방법(Google 계정) 사전 안내** 이메일 발송
- 전환 후: 당사자 담당 지원자가 participants 테이블 auth_user_id 연결 작업 수행

---

## 🏗️ PL 관점 — 아키텍처 결정 및 기술 스펙

### 변경 범위 요약

```
변경 파일 4개:
  1. src/app/(auth)/login/page.tsx            ← UI 교체
  2. src/app/(supporter)/layout.tsx           ← isDemoMode 하드코딩 제거
  3. src/app/actions/admin.ts                 ← ADMIN_EMAILS 업데이트
  4. src/app/(auth)/auth/callback/route.ts    ← 당사자 이메일 허용 로직 추가

환경변수 변경 (Vercel):
  - NEXT_PUBLIC_DEMO_MODE: true → false (또는 삭제)
  - ALLOWED_EMAIL_DOMAINS: nowondaycare.org (실무자/관리자 도메인)
  - ADMIN_EMAILS: 관리자 이메일 목록 (콤마 구분)
  - PARTICIPANT_EMAILS: 당사자 Gmail 목록 (콤마 구분) ← 신규 추가
  - NEXT_PUBLIC_SITE_URL: 실제 Vercel 도메인

변경 없는 파일:
  - src/utils/supabase/server.ts (NEXT_PUBLIC_DEMO_MODE 체크 이미 구현됨)
  - src/app/(auth)/auth/callback/route.ts의 도메인 검증 로직 (보강만 필요)
  - supabase/migrations/ (기존 RLS 정책 유지)
```

### 핵심 아키텍처 원칙

1. **데모 모드 코드 제거 X** — 환경변수로만 제어. `NEXT_PUBLIC_DEMO_MODE=true`이면 기존 데모 동작 유지 (롤백 가능)
2. **당사자 이메일 허용** — `PARTICIPANT_EMAILS` 환경변수를 `ADMIN_EMAILS`와 동일한 방식으로 처리
3. **역할 자동화 범위** — 관리자만 ADMIN_EMAILS로 자동 승격. 실무자는 로그인 후 관리자 수동 설정
4. **profile.role 기본값** — `handle_new_user` 트리거가 새 사용자를 `participant`로 생성하므로, 실무자는 로그인 후 관리자가 `supporter`로 변경

### 코드 검토 포인트

- `(supporter)/layout.tsx:16` — `isDemoMode = true` 하드코딩이 가장 큰 보안 취약점. **이 한 줄만 바꿔도 실무자/관리자 인증 체크 활성화됨**
- `auth/callback/route.ts:28` — `PARTICIPANT_EMAILS` 환경변수 추가 시 동일 패턴으로 처리
- `admin.ts:7-15` — ADMIN_EMAILS 배열을 환경변수로 이관하는 것이 장기적으로 바람직

---

## 🎨 UX/UI 관점 — 로그인 화면 재설계

### 현재 vs 목표 화면 비교

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
│  [G Google로 로그인]     │
│                         │
│  · 실무자: 기관 이메일   │
│  · 당사자: Gmail 로그인  │
└─────────────────────────┘
```

### UI 설계 방향

- **버튼 1개 원칙**: Google 로그인 버튼 하나로 모든 역할 통합 (역할은 서버가 판단)
- **로그인 후 리다이렉션**:
  - `admin` role → `/admin`
  - `supporter` role → `/supporter`
  - `participant` role → `/` (당사자 홈)
- **실패 안내**: 허용되지 않은 이메일 접속 시 명확한 한국어 안내문 표시
- **접근성**: Easy Read 기준 — 큰 버튼(min 48px), 명확한 설명 문구, Pretendard 폰트

### 오류 화면 메시지 (쉬운 말)

```
이 앱에 들어올 수 없는 이메일이에요.
아름드리꿈터 직원이라면 기관 이메일로 로그인해주세요.
당사자라면 담당 선생님께 문의해주세요.
```

---

## 🖥️ Frontend 관점 — 코드 변경 상세

### 변경 1: `src/app/(auth)/login/page.tsx` — 전면 교체

**현재**: 역할 선택 UI (handleRoleSelect → cookie 저장 → 라우팅)  
**변경 후**: Google OAuth 로그인 시작 버튼

```typescript
// 변경 핵심 로직
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

**유지할 UI 요소**:
- 로고 (💰 아이콘 + 아름드리꿈터)
- 앱 설명 문구
- 이스터에그 (버트런드 러셀 명언) — 선택적 유지

**제거할 요소**:
- `handleRoleSelect()` 함수
- localStorage 조작 코드
- `document.cookie = 'demo_role=...'`
- "역할을 선택해주세요" 배너
- 관리자/당사자 선택 버튼 2개

**추가할 요소**:
- Google 로그인 버튼 (공식 Google 브랜딩 가이드 준수)
- 역할 안내 텍스트 (실무자: 기관 이메일, 당사자: 개인 이메일)
- `?error=InvalidDomain` 파라미터 처리 → 친절한 오류 메시지 표시

### 변경 2: `src/app/(supporter)/layout.tsx` — 1줄 수정

```typescript
// Before (line 16)
const isDemoMode = true

// After
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
```

이 변경으로 `NEXT_PUBLIC_DEMO_MODE=false`일 때 아래 인증 블록이 활성화된다:
- `supabase.auth.getUser()` 실행
- 미로그인 → `/login` 리다이렉트
- participant role → `/` 리다이렉트

### 변경 3: `src/app/(auth)/auth/callback/route.ts` — 당사자 이메일 허용

```typescript
// 기존
const adminEmails = (process.env.ADMIN_EMAILS ?? 'cheese0318@gmail.com')
  .split(',').map(e => e.trim()).filter(Boolean)

if (!allowedDomains.some(d => email.endsWith('@' + d.trim())) && 
    !adminEmails.includes(email)) {
  // 거부
}

// 변경 후 — PARTICIPANT_EMAILS 추가
const adminEmails = (process.env.ADMIN_EMAILS ?? 'cheese0318@gmail.com')
  .split(',').map(e => e.trim()).filter(Boolean)
const participantEmails = (process.env.PARTICIPANT_EMAILS ?? '')
  .split(',').map(e => e.trim()).filter(Boolean)

const isAllowed = 
  allowedDomains.some(d => email.endsWith('@' + d.trim())) ||
  adminEmails.includes(email) ||
  participantEmails.includes(email)

if (!isAllowed) {
  await supabase.auth.signOut()
  return NextResponse.redirect(`${baseUrl}/login?error=InvalidDomain`)
}
```

### 로그인 후 역할별 리다이렉션 처리

현재 `(participant)/page.tsx`에 이미 역할 기반 리다이렉션 로직이 있다:
```typescript
if (profile?.role === 'admin') redirect('/admin')
if (profile?.role === 'supporter') redirect('/supporter')
```
→ 추가 변경 불필요, 기존 로직 활용

---

## 🗄️ Backend 관점 — Supabase 설정 및 역할 관리

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

### Step 2: 관리자 계정 역할 설정

로그인 후 profiles 테이블에서 role을 'admin'으로 설정:

```sql
-- Supabase SQL Editor에서 실행
-- 관리자 이메일들을 admin으로 설정
UPDATE public.profiles p
SET role = 'admin'
FROM auth.users u
WHERE p.id = u.id
AND u.email IN (
  'cheese0318@gmail.com',
  'ahreum217@nowondaycare.org',
  'valuesh@nowondaycare.org',
  'tpdnr9870@nowondaycare.org',
  '0305ysy@nowondaycare.org',
  'soujin1020@nowondaycare.org',
  'green4869@nowondaycare.org'
);
```

### Step 3: 실무자 계정 역할 설정

실무자들이 Google 로그인 완료 후 (profiles에 participant로 생성됨):

```sql
-- 방법 1: SQL로 일괄 설정 (실무자 이메일 목록 확인 후)
UPDATE public.profiles p
SET role = 'supporter'
FROM auth.users u
WHERE p.id = u.id
AND u.email LIKE '%@nowondaycare.org'
AND p.role = 'participant';  -- 아직 변경 안 된 계정만

-- 방법 2: Admin UI 활용 (관리자가 /admin/settings에서 역할 변경)
```

### Step 4: 당사자 계정 연결

당사자가 Google 로그인 완료 후 auth.users에 생성됨 → participants 테이블과 연결:

```sql
-- participants 테이블의 auth_user_id 연결
UPDATE public.participants p
SET auth_user_id = u.id
FROM auth.users u
WHERE u.email = '당사자이메일@gmail.com'  -- 개별 설정
AND p.name = '김지수';  -- 이름으로 매칭 (또는 관리자가 UI에서 선택)
```

### Step 5: handle_new_user 트리거 확인

신규 로그인 시 자동으로 profiles 테이블에 레코드가 생성되어야 한다:

```sql
-- 트리거 존재 여부 확인
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND trigger_schema = 'auth';

-- 트리거가 없다면 생성 (이미 있을 가능성 높음)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'participant'  -- 기본값: participant, 관리자가 수동으로 변경
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### ADMIN_EMAILS 환경변수화 (권장)

현재 `admin.ts`에 하드코딩된 ADMIN_EMAILS를 환경변수로 이관:

```typescript
// admin.ts 변경
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean)
```

이미 `auth/callback/route.ts`에서는 환경변수로 읽고 있으므로, `admin.ts`도 일치시켜야 한다.

### RLS 정책 — 변경 없음

기존 RLS 정책은 role 기반으로 이미 올바르게 설정되어 있다:
- `admin`: 전체 CRUD
- `supporter`: SELECT + INSERT + UPDATE (DELETE 불가)
- `participant`: 자신의 데이터만 SELECT

---

## ⚙️ DevOps 관점 — 환경변수 및 배포 설정

### Vercel 환경변수 변경 목록

**Vercel 대시보드** > Settings > Environment Variables:

| 변수명 | 현재 값 | 변경 후 값 | 환경 |
|--------|--------|----------|------|
| `NEXT_PUBLIC_DEMO_MODE` | `true` | `false` 또는 삭제 | Production |
| `ALLOWED_EMAIL_DOMAINS` | (없거나 nowondaycare.org) | `nowondaycare.org` | Production |
| `ADMIN_EMAILS` | (없거나 일부) | 전체 관리자 이메일 (콤마 구분) | Production |
| `PARTICIPANT_EMAILS` | (없음) | 당사자 Gmail 목록 (콤마 구분) | Production |
| `NEXT_PUBLIC_SITE_URL` | (없거나 임시) | `https://[실제 Vercel 도메인]` | Production |

### 배포 절차

```
1. Vercel 환경변수 변경 → 저장
2. Supabase Google OAuth 활성화 (Google Cloud Console → Supabase 대시보드)
3. 코드 변경 4개 파일 → git commit & push → Vercel 자동 배포
4. 배포 완료 후 3가지 역할 로그인 테스트
5. 실무자/당사자 계정 설정 (SQL 또는 Admin UI)
```

### 롤백 계획

문제 발생 시 `NEXT_PUBLIC_DEMO_MODE=true`로 되돌리면 즉시 데모 모드 복귀:
- `(supporter)/layout.tsx`의 `isDemoMode` 변경도 되돌려야 완전한 롤백
- Vercel에서 이전 배포로 Instant Rollback 가능
- 원본 데모 커밋은 `2a832c5` (AUTHENTICATION_CHANGES.md 참조)

### 로컬 개발 환경

```bash
# .env.local (로컬 테스트용)
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=https://[프로젝트].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
ALLOWED_EMAIL_DOMAINS=nowondaycare.org
ADMIN_EMAILS=cheese0318@gmail.com
PARTICIPANT_EMAILS=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 🧪 QA 관점 — 테스트 케이스

### 테스트 시나리오 1: 관리자 로그인

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 1-1 | ADMIN_EMAILS에 있는 이메일로 Google 로그인 | `/admin` 이동, 관리자 UI 표시 | P0 |
| 1-2 | ADMIN_EMAILS 이메일이 profiles에 `admin` role인지 확인 | DB: `role = 'admin'` | P0 |
| 1-3 | 관리자로 당사자 생성/수정/삭제 | 성공 | P1 |
| 1-4 | 관리자로 실무자 role 변경 | 성공 | P1 |

### 테스트 시나리오 2: 실무자 로그인

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 2-1 | @nowondaycare.org 이메일로 Google 로그인 | 로그인 성공, 처음엔 `/` 이동 (participant 기본값) | P0 |
| 2-2 | 관리자가 supporter로 role 변경 후 재로그인 | `/supporter` 이동 | P0 |
| 2-3 | 실무자로 `/admin` 직접 접근 시도 | `/` 또는 `/supporter`로 리다이렉트 | P0 |
| 2-4 | 실무자로 거래 생성 | 성공 | P1 |
| 2-5 | 실무자로 거래 삭제 시도 | 실패 (RLS 정책 차단) | P1 |

### 테스트 시나리오 3: 당사자 로그인

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 3-1 | PARTICIPANT_EMAILS에 있는 Gmail로 로그인 | 로그인 성공, `/` 당사자 홈 이동 | P0 |
| 3-2 | participants 테이블 auth_user_id 연결 후 자기 데이터 조회 | 자신의 예산/거래 표시 | P0 |
| 3-3 | 당사자로 `/admin` 직접 접근 시도 | `/`로 리다이렉트 | P0 |
| 3-4 | 당사자로 `/supporter` 직접 접근 시도 | `/`로 리다이렉트 | P0 |

### 테스트 시나리오 4: 거부 케이스

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 4-1 | 허용 안 된 Gmail 로그인 시도 | `/login?error=InvalidDomain` 이동 + 오류 메시지 | P0 |
| 4-2 | 로그아웃 후 `/admin` 접근 | `/login`으로 리다이렉트 | P0 |
| 4-3 | 세션 만료 후 접근 | `/login`으로 리다이렉트 | P1 |

### 빌드 검증

```bash
npm run build    # TypeScript 오류, 빌드 오류 없어야 함
npm run lint     # ESLint 경고 없어야 함
```

---

## ♿ Easy Read 관점 — 쉬운 정보 기준 검토

### 로그인 화면 문구 검토

**현재 데모 화면 문구 (교체 대상)**:
- "역할을 선택해주세요" → 삭제 (역할 선택 UI 제거됨)
- "관리자로 접속 / 당사자로 접속" → 삭제

**새 로그인 화면 문구 (작성 기준)**:

| 항목 | 쉬운 말 기준 | 제안 문구 |
|------|-----------|---------|
| 로그인 버튼 | 짧고 행동 중심 | "구글로 로그인하기" |
| 부가 설명 | 누가 어떻게 쓰는지 | "아름드리꿈터 선생님과 이용자를 위한 앱이에요" |
| 실패 메시지 | 원인과 해결 방법 | "이 앱에 들어올 수 없는 이메일이에요. 담당 선생님께 문의해주세요." |

**Easy Read 체크리스트** (로그인 화면):
- [ ] 한 문장에 한 가지 정보만
- [ ] 어려운 단어 없음 (OAuth, 도메인, 인증 등 비표시)
- [ ] 버튼 크기 최소 48×48px
- [ ] 색상 대비 WCAG AA 이상
- [ ] 오류 메시지에 해결 방법 포함

---

## 구현 순서 요약 (실행 체크리스트)

### 사전 준비
- [ ] Google Cloud Console에서 OAuth 2.0 앱 생성
- [ ] Supabase 대시보드 Google OAuth 활성화 (Client ID/Secret 입력)
- [ ] Supabase URL Configuration 설정 (Site URL, Redirect URLs)

### 코드 변경
- [ ] `src/app/(supporter)/layout.tsx` line 16: `isDemoMode = true` → `isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'`
- [ ] `src/app/(auth)/login/page.tsx`: 역할 선택 UI → Google 로그인 버튼으로 전면 교체
- [ ] `src/app/(auth)/auth/callback/route.ts`: `PARTICIPANT_EMAILS` 환경변수 추가 처리
- [ ] `src/app/actions/admin.ts`: ADMIN_EMAILS를 환경변수에서 읽도록 변경

### 환경변수 (Vercel)
- [ ] `NEXT_PUBLIC_DEMO_MODE` = `false` 또는 삭제
- [ ] `ALLOWED_EMAIL_DOMAINS` = `nowondaycare.org`
- [ ] `ADMIN_EMAILS` = 전체 관리자 이메일
- [ ] `PARTICIPANT_EMAILS` = 당사자 Gmail 목록
- [ ] `NEXT_PUBLIC_SITE_URL` = 실제 Vercel 도메인

### 배포 및 계정 설정
- [ ] `npm run build` 로컬 검증
- [ ] git push → Vercel 자동 배포
- [ ] 관리자 계정 1개로 첫 로그인 테스트
- [ ] SQL Editor로 관리자 role 수동 설정 (Step 2 SQL 실행)
- [ ] 실무자 전원 로그인 후 role 일괄 변경 (Step 3 SQL 실행)
- [ ] 당사자 Gmail 계정 로그인 후 auth_user_id 연결 (Step 4 SQL 실행)

### 최종 검증
- [ ] 관리자 로그인 → `/admin` 접근 확인
- [ ] 실무자 로그인 → `/supporter` 접근 확인
- [ ] 당사자 로그인 → `/` 당사자 홈 접근 확인
- [ ] 미허용 이메일 → 오류 메시지 확인

---

*이 계획서는 2026-05-04 기준 코드베이스를 분석하여 작성되었습니다.*
