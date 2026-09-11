# SIS-A 척도 기록 부활 (sis_assessments) — 설계·계약 (W)

> 관리자 QA 발견 **#9**: "SIS-A 척도 기록 기능 missing. 다시 살리기". 채점 로직
> `src/utils/sis-a.ts`(원점수→표준점수→지원요구지수/백분위, `calculateSisA`)는 **생존**하나,
> 저장 테이블은 아카이브(`supabase/migrations/_archive/15_sis_assessments.sql`)로 빠졌고
> **기록 UI 도 서울 리빌드에서 유실**됐다. G2(피드백)보다 큰 미니 트랙 — 테이블+액션+UI+허브 배선.
> 참고: 현재 참여자 허브의 "욕구사정(SIS-A)" 메뉴는 실제론 영역 욕구사정(needs assessment)으로
> 가서 라벨이 혼동돼 있다 → SIS-A 를 별도 진입점으로 분리한다.

## 계산 계약 (기존 `src/utils/sis-a.ts` — 무변경, 재사용)
`calculateSisA(raw: Record<SisSubScale,number>)` → `{ std, totalStd, indexScore, percentile }`.
6개 하위척도(2A 가정생활·2B 지역사회생활·2C 평생학습·2D 고용·2E 건강&안전·2F 사회).

## ① DB 슬라이스 — `supabase/seoul/18_sis_assessments.sql` (U, Manual-Ops)
아카이브 스키마를 서울 신원·RLS 규약으로 되살린다.
```
public.sis_assessments
  id UUID PK, participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_2a..raw_2f INTEGER NOT NULL DEFAULT 0,   -- 원점수
  std_2a..std_2f INTEGER NOT NULL DEFAULT 0,   -- 표준점수
  total_std INTEGER NOT NULL DEFAULT 0,
  index_score TEXT NOT NULL DEFAULT '',        -- 지원요구지수(예 "128-129")
  percentile  TEXT NOT NULL DEFAULT '',        -- 백분위(예 ">99")
  created_by UUID REFERENCES profiles(id),     -- 서울 규약(auth.users 아님)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
인덱스: (participant_id) · (participant_id, assessed_at DESC)
```
RLS(사정성 정보 — 09 needs_assessment 패턴):
- SELECT `seoul_can_access(participant_id)` (본인 + 담당/관리자 — 아카이브도 당사자 본인 열람 허용)
- INSERT/UPDATE/DELETE `seoul_is_staff_for(participant_id)` (실무자·관리자만 기록)
- 멱등: CREATE TABLE/INDEX IF NOT EXISTS · DROP POLICY IF EXISTS 후 재생성. 의존: participants·헬퍼(01).
- 번호 18 (16 데모서류·17 피드백 머지됨). 빌드배열+멱등재적용+verify 3곳 CI 등록.

### 계약 `Plan&Source/ontology/seoul/verify_sis_assessments.sql` (RED)
T0 테이블·컬럼(raw/std 12 + total/index/percentile). T1 RLS·FK CASCADE.
S1 담당 실무자 기록·열람. S2 본인 자기 열람(seoul_can_access). S3 남 열람 차단(유출0). S4 본인 무단기록 차단(staff아님).

## ② 서버 액션 — `src/app/actions/sisAssessment.ts` (U)
- `saveSisAssessment({ participantId, raw })`: assertStaff → `calculateSisA(raw)` 로 std/total/index/percentile 산출 → insert(raw+std+total+index+percentile+created_by). revalidate.
- `getSisAssessments(participantId)`: 목록(assessed_at desc).

## ③ 기록 UI — `src/app/(supporter)/supporter/[participantId]/sis/` (U)
- `page.tsx`(서버): requireStaff → getSisAssessments → 클라이언트에 전달.
- `SisAssessmentClient.tsx`('use client'): 6개 원점수 입력 → **입력 즉시 `calculateSisA` 로 표준점수·지수·백분위 미리보기**(순수 계산이라 클라에서 실시간) → 저장(saveSisAssessment) → 과거 기록 목록(지수·백분위·일자). Easy Read·44px·시맨틱 토큰.
- 계약 `SisAssessmentClient.test.tsx`(W): 6입력 렌더·실시간 계산 표시(예 raw→index)·저장 시 액션이 raw 로 호출·목록 렌더.

## ④ 허브 배선 (U)
`src/app/(supporter)/supporter/participants/[id]/page.tsx` 의 "욕구사정 · SIS-A" 카드를 정리:
- 욕구사정(영역)과 **SIS-A(척도)를 별도 항목**으로. SIS-A → `/supporter/[id]/sis`.

## 게이트 / Manual-Ops
- 재게이트: tsc·lint·vitest(계약)·build + docker DB verify(RED→GREEN) + 라이브 QA.
- Manual-Ops: 머지·db-verify green 후 대시보드에서 `18_sis_assessments.sql` 실행(01 이후·멱등). NOTIFY 후 확인.
- ★교훈 반영([[reference_manual-ops-verify]]): 실행 후 PostgREST 직접 타진(200)로 반영 확인, 42P01/PGRST205 구분.
