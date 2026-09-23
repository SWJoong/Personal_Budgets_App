# 16 · 기능 QA 체크리스트 (경로별)

> **목적**: 실사용자 QA 단계에서 실무자·당사자 편집 기능을 관리자 테스트 계정으로 점검하기 위한 경로별 체크리스트.
> **테스트 계정**: `cheese0318@gmail.com` — 코드 내장 슈퍼관리자(`src/utils/superAdmin.ts` `BUILTIN_SUPER_ADMINS`) → 로그인만 하면 자동 관리자.
> **편집 개방 조건**: Vercel `TEST_USER_EMAIL=cheese0318@gmail.com` 설정 + 재배포 (`src/utils/supabase/viewAs.ts`).
> **연관**: `docs/release/09`(실사용자 QA 계획)·`docs/release/12-test-participant-edit-access.md`(TEST_PARTICIPANT_ID)·본 계정 단위 예외(TEST_USER_EMAIL, PR #184).

---

## 0. 전제 설정 (QA 시작 전)

- [ ] `cheese0318@gmail.com`으로 로그인 → 관리자(`/admin`) 접근 확인
- [ ] Vercel Settings → Environment Variables → `TEST_USER_EMAIL` = `cheese0318@gmail.com` (Production; 프리뷰 QA면 Preview에도)
- [ ] 재배포 완료(Deployments → Redeploy) — env는 다음 배포부터 적용
- [ ] 확인용: 둘러보기 진입 후 당사자 화면에서 저장이 "차단 문구" 없이 되는지(설정 성공 신호)

> ⚠️ `TEST_USER_EMAIL`은 전체 편집 우회 계정이므로 **테스트/프리뷰 전용**(운영 미설정 권장).

---

## 경로 A — 실무자 기능 편집 (`/supporter` 직접 접근 · env 불요)

> 둘러보기(view-as)가 아니므로 `TEST_USER_EMAIL` 없이도 작동. 관리자 RLS라 **모든 당사자** 대상.

### A-1. 거래장부·지출 (`/supporter/transactions`)
- [ ] 지출 목록·당사자별 장부 열람
- [ ] 거래 상세 진입 (금액·날짜·내용·영역·제공기관·정산상태)
- [ ] **신규 지출 기록**(실무자가 당사자 대신) — 금액·날짜·내용·영역
- [ ] 지출 **수정/삭제** — 정산상태 `pending`일 때만 허용, 검토 후엔 안내만 (A2)
- [ ] 영수증 **업로드 + OCR** — 상호·주소·금액 추출, signed URL 표시
- [ ] **활동사진 추가**(거래 상세 "활동 사진" 섹션, #185) — 5MB/장, 갤러리 반영

### A-2. 영수증 검토 (`/supporter/review`)
- [ ] 검토 대기 영수증 목록
- [ ] 승인/반려 처리 → 정산상태 변화

### A-3. 계획·평가·모니터링 (`/supporter/evaluations`)
- [ ] 계획 열람
- [ ] **모니터링 기록 작성** (#180)
- [ ] 모니터링 **수정**(실무자)
- [ ] 모니터링 **삭제** — 2단계 삭제 확인(관리자 전용)

### A-4. 서류·보고서
- [ ] 서류 보관함 (`/supporter/documents`) 열람·업로드
- [ ] **월간 실적 보고서 인쇄/제출본** (`/report/print`, #182) — 인쇄 레이아웃(`print:hidden` 적용)

### A-5. 정산 (관리자 전용)
- [ ] 정산 기록(`recordSettlement`) — 관리자 권한 확인, 반려/환수 흐름

### A-6. 관리자 대시보드 (열람)
- [ ] KPI 사업 현황(`/admin/insights`, #179)
- [ ] 슈퍼비전 실무자 현황(`/admin/supervision`, #181)
- [ ] 감사 열람 대시보드(`/admin/audit`, #176)

---

## 경로 B — 당사자 본인 화면 편집 (둘러보기 view-as · `TEST_USER_EMAIL` 필요)

> 진입: `/admin` → **당사자 관리** → 당사자 선택 → **"당사자 화면 미리보기"** 클릭
> 상단 "🔎 관리자 미리보기 — ○○님 화면이에요" 배너 확인 → 편집 시작

### B-1. 진입·배너
- [ ] "당사자 화면 미리보기" 클릭 → 당사자 홈으로 전환
- [ ] 상단 배너 표시 + 하단 탭바가 당사자 탭으로 변경
- [ ] (종료) "미리보기 나가기" → 관리자 화면 복귀

### B-2. 홈·탐색 (열람)
- [ ] 홈 대시보드(`/`) — 잔액·오늘 지출 등
- [ ] 달력(`/calendar`)
- [ ] 오늘 계획(`/plan`)
- [ ] 활동사진 갤러리(`/gallery`)
- [ ] 더보기(`/more`)

### B-3. 편집 (TEST_USER_EMAIL 설정 시 저장 허용)
- [ ] **화면설정**(preferences) — 테마·글자 크기·TTS·쉬운말 토글 **저장** 후 유지
- [ ] **프로필** 편집 저장
- [ ] **계획 피드백**(#183) — "확인했어요 / 궁금해요(본문)" 제출 → 실무자 열람 반영
- [ ] **지출 기록** 관련 편집(당사자 관점)
- [ ] **이의/반려 대응**(appeal) 작성
- [ ] 활동사진 관련 동작

> ⚠️ **신규 지출 FAB(+)는 둘러보기에서 숨겨짐**(읽기전용 UI 규칙, `ParticipantFab.tsx`). *당사자가 새 지출을 만드는* 흐름은 **경로 A(/supporter)**로 테스트.

---

## 대조·보안 QA (격리 확인)

- [ ] **TEST_USER_EMAIL 미설정**(또는 다른 관리자 계정)에서 둘러보기 → 저장 시 "지금은 관리자 미리보기 중이에요…" **차단 문구**(읽기전용 정상)
- [ ] 다른 관리자 계정 → 둘러보기 편집 **불가**(cheese0318만 열림) 확인
- [ ] 감사 로그(`/admin/audit`) — 대리열람(`participant.preview`)·영수증/서류 열람 기록 확인

---

## 접근성 QA (Easy Read · 별도 축, 선택)

- [ ] 버튼 44×44px 터치 영역
- [ ] 색 대비(4테마: 기본/다크/고대비/노랑)
- [ ] TTS(읽어주기) 주요 화면 동작
- [ ] "쉬운 말" 토글 → 용어 쉬운 표현 전환
- [ ] 인쇄 화면(월간보고서)에서 내비/사이드바 숨김

---

## 발견 사항 기록

| # | 경로 | 화면/기능 | 증상 | 심각도 | 비고 |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

> 심각도(치명/높음/보통/낮음)와 재현 절차를 적으면 수정 착수 시 바로 활용.

---

## 게이트되는 당사자 뮤테이션 (참조)

`viewAsWriteBlock`이 게이트하는 서버액션 — 둘러보기 + `TEST_USER_EMAIL` 시 전부 개방:
`activityPhoto · activitySuggestion · appeal · ocr · planReview · preferences · profile · serviceProvider · serviceUsage · staffReviewSuggestion` (`src/app/actions/*`).
