# Personal Budgets App — Claude Code 가이드

> **`claude/seoul-personal-budget-rebuild` 브랜치 작업 중이라면**: 아래 "데모 모드"(고정 UUID·쿠키
> 스푸핑)와 "데이터베이스 마이그레이션"(`supabase/migrations/`) 절은 이 브랜치에서 **적용되지 않습니다**.
> 이 브랜치는 실제 시드 계정으로 로그인하고(`src/app/actions/demoAuth.ts`), DB 는
> `supabase/seoul/`(코어 + 서울형 26테이블)이 정본입니다. 자세한 내용은 `supabase/seoul/README.md` 참조.

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
| AI | Claude (Anthropic) — 영수증 OCR·평가 요약 (`@anthropic-ai/sdk`, `src/utils/ai.ts`) |
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

## 데이터베이스 마이그레이션 (D0 컷오버 후 — 서울형 정본)

**정본 빌드**: `supabase/seoul/` — 순서대로 수동 실행:
`00_extensions → 01_core → 02_core_rls → 03_seoul_schema → 04_seoul_rls → 05_seoul_graph →
06_storage → 07_seed_program → 08_seed_demo`.
축B 온톨로지 분류축 `09_ontology_classification.sql`(03 program 확장과 세트)는 진행 중(PR #17).
실행 순서·대시보드 수동작업 상세는 [`supabase/seoul/README.md`](supabase/seoul/README.md).

**레거시**: 번호 마이그레이션 `supabase/migrations/04~31` 은 D0 컷오버(#16)에서
`supabase/migrations/_archive/` 로 이관 — **실행하지 않음**(이력·롤백 참조용). 신규 스키마 변경은
`supabase/seoul/` 빌드 SQL 로만 한다.

**검증(W 레인)**: `Plan&Source/ontology/seoul/verify_*.sql` (동작·RLS·그래프·copay·분류축 계약).
로컬 임시 PostgreSQL 또는 대시보드 SQL Editor 에서 실행.

**중요**: 모든 SQL 은 코드로만 생성하고 실제 실행은 **Supabase 대시보드 > SQL Editor** 에서 수동으로
합니다(로컬 `supabase db push` 미사용). seoul 빌드 파일은 전부 재실행 가능(idempotent).

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
| `NEXT_PUBLIC_SITE_URL` | 로그인 콜백 리디렉션에 사용하는 배포 도메인 |
| `SUPER_ADMIN_EMAIL` | 이 이메일은 첫 로그인 시 무조건 관리자로 지정 |
| `ALLOWED_EMAIL_DOMAINS` | 실무자로 자동 인식할 이메일 도메인(쉼표 구분). 미설정 시 아무도 자동 허용 안 됨 |
| `NEXT_PUBLIC_DEMO_MODE` | `"true"` = 데모 모드 활성화 (서울형 리빌딩 브랜치에서는 미사용) |
| `NEXT_PUBLIC_DEMO_LOGIN_ENABLED` | `"true"` = `/login`에 데모 계정 버튼 노출 (서울형 리빌딩 브랜치) |
| `ANTHROPIC_API_KEY` | Claude (영수증 OCR·AI 요약, 서버 전용). `src/utils/ai.ts` callAI 진입점 |
| `AI_MODEL_OCR` | (선택) OCR 모델 오버라이드. 기본 `claude-haiku-4-5` |
| `AI_MODEL_SUMMARY` · `AI_MODEL_SUGGEST` | (선택) 요약·활동제안 모델. 기본 `claude-sonnet-5` |
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

---

## 병렬 하네스 운영 중 (agent-sync) — W · U 2 인스턴스

이 프로젝트는 **2개**의 Claude Code 인스턴스가 병렬로 작업한다(자기 결과를 자기가 채점하지 않게 분리).
전체 계획·역할스킬 매핑·로드맵: **[docs/harness-plan.md](docs/harness-plan.md)**.

- **W** (Windows/개인): **설계·검증 축** — 역할스킬 `/pl` `/qa` `/ux-ui` `/pm` `/easy-read-review`
- **U** (Ubuntu/팀): **구현·배포 축** — 역할스킬 `/backend` `/frontend` `/devops`

### 레인 규칙 (충돌 방지의 핵심)
- **W만** 수정: `Plan&Source/`(온톨로지 설계 포함) · `supabase/**/verify_*.sql` · `src/**/*.{test,spec}.{ts,tsx}` · `src/test/` · `vitest.config.ts` · `.claude/skills/` · `docs/harness-plan.md` · 이 CLAUDE.md 하네스 섹션
- **U만** 수정: `src/`(테스트 제외) · `supabase/`(빌드 SQL·`migrations/`) · `src/types/database.ts` · `.github/workflows/` · 빌드설정 · `docs/release/` · `.claude/settings.json`
- 공유 `CLAUDE.md`: 하네스 섹션 = W 저작, 「현재 작업 현황」 = 양쪽 append, 그 외 구조변경 = U
- **main 직접 push 금지** — 코드는 항상 PR·CI 경유

### 상태 동기화 (복붙 없이)
- 세션 시작·재개: `bash scripts/agent-sync.sh pull` (SessionStart 훅이 자동)
- 핸드오프·턴 종료: `bash scripts/agent-sync.sh post <w|u> "진행·문제·다음 요청"`
- 전용 `agent-sync` 브랜치 = 상태 로그만. 코드 핸드오프는 PR·CI. 접두 `[HANDOFF→W]`·`[HANDOFF→U]`·`[SYNC]`.

### 매 세션 루틴 (토큰 절약)
1. `agent-sync.sh pull` — 상대 최신 상태만 로드(복붙·재설명 금지).
2. 아래 「현재 작업 현황」 + 채널 로그로 **내 다음 작업만** 파악.
3. `npm test && npm run build` — 전체 재검토 대신 게이트만.
4. **내 레인만** 착수. 턴 종료 시 `post`로 상태만.

### 하네스 역할별 지침
- **W(설계·검증)**: 실패하는 골든/계약 테스트·`verify_*.sql`로 스펙을 먼저 못 박고 → `[HANDOFF→U]` → U 초록 확인·리뷰(요구→타입→성능→보안→접근성→테스트)·easy-read·a11y → merge. U 레인 파일 직접 수정 금지.
- **U(구현·배포)**: 브랜치 생성 → 구현·마이그레이션 → push → `[HANDOFF→W]`로 검증 요청. 테스트·verify·온톨로지 설계 단독 변경 금지(W에 요청). main 직접 push 금지.

### 수동 작업 게이트 (Manual-Ops Gate) — 비가역·클라우드 작업 직전 사용자 브리핑
대시보드 SQL Editor 반영, Auth Provider/URL 설정, Storage 버킷, 프로젝트·리전 생성 등 **비가역·수동
클라우드 작업은 자동화하지 않는다**(프로젝트 규칙). 대신 그 **직전에** 담당 에이전트가 사용자에게 아래를
브리핑하고 **명시적 승인 후** 진행한다. 실행은 **사용자가** 한다 — 에이전트는 자격증명 입력·비가역 실행을
대신하지 않는다.
1. **진척 요약**: 무엇이 머지·검증(verify/CI green)됐는지.
2. **수동 절차 체크리스트**: 적용할 SQL 파일과 **정확한 순서**·각 단계 목적, 대시보드 비-SQL 작업.
   (정본: [`supabase/seoul/README.md`](supabase/seoul/README.md) 실행순서 + `docs/release/` 실행노트.)
3. **되돌림·리스크**: 실패 시 복구·데이터 영향·멱등성 여부.
→ 전제: CI 계약검증(`db-verify` · `Plan&Source/ci_db_verify_spec_W.md`)이 **green** 일 때만 이 브리핑을
올린다(초록 아닌 스키마를 수동 반영하지 않는다).

### 현재 작업 현황
<!-- 양쪽이 작업 시작/완료 시 갱신·push -->
- **활성(W)**: 축B(#17·#18·#20) 랜딩·verify PG15 green 확인 → verify CI 자동화 스펙 `[HANDOFF→U]`(`ci_db_verify_spec_W.md`) + 수동작업 게이트 컨벤션 신설.
- **활성(U)**: CI 게이트 정상화(`quality-check`+`db-verify` both required·`strict`) + main 브랜치 보호 + **lint blocking 승격**(선재 22건 정리) + 욕구사정 삭제=담당자 계약 초록화(#24). 실행노트 `docs/release/02`.
- **다음**: 지출↔분류축(`domain`/`subdomain`) UI 연결은 **W 백필 설계 확정 후** 착수(디자인 레인). GOAL축 A 잔여 화면은 W UX·easy-read 설계 후. copay 교차계층 계약 대기.
- **PRD 대조(U, 2026-08-28)**: 사용자 업로드 「서울형 리빌딩 PRD」 정합성 리뷰 완료 — `docs/release/03-prd-alignment-review.md`. 9장 그래프 시각화 등은 이미 구현·머지된 재발견, 가명처리·마스킹(7장)은 실제 공백으로 확인. W 판단 대기: ①가명처리 설계 착수 여부·우선순위 ②코디네이터 역할 세분화 여부 ③멀티테넌시 확장 가이드(GOAL축B3) 반영 여부.
- **U 병렬 오케스트레이션(U, 2026-09-04)**: U 축을 단일 직렬 세션 → **오케스트레이터 + worktree 격리 병렬 워커**로 승격(계정 한도 상향 활용). 저자(U)↔검증자(W) 분리·레인·PR/CI 불변, 병렬화는 저자(U) 내부 팬아웃뿐. 운영모델 `docs/release/04-u-parallel-orchestration.md` + 도구 `scripts/u-wave-plan.sh`([HANDOFF→U] PR을 파일겹침+STATE로 웨이브 편성, 이미구현/스펙 자동 스킵). 첫 실행: #83 P2토큰 → PR #89(green), #79·#80은 이미구현 판정으로 중복워커 중지. **U 구현큐 현재 비어있음** — W 신규 RED 계약 시 재편성 spawn.
