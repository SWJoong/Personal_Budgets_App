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
| Epic 1 | 온보딩, 역할 기반 인증, DB 마이그레이션 | ✅ 완료 |
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

# OpenAI (영수증 OCR 및 AI 계획 생성, 선택사항)
OPENAI_API_KEY=your_openai_api_key

# 카카오맵 (지도 기능)
# JavaScript 키: 브라우저 지도 표시용 (카카오 콘솔 → 앱 키 → JavaScript 키)
NEXT_PUBLIC_KAKAO_MAP_API_KEY=your_kakao_javascript_key
# REST API 키: 서버에서 장소 검색용 (카카오 콘솔 → 앱 키 → REST API 키)
KAKAO_REST_API_KEY=your_kakao_rest_api_key
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

---

# 기관 담당자용 배포 가이드

> IT를 잘 몰라도 괜찮습니다. 아래 순서대로 따라 하면 우리 기관만의 앱을 운영할 수 있습니다.

## 준비물 (모두 무료로 시작 가능)

| 서비스 | 용도 | 가입 주소 |
|--------|------|-----------|
| **Supabase** | 데이터베이스 + 파일 저장 + 로그인 | supabase.com |
| **Vercel** | 웹 서버(앱 배포) | vercel.com |
| **카카오 개발자** | 지도 기능 | developers.kakao.com |
| **GitHub** | 코드 저장소 | github.com |

> OpenAI API는 AI 자동 요약 기능에만 필요합니다. 없어도 앱을 사용할 수 있습니다.

---

## Step 1 — Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) 에 접속해 회원가입 후 로그인합니다.
2. **New Project** 버튼을 클릭합니다.
3. 프로젝트 이름(예: `armdeuri-budgets`)과 **데이터베이스 비밀번호**를 입력합니다.  
   ⚠️ 비밀번호는 안전한 곳에 따로 저장해 두세요.
4. 지역은 **Northeast Asia (Seoul)**을 선택합니다.
5. 프로젝트 생성 완료까지 약 1~2분 기다립니다.

---

## Step 2 — 데이터베이스 테이블 만들기 (마이그레이션)

앱에서 사용하는 표(테이블)를 만드는 단계입니다.

1. Supabase 대시보드 왼쪽 메뉴에서 **SQL Editor**를 클릭합니다.
2. 이 저장소의 `supabase/migrations/` 폴더 안 SQL 파일을 **번호 순서대로** 실행합니다.

   ```
   04_fix_participants_rls.sql
   05_atomic_first_admin.sql
   06_add_12_demo_participants.sql   ← 데모 데이터 포함 (선택)
   07_set_admin_accounts.sql
   08_fix_rls_for_participant_creation.sql
   09_add_activity_photo_and_plan_details.sql
   10_demo_mode_profiles.sql
   11_add_ui_preferences.sql
   12_evaluations_published_at.sql
   13_eval_templates.sql
   14_care_plans.sql
   15_sis_assessments.sql
   16_transactions_location.sql
   17_plans_location.sql
   18_sample_location_data.sql      ← 샘플 거래 데이터 (선택)
   19_storage_buckets.sql           ← 파일 저장 버킷 생성 (필수)
   ```

3. 각 파일 내용을 SQL Editor에 붙여넣고 **Run** 버튼을 클릭합니다.  
   ✅ "Success" 메시지가 나오면 다음 파일로 진행합니다.

> **참고**: 06번, 18번은 테스트용 데모 데이터입니다. 실제 운영 시에는 건너뛰어도 됩니다.  
> **중요**: 19번(`19_storage_buckets.sql`)은 영수증·활동사진·증빙서류 파일 업로드를 위해 반드시 실행해야 합니다.

---

## Step 3 — 필요한 키(Key) 값 메모하기

### Supabase API 키
Supabase 대시보드 → **Settings** → **API** 에서 아래 값을 메모합니다.

| 항목 | 설명 |
|------|------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` 에 입력할 값 |
| anon/public 키 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` 에 입력할 값 |
| service_role 키 | `SUPABASE_SERVICE_ROLE_KEY` 에 입력할 값 ⚠️ 외부 노출 금지 |

### 카카오맵 API 키 (2가지 키 필요)
1. [developers.kakao.com](https://developers.kakao.com) 로그인 → **내 애플리케이션** → **애플리케이션 추가**
2. **앱 키** 탭에서 두 가지 키를 각각 복사합니다.
   - **JavaScript 키** → `NEXT_PUBLIC_KAKAO_MAP_API_KEY` (지도 지도 표시용)
   - **REST API 키** → `KAKAO_REST_API_KEY` (서버에서 장소 검색용)
3. **플랫폼** 탭 → **Web** → 사이트 도메인에 배포 주소 추가  
   (예: `https://your-app.vercel.app`)

---

## Step 4 — GitHub에 코드 올리기

> 이미 GitHub에 올라가 있다면 이 단계는 건너뛰세요.

1. [github.com](https://github.com) 에서 새 저장소를 만듭니다.
2. 터미널에서 아래 명령어를 실행합니다.
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/사용자명/저장소명.git
   git push -u origin main
   ```

---

## Step 5 — Vercel에 배포하기

1. [vercel.com](https://vercel.com) 에 접속해 GitHub 계정으로 로그인합니다.
2. **New Project** → GitHub 저장소 선택 → **Import** 클릭합니다.
3. **Environment Variables** 항목에 아래 값들을 입력합니다.

   | 키 이름 | 값 |
   |---------|-----|
   | `NEXT_PUBLIC_SUPABASE_URL` | Step 3에서 메모한 Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public 키 |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 |
   | `NEXT_PUBLIC_KAKAO_MAP_API_KEY` | 카카오 **JavaScript** 키 (지도 표시용) |
   | `KAKAO_REST_API_KEY` | 카카오 **REST API** 키 (장소 검색용, 별도 키) |
   | `NEXT_PUBLIC_DEMO_MODE` | `false` (실제 운영) |

4. **Deploy** 버튼을 클릭합니다.  
   ✅ 배포 완료 후 `https://your-app.vercel.app` 주소가 생성됩니다.

---

## Step 6 — 첫 관리자 계정 만들기

1. Supabase 대시보드 → **Authentication** → **Users** → **Add User** 클릭합니다.
2. 관리자로 사용할 이메일과 비밀번호를 입력합니다.
3. **SQL Editor** 에서 아래 쿼리를 실행합니다.  
   `관리자_이메일@example.com` 부분을 실제 이메일로 바꿔서 실행합니다.

   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE email = '관리자_이메일@example.com';
   ```

4. 앱 주소에 접속해 관리자 이메일로 로그인합니다.

---

## AI 기능 설정

**영수증 OCR** 및 **AI 지출 계획 생성** 기능은 OpenAI API를 사용합니다.  
API 키 없이도 앱을 정상적으로 사용할 수 있으며, 영수증은 수동 입력, 계획은 직접 작성으로 대체됩니다.

### 방식 A — 직접 입력 (API 키 불필요)
- 영수증 내용을 직접 입력하고, 지출 계획도 직접 작성합니다.
- 비용이 없고 추가 설정이 필요 없습니다.

### 방식 B — AI 자동 처리 (OpenAI API 키 필요)
- 영수증 사진을 찍으면 금액·날짜·내용이 자동으로 인식됩니다.
- 이전 지출 기록을 바탕으로 월별 계획을 AI가 자동 제안합니다.
- 영수증 OCR 1건당 약 ₩5~20, 계획 생성 1회당 약 ₩10~50 수준의 비용이 발생합니다.

**OpenAI API 키 발급 방법**:
1. [platform.openai.com](https://platform.openai.com) 에 접속해 로그인합니다.
2. 계정 아이콘 → **API keys** → **Create new secret key** 클릭합니다.
3. 생성된 키(`sk-...`로 시작)를 복사합니다.
4. Vercel 대시보드 → 프로젝트 → **Settings** → **Environment Variables** 에 추가합니다.
   ```
   OPENAI_API_KEY = sk-...여기에_복사한_키...
   ```
5. **Redeploy**(재배포)를 실행합니다.

| 비교 | 방식 A (직접 입력) | 방식 B (AI 자동) |
|------|------------------|----------------|
| API 키 | 불필요 | 필요 |
| 비용 | 없음 | 소량 발생 |
| 영수증 처리 | 직접 입력 | 자동 인식 |
| 지출 계획 | 직접 작성 | AI 자동 제안 |

---

## 저장 용량 안내

- Supabase **무료 티어**: 스토리지 **1 GB**
- 영수증 이미지(100~200 KB) 기준 약 **5,000~10,000장** 저장 가능
- 현재 사용량 확인: Supabase 대시보드 → **Storage** 섹션
- 용량 초과 시: Supabase Pro 플랜($25/월, 100 GB)으로 업그레이드하거나 오래된 이미지를 주기적으로 정리합니다.

---

## 문제 해결

| 증상 | 확인 사항 |
|------|-----------|
| 로그인 안 됨 | Supabase → Authentication → Users에 계정 존재 여부 확인. 이메일 인증 옵션이 켜진 경우 끄기 |
| 지도 안 나옴 | `NEXT_PUBLIC_KAKAO_MAP_API_KEY` 값 확인. 카카오 콘솔 → 플랫폼 → Web에 도메인 등록 여부 확인 |
| CSV 가져오기 오류 | 엑셀 파일 암호 제거 후 재시도 |
| 영수증 OCR 오류 | `OPENAI_API_KEY` 설정 및 OpenAI 사용 한도 확인 |
| 데이터 없음 | `NEXT_PUBLIC_DEMO_MODE=false` 설정 확인 |
