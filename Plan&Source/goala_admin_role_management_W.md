# 관리자 역할 관리 — 설계권위 (W)

> 고아 액션 백로그(미구축) — `getAllUsers`·`updateUserRole`(둘 다 완성·호출처 0).
> 관리자가 전체 사용자 목록을 보고 각자의 역할(관리자/실무자/당사자)을 바꾸는 **신규 화면**.
> 앱 전용·DB 변경 없음. 액션(`src/app/actions/admin.ts`) **무변경**.

## §0 배경·안전
- `getAllUsers()` → `{ profiles }`(profiles 전체, created_at desc). `verifyAdmin` 내장.
- `updateUserRole(userId, newRole)` → 본인 역할 변경 차단(`userId===user.id`시 `{error}`) · `auditLog('role.change',{from,to})` · revalidate `/admin/settings`·`/admin`.
- 락아웃 방지: 액션이 **본인 변경을 막으므로** 마지막 관리자(=본인)를 강등할 수 없다. UI 도 본인 행은 변경 컨트롤을 아예 내지 않아 이중 방어.
- 역할 변경은 되돌릴 수 있으나(다시 바꾸면 됨) 권한(민감정보 접근)을 바꾸는 **결과가 큰** 조작 → 실행 전 **인라인 확인** 필수(오조작 방지·인지 접근성).

## §1 신규 라우트 `/admin/users`
- `src/app/(supporter)/admin/users/page.tsx` (서버):
  - `requireAdmin()` → `user`(currentUserId).
  - `getAllUsers()` 호출(고아 액션 배선). 결과 profiles → `{ id, name, email, role, created_at }` 로 매핑해
    `UserRoleManagementClient` 에 전달. `role` 은 `UserRole`(`admin|supporter|participant`)로 취급(스키마 role: string).
  - 헤더: 뒤로가기(←, aria-label "뒤로 가기", 글리프 aria-hidden — a11yArrowGlyphs 가드) → `/admin`.
    제목 "역할 관리". `<main id="main-content" tabIndex={-1}>`(skip-link 타겟). 컨테이너 `max-w-2xl`.
  - metadata title "역할 관리".

## §2 `UserRoleManagementClient` (신규, 'use client')
- 계약: `src/app/(supporter)/admin/users/UserRoleManagementClient.test.tsx`.
- props: `{ users: { id; name: string|null; email: string|null; role: UserRole; created_at: string }[]; currentUserId: string }`.
- 라벨 관례 재사용: `ROLE_LABEL = { admin:'관리자', supporter:'실무자', participant:'당사자' }`,
  `ROLE_OPTIONS: UserRole[] = ['admin','supporter','participant']`.
- 소비: `useRouter`(refresh) · `useToast`(announce) · `updateUserRole`(admin 액션).
- 목록: `<ul>` — 각 사용자는 **`<li>`** 카드. 카드 내부:
  - 표시명 = `name || '(이름 미등록)'`(이 텍스트가 `<li>` 안에 있어야 계약이 행을 찾는다) · 이메일 = `email || '이메일 없음'` · 가입일 `created_at.slice(0,10)`.
  - 현재 역할 뱃지(`ROLE_LABEL[role]`, 시맨틱 토큰; 역할별 색 구분은 범주 표시일 뿐 가치판단 아님).
  - **본인 행**(`u.id === currentUserId`): 역할 변경 컨트롤(select·버튼) **미출력**. 대신 "나" 뱃지 +
    안내문 "자신의 역할은 바꿀 수 없어요.". (계약: combobox 개수 = 비본인 수, "나" 노출.)
  - **비본인 행**: 역할 `<select>` (`aria-label={`${표시명} 역할`}`, 현재 role 프리필) + **"변경"** 버튼
    (`type=button`, `disabled` = 선택값===현재role). 클릭 → 그 행이 **인라인 확인**으로 전환.
- 인라인 확인(한 번에 한 행만, `confirmingId`): select+변경 자리를 확인 블록으로 교체 —
  `<p role="alert">{표시명}님을 {ROLE_LABEL[to]}(으)로 바꿀까요?</p>` + 역할 설명 1줄
  (admin: "관리자는 모든 당사자 정보를 보고 설정을 바꿀 수 있어요." / supporter: "실무자는 맡은 당사자의
  예산과 기록을 함께 관리해요." / participant: "당사자는 자기 예산과 지출만 볼 수 있어요.") +
  [그대로 두기][바꾸기]. "바꾸기" → `updateUserRole(id, to)` (useTransition):
  성공 → `announce('…역할을 바꿨어요.', 'polite')` · `router.refresh()` · 확인닫기.
  실패 → `announce(error,'assertive')` · 선택값 현재role 로 되돌림 · 확인닫기.
  "그대로 두기" → 선택값 현재role 로 되돌림 · 확인닫기(미호출).
- 접근성: 모든 상호작용 44px·focus-visible·쉬운 말. hover 는 토큰(`hover:bg-*-hover`) — P7 hoverPressTokens 가드.

## §3 진입점 — 대시보드 빠른실행 타일
- `AdminDashboardCards.tsx` QUICK_LINKS 에 `{ href:'/admin/users', emoji:'🧑‍⚖️'(또는 적절), label:'역할 관리' }` 추가.
  (골든 `AdminDashboardCards.test.tsx` 는 타일 개수 미고정·특정 href 3개만 확인 → 타일 추가 회귀 없음.)

## 게이트
tsc0·lint0·vitest(UserRoleManagementClient 계약 + 회귀0)·build0. 액션(admin.ts) 무변경. 앱 전용.
