# 12 — 테스트 당사자 편집 접근 (`TEST_PARTICIPANT_ID`)

## 배경
관리자 계정(예: `cheese0318`)이 **둘러보기(view-as)** 로 당사자 화면에 들어가 화면 설정 등을
저장하려 하면 "지금은 관리자 미리보기 중이에요…" 로 막힌다. view-as 는 설계상 **읽기전용 미리보기**
(실참여자 데이터 오조작 방지)이기 때문이다([`viewAsWriteBlock`](../../src/utils/supabase/viewAs.ts)).

테스트 목적으로 **딱 한 명의 테스트용 당사자**에 한해 이 읽기전용 예외를 연다.

## 동작
- `viewAsWriteBlock()` 은 미리보기 대상 `participantId` 가 `process.env.TEST_PARTICIPANT_ID` 와
  같을 때만 `null`(허용)을 돌려준다. 그러면 그 당사자에 대해서는 화면설정 저장뿐 아니라
  view-as 가드를 쓰는 **모든 편집**(이의신청·계획통지·활동사진·AI 제안 등)이 열린다.
- 그 외 **모든 실참여자는 그대로 읽기전용**. `TEST_PARTICIPANT_ID` 미설정이면 예외가 없는 것과 같아
  기존 동작이 100% 유지된다.
- 보안: RLS·트리거상 admin 은 이미 참여자 필드 쓰기 권한이 있으므로, 이건 '권한 부여'가 아니라
  **앱 레벨 읽기전용 가드의 테스트 예외**다. 쿠키 위조 방어(비관리자 무효) 등 기존 불변식은 그대로.

## 수동 설정 (사용자)
1. **테스트용 당사자 하나를 정한다.** 되도록 실사용자 아닌 시드/더미 당사자를 쓴다.
2. **그 당사자의 `participants.id`(UUID)를 확인한다.** 가장 쉬운 방법:
   관리자 화면에서 그 당사자 상세로 들어가면 URL 이 `/admin/participants/<UUID>` 다 — 이 `<UUID>` 가 값.
   (또는 Supabase 대시보드 `participants` 테이블에서 확인.)
3. **환경변수 설정** — 서버 전용(`NEXT_PUBLIC_` 아님):
   - Vercel: Project → Settings → Environment Variables → `TEST_PARTICIPANT_ID = <UUID>`
     (Preview/Production 중 **테스트로 쓸 환경에만**). 저장 후 재배포.
   - 로컬: `.env.local` 에 `TEST_PARTICIPANT_ID=<UUID>`.
4. 관리자로 로그인 → 그 당사자로 **둘러보기** 진입 → 화면 설정을 바꾸고 저장하면 이제 반영된다.

## 되돌림·주의
- 예외를 끄려면 `TEST_PARTICIPANT_ID` 를 지우고 재배포하면 된다(즉시 전면 읽기전용 복귀).
- **운영 환경에는 설정하지 않는 것을 권장.** 설정하면 그 한 당사자는 관리자 미리보기 중 편집이
  실제 저장되므로, 진짜 사용자 계정이 아닌 더미를 지정할 것.
- UX 참고: 편집이 허용돼도 상단 배너는 여전히 "미리보기 중"으로 표시된다(테스트 계정이라 그대로 둠).
