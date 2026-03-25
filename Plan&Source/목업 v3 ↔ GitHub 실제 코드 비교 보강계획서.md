# 아름드리꿈터 자기주도 개인예산 관리 앱
## 목업 v3 ↔ GitHub 실제 코드 비교 보강계획서

**Gap Analysis & Reinforcement Plan — v5.1**

| 항목 | 내용 |
|------|------|
| **작성일** | 2026년 3월 25일 |
| **비교 기준** | 목업 kkumteo-budget-app (Perplexity Computer) |
| **대상 레포** | SWJoong/Personal_Budgets_App (main 브랜치) |
| **기준 커밋** | 106eadf (2026-03-25 latest) |
| **현재 진행** | Epic 1~4 완료, Epic 5~9 미시작 |

---

## 1. 비교 개요

이 문서는 Perplexity Computer로 구현한 목업 앱(kkumteo-budget-app)에서 검증된 UX/기능 요소와, 현재 GitHub 레포지토리(SWJoong/Personal_Budgets_App)에 실제로 구현된 코드를 항목별로 대조합니다. 반영된 사항, 부분 반영된 사항, 아직 미반영된 사항을 구분하여 Epic 5~9 진행 시 우선순위와 구체적 개발 지침을 제시합니다.

> **비교 범위:** 홈 대시보드 · 계획 페이지 · 영수증 · 달력 · 평가 · 더보기 · 네비게이션 · 디자인 시스템 · 데이터/인증 구조

### 반영 현황 요약

| **영역** | **✅ 반영** | **🔶 부분** | **❌ 미반영** |
|---|---|---|---|
| **홈 대시보드 · 시각화** | 4 | 3 | 인터랙티브 SVG 돈주머니, 월별 추이 차트 |
| **네비게이션 · 레이아웃** | 4 | 1 | --- |
| **계획 비교 (Plan)** | 3 | 1 | 선택지 색깔 점선 오버레이 |
| **영수증 · OCR** | 3 | 1 | OCR 실제 연동 (API키 미설정) |
| **달력** | 3 | 1 | 날짜 셀 사진 썸네일 |
| **평가 (Evaluation)** | 4 | 0 | AI 분석 타임아웃 처리 |
| **더보기 · 파일 링크** | 3 | 1 | --- |
| **인증 · 권한** | 4 | 0 | --- |
| **DB · 백엔드** | 5 | 0 | --- |
| **디자인 시스템** | 4 | 1 | 폰트 실제 로드 |

---

## 2. 영역별 상세 비교

### 2-1. 홈 대시보드 · 예산 시각화

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **통합/재원별 보기 전환** | 토글 버튼으로 통합/재원별 전환 | viewMode 토글 ✅ 동일 구조 | **✅ 반영** | 구현 완료. 동일 패턴 확인. |
| **잔액 상태 7단계 메시지** | luxury/stable/observing/shrinking/critical/empty/warning | budget-visuals.ts 7단계 완성 | **✅ 반영** | 계획서 7.1 로직과 일치. |
| **상태별 색상 테마** | 초록→파랑→인디고→주황→빨강 동적 전환 | themeColor + bgClass 동적 전환 | **✅ 반영** | HomeDashboard 조건부 클래스 구현. |
| **예산 소비 속도 안내** | 남은 날짜 대비 속도 문구 | idealDailySpend 계산 후 문구 출력 | **✅ 반영** | 목업과 동일 로직. ✅ |
| **인터랙티브 SVG 돈주머니** | 탭/hover 시 열리며 스택 막대 차트 | 진행바 + 텍스트 수준에 머묾 | **❌ 미반영** | Epic 3 우선 구현 항목. 목업 InteractivePouchSection 컴포넌트 구조 참고. |
| **월별 예산 추이 차트** | 최근 6개월 막대그래프 | 미구현 | **❌ 미반영** | HomeDashboard에 섹션 추가. transactions 테이블 월별 GROUP BY로 계산. |
| **활동 사진 썸네일 (최근 내역)** | receipt_image_url 있으면 사진 표시 | 상태 도트만 표시 | **🔶 부분반영** | recentTransactions map에 img 태그 조건부 추가. receipt_image_url 컬럼 이미 있음. |

### 2-2. 네비게이션 · 레이아웃

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **Route Groups 분리** | (participant)/(supporter)/(auth) 3그룹 | (participant)/(supporter)/(auth) 분리 완료 | **✅ 반영** | 이전 보강 제안 반영됨. |
| **당사자 하단 TabBar** | 5탭: 홈/계획/영수증/달력/더보기, 이모지 픽토그램 | 5탭 이모지 구현, ARIA 적용 | **✅ 반영** | |
| **지원자 사이드바** | AdminSidebar 좌측 고정, 모바일 햄버거 메뉴 | 모바일 햄버거 메뉴 추가됨 (PR#2) | **✅ 반영** | |
| **로그인 화면** | 따뜻한 톤, 단계별 안내 | 따뜻한 톤으로 리디자인됨 (PR#2) | **✅ 반영** | |
| **온보딩 플로우** | 최초 로그인 시 역할선택+프로필 설정 | OnboardingClient 멀티스텝 구현 | **✅ 반영** | |
| **미구현 메뉴 비활성 처리** | 준비 중 표시 | 평가/문서 메뉴 페이지 이미 구현됨 | **✅ 반영** | |

### 2-3. 계획 비교 (Plan Page)

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **실제 잔액 기반 계획 표시** | 로그인 사용자 funding_sources 조회 | Server Component로 실제 잔액 조회 | **✅ 반영** | 이전 보강 제안 반영됨. |
| **AI 활동 추천 (GPT)** | AI가 잔액 기반 활동 1개+옵션 2개 추천 | actions/plan.ts → GPT-4o 연동 | **✅ 반영** | model은 gpt-4o 사용. OPENAI_API_KEY 환경변수 필요. |
| **선택지 비교 카드** | 비용/시간/선택 후 잔액 표시 | PlanComparison.tsx 구현 | **✅ 반영** | |
| **선택지별 색깔 점선 오버레이** | A/B/C 선택에 따라 돈주머니 바에 점선 | 미구현 | **❌ 미반영** | PlanComparison 카드에 "선택 후 남는 예산" 섹션만 있음. 홈 돈주머니 바 연동 필요. |

### 2-4. 영수증 · OCR

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **영수증 사진 업로드** | 카메라/갤러리 → Supabase Storage | ReceiptUploadForm → Storage 업로드 | **✅ 반영** | |
| **임시반영(pending) 흐름** | 업로드 즉시 confirmed 아님 | status: pending 기본값으로 저장 | **✅ 반영** | actions/transaction.ts 확인. |
| **잔액 자동 계산 트리거** | confirmed 전환 시만 잔액 차감 | migrations/01_balance_trigger.sql 완성 | **✅ 반영** | Race condition 해결. 이전 보강 제안 완전 반영. |
| **OCR 자동 추출** | GPT Vision으로 날짜/금액/상호명 추출 | actions/ocr.ts 존재하나 OPENAI_API_KEY 미설정 | **🔶 부분반영** | ocr.ts 로직 확인 필요. API 키 설정 후 실연 테스트 필수. |

### 2-5. 달력 (Calendar)

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **월간 달력 + 날짜별 내역** | 날짜 탭 → 해당일 거래 슬라이드 | TransactionCalendar 컴포넌트 구현 | **✅ 반영** | ARIA grid roles 추가됨. |
| **임시/확정 구분 도트** | 초록(confirmed), 주황(pending) | 초록/주황 점 표시 | **✅ 반영** | |
| **날짜 셀 사진 썸네일** | receipt_image_url 있으면 작은 사진 | 도트만 표시, 사진 없음 | **❌ 미반영** | TransactionCalendar에 이미지 셀 렌더링 추가. receipt_image_url 이미 조회됨(select에 포함). |
| **월 이동 (이전/다음 달)** | 좌우 화살표 월 전환 | TransactionCalendar 내부 상태로 구현 | **✅ 반영** | |

### 2-6. 평가 (Evaluation)

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **당사자 평가 보기 화면** | 지원자 편지 형식, 쉬운 요약 표시 | evaluations/page.tsx "선생님의 편지" 구현 | **✅ 반영** | |
| **지원자 PCP 4+1 평가 입력** | tried/learned/pleased/concerned/next_step 5필드 | EvaluationForm.tsx 5필드 구현 | **✅ 반영** | |
| **AI 분석 (지원자용/당사자용)** | GPT로 supporterAnalysis + easySummary 생성 | actions/evaluation.ts OpenAI 연동 | **✅ 반영** | model gpt-4o 사용. API 키 설정 필요. |
| **AI 타임아웃/실패 시 폴백** | AI 실패해도 저장 진행 | try-catch로 저장 진행하나 UI 피드백 없음 | **🔶 부분반영** | 평가 저장 완료 후 "AI 분석 중" 상태 표시 추가 권고. |

### 2-7. 더보기 · 파일 링크

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **프로필 요약 표시** | 이름/역할 표시 | more/page.tsx 프로필 카드 구현 | **✅ 반영** | |
| **Google Drive 파일 링크 등록** | 지원자가 링크 첨부, 당사자 열람 | actions/document.ts + file_links 테이블 | **✅ 반영** | |
| **앱 사용 설명서 (Guide)** | 5단계 쉬운 설명 | guide/page.tsx 5단계 구현 | **✅ 반영** | |
| **큰 글씨/고대비 접근성 모드** | 3단계 폰트, 고대비 토글 | useAccessibility 훅 존재 | **🔶 부분반영** | more/page.tsx에서 접근성 설정 UI 실제 연결 여부 확인 필요. |

### 2-8. 인증 · 권한

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **Google OAuth 로그인** | Google 계정으로 로그인 | Supabase Auth Google OAuth | **✅ 반영** | |
| **도메인 제한 이중 방어** | auth callback + middleware 이중 검증 | callback에서 도메인 체크 + cheese0318@gmail.com 예외 추가 | **✅ 반영** | 최신 커밋(106eadf)에서 gmail 예외 처리 확인. |
| **온보딩 완료 여부 리다이렉트** | 최초 접속 시 온보딩으로 | middleware.ts onboarding_completed 체크 | **✅ 반영** | |
| **역할별 라우팅 분기** | participant→홈, supporter→/supporter, admin→/admin | page.tsx 역할 redirect 구현 | **✅ 반영** | |

### 2-9. DB · 백엔드 구조

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **잔액 계산 트리거 (Race Condition 해결)** | 트리거로 원자적 잔액 계산 | migrations/01_balance_trigger.sql 완성 | **✅ 반영** | 이전 보강 제안 완전 반영. |
| **7개 테이블 스키마** | profiles/participants/funding_sources/transactions/plans/evaluations/file_links | schema.sql 7테이블 완성 | **✅ 반영** | |
| **Server Actions 구조** | 클라이언트 직접 fetch 대신 Server Action | actions/*.ts 모두 Server Action | **✅ 반영** | |
| **TypeScript 타입 정의** | database.ts 타입 자동화 | database.ts에 모든 테이블 타입 수동 정의 | **✅ 반영** | Supabase CLI gen types로 자동화 추후 권고. |
| **시드 데이터** | 목업 당사자 이름 기반 테스트 데이터 | seed.sql v5 — 목업 성함(김민준/이서연 등) 반영 | **✅ 반영** | |

### 2-10. 디자인 시스템

| **기능 항목** | **목업 v3** | **GitHub 현황** | **반영 여부** | **비고 / 다음 액션** |
|---|---|---|---|---|
| **HSL 색상 토큰 (목업 동일)** | 207/130/32/0 기반 파랑/초록/주황/빨강 | globals.css @theme 목업 동일 HSL 값 적용 | **✅ 반영** | |
| **line-height 1.85 Easy Read** | 본문 줄간격 1.85 | body { line-height: 1.85 } 적용 | **✅ 반영** | |
| **warm-banner, easy-read-bg 클래스** | 목업 커스텀 클래스 | globals.css에 동일 클래스 정의 | **✅ 반영** | |
| **Pretendard/Noto Sans KR 폰트** | 한글 가독성 폰트 실제 로드 | globals.css --font-pretendard 변수 선언만, layout.tsx 실제 로드 미확인 | **🔶 부분반영** | layout.tsx에서 next/font 또는 CDN으로 Pretendard 명시적 로드 추가 필요. |

---

## 3. 미반영·부분반영 항목 보강 계획

이 섹션은 위 비교에서 ❌ 미반영 또는 🔶 부분반영으로 분류된 6개 항목에 대해 구체적 구현 지침을 제시합니다.

### P1. 인터랙티브 SVG 돈주머니 — 홈 핵심 시각화

> **현황:** HomeDashboard.tsx는 progress bar + 색상 테마 카드 수준. 목업의 핵심 차별점인 SVG 애니메이션 없음.

**구현 명세**

- 목업의 AnimatedPouch SVG 컴포넌트(잔액 비율에 따라 크기·열림 상태 변화)를 Next.js 컴포넌트로 이식
- 탭/클릭 시 열리며 날짜별 스택 막대 차트 렌더링 (D3 또는 순수 SVG 방식)
- 막대 탭 → 해당 날짜 거래 목록 슬라이드 패널, receipt_image_url 있으면 사진 표시
- budget-visuals.ts의 themeColor 값과 SVG fillColor 연동

**파일 위치**

- 신규: `src/components/home/InteractivePouchSection.tsx`
- 수정: `src/components/home/HomeDashboard.tsx` — progress bar 섹션 대체

---

### P2. 달력 날짜 셀 사진 썸네일

> **현황:** TransactionCalendar.tsx가 receipt_image_url을 이미 select로 가져오나, 날짜 셀에 이미지 렌더링이 없음.

**구현 명세**

- TransactionCalendar.tsx의 날짜 셀 렌더링 부분에 조건부 `img` 태그 추가
- 해당 날짜 거래 중 receipt_image_url 있는 첫 번째 건의 이미지를 28×28px 썸네일로 표시
- 이미지 없으면 기존 초록/주황 도트 유지
- 날짜 셀 최소 높이를 52px 이상으로 조정하여 숫자+썸네일 레이아웃 확보

코드 참고: 목업 CalendarDayCell 컴포넌트의 `hasPhotos && photoTx?.receiptImageUrl` 조건 분기 패턴

---

### P3. 월별 예산 추이 차트

> **현황:** 홈 화면에 최근 6개월 지출 추이를 보여주는 차트가 없음. 지원자 대시보드에서도 누적 트렌드 확인 불가.

**구현 명세**

- transactions 테이블을 월별 GROUP BY로 집계 (Server Component 단계에서 Supabase RPC 또는 클라이언트 집계)
- 최근 6개월 막대 그래프: 이번 달 진한 파랑, 지난 달 연한 파랑, 예산 초과 월 빨강
- 홈 대시보드 하단 또는 더보기 → 기록 탭에 BudgetTrendChart 컴포넌트로 추가

**파일 위치**

- 신규: `src/components/home/BudgetTrendChart.tsx`
- 수정: `src/app/(participant)/page.tsx` — transactions 월별 집계 데이터 추가 조회

---

### P4. OCR 실제 연동 확인

> **현황:** actions/ocr.ts 파일 존재 확인됨. OPENAI_API_KEY 환경변수가 설정되지 않으면 OCR 호출 시 실패. 현재 영수증 업로드 폼이 OCR 액션을 실제로 호출하는지 불명확.

**확인 및 보강 절차**

- ReceiptUploadForm.tsx에서 ocr.ts 액션 실제 호출 여부 확인
- OCR 결과(날짜/금액/상호명)를 폼 필드에 자동 채우는 UX 흐름 존재 여부 확인
- OPENAI_API_KEY를 Vercel/Supabase 환경변수에 설정
- OCR 실패 시 수동 입력 폴백 UI가 동작하는지 테스트

---

### P5. 선택지별 색깔 점선 오버레이 (Plan Page)

> **현황:** PlanComparison 카드에 "선택 후 남는 예산" 수치는 있으나, 홈 화면 돈주머니 진행바에 점선 오버레이가 없음.

**구현 명세**

- PlanComparison에서 선택지를 고를 때 해당 비용을 상위 컴포넌트로 전달
- PlanPage 내 미니 돈주머니 바(PouchPreviewBar)를 추가하여 현재 잔액 + 선택 시 차감 구간을 색깔 점선으로 표시
- 목업 OPTION_COLORS(파랑/초록/주황) 패턴을 재사용
- 홈 InteractivePouchSection과 연동(선택 상태 공유)은 선택 사항. 우선 PlanPage 내 독립 구현으로 시작

---

### P6. Pretendard 폰트 실제 로드

> **현황:** globals.css에 --font-pretendard 변수 선언 있음. layout.tsx에서 실제 폰트 로드 여부 미확인. 시스템 폰트 폴백 가능성.

**보강 방향**

- layout.tsx에 Pretendard CDN 로드 추가: `import localFont from 'next/font/local'` 또는 CDN link 태그
- CDN 방식: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css`
- 또는 Noto Sans KR을 next/font/google로 명시적 로드 (`import { Noto_Sans_KR } from "next/font/google"`)

---

## 4. 구현 우선순위 로드맵

Epic 5~9 진행 전 처리 권장 항목과, Epic 단계별 보강 항목을 정리합니다.

| **우선순위** | **항목** | **대상 Epic** | **구현 포인트** |
|---|---|---|---|
| **즉시** | **OCR 환경변수 + 실연 테스트** | Epic 6 | OPENAI_API_KEY 설정 → ReceiptUploadForm OCR 흐름 E2E 테스트 |
| **즉시** | **Pretendard 폰트 로드** | Epic 9 | layout.tsx CDN 또는 next/font/local 추가. 1시간 이내 완료 가능. |
| **높음** | **달력 사진 썸네일** | Epic 7 | TransactionCalendar.tsx 조건부 img 태그. receipt_image_url 이미 조회됨. |
| **높음** | **SVG 인터랙티브 돈주머니** | Epic 3 | 목업 InteractivePouchSection 컴포넌트 Next.js 이식. 홈 핵심 UX. |
| **중간** | **월별 예산 추이 차트** | Epic 3 | BudgetTrendChart.tsx 신규 컴포넌트. transactions 월별 집계. |
| **중간** | **선택지 점선 오버레이** | Epic 4 | PlanPage 내 PouchPreviewBar. 목업 OPTION_COLORS 패턴 재사용. |
| **낮음** | **AI 평가 저장 중 UI 피드백** | Epic 7 | 평가 저장 버튼에 "AI 분석 중..." 로딩 상태 추가. |
| **낮음** | **접근성 모드 설정 UI 연결** | Epic 9 | more/page.tsx에서 useAccessibility 훅 설정 토글 연결 확인. |

---

## 5. 구현계획서 개정 지침

GitHub 레포의 구현계획서(`개인예산관리앱_구현계획서.md`)를 현재 코드 진행 상황에 맞게 업데이트할 때 반영할 항목입니다.

| **Epic** | **명칭** | **현재 상태** | **계획서 반영 내용** |
|---|---|---|---|
| **Epic 1** | 프로젝트 설정 및 인증 | **전체 완료** | 모든 항목 ✅ 표시. 온보딩 플로우(OnboardingClient), DB 마이그레이션(01_balance_trigger, 02_onboarding_fields), 역할별 Route Groups 완료 명시. |
| **Epic 2** | 사용자 및 권한 구조 | **완료** | 온보딩 멀티스텝 역할 선택, AdminSidebar 모바일 햄버거 추가, 당사자/지원자/관리자 화면 분리 완료. |
| **Epic 3** | 예산 구조 및 시각화 | **완료(홈)/미완(SVG)** | budget-visuals.ts 7단계 + themeColor 완료. SVG 돈주머니 및 월별 추이 차트는 ⏳ 미완으로 표시. |
| **Epic 4** | 오늘 계획 비교 | **완료(기본)** | GPT-4o AI 추천 + PlanComparison 카드 완료. 선택지 점선 오버레이는 ⏳ 미완. |
| **Epic 5** | 사용 내역 관리 | **완료** | TransactionForm, 필터, CRUD, 잔액 트리거 완료 명시. |
| **Epic 6** | 영수증 OCR | **부분완료** | 업로드 + Storage 연동 완료. OCR actions/ocr.ts 존재, API 키 설정 및 E2E 테스트 필요. |
| **Epic 7** | 달력 및 평가 | **완료(달력)/보강필요** | TransactionCalendar 완료. 사진 썸네일 ⏳ 미완. EvaluationForm + AI 분석 완료. AI 로딩 UI 보강 필요. |
| **Epic 8** | 파일 링크 및 추천 | **완료(링크)** | file_links 테이블 + actions/document.ts 완료. AI 활동 제안은 plan.ts에서 부분 지원. |
| **Epic 9** | 접근성 및 검증 | **진행중** | useAccessibility 훅, ARIA roles 추가됨. Pretendard 폰트 로드 및 실기기 테스트 미완. |

---

## 6. 참고 자료

1. **목업 앱 배포 URL** — [https://www.perplexity.ai/computer/a/areumdeuriggumteo-gaeinyesan-g-MwSGZcj6RxGBmKnyyF.vUA](https://www.perplexity.ai/computer/a/areumdeuriggumteo-gaeinyesan-g-MwSGZcj6RxGBmKnyyF.vUA)
2. **GitHub 레포지토리** — [https://github.com/SWJoong/Personal_Budgets_App](https://github.com/SWJoong/Personal_Budgets_App)
3. **Pretendard CDN** — [https://github.com/orioncactus/pretendard](https://github.com/orioncactus/pretendard)
4. **Supabase Storage 문서** — [https://supabase.com/docs/guides/storage](https://supabase.com/docs/guides/storage)
5. **Next.js localFont** — [https://nextjs.org/docs/app/building-your-application/optimizing/fonts](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
