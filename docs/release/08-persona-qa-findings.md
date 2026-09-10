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

---

## 8. W 결정 대기 큐 (실무자 QA 보류분 핸드오프)
§7-4 의 보류 항목을 **W(설계·검증 축) 결정 대기 큐**로 정리한다. U 는 확정 결함(CRITICAL/MAJOR/안전 MINOR)만 이미 반영했고(§7-1~7-3), 아래는 **디자인·easy-read·IA·권한 판단이 갈려 U 단독 변경을 보류**한 것들이다. W 가 방향을 정하면(필요 시 RED 계약/verify 또는 easy-read·a11y 스펙) U 가 초록화한다.

| # | 항목 | W 모자 | W 가 정할 것 | 승인 시 U 작업 | 규모/리스크 |
|---|------|--------|--------------|----------------|-------------|
| 1 | **금액/날짜 표기 통일** — 거래 상세·원장이 `usage_date` ISO 원문(`transactions/[id]/page.tsx:67`, `OrgLedgerClient.tsx:114,137`) vs 예산은 `fmtDate`("2026.08.15"); 검토 화면은 지역 `won()`(`ReviewQueueClient.tsx:18`) vs `MoneyText` | /ux-ui (P3 프리미티브) | 공용 날짜 포맷 확정 + `MoneyText` 전면 적용 여부 | 공용 포맷터/`MoneyText` 로 치환(tabular-nums·부호 비색큐 흡수) | 소~중 (다수 파일, 골든 영향 확인) |
| 2 | **초과지출 시 "남은 돈" 음수 표기** — `budgets/[id]/page.tsx:127` `remainingTotal=allocated-usedTotal` 이 음수면 "-12,345원"(경고문·danger 는 병기됨) | /ux-ui + /easy-read-review | 음수 그대로 vs "0원 + 초과 X원 별도 표기" | budgets 표시 로직 분기 | 소 |
| 3 | **회계 용어 easy-read 풀이** — 환수/부과/심의 메모/미사용 등(`OrgLedgerClient.tsx:24,31`, `budgets/[id]/page.tsx:52,311`, `EvaluationClient.tsx:192`) | /easy-read-review | 실무자 화면 용어를 풀이/툴팁/유지 중 택 | 괄호풀이 또는 툴팁 병기 | 소 |
| 4 | **당사자 허브의 전역 카드** — `participants/[id]/page.tsx:79,85` '이용계획·심의'·'활동 지도' 카드가 participant 스코프 없이 전역 목록으로 이동(다른 카드는 pid 포함) | /ux-ui + /pl | 대상화면이 `?participant=` 수용할지 vs 카드에 '전체' 명시 | 링크 파라미터화 + 대상화면 필터 수용 | 중 (다수 화면) |
| 5 | **관계망 그래프 키보드 상호작용** — `NetworkGraphClient.tsx:154-165` 노드 선택이 cy `tap` 마우스/터치 전용(`<details>` 텍스트대안은 있어 완화) | /ux-ui + /qa(a11y) | 노드 상세를 키보드 포커스 리스트로 보강할 범위 | 선택노드 패널/리스트를 포커스 가능화 | 중~대 |
| 6 | **모바일 h1 중복** — `SupporterLayoutClient.tsx:74` 앱명 `<h1>` + 각 페이지 `<h1>` → 모바일 h1 2개(main 중첩은 이미 회피됨) | /ux-ui + /qa(a11y) | 앱명을 `<p>/<span>` 강등 vs 페이지 h1 조정 | 헤딩 계층 조정 | 소~중 (P4/P6 계약 확인 필요) |
| 7 | **활동사진 부분실패 안내·용량상한** — `NewTransactionClient.tsx:154` `addActivityPhotos` 반환 미검사, `:118` 활동사진 크기검증 없음(영수증은 5MB) | (이미 **사용자 파킹**) /pl 우선순위 | fast-follow 재개 여부 | 반환 오류 토스트 + 장당/합계 용량 가드 | 소~중 |
| 8 | **AdminSidebar 서브항목 adminOnly 필터**(잠재) — top-level 만 필터, 서브는 미필터(현재 admin 서브가 adminOnly 부모 아래라 **누수 0**) | /qa | 방어적 `filter(s=>!s.adminOnly)` 추가 여부 | 서브 렌더에 필터 1줄 | 소(무해) |

**진행 규약**: 각 항목은 착수 시 W 가 계약/스펙(또는 easy-read·a11y 판정)을 못 박고 `[HANDOFF→U]` → U 구현 → W 검증 → merge (프로젝트 test-first 사이클). 死링크·접근성 확정분(§7-1~7-3)은 이미 PR #120 반영(커밋 134eb24·9d364ba).

### 8-1. 처리 경과 (2026-09-08 · 사용자 지시로 ②③ 착수)
- **② 초과지출 음수잔액 — 구현 완료**: `budgets/[id]/page.tsx` 봉투 "남은 돈"을 초과 시 음수(-12,345원)로 보이지 않고 **0원으로 클램프**, 초과분을 `초과 X원`(danger)으로 **분리 표기**(기존 경고문 "배정된 돈보다 많이 썼어요."와 병기). 경계값(정확 소진=배정→초과 아님·0원, 배정 0·지출>0→0원+초과)은 strict `>` 로 안전. **독립 서브에이전트 검증 PASS**(구현≠검증). PR #120 이 커밋.
- **⑨ 영역별 카드 음수잔액 — 구현 완료(사용자 지시로 이어서)**: 같은 화면 **영역별 카드**의 "남은 돈"(`r.remaining`)도 봉투와 동일하게 `Math.max(0, r.remaining)` 클램프 + 초과 시 `초과 X원`(danger, `-r.remaining`) 분리(기존 상태칩 over·"계획 밖"과 병기). ②와 동일 패턴이라 봉투 독립검증(경계 strict·회귀)을 승계. 이로써 봉투·영역별 음수잔액 표기 통일.
- **③ 회계 용어 — '유지' 결정(W 분리 정합)**: `p7CopyWave1`(당사자 문구 계약)이 **당사자 화면만** easy-read 하고 **실무자 화면엔 전문용어(환수·부과·심의)를 의도적으로 유지**함을 확인(계약 FILES=당사자 파일 한정, forbid 규칙도 당사자 파일에만 적용). → 사용자 결정 **"실무자 화면 유지"**. 실무자 화면(거래장부·예산·정산) 무변경. 대신 **당사자 방화벽 재확인**: `(participant)` 트리·당사자 대면 공용 컴포넌트에 환수/심의/부과 **누수 0건**(p7CopyWave1 green + 교차 grep 실측). ③ **종료(의도적 유지)**.
- **① 금액/날짜 표기 통일 — 구현 완료(사용자 지시)**: 실무자 "돈" 화면 11개(거래장부·상세·검토·정산·예산·지도·설정)에서 지역 `won()` 6종 제거 → **JSX 금액=`MoneyText`(정본 프리미티브)·문자열 금액=`formatCurrency`**(option/템플릿/info색 보존 3곳); **날짜=신규 공용 `src/utils/formatDate.ts`**("2026.08.15", 13개소, budgets 지역 `fmtDate` 흡수). 자매 화면 관례대로 **sign=none + 현재 색 보존 emphasis** 선택 → 렌더 문자열·색 불변(vitest 657/657=골든 무회귀, tsc0·eslint0·build0). 함정 3건(정산기간 범위형·date input 폼값·계획밖 info색) 보존 확인. 독립 조사 서브에이전트 edit-map 기반. PR #120.
  - 후속(스코프 밖): 당사자 화면 `won()`(홈·달력·평가·my-plan·영수증)도 MoneyText 통일 — **완료**(아래 §8-2, 2026-09-09).
- **⑥ 모바일 h1 중복 — 구현 완료(사용자 지시)**: 실무자 셸의 앱 브랜드명을 heading→비-heading(span) 강등. `SupporterLayoutClient` 모바일 상단바 `<h1>`→`<span>`(모바일 h1 2개 중복 제거), `AdminSidebar` 브랜드 `<h2>`→`<span className="block">`(데스크톱 h2-before-h1 계층 역전 제거). 근거=앱명은 고정 크롬(브랜딩)이지 페이지 주제 heading 아님 → 각 페이지 `<h1>`(raw·PageHeader·자식 컴포넌트)이 유일 heading. 전 실무자 페이지 h1 보유 확인(무-h1 3건=리다이렉트 스텁 2 + preview는 자식 `ParticipantHomePreviewClient` h1). 계약 무영향(AdminSidebar 테스트=aria-current/expanded만·p7FocusWave2=애니메이션 클래스만). 게이트 tsc0·eslint0·vitest 657/657·build0. PR #120.
- **⑧ AdminSidebar 서브항목 adminOnly 필터 — 구현 완료(사용자 지시·방어적)**: 실무자(supporter)일 때 top-level 뿐 아니라 **서브항목도 `adminOnly` 를 거른다**(`subItems = isSupporter ? item.sub?.filter(s=>!s.adminOnly) : item.sub`, `hasSub`·서브 렌더 양쪽). 현재 admin 서브가 adminOnly 부모('당사자 관리') 아래라 **실효 누수 0(현 렌더 불변)**이지만, 비-adminOnly 부모에 admin 서브가 추가되면 死링크가 새는 잠재 위험을 선제 차단. role 불명/관리자(계약 테스트 `role=null` 포함)는 필터 미적용 → AdminSidebar 계약 불변(657/657). 게이트 tsc0·eslint0·build0. PR #120.
- **④ 당사자 허브 전역카드 스코프화 — 구현 완료(사용자 지시)**: 허브(`participants/[id]`)의 '이용계획·심의'·'활동 지도' 카드가 participant 스코프 없이 전역 이동하던 것을, **이미 있던 `?participant=pid` 규약(관계망 카드 선례)** 에 맞춰 스코프화. **plans**=`?participant=` 로 그 당사자 계획만 필터 + 스코프 헤더 + "전체 보기" 이스케이프; **map**=usages 를 `.eq('participant_id',…)` 필터 + markers 를 `usageCount>0`(실제 쓴 곳)로 좁힘 + 스코프 헤더 + "전체 지도" + 뒤로가기(허브로) + `MapClient.emptyLabel` 스코프 빈문구. **전역(사이드바) 진입은 파라미터 없어 불변**(회귀 0). ① 잔여 날짜(hub·plans 의 usage_date/기간)도 formatDate 로 함께 흡수. 독립 서브에이전트 검증. 게이트 tsc0·eslint0·vitest657/657·build0. PR #120.
- **⑤ 관계망 그래프 키보드 접근 — 구현 완료**(2026-09-09 · 사용자 지시 · 별도 브랜치 `feat/network-graph-keyboard`): cytoscape 노드 선택이 `tap`(마우스/터치) 전용이던 것을 **키보드 포커스 가능한 노드 선택 목록**("노드 골라 보기" details, 네이티브 `<button>`·44px)로 보강. 버튼 활성화 시 `selectNode`가 tap 과 동등 선택(상세 패널 + cy 하이라이트·센터링), 선택 상세는 `aria-live="polite"` 지속 래퍼로 SR 자동 안내, 현재 노드 `aria-pressed`. 그래프(`role=img`)·토글·tap·관계목록 불변(회귀 0). 설계=그림은 시각 보조, 목록으로 **동등 접근**(WCAG/KWCAG 비텍스트 대안 충족). ★캔버스 자체 화살표 탐색은 미지원(목록 우회, 의도). 독립 검증관 a11y **PASS** + 계약 **6테스트**(`NetworkGraphClient.test.tsx`). 게이트 tsc0·eslint0·vitest 726/726·build0.
- **⑦ 활동사진 부분실패 안내 + 5MB 상한 — 구현 완료**(2026-09-09 · 사용자 지시 · 별도 브랜치 `feat/activity-photo-partial-fail`): 파킹 해제. `addActivityPhotos` 반환(`{success?, added?, error?}`)을 **양쪽 호출부**에서 검사 → `photoFailed = activityPhotos.length - (added ?? 0)` 이 >0 이면 사진 유실을 알림. **실무자**(`NewTransactionClient`)=지출은 이미 저장됐으므로 **재기록 잠금**(`savedUsageId`)을 걸어 재클릭 시 `recordServiceUsage` 재호출 없이 목록으로만 이동(중복 지출 차단) + 버튼을 "나가기"로 전환 + `setError`. **당사자**(`ReceiptClient`)=폼 리셋·`router.refresh` 라 재제출 위험이 없어 `setError` + `announce`(assertive, easy-read 문구). **5MB 상한**=양쪽 활동사진 핸들러에 `f.size <= 5*1024*1024` 필터 + 초과분 개수 안내(영수증과 동일 기준). 정상 경로(전부 성공·0장) 회귀 0. **독립 검증관 적대적 검증 PASS**(photoFailed 4케이스[0장·전부성공·부분·전부실패 error]·재기록 잠금·5MB 경계 5242880 통과·`added ?? 0` undefined 안전) + 당사자 신규 문구 2개 `validate_easy_read` **PASS**(0/0/0) + 계약 **11테스트**(`NewTransactionClient.partialfail.test.tsx` 6·`ReceiptClient.partialfail.test.tsx` 5). 게이트 tsc0·eslint0·**vitest 737/737**(726+11)·build0.
  - **검증관 사전존재(pre-existing) 관찰 — 이번 diff 무관, W 후속 큐**: `ReceiptClient.tsx` 의 `if (result.error) return` 이 활동사진 업로드·폼 리셋 **앞**에 있어, `recordServiceUsage` 가 영수증 단건 업로드/insert 실패 시 `{success:true, usageId, error}`(둘 다) 반환하는 좁은 경로에서는 당사자에게 재기록 잠금이 없어 재클릭 시 중복 지출 소지. ⑦(활동사진) 범위 밖 기존 코드라 이번 PR 미포함 — 별도 항목으로 등록.
- **§8 실무자 QA 완결**: ①~⑨ 전부 처리(구현/의도적 유지/스코프화/키보드/부분실패). §8 표의 8개(+②⑨) 항목 모두 소진.

### 8-2. §8 밖 후속 — 당사자 won()→MoneyText 통일 (2026-09-09 · 사용자 지시)
- **구현 완료**(별도 브랜치 `feat/participant-money-unify`): 당사자 5개 화면(홈 `page.tsx`·`ReceiptClient`·`CalendarClient`·`MyPlanClient`·`evaluations/page`)의 지역 `won()` 5개 정의 제거 → 정본 **`MoneyText`**(표시 금액·`tabular-nums`) / 공유 **`formatCurrency`**(문자열 prop·hero/70 부제) 로 통일. 실무자 ①(PR#120)의 당사자 짝. **render-preserving**: `won(x)`≡`formatCurrency(Math.round(x))+'원'`≡MoneyText 출력이라 **문자열 byte-identical**, 색은 콜사이트별 상속색 그대로 보존(hero→`onHero`, hero/70·문자열 prop→`formatCurrency`, muted→`emphasis="muted"`, foreground→`emphasis="body"`). ★`evaluations:105` 는 실무자 짝(muted)과 달리 `text-foreground` 문맥이라 **body** 로 매핑(색 회귀 방지). sizing/weight 클래스(text-4xl·font-bold·shrink-0 등)는 외곽 래퍼 보존.
- **독립 검증관 PASS**(구현≠검증, 코드 안 짠 서브에이전트): 12콜사이트 색 **12/12 정확**, 문자열 identity·래핑 보존 확인. **엄밀 byte-identity 갭 1건 지적→즉시 경화**: 문자열형 2곳(홈 부제·receipt help)이 `formatCurrency` 에 `Math.round` 누락(정수 KRW는 동일이나 `NUMERIC(12,2)`+step 없는 number 입력이라 소수 도달 가능→"50,000.5원") → `formatCurrency(Math.round(x))` 로 수정(10 MoneyText 사이트는 내부 반올림이라 무관). **p7CopyWave1 GREEN**(37/37, 소스스캔이라 머니 무관). 렌더 계약 `CalendarClient.money.test.tsx`(2, muted/body·`tabular-nums`, anti-revert 실증).
- **스코프 밖(의도적 유지)**: `utils/easyReadSummary.ts`·`utils/activitySuggestion.ts`(서버 easy-read **문장 빌더**, React 컴포넌트 대체 불가) + `components/admin/ParticipantHomePreviewClient.tsx`(관리자 미리보기, 당사자 트리 아님·출력 동일).
- 게이트 tsc0·eslint0·**vitest 739/739**(737+2)·build0. W 검토→사람 머지.
- **잔여(W 후속)**: ⑦에서 발견한 `ReceiptClient` error-경로 중복지출(§8-1 ⑦ 하위 기록) — 이번 통일과 무관한 기존 코드.

---

## 9. W 검증 결과 (2026-09-09 · W 부재로 이 세션 대행)
W(설계·검증 축) 부재로 U 세션에서 W 검증 수행. **구현≠검증** 원칙 유지 — 코드를 작성하지 않은 **독립 서브에이전트 5개**를 W의 검증 손으로 병렬 팬아웃(보안·접근성·요구/死링크·테스트계약·easy-read)하고, U는 종합·판정만. 게이트도 HEAD=110d15f 로 **독립 재실행**.

**총평: BLOCK 0 → 병합 차단 사유 없음(사람 머지 준비 완료).** 독립 게이트: tsc0 · lint0 · vitest 657/657 · build0.

| 차원 | 판정 | 요지 |
|---|---|---|
| 요구·死링크 | **PASS**(OK12) | 실무자 死링크 잔존 **0** 전수(AdminSidebar role 분기·대시보드 CTA·빈상태 CTA·TabBar·모든 `/admin/*` 타겟 게이트 확인) |
| 보안 | **PASS**·C1 | 위조쿠키 무력(resolveViewAs admin검증 end-to-end)·9뮤테이션 가드 완비·cheese0318 승격 self-only·④ RLS 우회無·이메일 마스킹 누수 수정 |
| 접근성 | **PASS** | heading 단수(shell 브랜드 span+PageHeader 단일 h1)·aria(pressed/alert/label)·FAB region·44px·랜드마크 무회귀 |
| 테스트 | **무회귀**·C3 | named 계약(tokenFoundation·p7Copy/Focus)+렌더 계약 충돌 0. 신규 동작 7건 계약 공백 |
| easy-read | **PASS** | 당사자 방화벽 누수 0(심의/환수/부과)·배너 쉬운말(validate_easy_read pass)·신청접수 문구 실동작 일치 |

**CONCERN (병합 비차단 · 사용자/W 결정 필요):**
- **C1 하드코딩 슈퍼관리자 이메일**(보안·요구 중복): `route.ts:26` `BUILTIN_SUPER_ADMINS=['cheese0318@gmail.com']`. **goal #4 명시 요구**라 의도적(사용자 로그인 계정은 gmail, 조직메일 jobcenter.or.kr과 별개 — goal #4 원문이 gmail 지정). 트레이드오프=배포 격리(포크·타 배포에서 그 주소 자동 admin·이메일 소스 커밋·설정으로 제거불가). 옵션: **유지**(현행) vs `SUPER_ADMIN_EMAIL` env 단독 이전(배열 비우기, 코드 이미 지원).
- **C2 view-as 정산 충실도 갭** *(→ 2026-09-10 **해소**, §9-1 참조)*: `(participant)/evaluations/page.tsx` 관리자 미리보기가 대상의 최신 allocation 1건만 스코프 → 다건 배정 당사자의 과거 정산 누락. **유출 아님**(sentinel UUID로 전체유출 차단, 당사자 본인 화면 무영향). ~~문서화 한계~~ → **PR #128 로 대상 전체 allocation 스코프로 해소**.
- **C3 계약 공백 7건**: formatDate · view-as 가드 · **AdminSidebar 死링크 분기** · 음수잔액 · ④스코프 · cheese0318 승격 · view-as UI 배선 — 커밋된 회귀보호 0(독립 서브에이전트로만 검증). W가 RED 계약 저작 필요(우선: 死링크 분기·가드·승격). ★구현≠검증상 구현자(U) 직접 저작은 자기채점 → **신선 서브에이전트 또는 W** 가 저작해야.

**out-of-scope 관찰**: `supporter/network/page.tsx` h1 2개(조건분기 로딩/로드) — 이 PR 미변경, 별도 후속.

→ 병합은 **사람**이(에이전트 main 직접 머지 금지). C1·C3 결정 후 진행 권고.

### 9-1. 검증 후 결정·처리 (2026-09-09)
- **C1(하드코딩 슈퍼관리자) = 유지**(사용자 결정): goal #4 요구 그대로, 코드 변경 없음. 배포 격리 트레이드오프는 수용(이 저장소 단독 운영 전제).
- **C2(view-as 정산 충실도) = 해소**(2026-09-10, PR #128 · `test/w-viewas-settlement`): 관리자 view-as 가 대상의 **최신 allocation 1건**만 스코프하던 것을 **대상의 모든 allocation** 스코프로 넓혀, 당사자 본인 화면(RLS self=자기 모든 정산)과 **동일한 충실도**로 다건 배정 과거 정산까지 보이게 함. 근본=정산(`seoul_settlements`)은 `participant_id` 컬럼이 없고 `allocation_id` 로만 참여자에 묶임. `getSettlements(allocation?: string | string[])` — 배열→`.in`(전체·빈 배열은 유출방지 sentinel)·string→`.eq`(admin/participants·supporter/evaluations 상세 3곳 **하위호환**)·undefined→무필터(RLS self); `evaluations/page.tsx` view-as 는 `.limit(1).maybeSingle()` 제거하고 대상의 모든 allocation id 배열 전달. 구현≠검증: **W가 RED 계약 2건**(`settlement.test.ts` 4·`page.viewas.test.tsx` 1) 저작·greenability 실증 → **신선 서브에이전트(U) 구현**. 독립 게이트 tsc0·eslint0·**vitest 752/752**·build0. → **CONCERN 3건 전부 종결**(C1 유지·C2 해소·C3 계약).
- **C3(계약 공백) = 지금 신선 서브에이전트로 저작**(사용자 결정, 핵심3 우선). 구현≠검증 유지 — 코드 안 짠 독립 서브에이전트가 계약 저작·자체 GREEN. **52개 신규 테스트, 구현 버그 0.**
  - ✅ **저작 완료(5/7 · 핵심3 전부)**: formatDate(10)·**view-as 가드 viewAs.test.ts(13, ★위조방어 불변식)**·**AdminSidebar 死링크 분기(8)**·view-as UI 배선 ViewAsBanner/FAB/TabBar(8) [커밋 61c0140] · **cheese0318 승격** — 인라인 매칭을 `src/utils/superAdmin.ts` 순수함수로 **추출**(동작보존 독립검증 PASS) + superAdmin.test.ts(13) [커밋 91f2323].
  - ✅ **후속(2/7) 완료** (2026-09-09 · 별도 브랜치 `feat/budget-scope-contracts`): 아래 추출 실행 — `budgetByDomain.ts`(+`clampBudgetEnvelope`·`splitRemaining`)·신규 `src/utils/participantScope.ts`(+`scopeMarkersToUsed`·`scopePlansToParticipant`) 추출, budgets/map/plans 인라인 배선 교체(**동작보존 독립 서브에이전트 검증 PASS**), 계약 11테스트(`budgetByDomain.clamp.test.ts`·`participantScope.test.ts`). 게이트 tsc0·eslint0·**vitest 720/720**·build0. (설계: scope 두 함수는 assetMap 대신 신규 `participantScope.ts` 로 응집.) 원래 계획:
    - **음수잔액 클램프**: `budgetByDomain.ts` 에 `clampBudgetEnvelope(allocated,usedTotal)`·`splitRemaining(remaining)` 추출 → budgets/[id] 인라인 대체. 계약: `clampBudgetEnvelope(10000,12000)→{overspent:true,remainingDisplay:0,overageDisplay:2000}`·`(10000,10000)→{false,0,0}`(경계)·`splitRemaining(-2000)→{0,2000}`.
    - **④ 스코프 필터**: `assetMap.ts` 에 `scopeMarkersToUsed(markers,pid)` + (신규)`scopePlansToParticipant(plans,pid)` 추출 → plans/map 인라인 대체. 계약: usageCount>0 필터·participant_id 필터·전역모드(pid undefined) 무필터.
    둘 다 순수 substrate(buildBudgetByDomain·buildProviderAssets)는 이미 골든 → 추출 후 필터/클램프 분기만 계약하면 GREEN(중복 없음).
- **최종 게이트**: tsc0 · eslint0 · vitest **709/709**(657+52) · build0. **BLOCK 0 유지 — 병합 준비 완료(사람 머지).**
