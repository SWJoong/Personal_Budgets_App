# 통합 감사 로그 `seoul_audit_log` — 설계·계약 (W → U)

> 작성: **W(설계·검증, `/pl` `/backend-설계측`)** · 대상: **U(구현·배포, `/backend`)** · test-first
> 배경: PRD 7장 감사로그(통합 audit trail·3년 보관) = PRD 정합성 리뷰([docs/release/03](../docs/release/03-prd-alignment-review.md))가
> 짚은 실질 공백. 현재는 도메인별 트리거 기록(`seoul_rule_checks` 등)만 있고 **통합 조회·비가역 추적이 없다**.
> 사용자 착수 결정(2026-09-02). 레인: 설계·`verify_*.sql` = **W** · 빌드 SQL(`supabase/seoul/`)·앱 배선 = **U**.

---

## 1. 목적·원칙

**무엇을 남기나**: "누가(actor) · 무엇을(action) · 누구/무엇에(target) · 언제(created_at)"를 **한 테이블에
비가역(append-only)** 으로. 민감·비가역 행위(남의 화면 열람=B4 미리보기, 역할 변경, 정산·심의 결정, 삭제,
초대)를 사후 추적·소명할 수 있게 한다.

**핵심 원칙 4가지**
1. **비가역(append-only)**: UPDATE·DELETE 금지(보관기간 내). 감사 로그가 고쳐지면 감사가 아니다.
2. **행위자 위조 불가(non-repudiation)**: actor 는 앱이 넘기는 값이 아니라 **`auth.uid()` 로 서버가 스탬프**.
   → 삽입은 `SECURITY DEFINER` 함수 경유만, 테이블 직접 INSERT 는 회수.
3. **★식별정보 최소(B5 계승)**: `metadata` 에 **이름·자유서술·영수증 내용 등 원문 PII 를 넣지 않는다**.
   id·코드·수치만. 감사 로그는 "무슨 일이 있었나"를 id 로 가리키지, 내용을 복제하지 않는다.
4. **열람 제한**: 읽기는 **관리자(`seoul_is_admin()`)만**. 일반 실무자·당사자는 못 본다.

**보관**: 3년(PRD). 실제 파기(purge)는 후속 스케줄 작업(범위 밖) — 지금은 **정책 명문화 + append-only 보장**.

---

## 2. 스키마 (U 구현 — `supabase/seoul/12_audit_log.sql`)

```sql
CREATE TABLE IF NOT EXISTS public.seoul_audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 누가(=auth.uid, 함수가 스탬프)
  actor_role            TEXT,                        -- 당시 역할 스냅샷(admin/supporter/participant)
  action                TEXT NOT NULL,               -- 무엇(코드, §3)
  target_type           TEXT,                        -- 대상 종류('participant'·'plan'·'settlement'·'user'·'invitation'…)
  target_id             UUID,                        -- 대상 id
  target_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL, -- 당사자 스코프(있으면)
  metadata              JSONB NOT NULL DEFAULT '{}', -- ★코드·id·수치만(원문 PII 금지)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_participant ON public.seoul_audit_log (target_participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor       ON public.seoul_audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action      ON public.seoul_audit_log (action, created_at DESC);
```

`updated_at` 컬럼을 **두지 않는다**(append-only 를 스키마로 신호).

### 삽입 함수 (SECURITY DEFINER — 행위자 스탬프·직접 INSERT 차단)
```sql
CREATE OR REPLACE FUNCTION public.seoul_audit(
  p_action         TEXT,
  p_target_type    TEXT  DEFAULT NULL,
  p_target_id      UUID  DEFAULT NULL,
  p_participant_id UUID  DEFAULT NULL,
  p_metadata       JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp     -- definer 필수(권한상승 방지)
AS $$
DECLARE v_id UUID; v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'seoul_audit: 인증 필요';   -- 익명 스탬프 금지
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.seoul_audit_log
    (actor_user_id, actor_role, action, target_type, target_id, target_participant_id, metadata)
  VALUES
    (auth.uid(), v_role, p_action, p_target_type, p_target_id, p_participant_id, COALESCE(p_metadata,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL     ON FUNCTION public.seoul_audit(TEXT,TEXT,UUID,UUID,JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.seoul_audit(TEXT,TEXT,UUID,UUID,JSONB) TO authenticated;
```
- **왜 definer**: 앱(authenticated)은 테이블에 **직접 INSERT 권한이 없다**(아래 RLS/GRANT). 오직 이 함수로만
  기록 → actor 를 `auth.uid()` 로 강제 스탬프(위조·타인 사칭 불가). `seoul_provider_domains()`(#52)와 같은
  검증가능한 definer 관용구.

### RLS·권한 (append-only + 관리자 열람)
```sql
ALTER TABLE public.seoul_audit_log ENABLE ROW LEVEL SECURITY;

-- 읽기: 관리자만
DROP POLICY IF EXISTS seoul_audit_log_select ON public.seoul_audit_log;
CREATE POLICY seoul_audit_log_select ON public.seoul_audit_log
  FOR SELECT USING (public.seoul_is_admin());

-- INSERT/UPDATE/DELETE 정책 없음 → RLS 로 전부 차단(비관리자 read 도 0).
-- 테이블 직접 DML 권한 회수: 삽입은 definer 함수로만, 수정·삭제는 아무도 못 함(append-only).
REVOKE INSERT, UPDATE, DELETE ON public.seoul_audit_log FROM authenticated;
GRANT  SELECT                 ON public.seoul_audit_log TO authenticated;  -- RLS 가 관리자로 좁힘
```
- **비가역**: UPDATE·DELETE 정책이 없고 grant 도 회수 → authenticated 는 수정·삭제 불가. (관리자도 앱에선
  못 고침 — 서비스롤/DBA 만. 보관기간 파기는 후속 스케줄.)

---

## 3. 무엇을 기록하나 (스코프 — 노이즈 회피)

**기록(민감·비가역 행위만)** — 앱 서버액션이 성공 직후 `seoul_audit(...)` 호출:

| action 코드 | 트리거 지점(서버액션) | target | metadata(PII 금지) |
|---|---|---|---|
| `participant.preview` | 미리보기 진입(B4, `admin/participants/[id]/preview`) | participant | `{}`(누가 누구를=컬럼) |
| `role.change` | `admin.updateUserRole` | user | `{from, to}`(역할 코드) |
| `participant.delete` | `admin.deleteParticipant` | participant | `{}` |
| `plan.review` | `planReview.decidePlanReview` | plan | `{decision}` |
| `settlement.record` | `settlement.recordSettlement` | settlement | `{accepted,rejected,recovered,unused}`(수치) |
| `invitation.create`/`.delete` | `admin.createInvitation`/`deleteInvitation` | invitation | `{role}` |
| `ai.summary`/`ai.suggest` | 요약·제안 생성(#73/#74) | plan/participant | `{model}`(내용 금지) |

**기록 안 함**(노이즈·중복): 일반 조회(read), 정상 지출 기록(`service_usages` 자체가 원장), 로그인 등.
→ 로그인·인증 이벤트는 Supabase Auth 로그가 별도 보유(중복 회피).

**배선 방식**: 앱층 `seoul_audit()` RPC 호출(서버액션에서 `supabase.rpc('seoul_audit', {...})`)을 **기본**으로 한다.
DB 트리거 방식(테이블 변경 자동 기록)은 (a) 세션 actor 파악이 트리거에선 `auth.uid()` 로 가능하나 (b) "무엇이
민감한가"의 판단이 앱 맥락에 있어 **앱층 명시 호출이 더 정확**하다. 트리거는 후속(예: 하드 삭제 감지)에서 선택.

---

## 4. 앱 배선 (U — 서버액션에 1줄씩)

```ts
// 예: 역할 변경 감사 (admin.ts updateUserRole 성공 직후)
await supabase.rpc('seoul_audit', {
  p_action: 'role.change', p_target_type: 'user', p_target_id: userId,
  p_metadata: { from: prevRole, to: newRole },
})
```
- **실패 격리**: 감사 기록 실패가 본 동작을 되돌리지 않게 `try/catch`(감사 손실 < 기능 마비). 단 실패는 서버
  로그로 남긴다. (감사 필수성이 높은 액션은 후속에서 트랜잭션 결합 검토.)
- **B4 미리보기**: `preview/page.tsx` 서버 로드 시 `seoul_audit('participant.preview','participant', id, id)` 1회.
  ([goala_comingsoon_stubs_triage_W.md](goala_comingsoon_stubs_triage_W.md) §4-8-4 감사 연계 실현.)

---

## 5. W 계약 — `verify_audit_log.sql` (test-first, RED→U green)

`Plan&Source/ontology/seoul/verify_audit_log.sql`. 초록이면 "비가역·행위자스탬프·관리자열람·PII최소" 계약이
스펙대로 선 것. U 가 `12_audit_log.sql` 구현 + `db-verify.yml` verify 배열에 `verify_audit_log` 1줄 추가 시 발동.

**못박는 불변식**:
1. **테이블·함수 존재**: `seoul_audit_log` 테이블 + `seoul_audit(...)` 함수.
2. **함수 = SECURITY DEFINER + search_path 고정** (definer 관용구).
3. **EXECUTE→authenticated · PUBLIC 회수** (provider_domains P2 와 동형).
4. **행위자 스탬프**: authenticated 로 `seoul_audit()` 호출 → 행의 `actor_user_id` = 그 `auth.uid()`
   (앱이 다른 값을 못 넣음 — 함수 시그니처에 actor 인자 없음).
5. **직접 INSERT 차단**: authenticated 의 `INSERT INTO seoul_audit_log` 는 권한오류(함수로만 기록).
6. **비가역**: authenticated 의 `UPDATE`·`DELETE` 는 권한/RLS 차단(0행 또는 오류).
7. **열람 관리자 한정**: admin 은 전건 SELECT, supporter·participant 는 **0행**(RLS).
8. **PII 최소(구조적)**: 테이블에 이름·자유서술 원문 컬럼이 없다(id·코드·jsonb 만). metadata 규율은 앱 계약(§3)
   + 코드리뷰로 보증(SQL 로 값 내용까지는 강제 못 함 — 설계 주석으로 명문화).

---

## 6. U 핸드오프 체크리스트
1. `supabase/seoul/12_audit_log.sql`: 테이블 + 인덱스 + `seoul_audit()` definer 함수 + RLS/GRANT(§2). 멱등.
2. `db-verify.yml`: build 배열에 `12_audit_log.sql`, verify 배열에 `verify_audit_log` 추가(둘 다).
3. 앱 배선(§3·§4): 7개 action 지점에 `supabase.rpc('seoul_audit', …)` (try/catch). B4 미리보기 포함.
4. `npm run generate-types` → `database.ts` 재생성(신규 테이블·함수).
5. green 후 W 재검증·머지.

## 7. 후속(범위 밖, 명문화만)
- **파기 스케줄**(3년 경과 purge): pg_cron 또는 관리작업. 파기도 감사 대상(메타 로그).
- **관리자 감사 뷰 화면**: `admin/audit`(읽기 대시보드) — 별도 UX 스펙(당사자별·행위자별·기간 필터).
- **트리거 기반 하드삭제 감지**: 앱 우회 DML 포착(선택).
- **무결성 강화**: 해시체인/서명(고보안 요구 시) — 현재 append-only + definer 로 충분(1기관·내부).
