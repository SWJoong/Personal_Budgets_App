# Personal Budgets App — Claude Code 가이드

## 프로젝트 개요

발달장애인을 위한 **개인예산 관리 앱**. 사회복지 기관(복지관·지원주택)의 실무자(지원자)가
당사자(이용자)의 예산을 함께 관리하고, 당사자 본인도 직접 지출을 기록할 수 있습니다.

- **대상**: 발달장애인 당사자 + 사회복지 실무자 + 기관 관리자
- **UI 언어**: 한국어 (쉬운 말/Easy Read 원칙 적용)
- **배포 환경**: Vercel + Supabase Cloud

---

## 기술 스택

| 항목 | 버전/세부 |
|------|----------|
| Next.js | 15 (App Router) |
| React | 19 |
| TypeScript | 5 |
| Tailwind CSS | 4 (PostCSS) |
| Supabase | PostgreSQL + Auth + Storage |
| 폰트 | Pretendard (CDN) |
| AI | OpenAI GPT-4o (영수증 OCR, 평가 요약) |
| 지도 | Kakao Maps JavaScript SDK + REST API |

---

## 라우트 그룹 구조

```
src/app/
├── (auth)/           # 로그인 페이지 (/login)
├── (participant)/    # 당사자 화면 — 모바일 600px 중심
│   ├── page.tsx          # 홈 대시보드 (/)
│   ├── calendar/         # 달력 뷰
│   ├── plan/             # 오늘 계획
│   ├── gallery/          # 활동사진 갤러리
│   └── more/             # 더보기 메뉴
└── (supporter)/      # 실무자·관리자 화면
    ├── admin/            # 관리자 전용 (/admin)
    │   ├── page.tsx          # 관리자 대시보드
    │   ├── participants/     # 당사자 관리
    │   └── settings/         # 시스템 설정
    └── supporter/        # 실무자 공통 (/supporter)
        ├── transactions/     # 거래장부
        ├── evaluations/      # 계획·평가
        ├── documents/        # 서류 보관함
        └── review/           # 영수증 검토 대기
```

---

## 데모 모드

현재 **데모 모드가 활성화**되어 있습니다 (`NEXT_PUBLIC_DEMO_MODE=true`).

### 작동 방식
1. `/login` 에서 역할 선택 (관리자 / 당사자)
2. 선택 시 `document.cookie = 'demo_role=admin|participant'` 저장
3. `createClient()` 가 `NEXT_PUBLIC_DEMO_MODE=true` 를 감지하면 서비스 롤 클라이언트 반환
4. `auth.getUser()` 를 스푸핑하여 데모 유저 반환

### 데모 고정 UUID (절대 변경 금지)
- **데모 관리자**: `00000000-0000-0000-0000-000000000001`
- **데모 당사자 (김지수)**: `11e95b8b-6806-496d-9f36-88bd04e814b3`

### 페이지에서 데모 모드 확인
```typescript
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
// 또는 레이아웃에서 const isDemoMode = true (하드코딩)
```

---

## Supabase 클라이언트 선택 기준

| 상황 | 클라이언트 | 이유 |
|------|-----------|------|
| 일반 데이터 조회 (RLS 적용) | `createClient()` | 사용자 세션 기반, RLS 정책 작동 |
| Storage 파일 업로드/signed URL | `createAdminClient()` | RLS 우회 필요, 서비스 롤 사용 |
| 관리자 전용 작업 (RLS 우회) | `createAdminClient()` | 서비스 롤 |
| 데모 모드에서 모든 데이터 조회 | `createClient()` | 내부적으로 admin 클라이언트 반환됨 |

```typescript
// src/utils/supabase/server.ts
import { createClient, createAdminClient } from '@/utils/supabase/server'
```

---

## Storage 보안 규칙

**receipts**, **activity-photos**, **documents** 버킷은 **private**.
DB에 저장된 URL은 `public/` 경로이지만 직접 접근 불가 → 반드시 signed URL 변환 필요.

```typescript
import { extractStoragePath } from '@/utils/supabase/storage'

// DB URL → 경로 추출 → signed URL 생성
const path = extractStoragePath(dbUrl, 'receipts')  // 'userId/filename.jpg'
const adminClient = createAdminClient()
const { data } = await adminClient.storage
  .from('receipts')
  .createSignedUrl(path, 3600)  // 1시간 유효
```

이미지 표시: 서버 컴포넌트에서 signed URL 사전 생성 → prop으로 클라이언트에 전달.

---

## 서버 액션 패턴

모든 서버 액션은 `src/app/actions/` 에 위치합니다.

```typescript
'use server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function myAction(formData: FormData) {
  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증 필요' }

  try {
    const { error } = await supabase.from('table').insert({ ... })
    if (error) return { error: error.message }

    revalidatePath('/relevant-path')
    return { success: true }
  } catch (e) {
    return { error: '오류가 발생했습니다.' }
  }
}
```

---

## 데이터베이스 마이그레이션

마이그레이션 파일 위치: `supabase/migrations/`
현재 최고 번호: **20** (`20_system_settings_rls.sql`)

네이밍 규칙: `NN_설명_영어_또는_한국어.sql`

**중요**: 마이그레이션 파일은 코드로만 생성하고,
실제 실행은 **Supabase 대시보드 > SQL Editor**에서 수동으로 합니다.
(로컬 `supabase db push` 미사용)

---

## 접근성 원칙 (Easy Read)

- **폰트**: Pretendard (CDN, 모든 레이아웃에 적용)
- **줄 간격**: `leading-relaxed` 이상 (line-height ≥ 1.625), 목표 1.85
- **색상 대비**: WCAG AA 이상
- **버튼**: 최소 44×44px 터치 영역
- **언어**: 쉬운 말 사용, 전문 용어 최소화
- **테마**: 7가지 색상 테마 (`useAccessibility` 훅)

---

## 환경 변수

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트용 anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 서비스 롤 키 (절대 노출 금지) |
| `NEXT_PUBLIC_DEMO_MODE` | `"true"` = 데모 모드 활성화 |
| `OPENAI_API_KEY` | GPT-4o (OCR, AI 요약) |
| `NEXT_PUBLIC_KAKAO_MAP_API_KEY` | 카카오 지도 JS SDK |
| `KAKAO_REST_API_KEY` | 카카오 장소 검색 REST API |

---

## 개발 명령어

```bash
npm run dev           # 개발 서버 (localhost:3000)
npm run build         # 프로덕션 빌드 (배포 전 반드시 확인)
npm run lint          # ESLint
npm run generate-types # Supabase 타입 재생성 → src/types/database.ts
```

---

## 주요 커스텀 커맨드

| 커맨드 | 용도 |
|--------|------|
| `/migration` | 다음 번호 Supabase 마이그레이션 파일 생성 |
| `/server-action` | 서버 액션 스캐폴딩 |
| `/signed-url` | Storage signed URL 생성 패턴 안내 |
