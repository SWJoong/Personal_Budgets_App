# 아름드리꿈터 개인예산 관리 앱 (Personal Budgets App)

발달장애인 당사자를 위한 개인별 예산 관리 웹 애플리케이션

## 📋 프로젝트 개요

이 프로젝트는 발달장애인이 자신의 예산을 시각적으로 쉽게 이해하고 관리할 수 있도록 돕는 웹 애플리케이션입니다.
당사자(Participant), 지원자(Supporter), 관리자(Admin) 세 가지 역할을 지원하며, 각 역할에 맞는 기능을 제공합니다.

### 주요 특징

- 📊 **쉬운 읽기 디자인**: 발달장애인을 위한 접근성 높은 UI/UX
- 💰 **시각적 예산 관리**: 주머니(Pouch) 메타포를 활용한 직관적 예산 표현
- 📸 **영수증 OCR**: GPT Vision을 활용한 영수증 자동 인식
- 📅 **캘린더 기반 거래 내역**: 날짜별 지출 확인 및 사진 첨부
- 📈 **예산 계획**: AI 기반 지출 계획 수립 및 비교
- 🔐 **역할 기반 접근 제어**: 당사자/지원자/관리자별 차별화된 권한

## 🏗️ 기술 스택

### Frontend
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **Geist Font** (Vercel)

### Backend & Database
- **Supabase** (PostgreSQL, Auth, Storage)
- **Server Actions** (Next.js)
- **Row Level Security (RLS)**

### AI & OCR
- **OpenAI GPT-4o** (영수증 OCR, 지출 계획 생성)
- **GPT Vision API** (이미지 분석)

### Deployment
- **Vercel** (프론트엔드 호스팅)
- **Supabase Cloud** (데이터베이스 및 스토리지)

## 📁 프로젝트 구조

```
Personal_Budgets_App/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # 인증 라우트 그룹
│   │   │   ├── login/
│   │   │   └── onboarding/
│   │   ├── (participant)/            # 당사자 라우트 그룹
│   │   │   └── participant/
│   │   ├── (supporter)/              # 지원자 라우트 그룹
│   │   │   └── supporter/
│   │   ├── (admin)/                  # 관리자 라우트 그룹
│   │   │   └── admin/
│   │   └── api/                      # API Routes
│   ├── components/
│   │   ├── home/                     # 홈 대시보드 컴포넌트
│   │   │   ├── HomeDashboard.tsx     # 메인 대시보드
│   │   │   ├── InteractivePouchSection.tsx  # 주머니 SVG 인터랙션
│   │   │   └── BudgetTrendChart.tsx  # 예산 추이 차트
│   │   ├── transaction/              # 거래 내역 컴포넌트
│   │   │   ├── TransactionForm.tsx
│   │   │   ├── TransactionCalendar.tsx
│   │   │   └── ReceiptUploadForm.tsx # OCR 영수증 업로드
│   │   ├── plan/                     # 계획 컴포넌트
│   │   │   └── PlanComparison.tsx
│   │   ├── evaluation/               # 평가 컴포넌트
│   │   │   └── EvaluationForm.tsx
│   │   ├── admin/
│   │   │   └── AdminSidebar.tsx
│   │   └── ui/                       # 공통 UI 컴포넌트
│   ├── hooks/                        # 커스텀 훅
│   │   └── useAccessibility.ts       # 접근성 훅
│   ├── types/                        # TypeScript 타입 정의
│   │   └── database.ts               # Supabase 자동 생성 타입
│   └── utils/
│       ├── actions/                  # Server Actions
│       │   ├── actions-transaction.ts
│       │   ├── actions-plan.ts
│       │   ├── actions-ocr.ts
│       │   ├── actions-evaluation.ts
│       │   └── actions-document.ts
│       └── budget-visuals.ts         # SVG 시각화 유틸리티
├── supabase/
│   ├── migrations/
│   │   ├── 01_balance_trigger.sql    # 잔액 자동 계산 트리거
│   │   └── 02_onboarding_fields.sql  # 온보딩 필드 마이그레이션
│   ├── schema.sql                    # 전체 DB 스키마
│   └── seed.sql                      # 테스트 데이터
└── public/
```

## 🗄️ 데이터베이스 스키마

핵심 테이블 구조 (7개 테이블):

| 테이블 | 설명 |
|--------|------|
| `profiles` | 사용자 프로필 (역할, 온보딩 상태) |
| `participants` | 당사자 정보 (테마 색상 등) |
| `funding_sources` | 재원 정보 (예산 한도, 기간) |
| `transactions` | 거래 내역 (금액, 영수증 이미지) |
| `plans` | 월별 지출 계획 |
| `evaluations` | 자기평가 기록 |
| `file_links` | 문서 링크 (Google Drive 등) |

## 👥 역할(Role) 구조

```
관리자(Admin)
  └── 지원자(Supporter)
        └── 당사자(Participant)
```

- **당사자**: 자신의 예산 조회, 거래 내역 입력, 영수증 업로드
- **지원자**: 담당 당사자 관리, 거래 승인, 계획 수립 지원
- **관리자**: 전체 시스템 관리, 재원 설정, 사용자 관리

## 🚀 Epic 구현 현황

| Epic | 기능 | 상태 |
|------|------|------|
| Epic 1 | 온보딩, 인증(Google OAuth), DB 마이그레이션 | ✅ 완료 |
| Epic 2 | 관리자 대시보드, AdminSidebar, 당사자 관리 | ✅ 완료 |
| Epic 3 | SVG 주머니 시각화, budget-visuals.ts, 7가지 테마 | ✅ 완료 |
| Epic 4 | GPT-4o AI 계획 생성, PlanComparison 비교 UI | ✅ 완료 |
| Epic 5 | 거래 내역 CRUD, TransactionForm | ✅ 완료 |
| Epic 6 | 영수증 OCR, Supabase Storage 연동 | ✅ 완료 |
| Epic 7 | TransactionCalendar, 평가 폼, AI 평가 분석 | ✅ 완료 |
| Epic 8 | 문서 링크 관리, AI 계획 생성(plan.ts) | ✅ 완료 |
| Epic 9 | useAccessibility 훅, ARIA 역할, Pretendard 폰트 | ✅ 완료 |

## 🔧 환경 설정

### 필수 환경 변수 (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI (OCR 및 AI 계획 생성)
OPENAI_API_KEY=your_openai_api_key

# Google OAuth (Supabase Auth 설정)
# Supabase 대시보드 > Authentication > Providers > Google 에서 설정
```

### 개발 서버 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)으로 접속합니다.

### Supabase CLI 설정

```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인
supabase login

# 타입 자동 생성
supabase gen types typescript --project-id your_project_id > src/types/database.ts

# 마이그레이션 적용
supabase db push
```

## ♿ 접근성 (Accessibility)

이 앱은 **쉬운 읽기(Easy Read)** 원칙을 따릅니다:

- **폰트**: Pretendard (CDN) + Noto Sans KR (fallback)
- **행간**: `line-height: 1.85` (Easy Read 기준)
- **색상 대비**: HSL 기반 테마, WCAG 기준 충족
- **ARIA**: 캘린더 `grid` role, 탭바 `tablist` role 등 적용
- **useAccessibility**: 커스텀 훅으로 접근성 기능 통합 관리
- **7가지 테마**: 당사자별 맞춤 색상 (luxury, stable, observing, shrinking, critical, empty, warning)

## 📸 OCR 영수증 인식

1. `ReceiptUploadForm.tsx`에서 이미지 업로드
2. Supabase Storage에 이미지 저장 (→ `pending` 상태)
3. `actions-ocr.ts`에서 GPT Vision API 호출
4. 인식 결과로 `transactions` 테이블에 저장 (→ `confirmed` 상태)

> **주의**: Race condition 방지를 위해 `01_balance_trigger.sql` 트리거가 잔액을 자동 계산합니다.

## 📊 AI 예산 계획 생성

`actions-plan.ts`에서 GPT-4o를 활용해 월별 지출 계획을 생성합니다:

```typescript
// model: gpt-4o 사용
// 생성된 계획은 PlanComparison.tsx에서 A/B/C 비교 UI로 표시
```

## 🔗 관련 링크

- [Perplexity Computer 세션](https://www.perplexity.ai/computer/aareumdeuriggumteo-gaeinyesan-g-MwSGZcj6RxGBmKnyyF.vUA)
- [GitHub Repository](https://github.com/SWJoong/PersonalBudgetsApp)
- [Pretendard CDN](https://github.com/orioncactus/pretendard)
- [Supabase Storage 문서](https://supabase.com/docs/guides/storage)
- [Next.js localFont 최적화](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
- [Vercel 배포](https://personal-budgets-app-gp8t.vercel.app/)

## 📝 개발 히스토리

- **v3**: Perplexity Computer로 생성한 `kkumteo-budget-app` 기반 UX 재설계
- **v5.1**: GitHub `SWJoong/PersonalBudgetsApp` `main` 브랜치 (`106eadf`, 2026-03-25 기준) 보강 완료

---

> 이 프로젝트는 아름드리꿈터 주간이용시설의 발달장애인 당사자들을 위해 개발되었습니다.
