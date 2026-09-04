# P5 IA 합리화 — 설계 (W 저작, U 구현)

> 로드맵: 프론트 재구성 #82 **Phase 5**(IA/라우트 합리화). 전제: P3 프리미티브·P4 내비 통일 안착
> (main=`d1a5f11`, P3·P4 완주).
> 이 문서는 **RED 계약**([HANDOFF→U])의 설계 근거이자 U 세션의 구현 명세다. 계약은 P3/P4 선례대로
> **행위·ARIA·구조만** 단언하고 **토큰·색·className·픽셀·물리적 파일 nesting 은 단언하지 않는다**.
> 근거: 사용자 확정 IA 감사(2026-09-04) + `Plan&Source/goala_frontend_rearchitecture_W.md` + P4(`goala_p4_nav_W.md`).

---

## 0. ★확정 IA 결정 (감사로 확인 — force-merge 금물)

P5 는 "라우트를 줄이는" 단계가 아니라 **도달성·명확성**을 잠그는 단계다. 감사 결과 아래는 **분리 유지**가
옳다고 확정됐다. 억지 수렴(다른 청중·목적의 라우트를 강제 합치기)은 하지 않는다.

| 대상 쌍 | 결정 | 이유 |
|---|---|---|
| `admin/participants`(CRUD) ↔ `supporter/participants`(현황·업무진입) | **분리 유지** + 라벨 명확화 | 청중·동작 다름(등록/편집 vs 조회/업무진입) |
| `/plan`(해보고싶은것 read-only·계획탭) ↔ `/my-plan`(MyPlanClient 편집기) | **분리 유지** | read-only 조망 vs 편집기 — 수렴 아님 |
| `participant/map`·`evaluations` ↔ `supporter/map`·`evaluations` | **분리 유지** | 청중 다름(당사자 vs 실무자) |

> §7(프론트 재구성): "분리유지 → P5 점진 리다이렉트"는 **진짜 deprecated/orphan 라우트에만** 적용한다.
> 기능하는 라우트는 redirect 로 없애지 않고 **nav 링크 추가**로 도달성을 잠근다(기능 삭제 금지).

**P5 확정 스코프**
- (a) 진짜 deprecated/orphan 라우트만 redirect (신규 redirect 불필요 — 아래 §3)
- (b) nesting 규약 통일 → **설계문 가이드**(jsdom 불가, §4)
- (c) BUILD-B 잔여 완결성: B1(#87)·B3(#86)·B4(#90)·B5(#85) — 본 P5 는 **B4 진입점 배선**을 계약화(§2)
- (d) AdminSidebar 당사자 라벨 명확화(관리 vs 현황)

---

## 1. 계약 성격 분류 (왜 지금 빨강/무엇을 잠그나)

| 성격 | 계약 | 지금 상태 | 초록 조건 |
|---|---|:---:|---|
| **회귀잠금**(redirect) | supporter-transactions-new · admin-participant-report | **GREEN** | P4 stub 유지(삭제·경로변경 시 빨강) |
| **RED**(B4 진입점) | b4-preview-entry-link | RED | 상세 화면에 preview 진입 링크 배선 |
| **RED**(라벨) | participant-hyeonhwang-label | RED | '통합 현황'→'당사자 현황' rename |
| **RED**(도달성) | admin-invitations · guide · settings-profile | RED | 지정 nav 표면에 링크 추가 |
| **설계문 가이드**(하드 RED 제외) | nesting-convention · single-aria-current | — | jsdom 불가/기존 계약 충돌 → §4 |

> 재확인: **redirect 2건은 RED 가 아니라 회귀잠금**이다(P4 구현 완료·현재 GREEN). RED 로 넣지 않는다 —
> 스텁의 canonical 포워딩을 누가 제거·변경하면 그때 실패해 회귀를 잡는다.

---

## 2. 계약별 설계 근거

각 계약은 대상에 콜로케이트한 `*.test.tsx`(AdminSidebar 만 기존 P4 계약 보호를 위해 별도 파일
`AdminSidebar.p5.test.tsx`). 단언 범위: 행위(링크 존재·href·접근가능 이름·redirect 인자)만.

### C1. `redirect-lock/supporter-transactions-new` — `supporter/transactions/new/page.test.tsx`
- **근거**: §1 무맥락 지출폼 불성립(당사자 컨텍스트 필수). canonical=`/supporter/transactions`(org 거래장부 A1).
- **단언**: `next/navigation` redirect 모킹 후 default export 호출 → `redirect('/supporter/transactions')` 정확히
  1회 + 폼 JSX 미반환(return undefined).
- **성격**: GREEN 회귀잠금. 유지결정 라우트가 아니라 진짜 deprecated stub이라 redirect 정당.

### C2. `redirect-lock/admin-participant-report` — `admin/participants/[id]/report/page.test.tsx`
- **근거**: D2 admin 월간 보고서 = `supporter/[participantId]/report` 기능 중복. canonical 포워딩
  (관리자도 같은 보고서, 대상 화면이 스태프 권한 게이트).
- **단언**: redirect 모킹 후 `params={id}` 로 호출 → `redirect('/supporter/${id}/report')` + JSX 미반환.
- **성격**: GREEN 회귀잠금. 중복 화면이 되살아나거나 포워딩 경로가 바뀌면 빨강.

### C3. `buildb/b4-preview-entry-link` — `admin/participants/[id]/ParticipantDetailClient.test.tsx` (RED)
- **근거**: B4 화면(`admin/participants/[id]/preview`, 당사자 화면 미리보기)은 완성됐으나 **진입점 미배선**.
  코드베이스 전체에서 `/preview` 참조는 `PreviewBanner.tsx:47`(진입 '후' 전환 드롭다운) 1곳뿐 →
  URL 직접입력 외 도달 불가.
- **RED 사유**: 상세 화면(server page 헤더=뒤로가기 링크뿐, ParticipantDetailClient 에도 preview 링크 0)
  → `getByRole('link',{name:/미리보기|당사자 화면 미리보기/})` throw.
- **표면 권고**: `participantId` 를 이미 prop 으로 받는 **ParticipantDetailClient**(client)에 링크를 둔다
  (jsdom 렌더 가벼움; server page 단언은 requireAdmin/supabase/actions 모킹 필요).
- **U 구현**: `<Link href={`/admin/participants/${participantId}/preview`}>당사자 화면 미리보기</Link>` 배선.
  PreviewBanner 내부 드롭다운은 '진입 후'에만 노출되므로 진입점으로 인정하지 않는다.

### C4. `adminsidebar/participant-hyeonhwang-label` — `AdminSidebar.p5.test.tsx` (RED)
- **근거**: 확정 IA '당사자 관리 vs 당사자 현황'(스코프 d). 현재 서브 라벨 `📊 통합 현황`(→
  `/supporter/participants`)은 '당사자'를 담지 않아 관리 CRUD 와 청중 구분이 라벨만으로 안 된다.
- **RED 사유**: `getByRole('link',{name:/당사자 현황/})` 매칭 실패(현 라벨 '통합 현황').
  (테스트는 pathname=`/admin/participants` 로 부모 '당사자 관리' 서브메뉴를 펼친 뒤 서브 링크를 단언.)
- **U 구현**: `AdminSidebar.tsx` menuItems 의 서브 `'📊 통합 현황'` → **`'📊 당사자 현황'`** rename(최소 변경).
  부모 '당사자 관리'는 이미 '당사자' 포함이라 대칭 RED 불필요(억지 계약 금지).

### C5. `nav-reachability/admin-invitations` — `AdminSidebar.p5.test.tsx` (RED)
- **근거**: `admin/invitations`(getInvitations+InvitationsClient)는 기능하나 AdminSidebar
  menuItems/quickItems·대시보드 어디에도 없다(인바운드 링크 0).
- **RED 사유**: `getByRole('link',{name:/초대/})` 부재 → throw. (테스트는 '빠른 설정' disclosure 를
  펼쳐 menuItems·quickItems 두 표면 모두 커버.)
- **U 구현**: menuItems(상시 노출) **또는** quickItems 에 `{ name:'✉️ 초대 관리', href:'/admin/invitations' }`
  추가. redirect 아님 — 링크 추가로 초록(force-merge 금물, 기능 삭제 없음).

### C6. `nav-reachability/guide` — `MoreMenuClient.test.tsx` (RED)
- **근거**: `/guide`(앱 사용 설명서)는 기능하나 인바운드 링크 0(login 의 'guide' 매치는 인용문일 뿐).
  대체 상위 라우트 없음 → **redirect 금지**(기능 삭제).
- **RED 사유**: `getByRole('link',{name:/이용 안내|사용 안내|가이드|안내|설명서|도움말/})` 부재 → throw.
- **표면**: 당사자 '더보기' 메뉴(MoreMenuClient) — W 지정 1안.
- **U 구현**: MoreMenuClient 의 열린 섹션(예 '빠른 이동')에 `<Link href="/guide">앱 사용 설명서</Link>` 추가.

### C7. `nav-reachability/settings-profile` — `MoreMenuClient.test.tsx` (RED)
- **근거**: `/settings/profile`(ProfileEditClient 프로필 편집기)는 유일한 프로필-편집 라우트이나
  인바운드 링크 0 → **redirect 금지**(대체 없음).
- **RED 사유**: `getByRole('link',{name:/내 정보|프로필|정보 수정/})` 부재 → throw.
- **U 구현**: MoreMenuClient 의 열린 섹션에 `<Link href="/settings/profile">내 정보</Link>` 추가
  (기존 `/settings/display` 링크 옆이 자연스러움).

---

## 3. redirectMap (canonical ← deprecated)

```
/supporter/transactions      ← /supporter/transactions/new      (D3 무맥락 지출폼 → org 거래장부, 기존 stub)
/supporter/[id]/report       ← /admin/participants/[id]/report  (D2 중복 보고서 → canonical, 기존 stub)
```

**[확정 유지 — redirect 제외]**
`/plan` ≠ `/my-plan` · `/admin/participants` ≠ `/supporter/participants` ·
`participant/map` ≠ `supporter/map` · `participant/evaluations` ≠ `supporter/evaluations`
— 청중·목적 상이(force-merge 금물).

**[신규 redirect 없음]** P5 는 새 canonical→deprecated redirect 가 불필요하다. 기능 orphan
(`/guide`·`/settings/profile`·`/admin/invitations`·`/onboarding`)은 redirect 가 아니라
**nav-reachability(링크 추가)** 로 처리한다.

---

## 4. 설계문 가이드 (하드 RED 제외 — jsdom 불가/계약 충돌)

### G1. `design-guide/nesting-convention` — 당사자-스코프 라우트 단일 규약
현행 4규약 공존:
- `/supporter/participants/${id}`(허브)
- `/supporter/${id}/assessment`·`transactions`(첫 세그먼트)
- `/supporter/budgets/${id}`·`/supporter/evaluations/${id}`(끝 세그먼트)
- `/supporter/network?participant=${id}`(쿼리)

**제안 표준**: `/supporter/participants/[id]/<feature>` (id 를 `/participants` 하위 세그먼트로 통일).
물리 라우트 구조는 jsdom 으로 단언 불가 → **테스트가 아닌 설계문 가이드**. 점진 리다이렉트·표준화는
W 설계 확정 후 별도 계약화. `(participant)`=flat 단일레벨(설정만 `/settings/*`),
`(supporter)`=이중 프리픽스(`/admin/*`+`/supporter/*`) 병존은 **의도된 유지**.

### G2. `design-guide/single-aria-current` — 단일 aria-current (W 조율 필요)
`AdminSidebar` 에서 부모 '당사자 관리'(:128)와 서브 '전체 목록'(:166)이 href 를 공유(`/admin/participants`)해
pathname=`/admin/participants` 일 때 **이중 aria-current='page'** 가 붙는다. 그런데 기존 P4 계약
(`AdminSidebar.test.tsx:36-56`)이 부모+서브 **각각** aria-current='page' 를 명시 요구 → 단일화는 P4 계약과
정면 충돌. 정본화하려면 부모/서브 href 중복 해소(예: 부모를 disclosure-only) **IA 결정이 선행**해야 하며,
**W 재합의 전 RED 투입 금지**(force-merge 금물).

---

## 5. U 구현 체크리스트 (초록 전환)

1. `ParticipantDetailClient.tsx`: preview 진입 `<Link>` 배선 → C3 초록.
2. `AdminSidebar.tsx`: 서브 '📊 통합 현황' → '📊 당사자 현황' rename → C4 초록.
3. `AdminSidebar.tsx`: menuItems/quickItems 에 '초대 관리'(`/admin/invitations`) 추가 → C5 초록.
4. `MoreMenuClient.tsx`: '/guide'·'/settings/profile' 링크 추가 → C6·C7 초록.
5. redirect 2건(C1·C2)은 **손대지 않는다**(GREEN 유지 = 회귀잠금 통과).
6. G1·G2 는 이번 구현 대상 아님 — W 설계/조율 후 별도 라운드.

게이트: `npx vitest run` 로 신규 5 RED → GREEN 전환 + 기존 261 무손상 확인, 이어 `npm run build`.
