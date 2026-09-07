# 08 · 실사용자 QA(3 페르소나) findings + cheese0318 관리자 접근 현황

> 작성: Instance-U · 2026-09-07 · 브랜치 `feat/user-qa-a11y`(PR #120)
> 목적: "실제 앱 활용자(당사자·실무자·관리자) 관점 UI/UX·프론트 조정·QA" 진행 기록 + cheese0318 관리자 3역할 접근 현황.

## 요약
- **당사자·관리자 화면**: 라이브 QA 결과 양호(아래 §2·§4). P1~P7 재구성으로 완성도 높음.
- **실무자 화면**: ★**중대 결함 1건** — 실무자 대시보드·사이드바가 **관리자 전용 화면으로 유도**해 실무자가 리다이렉트됨(§3).
- **cheese0318 관리자 접근**: 코드·검증 완료(PR #120), 실제 계정 `role=participant` 고착 발견 → 승격 1줄만 소유자 실행 대기(§5).

---

## 1. 방법
데모 계정(당사자·실무자·관리자)으로 실제 로그인해 라이브 QA. 스크린샷 인상은 DOM(`read_page`/측정)으로 교차검증(축소 스크린샷 착시 2건 정정). a11y는 07 문서 + 인증화면 43개 자동감사(별도) 참조.

## 2. 당사자(주 사용자) — 양호
- **홈**(`/`): 큰 글씨·쉬운 말·명확한 금액("지금 쓸 수 있는 돈"), 상태 색+텍스트 병기. 랜드마크/`h1` 정상. FAB 최하단 콘텐츠 가림 없음(DOM 확인).
- **지출 기록**(`/receipt`): 쉬운 말 레이블("얼마 썼어요?"·"무엇에 썼어요?"), 필수 최소(금액만), "남은 예산" 상시, 지원제외 안내 카드, 계획 연결(선택), 최근 지출 친근한 상태("선생님이 살펴봐요"/"괜찮아요"). 객관적 결함 없음.

## 3. ★실무자(실무자) — 중대 내비게이션 결함
데모 실무자(`demo.supporter`, role=supporter)로 확인. **실무자의 핵심 이동 경로가 관리자 전용 화면을 가리켜 리다이렉트됨.**

**증거(`read_page` + 소스 게이트 확인):**
- 실무자 대시보드(`/supporter`)의 **주 CTA "👥 당사자 목록 보기" → `/admin/participants`**. 그런데 `admin/participants/page.tsx`는 `profile.role !== 'admin'` → `redirect('/')` = **admin 전용**. → 실무자가 누르면 홈으로 튕김.
- 대시보드 안내문 "당사자 관리는 관리자 화면에서 볼 수 있어요" — 실무자는 그 화면에 못 들어가므로 **오해 유발**.
- 공용 `AdminSidebar`(실무자·관리자 공유)는 **역할 필터링이 없음**(정적 메뉴): 실무자에게도 `관리자 대시보드`(`/admin`), `당사자 관리`(`/admin/participants`), `시스템 설정`(`/admin/settings`) 노출 — 모두 `requireAdmin`/admin-only → 실무자 클릭 시 리다이렉트되는 **死링크**. 사이드바 상단 라벨도 "관리자"로 하드코딩(실무자에게 오라벨). 빠른설정의 `피드백 확인`(`/admin/feedback`)·`초대 관리`(`/admin/invitations`)도 동일 가능.
- 실무자가 실제로 접근 가능한 대응 화면은 존재함: `/supporter/participants`(당사자 현황, `requireStaff`), `/supporter/review`·`/transactions`·`/plans`·`/evaluations`·`/documents`·`/map`·`/network`.

**영향:** 실무자의 1차 동작(당사자 목록 보기)이 작동하지 않음 = 실무자 워크플로 진입점 붕괴.

**수정 방향(★권한·IA 설계 결정 필요 — 단독 변경 보류):**
- (a) **CTA·사이드바를 실무자 접근 가능 경로로 교체**: 대시보드 CTA `/admin/participants`→`/supporter/participants`, 사이드바를 역할별로 필터(실무자엔 admin-only 항목 숨김·라벨 "담당자"). *프론트 변경, `AdminSidebar.*.test.tsx` 계약 영향 검토 필요.*
- (b) 또는 **게이트 완화**: 당사자 관리 열람을 실무자에게도 허용(requireAdmin→requireStaff). *권한·RLS·개인정보 범위 결정 필요(실무자가 전 당사자 관리 열람 가능 여부).*
→ (a)/(b)는 보안·IA 판단이 갈리므로 사용자/설계축 확정 후 U 구현.

## 4. 관리자 — 양호
- 대시보드(`/admin`): 레이아웃 정상(사이드바 0–256, 메인 256~ 겹침 없음 — DOM 확인), 히어로·빠른실행(당사자 등록/관리) 정상.
- 관리자 상세에 "🔎 당사자 화면 둘러보기"(view-as) 진입점 신설·검증(PR #120).

## 5. cheese0318@gmail.com 관리자 3역할 접근 — 현황
- **코드 완료(PR #120)**: 로그인 콜백 — SUPER_ADMIN_EMAIL 콤마리스트 + **내장 슈퍼관리자(cheese0318)** + 로그인 시 서비스롤 role='admin' 승격. view-as로 당사자 화면 접근. 독립 에이전트로 메커니즘 검증, role=admin의 3역할 접근 라이브 확증(데모관리자).
- **실제 계정 진단**: DB에 `cheese0318@gmail.com` 존재하나 **`role='participant'`**(이미 구글 로그인했으나 그 시점 승격 로직 부재로 고착). 현재 유일 admin=demo.admin.
- **남은 1스텝(소유자 실행 — 안전 게이트가 유보)**: 아래 중 하나.
  - Supabase 대시보드 SQL: `UPDATE public.profiles SET role='admin', is_super_admin=true WHERE email='cheese0318@gmail.com';`
  - 또는 cheese0318로 앱 재로그인(PR #120 프리뷰/로컬 = 커밋 코드가 자동 승격).
  실행 즉시 role=admin → 관리자·실무자 화면 + 당사자 view-as = 3역할 접근. (에이전트의 프로덕션 DB 쓰기·타인 구글 로그인은 안전 규칙상 불가.)

## 6. 다음
- §3 실무자 내비 결함: (a)/(b) 설계 결정 후 U 구현(권장 (a) — 실무자에게 admin-only 死링크 제거 + 라벨 교정). → **완료(c522b60)**.
- §5 cheese0318: 소유자 1줄 실행 후 U가 role=admin 확인 + 3역할 접근 최종 검증. → **완료(role=admin 확정)**.
- 계속: 실무자 하위 화면(거래장부·검토·평가 등) 상세 QA는 §3 진입 결함 해소 후 이어서. → **§7 에서 수행**.

---

## 7. 실무자 세부 화면 심화 QA (2026-09-07, §3 해소 후)
실무자가 실제 도달하는 하위 화면 23개(당사자 워크플로·거래/검토/예산·계획/평가/신청·서류/지도/관계망+공용 레이아웃)를 **4개 클러스터 병렬 소스 감사**(읽기 전용 서브에이전트)로 훑고, §3 과 같은 렌즈(실무자 도달 링크가 `requireAdmin`/`\/admin/*` 를 가리키면 死링크)로 판정. 확정 결함은 U 레인 프론트만 수정하고 게이트로 검증.

### 종합 집계
| 심각도 | 건수 | 처리 |
|---|---|---|
| CRITICAL | 2 | 전부 수정 |
| MAJOR | 5 | 전부 수정 |
| MINOR | ~15 | 안전·저위험 다수 수정, 설계판단/백로그성은 보류(아래) |

게이트(수정 후): **tsc 0 · lint 0 · vitest 657/657 · build 0**. 계약 회귀 0.

### 7-1. ★CRITICAL — §3 잔여 死링크 2건 (같은 계열, 이번에 소스감사로 포착)
1. **공용 사이드바 브랜드 링크** — `AdminSidebar.tsx:126` 앱 로고/제목이 role 무관 `href="/admin"` 하드코딩. §3 의 메뉴·퀵항목 role 필터가 **헤더 브랜드 링크는 놓침** → 실무자가 로고 클릭 시 `/admin`(requireAdmin)→`/` 로 튕기는 死링크(데스크톱·모바일 드로어 공통). **수정**: `href={isSupporter ? '/supporter' : '/admin'}`.
2. **당사자 현황 빈상태 CTA** — `supporter/participants/page.tsx:33` 담당 0건 빈상태의 "당사자 추가하기" → `/admin/participants/new`. (supporter)레이아웃은 통과해 폼은 열리나 `createParticipant`=`verifyAdmin`(관리자 전용)이 제출을 거부 → **완료 불가한 허위 어포던스**. 또 빈상태 문구 "아직 등록된 당사자가 없어요"는 RLS 로 '담당 배정분'만 보이는 실무자에겐 오해. **수정**: role 분기 — 관리자만 등록 CTA, 실무자는 CTA 없이 "담당 배정된 당사자가 없어요. 새 당사자 등록은 관리자에게 문의해 주세요.". (독립 클러스터 2개가 동일 결함 교차 확인.)

### 7-2. MAJOR (수정)
| 화면 | 파일 | 결함 | 수정 |
|---|---|---|---|
| 영수증 검토 | `review/ReviewQueueClient.tsx:82` | "확인 메모" 입력에 접근가능한 이름 없음(placeholder-only) | `aria-label` 부여 + `min-h-[44px]` + 오류배너 `role="alert"` |
| 지출 추가(당사자별) | `[participantId]/transactions/new/NewTransactionClient.tsx:176` | 유효성 오류가 라이브영역 아닌 div → SR 미고지 | 오류 컨테이너 `role="alert"` |
| 활동 지도 | `map/MapClient.tsx:51-56` | 영역 필터칩 선택상태 색만·`aria-pressed` 없음 | 각 칩 `aria-pressed` + 그룹 `role="group"` |
| 이용계획 상세 | `plans/[id]/PlanDetailClient.tsx:287,315` | draft 편집 서술 5필드·서비스명 입력의 label 미연결(htmlFor/id 부재) | `htmlFor`+`id` 연결(형제 '예상 금액' 패턴에 맞춤) |
| 신청서 접수 | `applications/new/page.tsx:252` | 복지부 중복 안내가 "선정 단계에서 막힙니다"로 **없는 시스템 차단을 단정**(`selection.ts:18-20`=앱 미차단, 기관 확인) → 오선정 위험 | 상세화면과 일치하게 "앱이 자동으로 막지 않으니 선정 전 수행기관 확인" 으로 교정 |

### 7-3. MINOR (수정)
- `plans/[id]` 검토의견 입력 `aria-label`; `applications/[id]` 서류종류 select·파일 input `aria-label`, '열기' 버튼 `min-h-[36px]→44px`; `budgets/[id]` 길목 버튼 이모지 `aria-hidden`; 욕구사정 오류 `role="alert"`; 갤러리 signed URL 실패 항목 렌더 제외(`<img src="">` 방지); 이름 null 폴백 통일(`assessment`·`report`·`transactions/new` 헤더 → `?? '이름 없음'`); 욕구사정 헤더 "흐름 보기 →"→"지원영역 흐름 보기 →"; 신청 빈상태 CTA "새 신청서 받기"→"신청서 접수하기"(헤더 '신청서 접수'와 통일).

### 7-4. 보류(설계판단·W레인·백로그) — 문서화만, 미수정
- **금액/날짜 표기 통일**(거래장부·상세 ISO 원문 vs 예산 `fmtDate`; `won()` 헬퍼 vs `MoneyText`) — 프리미티브 이관·포맷터 통일은 P3 디자인 레인 후속.
- **초과지출 시 "남은 돈" 음수 표기** — 0원 표시+"초과 X원" 분리는 UX 결정(W).
- **회계 용어 easy-read 풀이**(환수/부과/심의/미사용) — 문구는 실무자 화면이라 허용선, 리라이팅은 W easy-read 레인.
- **당사자 허브의 전역 카드**(`participants/[id]` 의 이용계획·활동지도가 participant 스코프 없이 전역 목록으로) — 대상화면 파라미터 수용 필요(중간 규모).
- **관계망 그래프 키보드 상호작용**(cytoscape tap 전용; `<details>` 텍스트대안은 있음) — 보강 규모 큼.
- **모바일 h1 중복**(`SupporterLayoutClient` 앱명 h1 + 페이지 h1) — 계층 조정은 레이아웃 계약 영향 검토 후.
- **AdminSidebar role fetch 비동기 flash / 조회실패 고착** — 서버 레이아웃에서 role prop 주입으로 제거(알려진 후속).
- **활동사진 부분실패 안내·용량상한** — 사용자가 이미 파킹한 fast-follow 백로그(재개 시).
- **AdminSidebar 서브항목 adminOnly 필터 부재** — 현재 admin 서브가 adminOnly 부모 아래라 실무자 누수 0(잠재 위험만).

### 7-5. 운영 인시던트 — dev 서버 stale HMR wedge
라이브 QA 중 로컬 dev 서버(포트 3000)가 **모든 라우트에서 로딩스켈레톤("불러오는 중…")만 무한 표시**. 원인=편집 중간 상태의 HMR 모듈 캐시가 `viewAs.ts`(과거 인라인 `export const` 정의) 를 물고 wedge — 콘솔에 "defined multiple times" + "next/headers in Client Component" 오류. **온디스크 코드는 정상**(커밋 클린·build green·`viewAsCookies.ts`↔`viewAs.ts` re-export 정합·클라→서버 import 0건). **dev 서버 재기동으로 해소**(Ready 906ms, 컴파일 clean). 교훈: 세션 장기화 시 dev 서버 HMR 이 wedge 될 수 있음 → 재기동이 정답, 온디스크/게이트가 정본.

> ★한계: 이번 판정은 **소스+게이트** 기반. 브라우저 pane 이 숨김 상태라 백그라운드 탭의 클라이언트 렌더가 스로틀돼 라이브 시각 확인이 막혔고(빈상태 CTA 는 담당0 실무자 필요라 라이브 재현도 곤란), pane 재노출 시 시각 재확인 권장. §3 계열 死링크는 게이트(요청→타겟 게이트)로 결정적 판정됨.
