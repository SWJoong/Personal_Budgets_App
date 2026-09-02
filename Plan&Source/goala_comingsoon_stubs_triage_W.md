# GOAL축 A · 12 ComingSoon 스텁 트리아지 + 재구현 설계 (W → U)

> 작성: **W(설계·검증, `/pl` `/ux-ui` `/pm`)** · 대상: **U(구현·배포, `/frontend` `/backend`)** · test-first
> 배경: 컷오버(#16) 당시 45라우트 중 22개가 ComingSoon 스텁이었고, GOAL축 A 진행으로 10개가 재구현됨.
> **현재 실측 = `<ComingSoon>` 을 렌더하는 라우트 12개.** 이 문서가 그 12개의 처분(삭제·리다이렉트·구현)을
> 각각 판정하고, 구현 대상의 IA·easy-read·계약을 못 박는다.
> 레인: 이 스펙·골든(`src/**/*.test.ts`)·easy-read 검수 = **W** · 화면·서버액션·네비 수정 = **U**.

---

## 0. 요약 — 12스텁의 3분류

| 처분 | 개수 | 라우트 |
|---|---|---|
| **DELETE/REDIRECT** (중복·고아) | 3 | `documents/care-plans/…`, `admin/participants/[id]/report`, `supporter/transactions/new` |
| **BUILD-A** (백엔드 준비됨 → 화면만) | 4 | `supporter/transactions`, `supporter/transactions/[id]`, `admin/invitations`, `admin/feedback`(읽기1 추가) |
| **BUILD-B** (설계+백엔드 필요, 우선순위 하) | 5 | `supporter/documents`, `admin/settings`, `admin/participants/[id]/preview`, `supporter/participants/[id]`, `participant/plan` |

> `supporter/participants/[id]`(당사자 통합 현황 허브)는 BUILD-A 로 볼 수도 있으나(액션 전부 존재), **IA 결정**
> (허브가 링크 모음이냐 대시보드냐)이 필요해 B 로 둔다. 아래 §4-3 참조.

**추가 발견 — 네비 위생(§2)**: 스텁과 무관하게 `soon` 뱃지 4곳이 **stale**(이미 구현된 map·evaluations 를
"준비중"으로 오표기) + 링크 1곳이 **오작동**(고아 스텁을 가리킴). 스텁 처분과 함께 U 가 정리.

---

## 1. 트리아지 상세 (각 스텁의 판정 근거)

### DELETE/REDIRECT (3)

| # | 라우트 | 판정 | 근거 |
|---|--------|------|------|
| D1 | `supporter/documents/care-plans/[participantId]/[planType]` | **DELETE** | 인바운드 링크 **0개**(grep 확인). 레거시 복지부 3단 서식 잔재. 서울형 이용계획 정본은 `plans/[id]`(구현됨). 디렉터리 삭제. |
| D2 | `admin/participants/[id]/report` | **REDIRECT→삭제** | 이미 구현된 `supporter/[participantId]/report`(월간 보고서 = `buildDomainAxisReport`)와 **동일 기능 중복**. `assessment` 페이지도 `/supporter/${pid}/report` 로 링크. admin 경로로 오는 링크가 있으면 그쪽으로 `redirect()`, 없으면 디렉터리 삭제. |
| D3 | `supporter/transactions/new` | **REDIRECT** | 실제 지출폼은 `supporter/[participantId]/transactions/new`(구현됨, #32/#39) — 당사자 컨텍스트 필수. 무맥락 `/new` 는 성립 불가. → 당사자 선택 화면(`supporter/transactions` org 원장, D2-A)으로 `redirect()`. **★그리고 `EvaluationClient.tsx:238` 의 잘못된 링크**(`/supporter/transactions/new` → `/supporter/${participantId}/transactions/new`)를 함께 고친다. |

### BUILD-A — 백엔드 준비됨, 화면만 (4) · **우선순위 상**

| # | 라우트 | 백엔드 | 비고 |
|---|--------|--------|------|
| A1 | `supporter/transactions` (회계/거래장부) | ✅ `getServiceUsages()` **무인자 = RLS 스코프 전량** | org 원장(담당 당사자 전체 지출). §4-1 + 골든 §5. |
| A2 | `supporter/transactions/[id]` (거래 상세) | ✅ `getServiceUsages()`+`getReceiptSignedUrl(usageId)` | 지출 1건 상세+영수증. §4-2. |
| A3 | `admin/invitations` (사용자 초대) | ✅ `getInvitations`·`createInvitation`·`deleteInvitation` 전부 존재 | 목록+발급+취소 CRUD 화면. §4-4. |
| A4 | `admin/feedback` (당사자 피드백) | ⚠️ `saveFeedback`(쓰기)만 → **`getFeedback()` 읽기 1개 추가**(U-backend) | 목록+답변 화면. §4-5. |

### BUILD-B — 설계·백엔드 필요 (5) · **우선순위 하 / 일부 제품결정**

| # | 라우트 | 필요 | 비고 |
|---|--------|------|------|
| B1 | `supporter/participants/[id]` (당사자 통합 현황) | IA 결정 | 허브 화면 — §4-3. 액션은 전부 존재(집계뷰 조합). |
| B2 | `supporter/documents` (증빙/서류 보관함) | 백엔드(문서 목록) | Storage `documents` 버킷 나열 액션 신설 필요. §4-6. |
| B3 | `admin/settings` (시스템 설정) | ✅결정: 읽기전용 | "제도 현황" 읽기 대시보드(편집 UI 없음). 실측 테이블 조합 — §4-7. |
| B4 | `admin/participants/[id]/preview` (당사자 뷰 미리보기) | 설계 | `PreviewBanner` 로 이미 배선. 관리자가 당사자 홈을 그 사람 눈으로 봄. §4-8. |
| B5 | `participant/plan` (해보고 싶은 것) | ✅결정: ⓑ | `seoul_self_narratives.goal_to_try` 경량 표시(easy-read pass). `my-plan` 데이터 재사용 — §4-9. |

---

## 2. 네비게이션 위생 (U-lane, 스텁과 함께 정리)

### 2-1. Stale `soon` 뱃지 제거 (이미 구현된 화면을 "준비중"으로 오표기)
| 파일 | 위치 | 현재 | 조치 |
|---|---|---|---|
| `AdminSidebar.tsx` | L54 `계획과 평가`→`/supporter/evaluations` | `soon:true` | **제거**(#64 구현됨) |
| `AdminSidebar.tsx` | L55 `활동 지도`→`/supporter/map` | `soon:true` | **제거**(#46 구현됨) |
| `AdminSidebar.tsx` | L64 quick `평가 작성`→`/supporter/evaluations` | `soon:true` | **제거** |
| `MoreMenuClient.tsx` | L100 `/evaluations`(선생님의 편지) | `SoonBadge` | **제거**(#64 미러 구현됨) |
| `NavDropdown.tsx` | L30 `/evaluations` | `soon:true` | **제거** |

### 2-2. 오작동 링크
- `EvaluationClient.tsx:238` `/supporter/transactions/new` → **`/supporter/${participantId}/transactions/new`**(D3).

### 2-3. 스텁 처분 반영 후 `soon` 갱신
- D1/D2/D3 삭제·리다이렉트 후 해당 뱃지 정리. A1~A4 구현 시 `soon` 제거. B군은 구현 전까지 `soon` 유지.

---

## 3. 착수 순서 (권장 — 값/비용 순)

1. **네비 위생(§2)** — 30분, 무위험. stale 뱃지·오링크 정리(사용자가 즉시 체감).
2. **D1·D2·D3** — 삭제/리다이렉트. 죽은 코드 제거.
3. **A1 `supporter/transactions`(org 원장)** — 골든(`orgLedger`) green → 화면. 나머지 A 의 진입 허브.
4. **A2·A3·A4** — 상세·초대·피드백(피드백은 `getFeedback` 읽기 먼저).
5. **B1 허브** — A 들이 서면 링크 대상이 갖춰짐.
6. **B2·B4** — 서류함·미리보기.
7. **B3·B5** — 제품결정 후(§4-7·§4-9).

---

## 4. 구현 대상 IA·easy-read (BUILD 항목)

> 원칙(당사자 노출분): 한 문장 한 뜻·쉬운 낱말·`toLocaleString('ko-KR')+"원"`·44px 터치·`leading-relaxed`.
> 담당자/관리자 화면은 표준어 가능. 신규 당사자 노출 문구는 구현 시 W 가 `validate_easy_read` 재검증.

### 4-1. `supporter/transactions` — org 거래장부 (A1)
- **범위**: 담당 실무자/관리자가 **자기 담당 당사자 전체**의 지출을 한 화면에서. `getServiceUsages()` 무인자
  (RLS 가 담당범위로 스코프 — admin=전체, supporter=배정분).
- **IA**:
  ```
  [헤더] 거래장부
  ① 요약 바: 전체 지출 ₩{합계} · {건수}건 · [정산상태 칩: 대기 n / 완료 n / 반려 n / 환수 n]
  ② 필터: 정산상태 · (관리자)당사자
  ③ 당사자별 그룹 목록 (buildOrgLedger, §5):
     {이름}  ₩{그 사람 합계} · {건수}건  [최근일]  → 클릭 시 supporter/[pid]/transactions
       └ 펼치면 최근 지출 몇 건(날짜·내용·금액·상태) → 각 행 클릭 시 상세(A2)
  ```
- **재사용**: 상태 라벨/스타일은 `supporter/[participantId]/transactions/page.tsx` 의 `STATUS_LABEL`/`STATUS_STYLE`
  을 공용 모듈로 승격(U 판단) — 중복 정의 방지.
- **진입점**: 이미 있음(TabBar `내역 관리`·AdminSidebar `회계/거래장부`). `soon` 제거만.

### 4-2. `supporter/transactions/[id]` — 지출 상세 (A2)
- **범위**: 지출 1건 상세 — 금액·날짜·내용·영역(domain)·정산상태·영수증 이미지·(있으면)심의/규칙 메모.
- **데이터**: `getServiceUsages()` 에서 `id` 매칭 1건 + `getReceiptSignedUrl(usageId)`(서버컴포넌트 사전생성).
- **IA**: 헤더(← 장부) · 금액 히어로 · 메타(날짜·영역·제공기관) · 정산상태 배지 · 영수증(있으면 `next/image`) ·
  (담당)정산/규칙 메모. 편집은 이번 스코프 밖(열람 전용, §4 부록).
- **진입점**: A1 목록 행 + 당사자별 원장 행.

### 4-3. `supporter/participants/[id]` — 당사자 통합 현황 허브 (B1)
- **범위**: 한 당사자의 **모든 축 진입점**을 한 화면에(사정·계획·예산·거래·평가·관계망·지도·리포트). 스펙
  `goala_budget_screen_ux_W.md §4`·`goala_evaluation_monitoring_ux_W.md §8`·`goala_relationship_network_W.md §4`
  가 "진입점 신설 필요"로 지목한 **바로 그 허브**.
- **IA(권장 — 대시보드형)**:
  ```
  [헤더] {이름}님
  ① 상태 요약: 현재 차수·선정상태·남은 예산(v_seoul_budget_balance)·본인부담금 상태
  ② 바로가기 카드(2열): 🎯이용계획(plans) · 💰예산(budgets/[id]) · 🧾거래장부(supporter/[pid]/transactions)
     · 📋정산·평가(evaluations/[pid]) · 🕸관계망(network?pid) · 🗺지도 · 📊월간보고서(supporter/[pid]/report)
     · 🧭욕구사정(supporter/[pid]/assessment)
  ③ 최근 활동(지출·모니터링 최신 몇 건)
  ```
- **재사용**: 각 카드가 가리키는 화면은 전부 구현됨 → 허브는 **집계 요약 + 링크**. 신규 백엔드 최소.
- **진입점**: AdminSidebar `통합 현황`(현 `/supporter/participants` soon) → 목록에서 행 클릭 시 이 상세로.
  (목록 `supporter/participants/page.tsx` 는 이미 존재 — 행 링크만 이 라우트로.)

### 4-4. `admin/invitations` — 사용자 초대 (A3)
- **범위**: 관리자가 실무자/당사자 이메일을 초대 등록(가입 시 자동 역할부여용 `user_invitations`).
- **데이터**: `getInvitations()`(목록)·`createInvitation({email, role, ...})`·`deleteInvitation(id)`.
- **IA**: 목록(이메일·역할·상태·발급일·[취소]) + 상단 발급 폼(이메일·역할 선택). 삭제는 확인 다이얼로그(`Modal`).
- **주의(보안 게이트)**: 이메일 입력·발급은 **폼 제출**이라 접근성 라이브영역 오류 배선(FormField) 재사용.
  실제 발송/외부전송 아님(DB 레코드만) → 자동화 가능.

### 4-5. `admin/feedback` — 당사자 피드백 (A4)
- **백엔드 추가(U)**: `getFeedback(): Promise<{feedback: FeedbackRow[]; error?}>` — `saveFeedback` 과 같은 파일.
  RLS: 관리자/담당 열람(기존 피드백 정책 재사용). 신규 정책 불필요면 그대로.
- **IA**: 목록(당사자·날짜·내용·감정아이콘) · 상세 펼침. 답변 기능은 이번 스코프 밖(열람 우선).
- **진입점**: AdminSidebar quick `피드백 확인`(soon 제거).

### 4-6. `supporter/documents` — 증빙/서류 보관함 (B2)
- **백엔드(U)**: `documents` Storage 버킷(private) 파일 목록 액션. 당사자별 그룹. signed URL(`createAdminClient`).
- **IA**: 당사자별 서류 그룹 · 파일(제목·유형·업로드일·[열기 signed URL]). 업로드는 후속(열람 우선).
- **주의**: 스토리지 signed URL 패턴(`extractStoragePath`+`createSignedUrl`) 준수(CLAUDE.md Storage 규칙).

### 4-7. `admin/settings` — 시스템 설정 (B3) · **RESOLVED: 읽기전용 "제도 현황"** (사용자 2026-09-02)
편집 UI 를 만들지 않는다(제도 데이터는 07 시드·env 라 앱에서 편집할 것이 없음, 과설계 회피). 관리자가 현재
운영 전제를 한눈에 확인하는 **읽기전용 대시보드**로 구현.
- **데이터(실측 테이블)**: 차수 `seoul_cohorts` · 시행주체 `seoul_administering_bodies` · 수행기관
  `seoul_executing_agencies` · 심의위원회 `seoul_review_committees` · 지출규칙 `seoul_spending_rules`
  (정책 요약, `enforcement` 표시) · 허용 이메일 도메인 `ALLOWED_EMAIL_DOMAINS`(env, 서버컴포넌트에서 노출).
- **IA(카드 나열, 편집 컨트롤 없음)**:
  ```
  [헤더] 시스템 설정 (읽기 전용)
  ① 운영 기관: 시행주체 · 수행기관 목록(이름·연락)
  ② 사업 차수: seoul_cohorts(차수명·기간·상태)
  ③ 심의위원회: seoul_review_committees(위원 명단·역할)
  ④ 지출 정책: seoul_spending_rules 요약 — enforcement='block' 0건 원칙 명시(막지 않고 기록)
  ⑤ 접근 정책: 허용 이메일 도메인 · 슈퍼관리자 이메일(마스킹)
  ```
- **RLS**: 전부 `seoul_is_admin()` 열람(기존 정책 재사용). 신규 정책 불필요.
- **백엔드**: 신규 액션 최소 — 서버컴포넌트에서 위 테이블 `select`(관리자 세션). 순수 로직 없음 → **골든 없음**
  (계약 = 읽기 쿼리 + 표시). 진입점: AdminSidebar `시스템 설정`(soon 제거).
- **주의**: env 값(도메인·슈퍼관리자)은 **표시만**, 절대 편집/전송 안 함. 슈퍼관리자 이메일은 부분 마스킹.

### 4-8. `admin/participants/[id]/preview` — 당사자 뷰 미리보기 (B4) · **보강 설계 (W, 2026-09-02)**

**목적**: 관리자가 특정 당사자의 홈을 **그 사람 눈으로** 본다 — easy-read·화면 개인화(§`goala_ui_preferences_W`)가
실제로 그 당사자에게 어떻게 보이는지 검수. 신규 화면이 아니라 **당사자 홈의 관리자 대리 렌더**.

**4-8-1. 렌더 메커니즘 — 공유 뷰 추출 (코드 중복 0)**
현재 `(participant)/page.tsx` 는 `getCurrentParticipant()`(auth.uid→participants) 로 **세션 당사자**를 해석해
잔액·영역별(`buildBudgetByDomain`)·본인부담(`describeCopay`)·`ui_preferences` 블록을 렌더한다. preview 는
**같은 화면을 대상 participantId 로** 그려야 한다. → 권장:
- **공유 서버 컴포넌트 `ParticipantHomeView({ participantId, mode })` 로 홈 본문 추출.**
  - `(participant)/page.tsx`: `participantId = getCurrentParticipant()`, `mode='live'`.
  - `admin/participants/[id]/preview/page.tsx`: `participantId = params.id`, `mode='preview'`, **`seoul_is_admin()` 게이트**.
- 대안(b) `getCurrentParticipant(overrideId?)` 에 admin 전용 오버라이드 인자 — 더 작지만 함수 책임이 흐려짐.
  권장은 (a)(뷰 추출) — 렌더 로직 1벌 유지·테스트 표면 동일.

**4-8-2. ★뮤테이션 안전 (이 화면의 핵심 위험 — 설계가 반드시 막아야 함)**
당사자 홈에는 **쓰기 동작**이 있다: 하단 FAB `📷 내가 쓴 돈 적기`(지출 생성)·화면설정 저장 등. 관리자가
preview 중 이를 누르면 **관리자 권한(RLS admin)으로 그 당사자 데이터에 실제 기록**될 수 있다(유령 지출·오설정).
- **`mode='preview'` 에서 참여자 쓰기 액션을 비활성/숨김**: FAB·지출기록·영수증 업로드는 preview 에서
  **렌더하지 않거나 disabled**(클릭 시 "미리보기에서는 기록할 수 없어요" 안내). 읽기 위젯만 활성.
- **편집 모드(`PreviewBanner` ✏️)**: 배너에 이미 view↔edit 토글이 있다. edit 모드가 허용하는 쓰기는
  **`ui_preferences` 대리 설정 하나로 한정**(§`goala_ui_preferences_W` §8 = 담당/관리자 대리 허용, 이미 계약됨).
  그 외(지출·계획)는 edit 모드에서도 preview 경로로 만들지 않는다(각 정본 화면에서 하도록 링크).
- → U 는 `ParticipantHomeView` 가 `mode` 를 받아 쓰기 요소를 **조건부 렌더**. 이 조건이 이 화면의 계약.

**4-8-3. 배너·이탈 (오인 방지)**
- `PreviewBanner`(구현됨): 상단 sticky, 호박색 "👁 미리보기 모드" + 참여자 셀렉트 + `✕ 닫기`
  (→`admin/participants/[id]`). **preview 전 구간에서 항상 보이게**(당사자 데이터를 관리자 자기 것으로 오인 방지).
- 배너 문구는 관리자용 표준어(당사자 노출 아님) — easy-read 대상 아님. 단 **본문은 당사자 easy-read 그대로**
  (그게 검수 목적).

**4-8-4. 보안·RLS·감사**
- **게이트**: `seoul_is_admin()`(관리자 전용). 실무자에겐 노출 안 함(대리 열람은 배정 스코프 다른 경로).
- RLS 는 admin 이라 대상 당사자 데이터 통과 — preview 는 **권한 확장이 아니라 표시 대상 전환**.
- ★**민감성**: 남의 화면을 그대로 보는 기능이라 **감사 로그 후속 대상**(ⓔ `audit_log` 결정과 연계 — 누가 누구를
  언제 preview 했는지). 이번 스코프는 기능 자체, 감사는 audit_log 도입 시 훅 추가(§별도).

**4-8-5. 계약·게이트**
- **순수 로직 신규 없음**(잔액·영역별은 기구현 골든 재사용) → **신규 골든 없음**. W 게이트 =
  ① 뮤테이션 안전(preview 에서 쓰기 요소 부재/disabled) **컴포넌트 계약** — U 가 `ParticipantHomeView`
  `mode='preview'` 렌더 테스트(선택) ② a11y(배너 랜드마크·닫기 44px) ③ 설계 리뷰.
- 진입점: `PreviewBanner`(배선됨) + `admin/participants/[id]` 상세에서 "미리보기" 링크.

### 4-9. `participant/plan` — 해보고 싶은 것 (B5) · **RESOLVED: ⓑ `goal_to_try` 경량 표시** (사용자 2026-09-02)
신규 엔티티(ⓒ)·완전 제외(ⓐ)가 아니라, 당사자가 이용계획에 이미 적은 **`seoul_self_narratives.goal_to_try`
(하고 싶은 것)**를 쉬운말로 보여주는 **읽기 우선 경량 화면**으로 대체한다. 기존 데이터 재사용 — 신규 테이블·
백엔드 없음. (편집은 `my-plan` 이 정본, 이 화면은 표시 + 그리로 안내.)
- **데이터**: 당사자 본인의 최신 계획 `seoul_self_narratives.goal_to_try`. `my-plan/page.tsx` 가 이미 narrative
  를 읽으므로 **같은 조회 재사용**(RLS 가 본인 것만). 여러 항목이면 줄바꿈/목록으로.
- **IA(당사자, 모바일)**:
  ```
  [헤더 ←] 무엇을 해볼까요?
  {goal_to_try 를 큰 글씨·쉬운말로}   ← 있으면
  (없으면) 아직 없어요.  [이용계획에서 적어요 → /my-plan]
  ```
- **★easy-read 카피 (`validate_easy_read` = pass, errors 0·warnings 0 실측 2026-09-02)**:
  | 위치 | 카피 |
  |---|---|
  | 화면 제목 | `무엇을 해볼까요?` |
  | 안내(값 있을 때) | `이용계획에 적은 일이에요.` |
  | 빈 상태 | `아직 없어요.` + `이용계획에서 적어요.` (→ `/my-plan`) |
- **순수 로직 없음 → 골든 없음**(계약 = narrative 읽기 + 표시 + 빈상태). W 게이트 = 위 easy-read 검증(완료) + a11y.
- **네비**: `/plan` 뱃지·라벨은 유지하되 라벨을 화면 제목과 맞춘다(NavDropdown L21 `나의 계획`·MoreMenu L119
  `오늘 계획` → 실제 화면 성격에 맞게 U 가 조정, soon 제거).

---

## 5. test-first 골든 계약 — `buildOrgLedger` (A1 잠금)

`supporter/transactions`(org 원장)의 순수 집계. `domainAxisReport.ts` 형제. `src/utils/orgLedger.ts`(U 구현),
골든 `src/utils/orgLedger.test.ts`(W 작성, RED→U green). **DB 행 shape 과 분리**하려 명시적 입력 인터페이스 사용.

```ts
// src/utils/orgLedger.ts (U 구현 대상)
export type SettlementStatus = 'pending' | 'accepted' | 'rejected' | 'recovered'
export interface OrgUsageRow {
  id: string
  participantId: string
  participantName: string
  amount: number | null          // null → 0
  settlementStatus: SettlementStatus | string  // 미지값은 'other' 버킷
  usageDate: string              // ISO
}
export interface OrgLedgerParticipant {
  participantId: string
  participantName: string
  total: number                  // Σ amount
  count: number
  latestDate: string | null      // 최신 usageDate
}
export interface OrgLedgerSummary {
  grandTotal: number
  totalCount: number
  byStatus: Record<'pending'|'accepted'|'rejected'|'recovered'|'other', { amount: number; count: number }>
  participants: OrgLedgerParticipant[]  // total 내림차순, 동률 시 이름 오름차순
}
export function buildOrgLedger(rows: OrgUsageRow[]): OrgLedgerSummary
```

### 골든이 못박는 불변식
1. **당사자 그룹핑**: 같은 `participantId` 행이 합산(`total`·`count`). 이름은 그룹 대표값.
2. **정산상태 롤업**: `byStatus` 5버킷(4표준 + `other`). 미지 상태 문자열은 `other` 로(누락 금지).
3. **null amount → 0**(합계·건수엔 건 포함, 금액 0).
4. **정렬 결정성**: `participants` 는 `total` 내림차순 → 동률 `participantName` 오름차순(재현성).
5. **`latestDate`**: 그룹 내 최신 `usageDate`(문자열 비교 아닌 `Date` 파싱). 빈 그룹 없음(행이 있으니).
6. **빈 입력** → `grandTotal:0, totalCount:0, byStatus` 전부 0, `participants:[]`.
7. **`grandTotal` == Σ participants.total == Σ byStatus.amount**(교차 합치성 — 회계 무결성).

→ 이 골든이 RED 인 동안 U 가 `buildOrgLedger` 구현해 green. A1 화면이 이 함수를 소비(§4-1 ③).

---

## 6. U 핸드오프 체크리스트

1. **[네비 §2]** stale `soon` 5곳 제거 + `EvaluationClient` 오링크 수정. (무위험, 먼저.)
2. **[D1]** `documents/care-plans/**` 삭제. **[D2]** `admin/participants/[id]/report` → `supporter/[pid]/report` 리다이렉트/삭제. **[D3]** `supporter/transactions/new` 리다이렉트.
3. **[A1]** `src/utils/orgLedger.ts` 구현 → 골든(§5) green → `supporter/transactions` org 원장 화면.
4. **[A2]** `supporter/transactions/[id]` 상세(+영수증 signed URL).
5. **[A3]** `admin/invitations` CRUD 화면(기존 액션 소비).
6. **[A4]** `getFeedback()` 읽기 추가(backend) → `admin/feedback` 목록 화면.
7. **[B1]** `supporter/participants/[id]` 통합 허브(집계+링크) + 목록 행 링크 배선.
8. **[B2]** `documents` 목록 액션 + `supporter/documents` 화면.
9. **[B4]** `admin/participants/[id]/preview` — 당사자 홈 participantId 파라미터화 재사용 + 배너.
10. **[B3]** `admin/settings` = 읽기전용 "제도 현황" 대시보드(§4-7, 결정 완료). **[B5]** `participant/plan` =
    `goal_to_try` 경량 표시(§4-9, 결정 완료·easy-read pass). 둘 다 순수로직 없어 골든 없음 — 착수 가능.
11. 구현 후 당사자 노출 신규 문구 → W `validate_easy_read` 재검증 요청. a11y(폼=FormField·모달=Modal) 준수.

## 7. 사용자 제품결정 (기록)
- **Q1 — RESOLVED(2026-09-02): 읽기전용.** `admin/settings` = 편집 UI 없이 "제도 현황" 읽기 대시보드(§4-7).
- **Q2 — RESOLVED(2026-09-02): ⓑ.** `participant/plan` = `seoul_self_narratives.goal_to_try` 경량 표시(§4-9,
  easy-read pass). ⓐ제외·ⓒ신규엔티티 기각.
- **Q3 — 미해결(권장 유지):** 상세·피드백·서류함의 **편집/답변/업로드**는 이번 스코프 밖(열람 먼저 green → 쓰기
  후속). U 가 열람 화면부터 착수. 쓰기 필요 시 별도 W 계약.
