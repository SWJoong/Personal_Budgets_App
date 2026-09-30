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

**보안 검증 체크(w-verifier·verify-pr 공통)**: RLS 스코프(당사자·담당 실무자·관리자) · `createAdminClient` 사용 전 인증·역할 확인 · Storage 경로 위조(서버가 접두를 강제) · view-as 읽기전용 우회(예외 env `TEST_PARTICIPANT_ID`·`TEST_USER_EMAIL` 만) · 감사 기록 누락 · AI 전송 전 이름 가림(가명처리) · 서비스 롤 키 노출.

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

**정본 빌드**: `supabase/seoul/` — 순서대로 수동 실행(`supabase/seoul/README.md` 「실행 순서」 기준):
`00_extensions → 01_core → 02_core_rls → 03_seoul_schema → 04_seoul_rls → 05_seoul_graph →
06_storage → 07_seed_program → 09_ontology_classification → 10_fk_ization → 11_provider_domains →
12_audit_log → 17_participant_feedback → 18_sis_assessments → 19_plan_feedback → 20_evaluations`.
- `13~15` 는 결번(관계망/Track B 제거 #171 — 라이브 드롭은 `_drops/2026-09-19_drop_network.sql`).
- 데모용(운영 제외): `scripts/seed-demo-auth.mjs`(터미널) → `08_seed_demo.sql` · `16_seed_documents_demo.sql`(선택, 08 이후).

실행 순서·대시보드 수동작업 상세는 [`supabase/seoul/README.md`](supabase/seoul/README.md).

**레거시**: 번호 마이그레이션 `supabase/migrations/04~31` 은 D0 컷오버(#16)에서
`supabase/migrations/_archive/` 로 이관 — **실행하지 않음**(이력·롤백 참조용). 신규 스키마 변경은
`supabase/seoul/` 빌드 SQL 로만 한다.

**DB 계약 검증(W 레인 파일 — `harness:w-contract-author` 저작, CI `db-verify` 가 실행)**: `Plan&Source/ontology/seoul/verify_*.sql` (동작·RLS·그래프·copay·분류축 계약).
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
- **검증 체크(w-verifier·QA 공통)**: 키보드 도달 · 포커스 생존(재마운트·달 이동·모달 복원) · 접근 가능한 이름 · 라이브 영역 단일 채널(같은 문구 재안내는 새 노드, 보이는 상자는 live 아님) · 포커스 표시(`:focus-visible` 링 유지 · `outline-none` 단독 금지 · 링 대비 3:1, 테마별) · 대비 4.5:1 · 터치 44px · `jsx-a11y` 오류 0 · 당사자 노출 문구 easy-read ≥ 70

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
| `TEST_PARTICIPANT_ID` | (선택·테스트용) 이 `participants.id` 를 관리자 둘러보기(view-as)로 볼 때만 화면설정 등 저장을 허용한다(읽기전용 예외). 지정한 그 당사자 1명에게만 열리고 나머지 실참여자는 계속 읽기전용. 미설정 시 모든 view-as 는 읽기전용. **테스트/프리뷰 환경에만 설정**(운영 미설정 권장). `src/utils/supabase/viewAs.ts` |
| `TEST_USER_EMAIL` | (선택·테스트용) **전체 편집 테스트 계정** 지정. 이 이메일 계정(★관리자 role 이어야 view-as 가능)으로 로그인 중이면 관리자 둘러보기(view-as)에서 **어느 당사자든** 저장/편집이 허용된다 — 영수증·활동사진 추가·화면설정 등 당사자 뮤테이션 전반. `TEST_PARTICIPANT_ID`(당사자 1명 예외)의 **계정 단위** 버전. 오직 그 이메일 1개만 열리고 다른 관리자·실참여자는 그대로 읽기전용. 미설정 시 무변화. 셋업: ①그 이메일로 회원가입 ②관리자 role 부여(`SUPER_ADMIN_EMAIL` 또는 `/admin/users`) ③이 env 설정. **테스트/프리뷰 전용**(운영 미설정 강력 권장 — 전체 편집 우회 계정). `src/utils/supabase/viewAs.ts` |
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

## 병렬 하네스 운영 (agent-sync) — 단일 계정 · W/U = 역할

한 계정의 **오케스트레이터 세션(U)** 이 서브에이전트로 **W(설계·검증)·U(구현·배포) 두 역할 컨텍스트를 분리 실행**한다
(자기 결과를 자기가 채점하지 않게). **사람 자리(W)** = QA · PR 머지 승인 · 제품/UX 결정 — 어느 세션·머신에서든.
정본: `.claude/harness.json`(레인·게이트·티어) · 플러그인 `harness`(에이전트·훅·워크플로 — `claude plugin list`) ·
[docs/harness-plan.md](docs/harness-plan.md) v2(근거·절차·§10 전환 기록) · [docs/release/18](docs/release/18-single-account-operating-model.md).
2026-09-27 이전의 2계정(Windows W / Ubuntu U) 모델은 역사다.

### 역할 지도 (누가 무엇을)
| 역할 | 실행 주체 | 편집 범위 | 검증 규칙 |
|---|---|---|---|
| 오케스트레이터(U 세션) | 사용자와 대화하는 메인 컨텍스트 | 공유·인프라·`docs/release/` + **소규모 예외**(W 레인은 훅이 묻는다) | 자기 PR 사인오프 금지, 검증은 위임 |
| `harness:u-worker` | sonnet · worktree · background · 스킬 backend/frontend · user 메모리 | U 레인만(훅 차단) | 계약을 초록으로만 |
| `harness:w-contract-author` | opus · worktree · background · 스킬 qa·pl·easy-read-review(roleSkills.w) · user 메모리 | W 레인만(훅 차단) | RED·그린어빌리티·tsc 확인 |
| `harness:w-verifier` · `/harness:verify-pr` | opus · Edit/Write 불가 · 스킬 qa/pl/easy-read-review | 없음 | 티어별 독립 검증 리포트 |
| **사람 자리(W)** | 사용자 | 전부(권위) | QA · 머지 승인 · 결정 |

핵심 규칙: **같은 기능의 구현과 계약을 한 컨텍스트가 함께 쓰지 않는다.** 오케스트레이터가 구현을 직접 썼다면 그 기능의 계약·검증은 반드시 위임한다.

### 레인 규칙 (충돌 방지의 핵심 — `.claude/harness.json` 과 1:1)
- **W 레인** → `harness:w-contract-author` 컨텍스트만: `Plan&Source/**` · `**/verify_*.sql` · `src/**/*.{test,spec}.{ts,tsx}` · `src/test/**` · `vitest.config.ts` · `.claude/skills/**` · `docs/harness-plan.md`.
  오케스트레이터는 소규모 예외(경로·주석·오타·현황)만 직접 — 플러그인 훅이 확인을 묻는다.
- **U 레인**(그 외 `src/` · `supabase/` 빌드 SQL·`migrations/` · `src/types/database.ts` · `.github/workflows/` · 빌드설정 · `docs/release/`) → `harness:u-worker` 컨텍스트.
  오케스트레이터가 직접 구현하면 그 기능의 계약·검증은 위임한다.
- **공유·인프라**(`CLAUDE.md` · `AGENTS.md` · `.mcp.json` · `.claude/harness.json` · `.claude/settings*.json` · `.claude/agents|workflows|commands/**` · `.github/pull_request_template.md` · `scripts/agent-sync.sh` · `docs/release/decisions.md` · `docs/release/qa-runs/**` · `.claude/agent-memory/**`) → 오케스트레이터·사람만(양쪽 워커 훅 차단).
- **에이전트 메모리**(`.claude/agent-memory/<에이전트>/`): 각 에이전트는 **자기 폴더만** 쓴다(플러그인 ≥ 0.4.0 — `harness.json` `plugin.minVersion` 값은 설정 계약이 강제하고, 실제 설치본 버전은 「매 세션 루틴」의 호출 경로 줄처럼 `installed_plugins.json` 으로 확인한다). 메모리는 **로컬 전용**이다(D-20260928-03): `.claude/agent-memory*/` 는 `.gitignore` — 검증자(project 범위)는 메인 체크아웃에만 쌓이고, `harness:u-worker`·`harness:w-contract-author` 는 `memory: user`(`~/.claude/agent-memory/`, 프로젝트 공통이므로 프로젝트 고유 경로·비밀 대신 일반 교훈만). 커밋은 경로를 지정해 `git add` 한다(`git add -A` 금지 — #199 에서 검증자 메모리 6개가 섞였던 사례). 검증자 메모리는 검증자만 쓴다 — 오케스트레이터가 정리할 때는 사용자 확인 후.
- 가드가 막는 것: 워커의 Edit/Write(플러그인 `lane-guard.sh` — 대상 파일이 속한 worktree 의 `harness.json` 기준, 워커는 자기 worktree 밖 편집 불가, 설정 없으면 기본 레인·설정 깨지면 차단). 못 막는 것: Bash 편집(규율로 금지). **main 직접 push 금지** — 코드는 항상 PR·CI 경유(훅이 다시 묻는다).
- 서브에이전트의 격리 worktree 는 origin/main 기준으로 생기므로 **`harness.json` 이 main 에 머지돼 있어야** 워커가 이 레인의 보호를 받는다.

### 상태 동기화 (agent-sync = 저널 + 사람 자리 기록)
- `u.md` = 오케스트레이터 저널·다음 세션 인계문(턴 종료·웨이브 취합 시 `post u` 1건). `w.md` = 사람 자리 기록(머지·QA·결정, 어느 머신에서든 `post w`).
  U 세션이 사람 행위를 대신 올릴 땐 `[DECISION by user]`·`[QA by user]`·`[MERGED by user]` 접두 필수(헤더에 "via U").
- 세션 시작 시 플러그인 훅이 `pull` 을 자동 실행한다(`bash scripts/agent-sync.sh pull` 로 수동 가능). 채널엔 상태만, 코드는 PR·CI.
- 접두: `[HANDOFF→W]` = 검증 요청(w-verifier / `/harness:verify-pr` 대상 + 사람 머지 대기) · `[HANDOFF→U]` = 계약 PR(draft, 구현 대기, 단독 머지 안 함) · `[SYNC]` = 상태·문서.

### 매 세션 루틴 (토큰 절약)
1. `pull`(자동) — `u.md` 인계문 + `w.md` 사람 자리 기록만 로드. 이전 결과 복붙·재설명 금지.
2. 아래 「현재 작업 현황」 + `docs/release/14` 백로그로 다음 작업 확정. 결정이 필요하면 AskUserQuestion(옵션 프레이밍) — 서브에이전트는 묻지 않고 플래그만.
3. 열린 PR 의 티어·검증 리포트·BEHIND 점검(`gh pr list`). 머지 준비된 것은 브리핑.
4. 착수: 계약 선행이면 `harness:w-contract-author` → 플러그인 `wave-plan.sh` 로 서로소 웨이브 → `harness:u-worker` × N(한 메시지에서 동시) → 티어별 검증 → 머지 브리핑.
5. 턴 종료: `post u` 1건. 사람 자리 행위가 있었으면 `post w`.
게이트: 계약 단건 `npx vitest run <파일>` → 전체 `npx tsc --noEmit && npm run lint && npm test && npm run build`. `/harness:operate` 가 이 루틴을 안내한다.
플러그인 스크립트(`wave-plan.sh`·`pr-risk-tier.sh`·`pr-merge-gate.sh`·`qa-run.sh`) 호출 경로: `H="$(jq -r '.plugins["harness@harness"][0].installPath' ~/.claude/plugins/installed_plugins.json)/scripts"` 후 `bash "$H/pr-merge-gate.sh" N check`. 설치본 버전은 `harness.json` `plugin.minVersion` 이상이어야 한다(설치본은 캐시 사본 — 개발 폴더 편집은 version bump·`claude plugin update` 전까지 반영되지 않는다).

### 검증 티어 (머지 전 요구 검증 — 정본 `.claude/harness.json` `tiers`)
| 티어 | 조건(하나라도 해당하면 상위) | 검증 | 머지 |
|---|---|---|---|
| **T0 docs** | 변경이 `docs/**`·`*.md` 뿐 — 단 gate 군의 규칙 파일은 `.md` 여도 high | CI + 사람 읽기 | 사람 승인 |
| **T1 small** | 코드 ≤ 12파일·≤ 400줄, 고위험 경로 없음 | `harness:w-verifier` 1건(돌연변이 포함) | approve + 사람 승인 |
| **T2 high** | rls(`supabase/**/*rls*.sql` + 정책·뷰·가드 트리거를 가진 빌드 SQL `01`·`03`·`05`·`06`·`09`·`11`·`12`·`17`~`20`) · auth(`src/proxy.ts`·`(auth)/`·`src/app/api/**`·view-as·view-as 쓰기 차단 액션·`src/utils/supabase/**`·데모 계정 시드 스크립트) · privacy(`deidentify*`·`ai.ts`·OCR·요약·제안·처리방침·`vercel.json` 리전) · audit(`audit*`·감사 기록 액션·supervision) · money(정산·거래·copay·ruleCheck·내보내기) · storage(활동사진·서류·신청서 업로드·갤러리·`src/utils/supabase/storage.ts`) · gate(CI·settings·harness.json·에이전트/워크플로/명령/스킬/에이전트 메모리·CLAUDE.md·AGENTS.md·`.mcp.json`·harness-plan·PR 템플릿·agent-sync — `.md` 여도) · SQL diff 에 POLICY/DEFINER/GRANT/FUNCTION/TRIGGER·`WITH CHECK`·`USING (`·`security_invoker`·`auth.uid()`·`RAISE EXCEPTION`(대소문자 무시) · 대형(> 12파일 또는 > 400줄) · 당사자 문구(`participantCopyGlobs` 경로에 한글 문구가 추가될 때 — 접근성 동작만 바꾼 변경은 계산상 small 이지만 PR 템플릿대로 선언은 high 로) | `/harness:verify-pr N` 팬아웃(에이전트 2 + 렌즈 × (1 + 반박자), 현재 설정 17) | approve(-with-conditions 해소) + 사람 승인 |
- 판정 정본은 `.claude/harness.json` `tiers`(플러그인 `pr-risk-tier.sh <PR>` 가 계산) — 위 표는 요약이다. 티어는 PR 본문 `- 검증 티어:` 에 `docs`·`small`·`high` 중 한 단어로 선언하고 게이트가 선언·계산 중 높은 쪽을 적용한다. **계산 티어 아래로 내리는 수단은 없다** — 계산이 과하면 `.claude/harness.json` `tiers` 를 고치는 PR(gate 티어)로 조정한다(채널·결정 로그 기록으로는 내려가지 않는다). 계약 PR(`[HANDOFF→U]`)은 티어 대상이 아니다.
- src 를 바꾸지 않는 문서·설정 PR 은 돌연변이 검증 대신 **설정 계약**(`src/test/harnessConfig.test.ts`: harness.json ↔ CLAUDE.md 레인·티어 정합)으로 조인다.
- 재검증은 `/harness:verify-pr N --lens <렌즈>` 로 생존 finding 이 있던 렌즈만(전체 재실행 금지).

### 사람 자리(W) 절차 — U 세션에서도 수행
- **머지**: CI green(`quality-check`·`db-verify`) · 검증 리포트(`VERIFY-REPORT` 코멘트의 head = 현재 head) · Manual-Ops 목록 확인 → 오케스트레이터 브리핑 →
  **PR 1건·head 1개당 사용자 승인 1회**(AskUserQuestion) → 플러그인 `pr-merge-gate.sh N merge --approved-by "user via U <시각>"`(승인 코멘트 → BEHIND 면 update-branch·CI 재확인 → head 검증 → squash 머지(+head 브랜치 삭제) → 계약 PR 닫기 → `post u [MERGED]`; 훅이 한 번 더 묻는다) →
  `post w "[MERGED by user] #N …"`. `--admin`·일괄 승인·auto-merge 금지.
  **스택 PR**: 게이트 `merge` 를 실행하기 **전에** `gh pr list --base <머지할 PR 의 head 브랜치>` 로 의존 PR 을 찾아 `gh api -X PATCH repos/{owner}/{repo}/pulls/<의존PR> -f base=main` 으로 재타깃한다 — 게이트는 squash 와 함께 head 브랜치를 지우고, 그러면 의존 PR 이 자동으로 닫힌다(#198 사례). 계약 PR(`[HANDOFF→U]`)은 게이트가 내용 병합 후 닫으므로 재타깃하지 않는다.
- **QA**: 사람이 실행, 오케스트레이터가 준비(체크리스트 `docs/release/16`·프리뷰·재현 절차)와 기록 — `docs/release/qa-runs/` + `post w "[QA by user] …"`. 브라우저는 관찰·증거 수집만.
- **결정**: 결정 질문은 오케스트레이터만 → AskUserQuestion → 3곳 기록: `docs/release/decisions.md` 행 · 「현재 작업 현황」 결정 확정 줄 · `post w "[DECISION by user] …"`. 수렴 프로토콜(STATUS PROPOSE/AGREE/FINAL)은 폐기.

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
<!-- 오케스트레이터가 갱신 · 사람 자리 기록은 agent-sync w.md · 2026-08-19~09-20 이력은 docs/release/18 부록 A 로 이관 -->
- **★현행 스냅샷(2026-09-29)**: main = `4b0aa72`(#199). 백로그 정본 =
  `docs/release/14-prd-reprioritization.md` 「현행 백로그 (2026-09-27 재점검)」(담당별·우선순위).
  - **완료(재착수 금지, 2026-09-20 이후)**: #175 요약 대리인 이름 치환 + `participant.preview` 감사 · #176 `/admin/audit` ·
    #177 TTS `SpeakButton`(홈 잔액·이용계획) · #178 쉬운 용어 사전+`<Term>`('이용계획') · #179 `/admin/insights` KPI A~C ·
    #180 모니터링 수정·삭제 · #181 `/admin/supervision` · #182 월간 보고서 인쇄 v1 · #183 계획 가벼운 피드백 ·
    #184 `TEST_USER_EMAIL` · #185 실무자 기존 지출 사진 추가 · #186 국외이전 결정메모(doc15) · #187 기능 QA 체크리스트(doc16) ·
    #188~#191 영수증검토 추가·거래장부/정산 표·평가 아코디언+월별 양식. 지출↔분류축 UI 는 #39 로 이미 완료(옛 '다음' 줄 stale).
  - **라이브 반영(사용자 Manual-Ops)**: `12_audit_log`(2026-09-21)·`19_plan_feedback`(2026-09-21)·`20_evaluations`(2026-09-26, 카탈로그 32/32).
    **미확인**: 감사 파기 pg_cron 등록(`0 18 * * *` UTC = KST 03시, `docs/release/12` §4) · 활동사진 04 RLS·03 경로 트리거(`docs/release/06` §2).
  - **결정 확정**: 감사 접속기록 보존 730일(2026-09-22) · Supabase 리전 `ap-northeast-2` 서울 → 저장 국외이전 면제(2026-09-23) ·
    계획 공유 = 가벼운 피드백(a)(→#183) · 단일 계정 운영 모델·플러그인화(D-20260927-02~06, D-20260928-01/02) · 에이전트 메모리 로컬 전용(D-20260928-03) · #199 조건 수용 머지(D-20260929-01) · main 보호 enforce_admins 켜기(D-20260929-02, 2026-09-29 적용). 결정 정본 = `docs/release/decisions.md`.
  - **머지(2026-09-27)**: #192(처리방침 사실 정정 + 쉬운말 요약 당사자 이름 가림 결함 수정 — `profiles` 오조회로 #73 이후 미마스킹) ·
    #193(AI 생성물 공통 라벨 `AiNotice` + OCR 자동채움 표시) · #194(지출 기록 성공 안내) · #195(상태 기록 정리) · #196(Phase C 계획서 보관).
  - **머지(2026-09-28)**: #197(하네스 코드화 — 에이전트 3종·lane-guard·`/verify-pr`, 같은 날 플러그인으로 이전) · #200(copay TS↔DB 상태값 패리티 골든 — P3) · #201(2026-09-29, 터치타깃 44px·장식 이모지 aria-hidden 재반영 + 사이드바 하위메뉴 토글·더보기 스위치).
  - **다음(결정·확인 선행)**: 기관 = AI API 국외이전 근거(OCR A안/국내/제거 · 요약·제안 B안)·처리방침 확정값·Supabase DPA 서명·Vercel
    Analytics 수집범위/DPA · 사용자 = pg_cron·활동사진 RLS 라이브 확인·실사용자 심사·기능 QA(doc16)·정산 실무자 허용·KPI D.
  - **다음(U 코드, 결정 불요)**: 쉬운말 `<Term>` 확대(`plan/page.tsx`)·지출기록 TTS·`receipt.view` 반복 기록 축소·감사 `target_participant_id` 누락.
  - **운영 모델(2026-09-27 정식화)**: 단일 계정 · W/U = 역할 컨텍스트 · 사람 자리(W) = QA·머지·결정 — 위 「병렬 하네스」 섹션과 `docs/release/18`. 홈 지시서·메모리 갱신은 머지 후 체크.
  - **하네스 코드화(#197, 머지 2026-09-28)**: 에이전트 3종·레인 가드·`/verify-pr` 워크플로·역할 스킬 정정 — `docs/release/17`. 그 런타임은 아래 플러그인으로 이전됐다(doc18).
  - **머지(2026-09-29)**: #199(단일 계정·역할 분리 운영 모델 v2 + 플러그인 이전, 조건 수용 — 후속 보통 5건은 doc18 §9) · 플러그인 `harness` 0.4.0(SWJoong/claude-harness#1).
  - **단일 계정 전환 + 플러그인화(U, 2026-09-27 → 머지 2026-09-29)**: 하네스 런타임을 플러그인 `harness`(에이전트·훅·워크플로·스크립트)로 추출, 저장소엔 `.claude/harness.json` 만. 로컬 사본(`.claude/agents`·`workflows`·`lane-guard`·`u-wave-plan`) 삭제, `settings.json` 훅 제거, PR 템플릿·결정 로그·QA 기록 규약 신설 — `docs/release/18`. 이전 현황 이력(08-19~09-20)은 doc18 부록 A.
