# 당사자 피드백 복구 (participant_feedback) — 설계·계약 (W)

> 관리자 QA 발견 **G2**. Seoul 리빌드에서 `participant_feedback` 테이블이 유실되어
> 피드백 기능 전체가 死. 코드(쓰기 `saveFeedback`·읽기 `getFeedback`·컴포넌트
> `SelfCheckFeedback`·온보딩 연동)는 전부 남아 있고 **테이블만 없다**. Track A '구멍
> 메우기'와 동류 — 테이블을 seoul 빌드에 되살려 기능을 복원한다(사용자 결정: 되살리기).

## 증상 (QA 라이브)
- **관리자**: `/admin/feedback` → raw DB 에러 노출
  `"Could not find the table 'public.participant_feedback' in the schema cache"`
- **당사자**: 온보딩 피드백(😊/😔) → `saveFeedback` insert 실패 → `.catch(()=>{})` 로
  조용히 삼킴 → 입력 영구 유실(당사자는 저장된 줄 앎).
- 전수 코드 스캔 결과 이런 레거시-테이블 구멍은 `participant_feedback` **하나뿐**
  (`documents`·`receipts` 는 Storage 버킷, `v_seoul_*` 는 03/05/14 정의됨 = 오탐).

## 코드가 기대하는 계약 (src/app/actions/feedback.ts)
- `saveFeedback(context, response)`: `createClient()`(RLS 적용) 로
  `insert({ participant_id: user.id, context, response })`. **`user.id` = 로그인 auth uid**.
- `getFeedback()`: 관리자 게이트 후 `createAdminClient()`(service role) 로 전량 조회
  `select id, participant_id, context, response, created_at ... order by created_at desc limit 200`,
  이름은 `profiles` 를 `participant_id` 로 조인해 붙인다.

## 데이터 모델 — `supabase/seoul/17_participant_feedback.sql` (U 구현)

```
public.participant_feedback
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
  participant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
  context        TEXT          -- 어느 화면/맥락(예: 온보딩 단계)
  response       TEXT          -- 감정 이모지(😊/😔) 또는 자유 응답
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()

인덱스
  idx_participant_feedback_participant  ON (participant_id)
  idx_participant_feedback_created      ON (created_at DESC)   -- getFeedback 정렬
```

### FK 대상이 `profiles(id)` 인 이유 (participants 아님)
`saveFeedback` 은 `user.id`(auth uid)를 `participant_id` 로 넣고, `getFeedback` 은 그 값을
`profiles` 에 조인한다. `profiles.id` 는 auth.users 와 1:1(01_core §2, 로그인마다 생성 —
당사자도 role='participant' 로 행을 가짐). 따라서 `profiles(id)` 가 참조 무결성·이름 조인
양쪽을 만족한다. **컬럼명 `participant_id` 는 레거시 오칭**(실제로는 "피드백을 남긴 로그인
계정")이나 앱 코드가 이 이름을 이미 쓰므로 유지하고 COMMENT 로 명시한다.

### RLS — 본인 작성 / 본인·관리자 열람 (append-only)
```
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;

-- 본인이 남기는 피드백만(스탬프 위조 차단)
INSERT  WITH CHECK (participant_id = auth.uid())
-- 본인 + 관리자 열람
SELECT  USING     (participant_id = auth.uid() OR public.seoul_is_admin())
-- UPDATE/DELETE 정책 없음 → append-only(RLS 기본 거부)
```
- `seoul_is_admin()` = 01_core 의 SECURITY DEFINER 헬퍼(profiles.role='admin').
- `getFeedback` 은 service role 로 읽어 RLS 를 우회하지만(코드 admin 게이트 별도), SELECT
  정책을 두어 방어심층 + `createClient()` 경유 접근도 안전하게.

## 멱등 / 의존 / 순서
- 멱등: `CREATE TABLE/INDEX IF NOT EXISTS` · `DROP POLICY IF EXISTS` 후 재생성.
- 의존: `profiles`(01) · `seoul_is_admin()`(01_core). → **01 이후 아무 때나** 실행 가능.
- 빌드 순서: 14 다음 17 (15·16 은 데모 시드라 빌드 배열 밖; 17 은 스키마라 빌드 배열 안).
- 번호: 16 은 미머지 PR #143(데모 서류 시드)이 점유 → 충돌 회피로 **17**.

## 계약 (RED) — `Plan&Source/ontology/seoul/verify_participant_feedback.sql`
- T0. 테이블·컬럼·NOT NULL 존재(구현 전 RED 게이트)
- T1a. RLS 활성 / T1b. FK profiles ON DELETE CASCADE(프로필 지우면 피드백도)
- S1. 본인이 자기 피드백 작성(participant_id=본인) → 성공
- S2. ★본인이 남 id 로 스탬프 위조 작성 → WITH CHECK 차단(0)
- S3. 본인이 자기 피드백 열람 → 봄
- S4. ★남이 내 피드백 열람 → 0(유출 차단)
- S5. 관리자가 전량 열람 → 봄

## CI (U 구현)
`.github/workflows/db-verify.yml`:
1. `build[]` 에 `supabase/seoul/17_participant_feedback.sql` 추가(14 다음).
2. 멱등 재적용 목록에 17 추가.
3. verify 배열에 `verify_participant_feedback` 추가.

## 앱 코드
테이블만 생기면 기존 `feedback.ts`·`SelfCheckFeedback`·`/admin/feedback` 이 **그대로 동작**
(코드는 늘 옳았고 테이블만 없었다). 이 슬라이스는 **순수 DB 복구** — 앱 코드 무변경.
(선택 후속: `getFeedback` 의 raw `error.message` 패스스루를 친화 문구로 하드닝 — 별도.)

## Manual-Ops (머지 후)
CI `db-verify` green 확인 → 대시보드 SQL Editor 에서 `17_participant_feedback.sql` 실행
(01 이후. 멱등이라 재실행 안전). 그러면 당사자 피드백 저장·관리자 열람 복원.
(선택: QA 가시성 위해 데모 피드백 시드 별도 슬라이스 — F1b 데모서류 시드 패턴.)
