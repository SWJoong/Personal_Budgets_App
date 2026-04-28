# 아름드리꿈터 개인예산 관리 앱 (Personal Budgets App)

발달장애인 당사자를 위한 개인별 예산 관리 웹 애플리케이션

[![Vercel](https://img.shields.io/badge/배포-Vercel-black)](https://personal-budgets-app-gp8t.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

---

## 📋 프로젝트 개요

발달장애인이 자신의 예산을 시각적으로 쉽게 이해하고 관리할 수 있도록 돕는 웹 애플리케이션입니다.
당사자(Participant), 지원자(Supporter), 관리자(Admin) 세 가지 역할을 지원하며, 각 역할에 맞는 기능을 제공합니다.

- **대상**: 발달장애인 당사자 · 사회복지 실무자(지원자) · 기관 관리자
- **UI 언어**: 한국어 (쉬운 말 / Easy Read 원칙 적용)
- **배포 환경**: Vercel + Supabase Cloud
- **데모 주소**: [https://personal-budgets-app-gp8t.vercel.app/](https://personal-budgets-app-gp8t.vercel.app/)

### 인증 방식

초기 개발 단계에서 **Google OAuth** (Supabase Auth 소셜 로그인) 설정을 완료했습니다.
현재 배포된 웹 앱은 체험·검증 목적의 **데모 모드**로 운영 중이며, 이후 정식 배포 버전에서 Google OAuth 인증으로 전환할 예정입니다.

| 구분 | 인증 방식 | 상태 |
|------|-----------|:----:|
| 현재 (데모) | 역할 선택 → 쿠키 기반 스푸핑 | 운영 중 |
| 정식 배포 | Google OAuth (Supabase Auth) | 전환 예정 |

### 데모 모드

`NEXT_PUBLIC_DEMO_MODE=true` 상태에서는 로그인 없이 역할(관리자/당사자)을 선택해 바로 체험할 수 있습니다.

---

## ✨ 주요 기능

### 당사자 화면
| 기능 | 설명 |
|------|------|
| 홈 대시보드 | SVG 주머니·지폐 일러스트로 잔액 시각화, 신호등 컬러 테마 |
| 달력 뷰 | 날짜별 지출 확인 및 사진 첨부 |
| 영수증 입력 | 사진 촬영 → GPT-4o OCR 자동 인식 |
| 이번 달 계획 | 월별 지출 계획 조회 (읽기 전용) |
| 내 목표 | 지원목표 및 AI 쉬운 요약 확인 |
| 활동 갤러리 | 활동 사진 모아보기 |
| 활동 지도 | 카카오맵 기반 지출 위치 확인 |
| 쉬운 정보 | Easy Read 기준 적용, TTS 음성 읽기 |

### 실무자(지원자) 화면
| 기능 | 설명 |
|------|------|
| 거래 장부 | 당사자별 수입·지출 CRUD, CSV 가져오기 |
| 영수증 검토 | 대기 중인 영수증 일괄 승인/반려 |
| 월별계획 | 계획 수립·전월 복사·AI 계획 생성(GPT-4o) |
| 지원목표 | 개인별 지원목표 등록 및 4+1 평가 워크플로 |
| 예산 세목 | 월별계획 세부 항목 관리 |
| 이용계획서 | 자동 생성·출력(이용계획서·개인별지원계획서) |
| SIS-A 사정 | 지원필요도 사정 도구 입력 및 저장 |
| 활동 지도 | 전체 거래 위치 지도 표시, 필터링 |
| 서류 보관함 | Google Drive 문서 링크 관리 |
| 당사자 대시보드 | 담당 당사자 통합 현황 조회 |

### 관리자 화면
| 기능 | 설명 |
|------|------|
| 관리자 대시보드 | 전체 현황 통계·알림 |
| 당사자 관리 | 등록·편집·예산 배정·프리뷰 |
| 보고서 출력 | 당사자별 예산 보고서 PDF 내보내기 |
| 평가 템플릿 | 평가 항목 커스터마이징 |
| 시스템 설정 | 앱 전체 설정 관리 |
| 피드백 관리 | 당사자 자기 평가 피드백 확인 |

---

## 🏗️ 기술 스택

### Frontend
| 항목 | 버전 |
|------|------|
| Next.js | 16.1.6 (App Router) |
| React | 19.2.3 |
| TypeScript | 5 |
| Tailwind CSS | 4 (PostCSS) |
| 폰트 | Pretendard (CDN) |

### Backend & Database
| 항목 | 세부 |
|------|------|
| Supabase | PostgreSQL + Auth + Storage |
| Server Actions | Next.js 서버 액션 (21개) |
| Row Level Security | RLS 정책 전면 적용 |

### AI & 외부 서비스
| 항목 | 용도 |
|------|------|
| OpenAI GPT-4o | 영수증 OCR, 지출 계획 생성, 쉬운 요약 |
| Kakao Maps SDK | 거래 위치 지도 표시 |
| Kakao REST API | 장소 검색 |

### 기타 라이브러리
| 패키지 | 용도 |
|--------|------|
| xlsx | CSV·엑셀 거래내역 가져오기 |
| html-to-image | 보고서·카드 이미지 내보내기 |
| @vercel/analytics | 방문 분석 |
| @vercel/speed-insights | 성능 모니터링 |

### 테스트
| 항목 | 세부 |
|------|------|
| Vitest | 단위 테스트 |
| Testing Library | React 컴포넌트 테스트 |
| GitHub Actions | CI `npm test` 자동화 |

### 배포
- **Vercel** (프론트엔드 호스팅)
- **Supabase Cloud** (데이터베이스 및 스토리지)

---

## 📁 프로젝트 구조

```
Personal_Budgets_App/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/                        # 로그인 (데모 모드 역할 선택 포함)
│   │   ├── (participant)/                    # 당사자 화면 (모바일 600px 중심)
│   │   │   ├── page.tsx                          # 홈 대시보드
│   │   │   ├── calendar/                         # 달력 뷰
│   │   │   ├── evaluations/                      # 자기 평가
│   │   │   ├── gallery/                          # 활동 사진 갤러리
│   │   │   ├── guide/                            # 앱 이용 가이드
│   │   │   ├── map/                              # 활동 지도
│   │   │   ├── more/                             # 더보기 메뉴
│   │   │   ├── my-plan/                          # 내 계획 (읽기 전용)
│   │   │   ├── plan/                             # 오늘 계획
│   │   │   ├── receipt/                          # 영수증 입력
│   │   │   └── settings/profile/                 # 프로필 설정
│   │   ├── (supporter)/
│   │   │   ├── admin/                        # 관리자 전용
│   │   │   │   ├── page.tsx                      # 관리자 대시보드
│   │   │   │   ├── feedback/                     # 피드백 관리
│   │   │   │   ├── participants/                 # 당사자 관리 (목록·상세·신규·프리뷰·보고서)
│   │   │   │   └── settings/                     # 시스템 설정
│   │   │   └── supporter/                    # 실무자 공통
│   │   │       ├── page.tsx                      # 실무자 대시보드
│   │   │       ├── [participantId]/transactions/ # 당사자별 거래 장부
│   │   │       ├── budgets/[id]/                 # 예산 상세
│   │   │       ├── documents/                    # 서류 보관함
│   │   │       │   └── care-plans/[id]/[type]/   # 이용계획서
│   │   │       ├── evaluations/                  # 계획·평가
│   │   │       │   └── [participantId]/[month]/  # 월별 평가
│   │   │       │       ├── plans/                # 월별계획
│   │   │       │       └── goals/                # 지원목표
│   │   │       ├── map/                          # 활동 지도
│   │   │       ├── participants/                 # 당사자 통합 대시보드
│   │   │       ├── review/                       # 영수증 검토 대기열
│   │   │       └── transactions/                 # 전체 거래 장부
│   │   ├── actions/                          # Server Actions (21개)
│   │   │   ├── admin.ts                          # 관리자 작업
│   │   │   ├── budgetLineItem.ts                 # 예산 세목
│   │   │   ├── carePlan.ts                       # 이용계획서
│   │   │   ├── copyPlan.ts                       # 전월 복사
│   │   │   ├── document.ts                       # 문서 링크
│   │   │   ├── easyReadSummary.ts                # AI 쉬운 요약
│   │   │   ├── evalTemplates.ts                  # 평가 템플릿
│   │   │   ├── evaluation.ts                     # 자기 평가
│   │   │   ├── feedback.ts                       # 피드백
│   │   │   ├── geocode.ts                        # 주소 → 좌표 변환
│   │   │   ├── goalEvaluation.ts                 # 목표 평가
│   │   │   ├── importTransactions.ts             # CSV 거래 가져오기
│   │   │   ├── monthlyPlan.ts                    # 월별계획 CRUD
│   │   │   ├── ocr.ts                            # 영수증 OCR
│   │   │   ├── plan.ts                           # AI 계획 생성
│   │   │   ├── preferences.ts                    # UI 환경설정
│   │   │   ├── profile.ts                        # 프로필 수정
│   │   │   ├── sisAssessment.ts                  # SIS-A 사정
│   │   │   ├── storage.ts                        # 파일 스토리지
│   │   │   ├── supportGoal.ts                    # 지원목표
│   │   │   └── transaction.ts                    # 거래 CRUD
│   │   └── onboarding/                       # 온보딩
│   ├── components/                           # 81개 컴포넌트 (13개 카테고리)
│   │   ├── admin/                                # 관리자 UI (8개)
│   │   ├── budgets/                              # 예산 관리 UI (4개)
│   │   ├── documents/                            # 서류 UI (5개)
│   │   ├── evaluations/                          # 평가 UI (8개)
│   │   ├── help/                                 # 도움말 UI (5개)
│   │   ├── home/                                 # 홈 대시보드 UI (14개)
│   │   ├── layout/                               # 레이아웃 (5개)
│   │   ├── map/                                  # 지도 (2개)
│   │   ├── participants/                         # 당사자 관리 UI (2개)
│   │   ├── plans/                                # 계획 UI (6개)
│   │   ├── transactions/                         # 거래 UI (8개)
│   │   └── ui/                                   # 공통 UI (4개)
│   ├── hooks/
│   │   ├── useAccessibility.tsx                  # 7가지 테마 · Easy Read 설정
│   │   ├── useAuth.ts                            # 인증 상태
│   │   └── useFirstVisit.ts                      # 첫 방문 감지
│   ├── types/
│   │   └── database.ts                           # Supabase 자동 생성 타입
│   └── utils/
│       ├── supabase/
│       │   ├── client.ts                         # 브라우저 클라이언트
│       │   ├── server.ts                         # 서버 클라이언트 + admin 클라이언트
│       │   └── storage.ts                        # signed URL 헬퍼
│       ├── activityEmoji.ts
│       ├── api-logger.ts
│       ├── budget-visuals.ts                     # SVG 시각화 유틸
│       ├── date.ts                               # KST 타임존 처리
│       ├── emojiCatalog.ts
│       ├── openai.ts                             # OpenAI 클라이언트
│       ├── sis-a.ts                              # SIS-A 점수 계산
│       └── tts.ts                                # 브라우저 TTS
├── supabase/
│   ├── migrations/                           # 마이그레이션 파일 (04~30번)
│   ├── schema.sql                            # 전체 DB 스키마
│   └── seed.sql                              # 테스트 데이터
└── public/
```

---

## 🗄️ 데이터베이스 마이그레이션

`supabase/migrations/` 폴더. **Supabase 대시보드 > SQL Editor**에서 번호 순으로 수동 실행합니다.

| 번호 | 파일명 | 설명 |
|:----:|--------|------|
| 04 | `04_fix_participants_rls.sql` | participants RLS 수정 |
| 05 | `05_atomic_first_admin.sql` | 첫 관리자 원자적 생성 |
| 06 | `06_add_12_demo_participants.sql` | 데모 당사자 12명 추가 (선택) |
| 07 | `07_set_admin_accounts.sql` | 관리자 계정 설정 |
| 08 | `08_fix_rls_for_participant_creation.sql` | 당사자 생성 RLS 수정 |
| 09 | `09_add_activity_photo_and_plan_details.sql` | 활동사진·계획 상세 필드 추가 |
| 10 | `10_demo_mode_profiles.sql` | 데모 모드 프로필 |
| 11 | `11_add_ui_preferences.sql` | UI 환경설정 필드 추가 |
| 12 | `12_evaluations_published_at.sql` | 평가 발행일 필드 추가 |
| 13 | `13_eval_templates.sql` | 평가 템플릿 테이블 |
| 14 | `14_care_plans.sql` | 이용계획서 테이블 |
| 15 | `15_sis_assessments.sql` | SIS-A 사정 테이블 |
| 16 | `16_transactions_location.sql` | 거래 위치 좌표 필드 추가 |
| 17 | `17_plans_location.sql` | 계획 위치 필드 추가 |
| 18 | `18_sample_location_data.sql` | 샘플 거래 데이터 (선택) |
| 19 | `19_storage_buckets.sql` | 파일 저장 버킷 생성 **필수** |
| 20 | `20_system_settings_rls.sql` | 시스템 설정 RLS |
| 21 | `21_participant_feedback.sql` | 당사자 피드백 테이블 |
| 22 | `22_rls_and_indexes.sql` | RLS 보강 + 인덱스 |
| 23 | `23_monthly_plans.sql` | 월별계획 테이블 |
| 24 | `24_support_goals.sql` | 지원목표 테이블 |
| 25 | `25_goal_evaluations.sql` | 목표 평가 테이블 |
| 26 | `26_budget_line_items.sql` | 예산 세목 테이블 |
| 27 | `27_monthly_plans_extend.sql` | 월별계획 확장 필드 |
| 28 | `28_migrate_care_plans_jsonb.sql` | 이용계획서 JSONB 마이그레이션 |
| 29 | `29_care_plans_index.sql` | 이용계획서 인덱스 |
| 30 | `30_easy_read_columns.sql` | Easy Read 컬럼 추가 |

> **참고**: 06번, 18번은 테스트용 데모 데이터입니다. 실제 운영 시 건너뛸 수 있습니다.
> **필수**: 19번(`19_storage_buckets.sql`)은 영수증·활동사진·증빙서류 업로드를 위해 반드시 실행해야 합니다.

---

## 👥 역할(Role) 구조

```
관리자(Admin)
  └── 지원자(Supporter)
        └── 당사자(Participant)
```

- **당사자**: 자신의 예산 조회, 거래 내역 입력, 영수증 업로드
- **지원자**: 담당 당사자 관리, 거래 승인, 계획 수립 지원, SIS-A 사정, 이용계획서 작성
- **관리자**: 전체 시스템 관리, 재원 설정, 사용자 관리, 보고서 출력

---

## 🚀 개발 단계별 구현 현황

| 단계 | 기간 | 주요 내용 | 상태 |
|------|------|-----------|:----:|
| **Phase A** | 2026-04-20~21 | 잔액 위젯·CashViz 지폐 일러스트 개선 | ✅ |
| **Phase 0** | 2026-04-21~22 | Vitest·CI 도입, 스테이징 환경 구성 | ✅ |
| **Phase B** | 2026-04-22 | `monthly_plans` 테이블·CRUD·위젯 연동 | ✅ |
| **Phase C** | 2026-04-22 | 지원목표·목표평가·예산세목 테이블 + Server Actions + 컴포넌트 | ✅ |
| **Phase F** | 2026-04-22 | KST 타임존 버그 수정, 활동지도 분리, 당사자 통합 대시보드 분리 | ✅ |
| **Phase G** | 2026-04-22 | 전월 복사(`copyPlan.ts`), 이용계획서 카드(`CarePlanSection`) | ✅ |
| **Phase H** | 2026-04-23 | Easy Read 기준 13개 항목 전면 적용 | ✅ |
| **v4.9** | 2026-04-23 | FAB 통합, 꾸미기 헤더 고정, 다크↔노란 배경 버그 수정 | ✅ |
| **v4.12~13** | 2026-04-29 | 다크 모드 개선, 잔액 표시 변경 | ✅ |
| **Phase I** | 2026-04-29~ | Easy Read 컬럼 추가(`Migration 30`), AI 쉬운 요약 | 🔄 진행 중 |

---

## 🔧 환경 설정

### 필수 환경 변수 (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # 서버 전용, 절대 노출 금지

# 데모 모드 (true = 로그인 없이 체험 가능)
NEXT_PUBLIC_DEMO_MODE=true

# OpenAI (영수증 OCR 및 AI 계획 생성 — 선택사항)
OPENAI_API_KEY=your_openai_api_key

# 카카오맵
NEXT_PUBLIC_KAKAO_MAP_API_KEY=your_kakao_javascript_key  # 지도 표시용
KAKAO_REST_API_KEY=your_kakao_rest_api_key               # 장소 검색용
```

### 개발 서버 실행

```bash
npm install
npm run dev        # localhost:3000
npm run build      # 프로덕션 빌드 (배포 전 확인)
npm run test       # Vitest 단위 테스트
npm run lint       # ESLint
npm run generate-types  # Supabase 타입 재생성
```

---

## ♿ 접근성 (Easy Read)

**쉬운 정보(Easy Read)** 기준 13개 항목을 전면 적용합니다.

| 항목 | 적용 내용 |
|------|-----------|
| 폰트 | Pretendard (CDN) — 모든 레이아웃 |
| 줄 간격 | `line-height: 1.85` (Easy Read 기준) |
| 색상 대비 | WCAG AA 이상 |
| 버튼 크기 | 최소 44×44px 터치 영역 |
| 언어 | 쉬운 말 사용, 전문 용어 최소화 |
| 특수문자 | `×` 기호 제거, 한글 표현으로 대체 |
| 시각화 | 신호등 컬러 테마, 지폐 일러스트 |
| 정보 구조 | 기본 접기로 정보 과부하 방지 |
| 음성 | TTS(음성 읽기) 지원 |
| 테마 | 7가지 색상 테마 (`useAccessibility` 훅) |
| ARIA | `grid`, `tablist` 등 역할 적용 |
| 도움말 | FAB 통합 도움말·슬라이드쇼 |
| 온보딩 | Easy Mode 온보딩 가이드 |

---

## 📸 영수증 OCR 흐름

1. `ReceiptUploadForm.tsx`에서 이미지 업로드
2. Supabase Storage `receipts` 버킷에 저장 → `pending` 상태
3. `actions/ocr.ts`에서 GPT-4o Vision API 호출
4. 인식 결과로 `transactions` 테이블에 저장 → `confirmed` 상태

> 잔액은 `01_balance_trigger.sql` 트리거가 자동으로 재계산합니다.

---

## 📊 AI 기능 목록

| 기능 | 파일 | 모델 |
|------|------|------|
| 영수증 OCR | `actions/ocr.ts` | GPT-4o Vision |
| 월별 지출 계획 생성 | `actions/plan.ts` | GPT-4o |
| AI 계획 비교 (A/B/C) | `components/plans/PlanComparison.tsx` | — |
| 쉬운 요약 (Easy Read) | `actions/easyReadSummary.ts` | GPT-4o |

---

## 🔗 관련 링크

- [배포 주소](https://personal-budgets-app-gp8t.vercel.app/)
- [GitHub Repository](https://github.com/SWJoong/Personal_Budgets_App)
- [Pretendard CDN](https://github.com/orioncactus/pretendard)
- [Supabase Storage 문서](https://supabase.com/docs/guides/storage)

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

> OpenAI API는 AI 자동 요약·OCR 기능에만 필요합니다. 없어도 앱을 사용할 수 있습니다.

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

1. Supabase 대시보드 왼쪽 메뉴에서 **SQL Editor**를 클릭합니다.
2. `supabase/migrations/` 폴더 안 SQL 파일을 **번호 순서대로** 실행합니다.

   ```
   04_fix_participants_rls.sql
   05_atomic_first_admin.sql
   06_add_12_demo_participants.sql        ← 데모 데이터 포함 (선택)
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
   18_sample_location_data.sql            ← 샘플 거래 데이터 (선택)
   19_storage_buckets.sql                 ← 파일 저장 버킷 생성 (필수)
   20_system_settings_rls.sql
   21_participant_feedback.sql
   22_rls_and_indexes.sql
   23_monthly_plans.sql
   24_support_goals.sql
   25_goal_evaluations.sql
   26_budget_line_items.sql
   27_monthly_plans_extend.sql
   28_migrate_care_plans_jsonb.sql
   29_care_plans_index.sql
   30_easy_read_columns.sql
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
   - **JavaScript 키** → `NEXT_PUBLIC_KAKAO_MAP_API_KEY` (지도 표시용)
   - **REST API 키** → `KAKAO_REST_API_KEY` (장소 검색용)
3. **플랫폼** 탭 → **Web** → 사이트 도메인에 배포 주소 추가
   (예: `https://your-app.vercel.app`)

---

## Step 4 — GitHub에 코드 올리기

> 이미 GitHub에 올라가 있다면 이 단계는 건너뛰세요.

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
   | `NEXT_PUBLIC_KAKAO_MAP_API_KEY` | 카카오 **JavaScript** 키 |
   | `KAKAO_REST_API_KEY` | 카카오 **REST API** 키 |
   | `NEXT_PUBLIC_DEMO_MODE` | `false` (실제 운영) |

4. **Deploy** 버튼을 클릭합니다.
   ✅ 배포 완료 후 `https://your-app.vercel.app` 주소가 생성됩니다.

---

## Step 6 — 첫 관리자 계정 만들기

1. Supabase 대시보드 → **Authentication** → **Users** → **Add User** 클릭합니다.
2. 관리자로 사용할 이메일과 비밀번호를 입력합니다.
3. **SQL Editor** 에서 아래 쿼리를 실행합니다.

   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE email = '관리자_이메일@example.com';
   ```

4. 앱 주소에 접속해 관리자 이메일로 로그인합니다.

---

## AI 기능 설정

**영수증 OCR** 및 **AI 지출 계획 생성**, **쉬운 요약** 기능은 OpenAI API를 사용합니다.
API 키 없이도 앱을 정상적으로 사용할 수 있으며, 해당 기능은 수동 입력으로 대체됩니다.

| 비교 | 방식 A (직접 입력) | 방식 B (AI 자동) |
|------|------------------|----------------|
| API 키 | 불필요 | 필요 |
| 비용 | 없음 | 소량 발생 |
| 영수증 처리 | 직접 입력 | 자동 인식 |
| 지출 계획 | 직접 작성 | AI 자동 제안 |
| 쉬운 요약 | 미제공 | AI 자동 생성 |

**OpenAI API 키 발급 방법**:
1. [platform.openai.com](https://platform.openai.com) 에서 로그인 후 **API keys** → **Create new secret key**
2. 생성된 키(`sk-...`)를 Vercel 환경변수 `OPENAI_API_KEY`에 추가
3. Vercel **Redeploy** 실행

> 영수증 OCR 1건당 약 ₩5~20, 계획 생성 1회당 약 ₩10~50 수준의 비용이 발생합니다.

---

## 저장 용량 안내

- Supabase **무료 티어**: 스토리지 **1 GB**
- 영수증 이미지(100~200 KB) 기준 약 **5,000~10,000장** 저장 가능
- 현재 사용량 확인: Supabase 대시보드 → **Storage** 섹션
- 용량 초과 시: Supabase Pro 플랜($25/월, 100 GB)으로 업그레이드

---

## 문제 해결

| 증상 | 확인 사항 |
|------|-----------|
| 로그인 안 됨 | Supabase → Authentication → Users에 계정 존재 여부 확인. 이메일 인증 옵션 비활성화 |
| 지도 안 나옴 | `NEXT_PUBLIC_KAKAO_MAP_API_KEY` 값 확인. 카카오 콘솔 → 플랫폼 → Web에 도메인 등록 여부 확인 |
| CSV 가져오기 오류 | 엑셀 파일 암호 제거 후 재시도 |
| 영수증 OCR 오류 | `OPENAI_API_KEY` 설정 및 OpenAI 사용 한도 확인 |
| 데이터 없음 | `NEXT_PUBLIC_DEMO_MODE=false` 설정 확인 |
| 파일 업로드 안 됨 | Migration 19번(`19_storage_buckets.sql`) 실행 여부 확인 |

---

> 이 앱은 아름드리꿈터 주간이용시설의 발달장애인 당사자들을 위해 개발되었습니다.
