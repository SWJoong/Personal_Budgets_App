# 12 · P0-B 감사로그 완성 — 열람(read) 기록 + 보관·파기

> [`10`](10-disability-law-a11y-eval.md) P1 / [`11`](11-p0-privacy-compliance.md) §4(P0-B) 착수.
> 개인정보보호법 §29(안전조치) + 「개인정보의 안전성 확보조치 기준」(접속기록 보관) 대응.
> **작성**: U · **작성일** 2026-09-14 · 브랜치 `feat/p0b-audit-retention`.

## 1. 배경 (도11 §4 갭)
통합 감사로그 `seoul_audit_log` 는 이미 있으나(append-only·행위자 위조불가·관리자 열람) —
(a) **쓰기·AI 호출만 기록, 열람(read) 미기록**, (b) **보관기간 정책값·파기(purge) 없음** 이 갭이었다.
안전성확보조치 기준상 **접속기록 = 개인정보 열람/조회도 포함**, 보관은 **1년 이상(민감정보·고유식별정보
처리 시스템은 2년 이상)**. 이 시스템은 민감정보(장애)를 처리한다.

## 2. 변경 — 열람(read) 감사 배선
**고위험 파일 접근**(private 버킷 signed URL 발급 = 실제 민감 파일 열람)에 `auditLog` 추가:

| 액션 | 파일 | action 코드 | 스코프 |
|---|---|---|---|
| `getReceiptSignedUrl` | `src/app/actions/serviceUsage.ts` | `receipt.view` | targetId=usageId(→참여자) |
| `getDocumentSignedUrl` | `src/app/actions/document.ts` | `document.view` | participantId 직접 |
| `getApplicationDocumentUrl` | `src/app/actions/application.ts` | `document.view` | participantId 직접 |

- 행위자는 `seoul_audit` 이 `auth.uid()` 로 스탬프(위조 불가), metadata 는 `{bucket}` 만(원문 PII 금지).
- 실패는 `auditLog` 내부 try/catch 로 격리(감사 손실 < 열람 마비).
- **스코프 결정(의도적 제외)**: ① 당사자 **본인 갤러리**(`(participant)/gallery`) signed URL = **자기 접근**
  이라 접속기록(취급자→개인정보) 대상 아님 → 제외. ② 갤러리 **서버 컴포넌트 일괄 발급**은 렌더마다
  다건·중복로그 위험 → 이번 슬라이스 제외(후속: 페이지당 1회 `gallery.view` 설계).

## 3. 변경 — 보관·파기(purge) 메커니즘
`supabase/seoul/12_audit_log.sql` 에 추가(멱등):
- `seoul_audit_purge(p_retain_days INT) RETURNS INTEGER` — `SECURITY DEFINER`, `search_path` 고정.
  보관 연한 경과 레코드 DELETE 후 삭제 건수 반환. append-only 테이블의 **유일한 DELETE 경로**(직접 DELETE 는 회수됨).
- **정책/메커니즘 분리**: 정확 보관 연한은 스케줄러 인자로 전달(스키마에 미박음). 함수는 **365일 미만 거부**
  (법정 1년 최소 안전레일)만 강제.
- 권한: `authenticated` 실행 회수, **`service_role` 만 EXECUTE**(운영 스케줄러 전용).

## 4. Manual-Ops (사용자 실행 — 에이전트 대행 금지)
CI 계약 green 확인 후:
1. **`12_audit_log.sql` 대시보드 적용** — SQL Editor 에서 전체 재실행(멱등). ★ 도11 §4에서 지적된
   "12 라이브 적용 미확정" 을 이때 해소(테이블·`seoul_audit`·`seoul_audit_purge` 반영 확인).
2. **파기 스케줄 등록** — 아래 중 하나(보관 연한 = 기관 결정값, 권고 730):
   - pg_cron(확장 사용 가능 시): `SELECT cron.schedule('audit-purge','0 3 * * *', $$ SELECT public.seoul_audit_purge(730); $$);`
   - 또는 Supabase Scheduled Edge Function / 외부 cron → `rpc('seoul_audit_purge', { p_retain_days: 730 })` (service_role 키).
3. **동작 확인** — `SELECT public.seoul_audit_purge(730);` 1회 수동 실행 → 반환값(삭제 건수) 확인.

## 5. [기관결정] 대기
- **접속기록 보관 연한** — 권고 **730일(2년, 민감정보)**; 기관 정책으로 상향 가능(3년 등). 스케줄러 인자로 반영.
- (도11 §6의 다른 [기관결정] 4건과 별개 — 이건 감사 보관 전용.)

## 6. 후속(백로그)
- **[보통·W발견] 검토큐 열람 로그 증폭** — `src/app/(supporter)/supporter/review/page.tsx` 가 서버 렌더마다
  대기 영수증 수만큼 `receipt.view` 를 남긴다(새로고침·재진입 중복). 접속기록이 렌더 트래픽으로 희석됨.
  → 페이지당 1회 이벤트화 또는 실제 확대(열람) 시점 로깅으로 좁히기(갤러리 `gallery.view` 와 동일 논점).
  보안결함 아님("전부 로깅=완전성" 현 결정) — fast-follow.
- **[낮음·W발견] `receipt.view` 참여자 스코프 부재** — `getReceiptSignedUrl` 은 `participantId` 미전달
  (`target_participant_id=NULL`) → 당사자중심 "내 정보 열람자" 리포트에서 usageId→participant 조인 필요.
- 당사자 **상세/민감기록 열람**(서버 컴포넌트) 감사 — 중복로그 방지 설계 후.
- 갤러리 **페이지당 1회** `gallery.view` 감사.
- ✅ **완료(W)**: `Plan&Source/ontology/seoul/verify_audit_log.sql` P9~P12(purge 존재·DEFINER·search_path /
  service_role 전용·authenticated·PUBLIC 회수 / 365·NULL 안전레일 / 삭제·보존 동작) — 로컬 PG15 실측 green.
  `verify_00_auth_stub.sql` 에 `anon`·`service_role` 롤 추가(CI db-verify 의 service_role GRANT 빌드깨짐 해소).
