# 관리자 당사자 수정·삭제 — 설계권위 (W)

> 고아 액션 백로그 최우선(사용자 결정). `updateParticipant`/`deleteParticipant`(admin.ts, 완성·호출처 0)를
> 배선하는 신규 UI. 관리자가 당사자 이름·이메일·담당자를 고치거나 삭제할 수 있게. 앱 전용·DB 변경 없음.

## 배경
- `updateParticipant(id, {name?, email?, supporterId?})`·`deleteParticipant(id)` 는 admin.ts 에 완성돼 있으나
  호출 UI 가 없음(상세 페이지는 모니터링·정산·이의용). 등록(createParticipant)은 `/new` 에 있고, 수정·삭제만 공백.

## 신규 라우트 `/admin/participants/[id]/edit`
### page.tsx (서버)
- `requireAdmin()`. participant(id, name, email, assigned_supporter_id) 조회(없으면 notFound). supporters
  = profiles role='supporter'(id, name) 조회. 헤더(뒤로가기=상세로, `<PageHeader>` 또는 기존 헤더 패턴 +
  접근명 있는 back) + `<ParticipantEditClient participant={...} supporters={...} />`.

### ParticipantEditClient.tsx (클라이언트) — 등록 폼(new/page.tsx) UX 미러
- props: `{ participant: {id,name,email,assigned_supporter_id}, supporters: {id,name}[] }`. 계약: ParticipantEditClient.test.tsx.
- 폼: 이름·이메일(FormField id+label, getByLabelText 가능)·담당자 `<select>`(label "담당자", 옵션=supporters
  + "담당자 없음"=''), **현재값 프리필**. useToast announce(등록 폼과 동일).
- 저장(버튼명 "저장" 또는 "수정"): 이름·이메일 빈값 검증(빈값이면 오류안내·액션 미호출) →
  `updateParticipant(id, { name, email, supporterId: 선택값||null })` → 성공 시 router.push(`/admin/participants/${id}`)
  (+refresh), 실패 시 announce.
- **삭제(위험·인라인 2단계 확인)**: "삭제" 버튼 → 확인 UI 노출("정말 삭제할까요? 되돌릴 수 없어요" + "확인"/"취소").
  "확인" → `deleteParticipant(id)` → 성공 시 router.push('/admin/participants'). 바로 삭제 금지(확인 전 미호출).
  삭제 영역은 시각적으로 구분(danger 토큰·별도 섹션). 44px·focus-visible·쉬운 말.

## 진입점
- `/admin/participants/[id]/page.tsx` 헤더에 "✏️ 정보 수정" 링크 → `/admin/participants/${id}/edit`
  (view-as 버튼 옆, 접근명 명확). (목록 행에도 추가는 선택.)

## 게이트
tsc0·lint0·vitest(ParticipantEditClient 계약 + 회귀0)·build0. 앱 전용.
