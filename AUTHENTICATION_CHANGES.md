# 인증 시스템 변경사항

## 개요
Google OAuth 인증을 제거하고 이메일/비밀번호 기반 인증으로 전환했습니다.

## 브랜치
- **브랜치명**: `remove-google-auth`
- **기본 브랜치**: `main`

## 변경된 파일

### 1. `/src/app/(auth)/login/page.tsx`
**변경 내용:**
- Google OAuth 버튼 제거
- 이메일/비밀번호 입력 폼 추가
- 회원가입 페이지로 이동하는 링크 추가
- 도메인 제한 검증 (클라이언트 사이드)

**주요 기능:**
```typescript
// 이메일/비밀번호로 로그인
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

### 2. `/src/app/(auth)/signup/page.tsx` *(새 파일)*
**주요 기능:**
- 이메일/비밀번호 회원가입
- 이름 입력 (선택사항)
- 비밀번호 확인 필드
- 비밀번호 최소 6자 검증
- 도메인 화이트리스트 검증
- 회원가입 성공 시 로그인 페이지로 자동 리디렉션

```typescript
// 회원가입
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      name: name || email.split('@')[0],
    },
  },
});
```

## 도메인 제한 설정

### 환경 변수
`.env.local` 파일에 다음 환경 변수를 설정하세요:

```bash
# 클라이언트 사이드 (브라우저에서 접근 가능)
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=nowondaycare.org

# 여러 도메인 허용 시 (쉼표로 구분)
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=nowondaycare.org,example.com

# 특정 이메일 화이트리스트 (관리자 등)
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com,manager@test.com
```

### 서버 사이드 환경 변수
`/auth/callback` route에서도 동일한 검증을 수행합니다:
```bash
ALLOWED_EMAIL_DOMAINS=nowondaycare.org
ADMIN_EMAILS=admin@example.com
```

## Supabase 설정

### 1. 이메일 인증 활성화
Supabase 대시보드에서:
1. **Authentication** → **Providers** 이동
2. **Email** provider 활성화
3. **Confirm email** 옵션 설정 (선택사항)

### 2. Email Templates (선택사항)
이메일 확인을 원할 경우:
- **Authentication** → **Email Templates**에서 템플릿 커스터마이징

### 3. Google OAuth 비활성화 (선택사항)
- **Authentication** → **Providers**에서 Google provider 비활성화

## 사용자 플로우

### 회원가입
1. `/signup` 페이지 접속
2. 이름 (선택), 이메일, 비밀번호 입력
3. 도메인 검증 통과 필요 (예: @nowondaycare.org)
4. 회원가입 성공 → 자동으로 `/login`으로 이동

### 로그인
1. `/login` 페이지 접속
2. 이메일과 비밀번호 입력
3. 도메인 검증 통과
4. 로그인 성공 → `/` (홈)으로 리디렉션

## 보안 기능

### 클라이언트 사이드
- 비밀번호 최소 6자 검증
- 비밀번호 확인 일치 검증
- 도메인 화이트리스트 검증

### 서버 사이드
- auth callback에서 도메인 재검증
- 허용되지 않은 도메인 시 즉시 로그아웃 및 에러 페이지로 리디렉션

## 테스트

### 로컬 테스트
```bash
npm run dev
```

### 빌드 테스트
```bash
npm run build
```

빌드 성공 확인:
```
✓ Generating static pages (17/17)
○ /login
○ /signup
```

## 마이그레이션 가이드

### main 브랜치에 병합하기
```bash
# 현재 브랜치 확인
git branch  # remove-google-auth에 있어야 함

# main 브랜치로 전환
git checkout main

# remove-google-auth 브랜치 병합
git merge remove-google-auth

# 원격 저장소에 푸시
git push origin main
```

### 환경 변수 업데이트
병합 후 프로덕션 환경 (.env.production 또는 Vercel)에 다음 환경 변수 추가:
```bash
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=nowondaycare.org
NEXT_PUBLIC_ADMIN_EMAILS=cheese0318@nowondaycare.org
ALLOWED_EMAIL_DOMAINS=nowondaycare.org
ADMIN_EMAILS=cheese0318@nowondaycare.org
```

## 롤백 방법

Google OAuth로 되돌리려면:
```bash
git checkout main
git revert <commit-hash>  # 이 커밋의 해시: 91275a3
```

또는 브랜치 삭제:
```bash
git branch -D remove-google-auth
```

## 주의사항

1. **기존 사용자**: Google OAuth로 가입한 기존 사용자는 비밀번호 재설정이 필요할 수 있습니다.
2. **이메일 확인**: Supabase에서 "Confirm email"을 활성화한 경우, 사용자는 이메일 인증 링크를 클릭해야 합니다.
3. **도메인 제한**: 반드시 환경 변수에 허용된 도메인을 설정하세요.
4. **비밀번호 정책**: 현재 최소 6자만 요구하며, 더 강력한 정책이 필요하면 코드를 수정하세요.

## 문의

문제가 발생하면 다음을 확인하세요:
1. Supabase 대시보드에서 Email provider 활성화 여부
2. 환경 변수가 올바르게 설정되었는지 (.env.local)
3. 브라우저 콘솔에서 에러 메시지 확인
4. Supabase 로그 확인

---

**작성일**: 2026-03-28
**버전**: 1.0.0
**커밋**: 91275a3
