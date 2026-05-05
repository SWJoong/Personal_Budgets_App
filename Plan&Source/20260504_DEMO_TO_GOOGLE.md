# 데모 모드 → Google OAuth 전환 구현 계획서

**작성일**: 2026-05-04  
**최종 수정**: 2026-05-05 (다중 기관 아키텍처 및 권한 계층 추가)  
**프로젝트**: 개인예산 관리 앱 (아름드리꿈터 · 신세계중랑자립생활센터 통합 운영)  
**전환 목적**: 외부 공개 데모 앱을 실제 Google 인증 기반 + 다중 기관 운영 앱으로 전환  

---

## ⚡ 추가 요구사항 (2026-05-05)

기존 "데모 → Google 전환" 계획에 아래 두 가지 요구사항이 추가되었다.

### 1. 이메일 기반 인증 권한 체계 재설계

- `cheese0318@nowondaycare.org` (최중호) = **슈퍼 관리자** (모든 기관 접근 권한)
- `@nowondaycare.org` 도메인 = 로그인 시 기본으로 **실무자(supporter)** 역할 부여
- 관리자가 Google 이메일을 **사전 등록**하여 역할·기관을 미리 설정 → 실제 사용자가 Google 로그인 시 자동 인증

### 2. 다중 기관(Multi-tenant) 지원

하나의 레포지토리·DB로 여러 기관이 데이터를 분리하여 운영:
- **아름드리꿈터**: `@nowondaycare.org` 도메인, 서울시형 개인예산제
- **신세계중랑자립생활센터**: 별도 이메일, 보건복지부형 개인예산제

각 기관 관리자는 자기 기관 데이터만 접근. 슈퍼 관리자(최중호)만 전체 접근 가능.

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

## 권한 계층 구조 (4단계)

```
슈퍼 관리자 (super admin)
  └── cheese0318@nowondaycare.org (최중호)
  └── 모든 기관 데이터 접근 · 수정 가능
  └── profiles.is_super_admin = true

기관 관리자 (org admin)
  └── 각 기관별 1명 이상
  └── 자기 기관 데이터만 접근 가능
  └── profiles.role = 'admin', organization_id = 해당 기관 ID

실무자 (supporter)
  └── @nowondaycare.org → 아름드리꿈터 자동 배정
  └── 다른 기관은 관리자가 사전 등록
  └── profiles.role = 'supporter', organization_id = 소속 기관 ID

당사자 (participant)
  └── 사전 등록 필수 (관리자가 Gmail 등록)
  └── profiles.role = 'participant', participants.organization_id 연결
```

## 기관(Organization) 분류

| 기관명 | slug | 예산제 유형 | 이메일 처리 방식 |
|-------|------|-----------|---------------|
| 아름드리꿈터 | `areumdeuriggumteo` | 서울시형 | @nowondaycare.org 도메인 → supporter 자동 배정 |
| 신세계중랑자립생활센터 | `shinsegae-jungnang` | 보건복지부형 | **MS 기반 기관, 구글 도메인 없음** → 개인 Gmail + user_invitations 사전 등록 필수 |

## 역할별 계정 분류 (기관 포함)

| 역할 | 이메일 조건 | 기본 role | 기관 배정 방식 |
|------|-----------|---------|------------|
| 슈퍼 관리자 | `cheese0318@nowondaycare.org` | admin + `is_super_admin=true` | 전체 기관 |
| 기관 관리자 | 사전 등록 이메일 | admin | 사전 등록 시 지정 |
| 실무자 | @nowondaycare.org 도메인 | supporter (자동) | 아름드리꿈터 자동 배정 |
| 실무자 | 사전 등록 이메일 (타 기관) | supporter | 사전 등록 시 지정 |
| 당사자 | 사전 등록 이메일 (Gmail) | participant | 사전 등록 시 지정 |

---

## 📋 PM 관점 — 일정 및 리스크 관리

### 전환 단계 (Phase) — 다중 기관 반영 버전

```
Phase 0 (선행)    DB 설계 — organizations, user_invitations 테이블 마이그레이션 실행
Phase 1 (1일차)   환경 설정 — Supabase Google OAuth 활성화, Vercel 환경변수 변경
Phase 2 (1~2일차) 코드 변경 — 로그인 UI, 레이아웃 인증, 콜백 로직, 기관 분리 RLS
Phase 3 (2일차)   기관·계정 설정 — 2개 기관 생성, 슈퍼 관리자·기관 관리자 설정
Phase 4 (3일차)   사전 등록 — 실무자·당사자 이메일 user_invitations에 등록
Phase 5 (3~4일차) 검증 및 배포 — 4가지 역할 × 2개 기관 시나리오 테스트
```

### 마일스톤

- [ ] M0: `organizations`, `user_invitations` 테이블 마이그레이션 실행
- [ ] M1: Supabase Google OAuth 활성화 완료
- [ ] M2: Vercel 환경변수 `NEXT_PUBLIC_DEMO_MODE=false`
- [ ] M3: 코드 변경 및 빌드 성공 (`npm run build`)
- [ ] M4: 슈퍼 관리자(`cheese0318@nowondaycare.org`) 로그인 → 전체 기관 접근 확인
- [ ] M5: 아름드리꿈터 기관 관리자 로그인 → 자기 기관만 접근 확인
- [ ] M6: 아름드리꿈터 실무자(@nowondaycare.org) 로그인 → supporter 자동 부여 확인
- [ ] M7: 신세계중랑 기관 관리자 로그인 → 아름드리꿈터 데이터 차단 확인
- [ ] M8: 당사자 Gmail 로그인 → 자기 기관 당사자 홈 접근 확인
- [ ] M9: 프로덕션 배포 완료

### 리스크 (추가 항목 포함)

| 리스크 | 가능성 | 대응 방안 |
|--------|------|---------|
| Google Cloud OAuth 앱 승인 지연 | 낮음 | Test 모드로 우선 운영 (100명 제한) |
| @nowondaycare.org 이외 도메인 실무자 진입 불가 | 높음 | user_invitations 사전 등록으로 해결 |
| 당사자 Gmail 계정 미보유 | 중간 | 기관 계정 생성 또는 Guardian 대리 로그인 검토 |
| 기존 데모 데이터와 organization_id 충돌 | 중간 | 마이그레이션에서 기존 participants에 org_id 일괄 설정 |
| 기관 간 데이터 누출 (RLS 설정 오류) | 낮음 | 기관 격리 RLS 별도 테스트 시나리오 검증 필수 |
| 신세계중랑 이메일 도메인 미정 | 높음 | 담당자 확인 필요 (임시: 사전 등록 방식으로 대체) |

### 이해관계자 커뮤니케이션

- 전환 전: 아름드리꿈터·신세계중랑 실무자들에게 **새 로그인 방법 + 기관별 접속 안내** 이메일 발송
- 전환 전: 각 기관 담당자에게 **당사자 Gmail 수집** 요청 (user_invitations 사전 등록용)
- 전환 후: 슈퍼 관리자가 각 기관 관리자 계정을 user_invitations에 등록
- 전환 후: 기관 관리자가 소속 실무자·당사자를 user_invitations에 등록

---

## 🏗️ PL 관점 — 아키텍처 결정 및 기술 스펙

### 변경 범위 요약 (다중 기관 포함)

```
신규 마이그레이션 파일 2개:
  supabase/migrations/31_organizations.sql        ← organizations, user_invitations 테이블
  supabase/migrations/32_org_rls_policies.sql     ← 기관 격리 RLS 정책

변경 파일 7개:
  1. src/app/(auth)/login/page.tsx                ← UI 교체 (Google 로그인 버튼)
  2. src/app/(supporter)/layout.tsx               ← isDemoMode 하드코딩 제거
  3. src/app/(auth)/auth/callback/route.ts        ← user_invitations 조회, 기관 배정 로직
  4. src/app/actions/admin.ts                     ← 기관 관리 함수 추가, org 필터 적용
  5. src/types/database.ts                        ← organizations, user_invitations 타입 추가
  6. src/app/(supporter)/admin/page.tsx           ← 기관 선택/표시 UI 추가 (슈퍼 관리자용)
  7. src/app/(supporter)/admin/invitations/       ← 사전 등록 관리 UI (신규 페이지) ← Admin UI 방식 채택

환경변수 변경 (Vercel):
  - NEXT_PUBLIC_DEMO_MODE: true → false
  - SUPER_ADMIN_EMAIL: cheese0318@nowondaycare.org  ← 신규
  - ALLOWED_EMAIL_DOMAINS: nowondaycare.org
  - NEXT_PUBLIC_SITE_URL: 실제 Vercel 도메인
  ※ PARTICIPANT_EMAILS 환경변수 방식 → user_invitations DB 테이블로 대체
  ※ ADMIN_EMAILS 환경변수 방식 → user_invitations DB 테이블로 대체 (슈퍼 관리자 제외)

변경 없는 파일:
  - src/utils/supabase/server.ts (NEXT_PUBLIC_DEMO_MODE 체크 이미 구현됨)
  - 기존 페이지 컴포넌트 (RLS가 자동으로 기관별 데이터 필터링)
```

### 핵심 아키텍처 원칙

1. **데모 모드 코드 제거 X** — 환경변수로만 제어. 롤백 가능
2. **사전 등록 방식** — 환경변수 대신 `user_invitations` DB 테이블로 이메일·역할·기관 관리. 관리자가 UI(또는 SQL)로 추가 가능
3. **@nowondaycare.org 도메인 자동 처리** — OAuth 콜백에서 도메인 감지 → supporter 역할 + 아름드리꿈터 org 자동 배정
4. **슈퍼 관리자 하드코딩 최소화** — `SUPER_ADMIN_EMAIL` 환경변수 하나로만 지정, `is_super_admin=true` 플래그로 관리
5. **RLS 기반 격리** — 페이지 컴포넌트 수정 없이 DB 레벨에서 기관 데이터 자동 격리
6. **향후 포크 대비** — `organizations` 테이블 도입으로 각 기관이 나중에 fork 시 자기 조직 row만 유지하면 됨

### 코드 검토 포인트

- `(supporter)/layout.tsx:16` — `isDemoMode = true` 하드코딩. 이 한 줄이 가장 큰 보안 취약점
- `auth/callback/route.ts:24-31` — 기관 배정 로직의 핵심. user_invitations 조회 순서: 슈퍼 관리자 → 사전 등록 → 도메인 자동 배정
- `admin.ts:7-15` — ADMIN_EMAILS 하드코딩을 user_invitations 조회로 교체해야 함

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

### 사전 등록 관리 UI (`/admin/invitations`) — Admin UI 채택

슈퍼 관리자 및 기관 관리자가 이메일을 미리 등록하는 화면:

```
┌─────────────────────────────────────────────┐
│  사용자 초대 관리                             │
│                                             │
│  [+ 새 사용자 초대]                           │
│                                             │
│  이메일            역할      기관       상태  │
│  ─────────────────────────────────────────  │
│  abc@gmail.com   실무자  아름드리꿈터  미사용  │
│  def@gmail.com   당사자  신세계중랑   사용됨  │
│                                             │
└─────────────────────────────────────────────┘
```

- 슈퍼 관리자: 모든 기관의 초대 목록 조회·등록
- 기관 관리자: 자기 기관 초대만 조회·등록
- 초대 등록 시 이메일·역할·기관 선택
- `used_at` NULL이면 "미사용", 날짜 있으면 "사용됨(로그인 완료)"
- 신세계중랑 실무자/당사자는 반드시 이 화면에서 사전 등록 후 Google 로그인 가능

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

### 변경 3: `src/app/(auth)/auth/callback/route.ts` — 기관 배정 통합 로직

환경변수 기반 허용 목록 → `user_invitations` DB 조회 방식으로 전환:

```typescript
// 변경 후 — user_invitations 조회 + 슈퍼 관리자 처리
const email = user.email ?? ''
const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim()

// 1. 슈퍼 관리자 체크
if (email === superAdminEmail) {
  // handle_new_user 트리거로 이미 profiles 생성됨
  // is_super_admin 플래그는 Step 3 SQL로 별도 설정
  return NextResponse.redirect(`${baseUrl}/admin`)
}

// 2. user_invitations 사전 등록 확인
const { data: invitation } = await supabase
  .from('user_invitations')
  .select('role, organization_id, used_at')
  .eq('email', email)
  .is('used_at', null)  -- 미사용 초대만
  .single()

// 3. 도메인 자동 배정 확인 (nowondaycare.org → 아름드리꿈터 supporter)
const { data: orgByDomain } = await supabase
  .from('organizations')
  .select('id')
  .not('email_domain', 'is', null)
  .filter('email_domain', 'not.is', null)
  .limit(1)
  // 실제로는 SQL 함수로 처리: email LIKE '%@' || email_domain

// 4. 허용 여부 최종 판단
const isAllowed = invitation || orgByDomain
if (!isAllowed) {
  await supabase.auth.signOut()
  return NextResponse.redirect(`${baseUrl}/login?error=InvalidDomain`)
}
// 역할·기관 배정은 handle_new_user 트리거에서 자동 처리
```

> **note**: 실제 구현 시 Supabase의 RPC 함수나 서버 사이드 쿼리로 도메인 매칭을 처리한다. `user_invitations` 체크는 `adminClient`로 실행해야 RLS를 우회하여 조회 가능하다.

### 로그인 후 역할별 리다이렉션 처리

현재 `(participant)/page.tsx`에 이미 역할 기반 리다이렉션 로직이 있다:
```typescript
if (profile?.role === 'admin') redirect('/admin')
if (profile?.role === 'supporter') redirect('/supporter')
```
→ 추가 변경 불필요, 기존 로직 활용

---

## 🗄️ Backend 관점 — Supabase 설정 · 다중 기관 DB 아키텍처

### Step 0: 다중 기관 DB 설계 (신규 마이그레이션)

#### `supabase/migrations/31_organizations.sql`

```sql
-- 1. 기관 테이블
CREATE TABLE public.organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,                        -- 아름드리꿈터
  slug         TEXT UNIQUE NOT NULL,                 -- areumdeuriggumteo
  budget_type  TEXT NOT NULL DEFAULT 'seoul',        -- 'seoul' | 'mohw'
  email_domain TEXT,                                 -- nowondaycare.org (자동 배정용)
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. 사전 등록 테이블 (관리자가 이메일·역할·기관을 미리 등록)
CREATE TABLE public.user_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'supporter', -- admin | supporter | participant
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by      UUID REFERENCES public.profiles(id),
  note            TEXT,                              -- 메모 (당사자 이름 등)
  used_at         TIMESTAMPTZ,                       -- NULL이면 미사용
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email)
);

-- 3. profiles: organization_id, is_super_admin 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS is_super_admin  BOOLEAN NOT NULL DEFAULT false;

-- 4. participants: organization_id 컬럼 추가
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 5. 기관 초기 데이터 삽입
INSERT INTO public.organizations (name, slug, budget_type, email_domain) VALUES
  ('아름드리꿈터',           'areumdeuriggumteo', 'seoul', 'nowondaycare.org'),
  -- 신세계중랑: MS 기반 기관, 구글 도메인 없음 → email_domain = NULL, 사전 등록 방식만 사용
  ('신세계중랑자립생활센터', 'shinsegae-jungnang', 'mohw',  NULL);
```

#### `supabase/migrations/32_org_rls_policies.sql`

```sql
-- 기관 격리 핵심 함수 (RLS 정책에서 재사용)
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_super_admin, false) FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- profiles: 기관 격리 정책 추가
CREATE POLICY "profiles_org_isolation" ON public.profiles
FOR SELECT USING (
  is_super_admin()                        -- 슈퍼 관리자: 전체
  OR id = auth.uid()                      -- 자기 자신
  OR organization_id = get_my_org_id()   -- 같은 기관
);

-- participants: 기관 격리 정책 추가
CREATE POLICY "participants_org_isolation" ON public.participants
FOR ALL USING (
  is_super_admin()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid())
    IN ('admin', 'supporter')
    AND organization_id = get_my_org_id()
  )
  OR auth_user_id = auth.uid()
);

-- user_invitations: 기관 관리자 이상만 조회·등록 가능
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations_admin_only" ON public.user_invitations
FOR ALL USING (
  is_super_admin()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id = get_my_org_id()
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

로그인 시 자동으로 profiles 생성 + 기관 자동 배정:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation RECORD;
  v_org_id     UUID;
  v_role       TEXT;
  v_super_email TEXT;
BEGIN
  -- 슈퍼 관리자 이메일은 별도 처리 (auth/callback에서 처리하므로 여기선 기본값)
  -- 1. user_invitations 테이블에서 사전 등록 여부 확인
  SELECT * INTO v_invitation
  FROM public.user_invitations
  WHERE email = NEW.email AND used_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    v_role   := v_invitation.role;
    v_org_id := v_invitation.organization_id;
    -- 초대 사용 처리
    UPDATE public.user_invitations SET used_at = now() WHERE id = v_invitation.id;
  ELSE
    -- 2. 이메일 도메인으로 기관 자동 배정
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE email_domain IS NOT NULL
      AND NEW.email LIKE '%@' || email_domain
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      v_role := 'supporter';  -- nowondaycare.org → supporter
    ELSE
      v_role := 'participant'; -- 미등록 이메일 기본값
    END IF;
  END IF;

  INSERT INTO public.profiles (id, name, email, role, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_role,
    v_org_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 3: 슈퍼 관리자 설정

```sql
-- cheese0318@nowondaycare.org 로그인 후 실행
UPDATE public.profiles p
SET role = 'admin', is_super_admin = true, organization_id = NULL
FROM auth.users u
WHERE p.id = u.id
AND u.email = 'cheese0318@nowondaycare.org';
```

### Step 4: 기관별 관리자 사전 등록 (user_invitations)

슈퍼 관리자가 SQL 또는 Admin UI에서 기관 관리자 등록:

```sql
-- 아름드리꿈터 관리자 등록 예시
INSERT INTO public.user_invitations (email, role, organization_id, note)
SELECT
  unnest(ARRAY[
    'ahreum217@nowondaycare.org',
    'valuesh@nowondaycare.org'
  ]) AS email,
  'admin' AS role,
  (SELECT id FROM organizations WHERE slug = 'areumdeuriggumteo'),
  '아름드리꿈터 관리자';

-- 신세계중랑 관리자 등록 예시
INSERT INTO public.user_invitations (email, role, organization_id, note)
VALUES (
  '신세계관리자@gmail.com', 'admin',
  (SELECT id FROM organizations WHERE slug = 'shinsegae-jungnang'),
  '신세계중랑 관리자'
);

-- 당사자 사전 등록 예시
INSERT INTO public.user_invitations (email, role, organization_id, note)
VALUES (
  '당사자@gmail.com', 'participant',
  (SELECT id FROM organizations WHERE slug = 'areumdeuriggumteo'),
  '김지수'
);
```

### Step 5: 기존 participants 데이터에 org_id 설정

```sql
-- 기존 데모 당사자들 → 아름드리꿈터 배정
UPDATE public.participants
SET organization_id = (SELECT id FROM organizations WHERE slug = 'areumdeuriggumteo')
WHERE organization_id IS NULL;
```

### RLS 정책 변경 요약

| 테이블 | 기존 | 변경 |
|--------|------|------|
| profiles | role 기반 | + organization_id 격리 + is_super_admin 우회 |
| participants | role 기반 | + organization_id 격리 + is_super_admin 우회 |
| funding_sources | participant 소유권 | participants.organization_id 통해 간접 격리 |
| transactions | participant 소유권 | 동일 |
| user_invitations | 신규 | admin 이상만 접근 |
| organizations | 신규 | 모두 읽기, 슈퍼 관리자만 쓰기 |

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

### 테스트 시나리오 0: 슈퍼 관리자

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 0-1 | `cheese0318@nowondaycare.org` Google 로그인 | 로그인 성공, `is_super_admin=true` 확인 | P0 |
| 0-2 | 슈퍼 관리자로 아름드리꿈터 당사자 조회 | 성공 | P0 |
| 0-3 | 슈퍼 관리자로 신세계중랑 당사자 조회 | 성공 | P0 |
| 0-4 | 슈퍼 관리자로 user_invitations 등록 | 성공 | P0 |

### 테스트 시나리오 2: 실무자 로그인

| # | 시나리오 | 기대 결과 | 우선순위 |
|---|---------|---------|--------|
| 2-1 | @nowondaycare.org 이메일로 Google 로그인 | 로그인 성공, supporter 역할 자동 배정, 아름드리꿈터 배정 | P0 |
| 2-2 | 아름드리꿈터 실무자로 신세계중랑 당사자 조회 시도 | RLS 차단, 데이터 없음 | P0 |
| 2-3 | 실무자로 `/admin` 직접 접근 시도 | `/supporter`로 리다이렉트 | P0 |
| 2-4 | 실무자로 거래 생성 | 성공 | P1 |
| 2-5 | 실무자로 거래 삭제 시도 | 실패 (RLS 정책 차단) | P1 |
| 2-6 | 신세계중랑 실무자(사전 등록)로 로그인 | 신세계중랑 배정, 아름드리꿈터 데이터 차단 | P0 |

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

### Phase 0: DB 마이그레이션 (선행 필수)
- [ ] `supabase/migrations/31_organizations.sql` 파일 생성
- [ ] Supabase SQL Editor에서 31 마이그레이션 실행 (organizations, user_invitations 테이블, profiles/participants 컬럼 추가)
- [ ] `supabase/migrations/32_org_rls_policies.sql` 파일 생성
- [ ] Supabase SQL Editor에서 32 마이그레이션 실행 (기관 격리 RLS 정책)
- [ ] 기존 participants에 organization_id 일괄 설정 (Step 5 SQL 실행)

### Phase 1: 사전 준비
- [ ] Google Cloud Console에서 OAuth 2.0 앱 생성
- [ ] Supabase 대시보드 Google OAuth 활성화 (Client ID/Secret 입력)
- [ ] Supabase URL Configuration 설정 (Site URL, Redirect URLs)

### Phase 2: 코드 변경
- [ ] `src/app/(supporter)/layout.tsx` line 16: `isDemoMode = true` → `isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'`
- [ ] `src/app/(auth)/login/page.tsx`: 역할 선택 UI → Google 로그인 버튼으로 전면 교체
- [ ] `src/app/(auth)/auth/callback/route.ts`: user_invitations 조회 + 슈퍼 관리자 처리로 교체
- [ ] `src/app/actions/admin.ts`: user_invitations 관리 함수 추가, ADMIN_EMAILS 하드코딩 제거
- [ ] `src/types/database.ts`: organizations, user_invitations 타입 추가
- [ ] `src/app/(supporter)/admin/page.tsx`: 슈퍼 관리자용 기관 선택 UI 추가 (선택)

### Phase 3: 환경변수 (Vercel)
- [ ] `NEXT_PUBLIC_DEMO_MODE` = `false` 또는 삭제
- [ ] `SUPER_ADMIN_EMAIL` = `cheese0318@nowondaycare.org`
- [ ] `ALLOWED_EMAIL_DOMAINS` = `nowondaycare.org`
- [ ] `NEXT_PUBLIC_SITE_URL` = 실제 Vercel 도메인
- [ ] ~~`ADMIN_EMAILS`~~ → user_invitations 테이블로 대체
- [ ] ~~`PARTICIPANT_EMAILS`~~ → user_invitations 테이블로 대체

### Phase 4: 배포 및 계정 초기 설정
- [ ] `npm run build` 로컬 검증
- [ ] git push → Vercel 자동 배포
- [ ] `cheese0318@nowondaycare.org` 로 첫 로그인 → profiles 생성 확인
- [ ] SQL Editor로 슈퍼 관리자 설정 (Step 3 SQL 실행)
- [ ] 각 기관 관리자 이메일 user_invitations 등록 (Step 4 SQL 실행)

### Phase 5: 실무자·당사자 등록
- [ ] 아름드리꿈터 실무자(@nowondaycare.org) 로그인 → supporter + 기관 자동 배정 확인
- [ ] **신세계중랑 실무자: Admin UI(`/admin/invitations`)에서 개인 Gmail 사전 등록** → 로그인 테스트
  - MS 기반 기관이므로 구글 도메인 자동 배정 없음, 개인 Gmail만 사용
- [ ] 당사자 Gmail Admin UI에서 사전 등록 → 로그인 + participants 연결 테스트

### Phase 6: 최종 검증
- [ ] 슈퍼 관리자 → 두 기관 모두 접근 확인
- [ ] 아름드리꿈터 관리자 → 신세계중랑 데이터 차단 확인
- [ ] 신세계중랑 관리자 → 아름드리꿈터 데이터 차단 확인
- [ ] 실무자 → `/admin` 접근 차단 확인
- [ ] 당사자 → 자기 데이터만 접근 확인
- [ ] 미등록 이메일 → 오류 메시지 확인

---

## 향후 기관 포크 가이드

이후 각 기관이 독립 레포로 포크할 때는:

```
1. 이 레포를 fork
2. .env.local에서 본인 기관의 Supabase 프로젝트 URL로 변경
3. organizations 테이블에서 자기 기관 row 1개만 남기고 삭제
4. 기존 is_super_admin, organization_id 체크 로직 단순화 가능
```

단일 Supabase 프로젝트에서 다중 기관을 운영하다 각 기관이 성장하면 개별 프로젝트로 분리할 수 있는 구조를 갖추었다.

---

*이 계획서는 2026-05-04 기준 코드베이스를 분석하여 작성되었으며, 2026-05-05 다중 기관 아키텍처 및 슈퍼 관리자 권한 체계가 추가되었습니다.*
