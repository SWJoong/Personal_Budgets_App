# 인증 시스템 변경사항 (데모 모드)

## 📋 개요
모든 인증 시스템을 제거하고 **완전한 데모 모드**로 전환했습니다.

### 변경 이력
1. ~~Google OAuth 제거 → 이메일/비밀번호 인증으로 전환~~ (커밋: 91275a3)
2. **이메일 인증까지 완전 제거 → 역할 선택 데모 모드** (커밋: 2a832c5) ✅

## 🎭 현재 버전: 데모 모드

### 브랜치
- **브랜치명**: `remove-google-auth`
- **기본 브랜치**: `main`
- **최신 커밋**: `2a832c5`

### 주요 특징
- ✅ **인증 불필요**: 로그인/회원가입 없이 바로 사용
- ✅ **역할 선택**: 관리자 또는 당사자 중 선택
- ✅ **localStorage 기반**: 브라우저 로컬 스토리지에 역할 저장
- ✅ **즉시 체험**: 클릭 한 번으로 앱 전체 기능 사용 가능

---

## 📱 사용자 플로우

### 1. 첫 화면 (`/login`)
사용자가 앱에 접속하면 역할 선택 화면이 표시됩니다:

```
┌─────────────────────────────────────┐
│     아름드리꿈터                     │
│  자기주도 개인예산 관리 앱            │
│                                     │
│  🎭 역할을 선택해주세요              │
│                                     │
│  ┌──────────┐    ┌──────────┐      │
│  │   🏢     │    │    🙋    │      │
│  │  관리자   │    │   당사자  │      │
│  └──────────┘    └──────────┘      │
└─────────────────────────────────────┘
```

### 2. 역할 선택 시 동작

#### 관리자 선택
```javascript
localStorage.setItem("demo_role", "admin");
localStorage.setItem("demo_user_id", "demo-admin-{timestamp}");
localStorage.setItem("demo_user_name", "관리자");

// 리디렉션
router.push("/admin");
```

**접근 가능한 화면:**
- `/admin` - 관리자 대시보드
- `/admin/participants` - 당사자 관리
- `/admin/settings` - 시스템 설정
- `/supporter/transactions` - 거래 내역 관리
- 기타 모든 관리자 기능

#### 당사자 선택
```javascript
localStorage.setItem("demo_role", "participant");
localStorage.setItem("demo_user_id", "demo-participant-{timestamp}");
localStorage.setItem("demo_user_name", "김철수");

// 리디렉션
router.push("/");
```

**접근 가능한 화면:**
- `/` - 당사자 홈 (예산 현황)
- `/calendar` - 캘린더
- `/plan` - 계획 수립
- `/receipt` - 영수증 기록
- 기타 모든 당사자 기능

---

## 🎨 UI/UX 특징

### 역할 선택 카드
- **인터랙티브 디자인**: 호버 시 확대 및 색상 변화
- **시각적 피드백**: 선택 시 애니메이션 효과
- **명확한 설명**: 각 역할의 주요 기능 소개
- **반응형**: 모바일/데스크톱 모두 지원

### 카드 구성 요소
1. **아이콘**: 역할을 나타내는 이모지 (🏢/🙋)
2. **제목**: 역할 이름 (관리자/당사자)
3. **설명**: 역할별 주요 기능
4. **기능 목록**: 3가지 핵심 기능 표시
5. **CTA 버튼**: "관리자로 시작하기" / "당사자로 시작하기"

### 데모 모드 안내 배너
```
ℹ️ 데모 버전 안내
이 앱은 데모 모드로 실행 중입니다.
로그인 없이 관리자 또는 당사자 화면을 자유롭게 체험하실 수 있습니다.
데이터는 브라우저에만 저장되며 실제 서버에는 저장되지 않습니다.
```

---

## 🔧 기술 구현

### 변경된 파일

#### 1. `/src/app/(auth)/login/page.tsx`
**변경 전 (커밋 91275a3):**
- 이메일/비밀번호 입력 폼
- 도메인 검증 로직
- 회원가입 링크

**변경 후 (커밋 2a832c5):**
```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RoleSelectionPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"admin" | "participant" | null>(null);

  const handleRoleSelect = (role: "admin" | "participant") => {
    // Store role in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("demo_role", role);
      localStorage.setItem("demo_user_id", `demo-${role}-${Date.now()}`);
      localStorage.setItem("demo_user_name", role === "admin" ? "관리자" : "김철수");
    }

    // Navigate based on role
    if (role === "admin") {
      router.push("/admin");
    } else {
      router.push("/");
    }
    router.refresh();
  };

  return (
    // 역할 선택 UI
  );
}
```

#### 2. `/src/app/(auth)/signup/page.tsx`
**상태**: ❌ 삭제됨
- 회원가입 페이지 완전 제거
- 더 이상 필요 없음

---

## 🚀 배포 및 테스트

### Vercel 프리뷰 배포

#### 1. 브랜치 푸시
```bash
git push origin remove-google-auth
```

#### 2. Vercel 자동 배포
- 프리뷰 URL: `https://personal-budgets-app-git-remove-google-auth-<project>.vercel.app`
- 배포 시간: 약 2-3분

#### 3. 환경 변수 (필요 없음!)
데모 모드에서는 Supabase 인증을 사용하지 않으므로 환경 변수 설정 불필요

### 로컬 테스트
```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:3000/login 접속
# 역할 선택 → 즉시 사용 가능
```

### 빌드 테스트
```bash
npm run build
# ✓ Generating static pages (16/16)
# ○ /login (정적 페이지로 빌드됨)
```

---

## 📊 장단점 분석

### ✅ 장점
1. **즉시 사용 가능**: 가입/로그인 과정 없이 바로 체험
2. **간편한 테스트**: QA, 데모, 프레젠테이션에 최적
3. **낮은 진입 장벽**: 누구나 쉽게 앱 기능 확인 가능
4. **빠른 개발**: 인증 관련 버그/이슈 제거
5. **비용 절감**: 인증 서비스 비용 없음

### ⚠️ 단점 (프로덕션 사용 시)
1. **보안 없음**: 누구나 모든 기능 접근 가능
2. **데이터 관리 불가**: 사용자별 데이터 분리 불가
3. **멀티 유저 불가**: 동시에 여러 사용자 사용 불가
4. **데이터 휘발성**: localStorage 삭제 시 역할 정보 손실

### 💡 권장 사용 사례
- ✅ **데모/프로토타입**: 기능 시연용
- ✅ **개발/테스트**: 빠른 기능 테스트
- ✅ **교육/트레이닝**: 사용법 학습
- ❌ **프로덕션**: 실제 서비스 운영 ❌

---

## 🔄 프로덕션 전환 가이드

데모 모드를 실제 서비스로 전환하려면:

### 옵션 1: 이메일/비밀번호 인증 (커밋 91275a3)
```bash
git checkout 91275a3
# 이메일/비밀번호 인증 버전으로 롤백
```

### 옵션 2: Google OAuth 인증 (main 브랜치)
```bash
git checkout main
# 원래 Google OAuth 버전으로 복구
```

### 옵션 3: 하이브리드 모드
- 데모 모드 + 실제 인증 병행
- 환경 변수로 모드 전환
```typescript
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

if (isDemoMode) {
  // 역할 선택 UI
} else {
  // 실제 로그인 UI
}
```

---

## 📝 커밋 히스토리

```
2a832c5 feat: 완전한 데모 모드 - 인증 없이 역할 선택으로 변경
e309f06 docs: Add authentication system changes documentation
91275a3 feat: Google OAuth 제거 및 이메일/비밀번호 인증으로 전환
```

---

## 🎯 다음 단계

### main 브랜치에 병합
```bash
git checkout main
git merge remove-google-auth
git push origin main
```

### Pull Request 생성 (권장)
```bash
git push origin remove-google-auth
# GitHub에서 PR 생성하여 팀 리뷰 진행
```

---

## ❓ FAQ

### Q1: 데이터가 저장되나요?
**A**: 아니요. localStorage에 역할 정보만 저장되며, 실제 데이터는 서버에 저장되지 않습니다. Supabase와 연동된 경우에만 서버에 저장됩니다.

### Q2: 역할을 변경하려면?
**A**:
1. 브라우저 개발자 도구 → Application → Local Storage → 삭제
2. 다시 `/login` 접속하여 역할 재선택

또는:
```javascript
localStorage.clear();
window.location.href = '/login';
```

### Q3: 여러 당사자를 테스트하려면?
**A**: 현재는 한 번에 하나의 역할만 가능. 여러 당사자 테스트를 위해서는:
- 시크릿 모드 사용
- 다른 브라우저 사용
- 또는 실제 인증 시스템 도입 필요

### Q4: Supabase는 여전히 필요한가요?
**A**: 인증은 불필요하지만, 데이터 저장(거래 내역, 계획 등)을 위해서는 여전히 Supabase 필요

---

## 🐛 문제 해결

### 문제: 역할 선택 후 화면이 비어있음
**해결**:
```bash
# localStorage 확인
console.log(localStorage.getItem('demo_role'));

# Supabase 데이터 확인 (seed 데이터가 있는지)
```

### 문제: 관리자 화면에서 당사자 목록이 비어있음
**해결**:
```bash
# seed 데이터 삽입 필요
npm run supabase:seed
```

---

**작성일**: 2026-03-28
**최종 업데이트**: 2026-03-28
**버전**: 2.0.0 (데모 모드)
**최신 커밋**: 2a832c5
