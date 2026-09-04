# 서울형 개인예산제 — 화면 구성 재세팅 (W → U)

> 작성: **W(설계·검증, `/pl` `/ux-ui` `/frontend`설계)** · 대상: **U(구현·배포, `/frontend`)** · 2026-09-03
> 배경: 앱은 원래 **아름드리꿈터 단일기관용**으로 만들어졌으나 DB·핵심화면은 이미 **서울형 개인예산제**
> (서울특별시 사업 · 수행기관=아름드리꿈터)로 ~80% 이전됨. 이 문서는 **마이그레이션 마무리**의 화면구성
> 재세팅을 못 박는다 = ① 브랜딩 완전 교체 ② 남은 ComingSoon(BUILD-B) ③ 네비 위생.
> 레인: 이 스펙·easy-read·계약 = **W** · 화면·서버액션·네비 수정 = **U**.

---

## 0. 사용자 결정 (2026-09-03)

- **브랜딩 = 서울형으로 완전 교체.** 화면 chrome 에서 "아름드리꿈터" 표기를 모두 제거하고
  "서울형 개인예산제"로 통일(범용 사업 앱 지향). **단, DB 도메인 데이터로서의 기관명은 유지**(§1 예외).
- **구현 주체 = 하네스 유지.** W 가 이 통합 스펙 확정 → `[HANDOFF→U]` → U 구현. B2 서류함은 이미 U **#79**.

## 0-1. 현 상태 실측 (재계획 방지)

| 구분 | 상태 |
|---|---|
| DB | 서울형 정본 `supabase/seoul/00~11` (라이브 배포·검증 완료) |
| 당사자 홈 `(participant)/page.tsx` | ✅ 서울형(`v_seoul_budget_balance`·6영역·`describeCopay`) |
| 실무자 IA `AdminSidebar` | ✅ 서울형 생애주기(신청·선정→이용계획·심의→영수증검토→회계/거래장부→서류→평가) |
| BUILD-A 3화면(거래장부·초대·피드백) | ✅ #72 구현 완료 |
| **잔재 = 이번 스코프** | 브랜딩 chrome 6파일 · ComingSoon 5라우트(BUILD-B) · stale soon 배지 |

---

## 1. 브랜딩 완전 교체 — 정확한 타깃 (chrome 만)

> 아래 참여자 노출 신규 카피는 **`validate_easy_read` = pass(errors 0·warnings 0), 2026-09-03 실측**.

| # | 파일:라인 | 현행 | 교체 |
|---|---|---|---|
| BR1 | `src/app/(auth)/login/page.tsx`:100 | `아름드리꿈터` | `서울형 개인예산제` |
| BR2 | `src/app/(auth)/login/page.tsx`:103 | `아름드리꿈터 선생님과 이용자를 위한 앱이에요` | `선생님과 이용자가 함께 쓰는 앱이에요` |
| BR3 | `src/app/(auth)/login/page.tsx`:111 | `아름드리꿈터 선생님이라면 기관 이메일로 로그인해주세요.` | `선생님이라면 기관 이메일로 로그인해주세요.` |
| BR4 | `src/app/layout.tsx`:10,11,13 | `아름드리꿈터 개인예산 관리` / `%s · 아름드리꿈터 개인예산` / `아름드리꿈터 자기주도 개인예산 관리 앱` | `서울형 개인예산제` / `%s · 서울형 개인예산제` / `서울형 개인예산제 관리 앱` |
| BR5 | `src/components/layout/AdminSidebar.tsx`:96-97 | `아름드리꿈터` / `관리자 뷰 (회계장부)` | `서울형 개인예산제` / `관리자` |
| BR6 | `src/app/(supporter)/SupporterLayoutClient.tsx`:74 | `아름드리꿈터 관리` | `서울형 개인예산제` |
| BR7 | `src/app/(participant)/more/page.tsx`:38 | `아름드리꿈터`(백링크) | `서울형 개인예산제` |
| BR8 | `src/app/(participant)/more/page.tsx`:78 | `아름드리꿈터 개인예산`(푸터) | `서울형 개인예산제` |

### 1-1. 예외 — 도메인 데이터(브랜딩 아님, 유지)
`admin/settings` 제도현황(B3)의 **"수행기관" 필드**는 `seoul_executing_agencies` 에서 **동적으로** 오는
실제 기관명(현재 시드=아름드리꿈터)이다. 하드코딩이 아닌 DB 조회 표시이므로 그대로 둔다. 이는 "화면 chrome
교체" 결정과 무모순(브랜딩 로고/헤더/타이틀 ≠ 운영 데이터 표시).

### 1-2. 수용 기준
- 사용자 노출 문자열에서 `아름드리|꿈터` **grep = 0건**. tsx 외에 `public/manifest*.json`·opengraph 메타·
  `README` 등도 U 가 최종 스윕(노출 chrome 한정, DB 시드·이 문서·설계문서는 대상 아님).

### 1-3. (선택·별건) 로그인 "더 알아보기" 정보 정확성
`login/page.tsx`:188·202 의 `GPT-4o` 표기는 **구식**(현재 AI = Claude/Anthropic, `docs/release/03-prd-alignment-review.md`
6장). 브랜딩과 별개지만 화면 정확성 차원에서 U 가 `GPT-4o`→`Claude` 로 함께 정정하면 좋음(스코프 밖·선택).

---

## 2. 네비게이션 위생

### 2-1. Stale "준비중" 배지 제거 (구현됐는데 준비중 오표기)
| 파일 | 위치 | 조치 |
|---|---|---|
| `TabBar.tsx`:49 | supporterTabs `내역 관리`→`/supporter/transactions` `soon:true` | **제거**(#72 org 거래장부 구현됨) |
| `TabBar.tsx`:56 | adminTabs `내역 관리`→`/supporter/transactions` `soon:true` | **제거**(동상) |

> 트리아지 §2-1 의 stale 배지(map·evaluations)는 이미 정리됨. 위 TabBar 2건이 **남은 유일한 stale**.

### 2-2. `soon` 생애주기 (BUILD-B 구현과 동기)
현재 정당한 `soon`(진짜 미구현) = `AdminSidebar` 통합현황(B1)·서류함(B2)·시스템설정(B3), `NavDropdown` 나의계획(B5).
**각 화면 구현 완료 시 그 화면의 `soon` 을 함께 제거**한다(구현과 배지가 항상 일치). B4 preview 는 배지 없음(진입점이
`PreviewBanner`).

---

## 3. BUILD-B — 남은 5개 ComingSoon (설계는 트리아지 §4에 확정, 재설계 없음)

> 상세 IA·easy-read·계약은 **`goala_comingsoon_stubs_triage_W.md`** 참조. 여기선 요약·상태만.

| # | 라우트 | 설계 | U 비고 |
|---|---|---|---|
| B5 | `participant/plan` | §4-9 `goal_to_try` 경량 표시(easy-read pass) | 순수표시·골든 없음. 착수 쉬움 |
| B3 | `admin/settings` | §4-7 읽기전용 "제도 현황" 대시보드 | 순수표시·골든 없음. §1-1 예외(수행기관명 동적) |
| B1 | `supporter/participants/[id]` | §4-3 통합 현황 허브(집계+링크) | 목록 행 링크 배선 포함 |
| B4 | `admin/participants/[id]/preview` | §4-8 당사자 홈 대리 렌더 | ★뮤테이션 안전(§4 아래) |
| B2 | `supporter/documents` | §4-6 서류 보관함 | **계속 U #79** — 이 문서 밖 |

### 3-1. ★B4 뮤테이션 안전 (이 화면의 핵심 계약 — 재확인)
당사자 홈엔 쓰기 동작(FAB `내가 쓴 돈 적기`·영수증 업로드·화면설정 저장)이 있다. 관리자 preview 중 이를
누르면 **관리자 RLS 로 그 당사자 데이터에 실제 기록**될 위험(유령 지출). → `ParticipantHomeView({participantId, mode})`
공유 뷰에서 **`mode='preview'` 일 때 참여자 쓰기 요소를 부재/`disabled`** 로 렌더(트리아지 §4-8-2). edit 모드가
허용하는 쓰기는 `ui_preferences` 대리설정 하나로 한정(`goala_ui_preferences_W.md` §8, 계약됨). **이 조건이 계약** —
U 가 렌더 테스트로 잠그면 좋음(선택). 진입점 `PreviewBanner`(배선됨).

---

## 4. U 핸드오프 체크리스트 (착수 순서 = 값/비용 순)

1. **[무위험, 먼저] 브랜딩 교체(§1)** — 8타깃(BR1~BR8). + `아름드리` grep 0 스윕(§1-2). (선택 §1-3 GPT-4o 정정.)
2. **[네비 위생] TabBar stale soon ×2 제거(§2-1).**
3. **[BUILD-B]** B5·B3(순수표시, 쉬움) → B1 허브 → B4 preview(뮤테이션 안전 §3-1). 각 구현 시 그 `soon` 제거(§2-2).
   B2 서류함은 **#79 로 계속**(이 목록 밖).
4. 구현 후 게이트: `npm run build`·`npm run lint`·`npm test`(기존 골든 회귀 0). 신규 당사자 노출 문구는 W
   `validate_easy_read` 재검증 요청. a11y(폼=FormField·모달=Modal) 준수.

---

## 5. 검증 (W 게이트)

- **브랜딩**: `아름드리|꿈터` grep(노출 chrome) = 0. 로그인·홈헤더·사이드바·모바일헤더·더보기에 "서울형 개인예산제".
- **ComingSoon 소거**: B1·B3·B4·B5 라우트가 `<ComingSoon>` 대신 실화면(B2=#79).
- **네비 정합**: "준비중" 배지가 실제 미구현 화면에만.
- **easy-read**: 신규 참여자 카피 `validate_easy_read` errors 0 (§1 로그인분 = 완료).
- **배포(선택)**: main 머지 → Vercel 자동 재배포 → `personal-budgets-app-gp8t.vercel.app` 로그인 브랜딩 육안.

## 6. 레인·충돌 회피
- W = `Plan&Source/**` · `src/**/*.test.tsx` 만. `src/`(테스트 제외) 구현 = U. main 직접 push 금지(PR·CI 경유).
- 진행 중 U 브랜치 **건드리지 않음**: #79(B2 서류함)·#80(provider anon revoke).
