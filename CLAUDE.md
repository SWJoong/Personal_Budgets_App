# Personal Budgets App — Claude Code 가이드

## 프로젝트 개요

발달장애인을 위한 **개인예산 관리 앱**. 사회복지 기관(복지관·지원주택)의 실무자(지원자)가
당사자(이용자)의 예산을 함께 관리하고, 당사자 본인도 직접 지출을 기록할 수 있습니다.

- **대상**: 발달장애인 당사자 + 사회복지 실무자 + 기관 관리자
- **UI 언어**: 한국어 (쉬운 말/Easy Read 원칙 적용)
- **배포 환경**: Vercel + Supabase Cloud
- **데모 주소**: https://personal-budgets-app-gp8t.vercel.app/

---

## 기술 스택

| 항목 | 버전/세부 |
|------|----------|
| Next.js | 16.1.6 (App Router) |
| React | 19.2.3 |
| TypeScript | 5 (strict, `@/*` → `./src/*`) |
| Tailwind CSS | 4 (PostCSS) |
| Supabase | `@supabase/ssr` + `@supabase/supabase-js` v2 |
| 폰트 | Pretendard (CDN) |
| AI | OpenAI GPT-4o (영수증 OCR, 계획 생성, 평가 요약) |
| 지도 | Kakao Maps JavaScript SDK + REST API |
| 테스트 | Vitest + Testing Library (jsdom) |
| 분석 | `@vercel/analytics`, `@vercel/speed-insights` |
| 기타 | `xlsx` (CSV 가져오기), `html-to-image` (보고서 이미지화) |

---

## 라우트 그룹 구조

```
src/app/
├── layout.tsx               # 루트(html lang="ko") + AccessibilityProvider + Pretendard CDN
├── globals.css              # 전역 스타일 + 접근성 테마 클래스
├── loading.tsx              # 글로벌 로딩 UI
├── (auth)/
│   ├── layout.tsx               # 가운데 정렬 인증 레이아웃
│   ├── login/                   # Google OAuth + 데모 모드 역할 선택
│   └── auth/                    # Supabase auth 콜백
├── (participant)/           # 당사자 화면 — 모바일 600px 중심 (lg에서 중앙 정렬 앱 프레임)
│   ├── page.tsx                 # 홈 대시보드 (/)
│   ├── calendar/                # 달력 뷰
│   ├── evaluations/             # 자기 평가
│   ├── gallery/                 # 활동사진 갤러리
│   ├── guide/                   # 앱 이용 가이드
│   ├── map/                     # 활동 지도
│   ├── more/                    # 더보기 메뉴
│   ├── my-plan/                 # 내 계획 (읽기 전용)
│   ├── plan/                    # 오늘 계획
│   ├── receipt/                 # 영수증 입력
│   └── settings/                # 프로필 등 환경설정
├── (supporter)/             # 실무자·관리자 화면 (`force-dynamic`, 사이드바 레이아웃)
│   ├── layout.tsx               # 인증/역할 가드 → SupporterLayoutClient
│   ├── SupporterLayoutClient.tsx
│   ├── error.tsx
│   ├── admin/                   # 관리자 전용 (/admin)
│   │   ├── page.tsx                 # 관리자 대시보드
│   │   ├── feedback/                # 당사자 자기평가 피드백
│   │   ├── invitations/             # 사전 등록(user_invitations) 관리
│   │   ├── participants/            # 당사자 등록/편집/프리뷰/보고서
│   │   └── settings/                # 시스템 설정
│   └── supporter/               # 실무자 공통 (/supporter)
│       ├── page.tsx                 # 실무자 대시보드
│       ├── [participantId]/transactions/  # 당사자별 거래장부
│       ├── budgets/[id]/            # 예산 상세
│       ├── documents/               # 서류 보관함 (이용계획서 포함)
│       ├── evaluations/             # 월별 계획·목표·평가
│       ├── map/                     # 활동 지도
│       ├── participants/            # 당사자 통합 대시보드
│       ├── review/                  # 영수증 검토 대기열
│       └── transactions/            # 전체 거래장부
├── actions/                 # Server Actions (모든 mutation은 여기로)
├── api/                     # REST 라우트 (budgets, export, funding-sources, participants, supporters)
└── onboarding/              # 신규 가입자 온보딩 플로우
```

미들웨어는 `src/proxy.ts` (Next.js의 `middleware.ts` 역할). 인증 가드와 온보딩 리다이렉트, 데모 모드 분기를 담당합니다.

---

## 데모 모드

현재 **데모 모드가 기본 활성화**되어 있습니다 (`NEXT_PUBLIC_DEMO_MODE=true`). 정식 배포는 Google OAuth(Supabase Auth)로 전환 예정.

### 작동 방식
1. 미들웨어(`src/proxy.ts`)가 `demo_role` 쿠키 없으면 `/login` 으로 리다이렉트
2. `/login` 에서 역할(관리자/당사자) 선택 → `document.cookie = 'demo_role=admin|participant'` + `localStorage`
3. 서버 `createClient()` 가 데모 모드를 감지 → **service role 클라이언트** 반환
4. `auth.getUser()` 를 **모의 사용자**로 스푸핑 (`getUser` 메서드만 오버라이드, 다른 메서드는 prototype 유지)

### 데모 고정 UUID (절대 변경 금지)
- **데모 관리자**: `00000000-0000-0000-0000-000000000001` (migration `10_demo_mode_profiles.sql`)
- **데모 당사자 (김지수)**: `11e95b8b-6806-496d-9f36-88bd04e814b3` (seed.sql)

### 데모 모드 분기 패턴
```typescript
// 서버 컴포넌트/액션
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// 데모 모드에서 파괴적 작업 차단 (서버 액션 다수에서 사용)
if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
  return { error: '데모 모드에서는 삭제할 수 없습니다.' }
}
```

---

## Supabase 클라이언트 선택 기준

| 상황 | 클라이언트 | 위치 | 이유 |
|------|-----------|------|------|
| 브라우저(클라이언트 컴포넌트) | `createClient()` | `src/utils/supabase/client.ts` | `createBrowserClient` 래퍼 |
| 서버 컴포넌트 / 서버 액션 (RLS 적용) | `createClient()` | `src/utils/supabase/server.ts` | 사용자 세션 기반 |
| Storage 파일 업로드 / signed URL | `createAdminClient()` | `src/utils/supabase/server.ts` | RLS 우회 필요, service role |
| 관리자 전용 작업 (RLS 우회) | `createAdminClient()` | 동일 | service role |
| 데모 모드 (모든 데이터 조회) | `createClient()` | 동일 | 내부적으로 admin 클라이언트 반환 + `getUser` 스푸핑 |

```typescript
import { createClient, createAdminClient } from '@/utils/supabase/server'   // 서버
import { createClient } from '@/utils/supabase/client'                       // 브라우저
```

---

## Storage 보안 규칙

`receipts`, `activity-photos`, `documents` 버킷은 모두 **private** (migration `19_storage_buckets.sql`).
DB에는 `public/` 경로의 URL이 저장되어 있을 수 있으나 직접 접근 불가 → 반드시 **signed URL 변환** 필요.

```typescript
import { extractStoragePath } from '@/utils/supabase/storage'
import { createAdminClient } from '@/utils/supabase/server'

const path = extractStoragePath(dbUrl, 'receipts')  // 'userId/filename.jpg'
const admin = createAdminClient()
const { data } = await admin.storage
  .from('receipts')
  .createSignedUrl(path, 3600)  // 1시간 유효
```

`extractStoragePath`는 `/object/public/{bucket}/` 과 `/object/authenticated/{bucket}/` 두 형식을 모두 처리합니다.

이미지 표시 권장 패턴: **서버 컴포넌트에서 signed URL을 사전 생성 → prop 으로 클라이언트에 전달**.
`next.config.ts`의 `images.remotePatterns` 가 `*.supabase.co/storage/v1/**` 만 허용합니다.

---

## 서버 액션 패턴

모든 서버 액션은 `src/app/actions/` 에 위치 (현재 21개 파일).

```typescript
'use server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function myAction(formData: FormData) {
  const supabase = await createClient()

  // 인증 확인 (데모 모드에서는 createClient()가 데모 유저를 반환)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증이 필요합니다.' }

  // 파괴적 작업은 데모 모드 차단 권장
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return { error: '데모 모드에서는 삭제할 수 없습니다.' }
  }

  try {
    const { error } = await supabase.from('table').insert({ /* ... */ })
    if (error) return { error: error.message }

    revalidatePath('/relevant-path')
    return { success: true }
  } catch {
    return { error: '오류가 발생했습니다.' }
  }
}
```

반환 타입은 `{ success: true, data? }` 또는 `{ error: string }` 패턴. 클라이언트에서 `if ('error' in result)` 로 분기.

`next.config.ts` 에 `serverActions.bodySizeLimit = '25mb'` 로 영수증/사진 업로드를 허용합니다.

### 주요 서버 액션 (선택)
`admin.ts`, `budgetLineItem.ts`, `carePlan.ts`, `copyPlan.ts`, `document.ts`, `easyReadSummary.ts`, `evalTemplates.ts`, `evaluation.ts`, `feedback.ts`, `geocode.ts`, `goalEvaluation.ts`, `importTransactions.ts`, `monthlyPlan.ts`, `ocr.ts`, `plan.ts`, `preferences.ts`, `profile.ts`, `sisAssessment.ts`, `storage.ts`, `supportGoal.ts`, `transaction.ts`.

---

## 데이터베이스 마이그레이션

마이그레이션 파일 위치: **`supabase/migrations/`**
현재 최고 번호: **31** (`31_user_invitations.sql`)

> `src/utils/supabase/migrations/`, `src/utils/supabase/schema.sql` 등은 참고용 스냅샷이며 실행되지 않습니다.

네이밍 규칙: `NN_설명_영어_또는_한국어.sql` (두 자리 숫자, snake_case)

**중요**: 마이그레이션 파일은 코드로만 생성하고,
실제 실행은 **Supabase 대시보드 > SQL Editor**에서 수동으로 합니다.
(로컬 `supabase db push` 또는 Supabase CLI 미사용)

### 마이그레이션 작성 규칙
- 새 테이블에는 항상 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- RLS 정책은 SELECT 와 INSERT/UPDATE/DELETE 를 분리
  - 읽기: `TO authenticated USING (true)` 또는 조건부
  - 쓰기: admin 체크 `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`
- 컬럼 추가: `ADD COLUMN IF NOT EXISTS`
- Storage 버킷은 항상 `public = false`
- 멱등성: `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`

### 주요 테이블
`profiles`, `participants`, `funding_sources`, `transactions`, `monthly_plans`, `support_goals`, `goal_evaluations`, `budget_line_items`, `evaluations`, `eval_templates`, `care_plans`, `sis_assessments`, `participant_feedback`, `user_invitations`, `ui_preferences`, 그리고 시스템 설정 테이블.

---

## 접근성 원칙 (Easy Read)

- **폰트**: Pretendard (CDN, 루트 레이아웃에서 preconnect + stylesheet 로 로드)
- **줄 간격**: `leading-relaxed` 이상 (line-height ≥ 1.625), 목표 1.85
- **색상 대비**: WCAG AA 이상
- **버튼**: 최소 44×44px 터치 영역 (당사자 화면은 56px 권장)
- **언어**: 쉬운 말 사용, 전문 용어 최소화 — 어려운 용어는 `EasyTerm` 컴포넌트로 토글 가능
- **접근성 옵션**: `useAccessibility` 훅 + `AccessibilityProvider` (글자 크기 3단계, 고대비, 쉬운 용어, 노란 배경, 다크 모드) — 모두 `localStorage` 에 저장
- **TTS**: `src/utils/tts.ts` 로 음성 읽기 지원
- **레이아웃**: 당사자 화면은 데스크탑에서도 600px 폭의 모바일 앱 프레임으로 중앙 정렬

---

## 환경 변수

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트용 anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 service role 키 (절대 클라이언트 노출 금지) |
| `NEXT_PUBLIC_DEMO_MODE` | `"true"` = 데모 모드 활성화 |
| `OPENAI_API_KEY` | GPT-4o (OCR, AI 요약, 계획 생성) |
| `NEXT_PUBLIC_KAKAO_MAP_API_KEY` | 카카오 지도 JS SDK |
| `KAKAO_REST_API_KEY` | 카카오 장소 검색 REST API |
| `SUPABASE_PROJECT_ID` | `npm run generate-types` 에서 사용 |

CI(`.github/workflows/ci.yml`)는 위 모든 키를 secret 으로 받아 빌드합니다.

---

## 개발 명령어

```bash
npm run dev             # 개발 서버 (localhost:3000)
npm run build           # 프로덕션 빌드 (배포 전 반드시 확인)
npm run start           # 빌드 결과 실행
npm run lint            # ESLint (next/core-web-vitals + next/typescript)
npm test                # Vitest 단위 테스트 (1회 실행)
npm run test:watch      # Vitest watch
npm run test:coverage   # 커버리지 리포트 (lcov)
npm run generate-types  # Supabase 타입 → src/types/database.ts
```

CI(GitHub Actions, `ci.yml`)는 `main`/`develop` push 및 `main` 대상 PR 에서
`tsc --noEmit` → `lint` → `test` → 프로덕션 빌드(+ 옵션 staging 빌드) 를 실행합니다.

---

## 테스트 가이드

- 테스트 파일은 `*.test.ts(x)` 또는 `*.spec.ts(x)`, `src/` 어디에 두어도 자동 수집됩니다.
- 환경: `jsdom`, 전역 setup: `src/test/setup.ts` (jest-dom matchers)
- 커버리지 대상: `src/utils/**`, `src/components/**`, `src/app/actions/**`
- 새 유틸리티/컴포넌트/액션을 추가할 때는 가능하면 단위 테스트도 함께 추가.

---

## 주요 디렉토리 빠른 참조

| 위치 | 용도 |
|------|------|
| `src/app/actions/` | 모든 서버 액션 (mutation) |
| `src/app/api/` | REST 라우트 (export, supporters 등) |
| `src/components/<category>/` | 카테고리별 UI 컴포넌트 (admin, budgets, documents, evaluations, help, home, layout, map, participants, plans, transactions, ui) |
| `src/hooks/` | `useAccessibility`, `useAuth`, `useFirstVisit` |
| `src/utils/supabase/` | 서버/브라우저 클라이언트, storage 헬퍼 |
| `src/utils/` | 일반 유틸리티 (`date`, `openai`, `tts`, `sis-a`, `budget-visuals`, `api-logger`, `emojiCatalog`, …) |
| `src/types/` | DB 타입(`database.ts` 는 자동 생성), 도메인 타입, Kakao Maps 타입 |
| `src/data/` | 정적 콘텐츠 (FAQ, 도움말 슬라이드 등) |
| `supabase/migrations/` | 실행 대상 SQL (Supabase 대시보드에서 수동 실행) |
| `mockup_personal_budgets/` | 디자인 목업 (코드와 연결 없음) |
| `Plan&Source/` | 기획·산출물 자료 (tsconfig 에서 제외됨) |

---

## 주요 커스텀 커맨드 (`/`)

| 커맨드 | 용도 |
|--------|------|
| `/migration` | 다음 번호의 Supabase 마이그레이션 파일 생성 |
| `/server-action` | 서버 액션 스캐폴딩 |
| `/signed-url` | Storage signed URL 생성 패턴 안내 |

`.claude/skills/` 에는 역할별(PM, PL, FE, BE, DevOps, QA, UX/UI, Easy Read) 페르소나 스킬이 정의돼 있어 컨텍스트에 맞게 자동 활성화됩니다.

---

## 작업 시 체크리스트

1. **데모 모드 분기** — 파괴적 작업은 `NEXT_PUBLIC_DEMO_MODE` 가드를 추가했는가?
2. **클라이언트 선택** — RLS 적용/우회를 의식하고 `createClient` vs `createAdminClient` 를 골랐는가?
3. **Signed URL** — DB에 저장된 storage URL 을 그대로 `<img>` 에 넣지 않았는가?
4. **`revalidatePath`** — 데이터를 바꾼 뒤 영향 받는 경로를 revalidate 했는가?
5. **Easy Read** — 새 텍스트는 쉬운 말로 작성하고, 필요 시 `EasyTerm` 으로 감쌌는가?
6. **타입** — DB 스키마 변경 후 `npm run generate-types` 로 `src/types/database.ts` 를 갱신했는가?
7. **CI** — 푸시 전에 로컬에서 `npm run lint && npm test && npm run build` 를 통과시켰는가?
