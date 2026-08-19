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

### 현재 작업 현황
<!-- 양쪽이 작업 시작/완료 시 갱신·push -->
- **활성(W)**: 하네스 설치 완료 → copay 계약테스트 `[HANDOFF→U]` + 온톨로지↔서울형 정합성 검증 착수
- **활성(U)**: `.claude/settings.json` 훅·`scripts/` 커밋·`docs/release/` 스캐폴드 + 통합 base 정리
- **다음**: 통합 base(`db-ontology-rdf-format`) → main (D0: seoul 정본 전환) → 22 스텁 재구현
