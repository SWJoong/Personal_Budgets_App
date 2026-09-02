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
| B3 | `admin/settings` (시스템 설정) | 제품결정 | 무엇을 설정? 차수·기관·심의위 등은 시드. 범위 정의 필요 — §4-7(열린질문). |
| B4 | `admin/participants/[id]/preview` (당사자 뷰 미리보기) | 설계 | `PreviewBanner` 로 이미 배선. 관리자가 당사자 홈을 그 사람 눈으로 봄. §4-8. |
| B5 | `participant/plan` (오늘 계획) | **제품결정** | `my-plan`(이용계획, 구현됨)과 **다른 개념**(일일 활동계획). 서울형 스코프에 "오늘 계획"이 실제 필요한지 사용자 확인 — §4-9(열린질문). |

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

### 4-7. `admin/settings` — 시스템 설정 (B3) · **열린 질문**
- 서울형에서 "설정"의 실체를 먼저 정의해야 함. 후보: 기관정보 표시·차수(`seoul_program_phases`) 열람·
  심의위원 명단·이메일 도메인(`ALLOWED_EMAIL_DOMAINS`) 안내. **대부분 시드/env 라 편집 UI 가 정말 필요한지**
  사용자 확인. → 최소안: 읽기전용 "제도 현황"(현재 차수·기관·정책 요약) 카드. **사용자 결정 대기.**

### 4-8. `admin/participants/[id]/preview` — 당사자 뷰 미리보기 (B4)
- **범위**: 관리자가 특정 당사자의 홈을 **그 사람 눈으로** 확인(easy-read·개인화 검수용). `PreviewBanner` 로
  이미 라우팅 배선됨(`router.push(.../preview)`).
- **설계 결정 필요**: (a) 당사자 홈(`(participant)/page.tsx`)을 `participantId` 오버라이드로 렌더 vs
  (b) 별도 읽기전용 미러. 권장 (a) — 홈 서버컴포넌트가 대상 participantId 를 받도록 파라미터화(RLS 는 admin 이라
  통과). 코드 중복 없이 재사용. **PreviewBanner 상단 고정 배너로 "미리보기 중" 명시**(오조작 방지).

### 4-9. `participant/plan` — 오늘 계획 (B5) · **제품결정**
- `my-plan`(이용계획서=제도 문서)과 **개념이 다름**: `/plan` 은 당사자의 **일일/단기 활동 계획**(오늘 뭐 할지).
  서울형 스키마엔 대응 테이블 없음. → **선택지**: ⓐ 스코프에서 제외하고 나비 항목 제거(가장 단순),
  ⓑ `seoul_self_narratives.goal_to_try`(하고싶은 것)를 쉬운말로 보여주는 경량 화면으로 대체,
  ⓒ 신규 "오늘 할 일" 엔티티(범위 큼). **사용자 결정 대기.** 권장 ⓑ(기존 데이터 재사용, easy-read 부합).

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
10. **[B3·B5]** `admin/settings`·`participant/plan` = **사용자 제품결정 후**(§4-7·§4-9).
11. 구현 후 당사자 노출 신규 문구 → W `validate_easy_read` 재검증 요청. a11y(폼=FormField·모달=Modal) 준수.

## 7. 사용자 제품결정 요청 (W 대기)
- **Q1** `admin/settings` 범위: 읽기전용 "제도 현황"으로 충분한가, 편집 UI 가 필요한 설정 항목이 있나?(§4-7)
- **Q2** `participant/plan`(오늘 계획): ⓐ제외 / ⓑ`goal_to_try` 경량표시 / ⓒ신규 엔티티 중?(§4-9, 권장 ⓑ)
- **Q3** 상세·피드백·서류함의 **편집/답변/업로드**를 이번 스코프에 포함할지(권장: 열람 먼저 green → 쓰기 후속).
