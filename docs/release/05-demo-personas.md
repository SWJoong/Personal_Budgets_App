# 05 · 데모 페르소나 10명 시드 — 실행 노트 & 수동작업 브리핑

**작성**: U · **일자**: 2026-09-06 · **대상**: `supabase/seoul/08_seed_demo.sql` (당사자 1명 → 10명)

서울형 개인예산제 데모를, 발달장애 당사자 10명의 **입체 페르소나 + 사람중심계획**으로
확장했다. 페르소나는 [NVIDIA Nemotron-Personas-Korea](https://huggingface.co/datasets/nvidia/Nemotron-Personas-Korea)
26필드 형식으로 구성하고, 각자의 생애사·사업 목표·사람중심생각에서 이용계획을
도출해 신청~정산 전 과정을 데이터로 남겼다. 정본: [`docs/demo/seoul-personas.md`](../demo/seoul-personas.md).

## 1. 진척 요약 (무엇이 검증됐나)

- **로컬 PostgreSQL 15 실측 검증(green)**: `verify_00_auth_stub` → `supabase/seoul/00~05·07·09~12` →
  **`08`** 순서로 무오류 적용. 이어서 데이터 정합성 스팟체크 통과.
- **재실행(idempotent)**: `08` 2회 실행 시 행수 불변(중복 없음) 확인.
- **핵심 지표(실측)**: 당사자 10 · 신청 10 · 동의 20 · 선정 9 · 계획 9 · 요청서비스 26 ·
  심의 7 · 이의신청 2 · 배정 6 · 이용 19 · 영수증(경로) 7 · 검토대기 rule_check 2 ·
  정산 2 · 모니터링 6 · 욕구사정 10.
- **본인부담금 엔진**: 일반(이서연) **150,000원 부과(charged)**, 기초수급(김지수·최민수)·
  차상위(박준호·강도현·한소영) **면제** — `seoul_set_copay()` 트리거로 자동 산정 확인.
- **계획외 지출 플래그**: 김지수·한소영의 계획외 1건씩이 자동 차단이 아니라
  `seoul_rule_checks`(needs_review·pending)로 남아 담당자 "검토 대기"에 노출.
- **절차 전 단계 분포**: 접수·심사(윤미래) / 계획작성(정하늘) / 심의대기(오지훈) /
  승인·이용(5명) / 조건부→이의→부분배정(최민수) / 부결→이의진행(임재현).
- **활동사진(#117 `seoul_activity_photos`)**: 활동성 이용건에 사진행 시드(김지수 갤러리 4장
  포함, 총 10장). 경로 위조 방지 트리거 통과(첫 세그먼트=참여자 id). 갤러리 활동사진 우선 표시.

> 범위: 이 변경은 **시드 SQL + 문서만**(TS/테스트 무접촉). 앱 빌드·vitest 영향 없음 —
> 실제 산출물(SQL)은 위와 같이 PG15에서 직접 검증했다. PR에서 CI `quality-check`·`db-verify` 재확인.

## 2. 수동 절차 체크리스트 (대시보드 — 사용자 실행)

SQL은 코드로만 만들고 **실행은 사용자가** 대시보드 SQL Editor에서 한다(프로젝트 규칙).
새 프로젝트라면 `supabase/seoul/README.md` 순서(00~09)를 먼저 끝낸 뒤:

1. **데모 계정 3종 생성** — 터미널에서 `node scripts/seed-demo-auth.mjs`
   (env: `DEMO_ADMIN_EMAIL/PASSWORD`, `DEMO_SUPPORTER_EMAIL/PASSWORD`,
   `DEMO_PARTICIPANT_EMAIL/PASSWORD`). 목적: 관리자·담당자 역할 배정과
   **1번 당사자(김지수)** 로그인 연결(이메일 일치). `DEMO_PARTICIPANT_EMAIL`은
   반드시 `demo.participant@example.com`(=1번 email)이어야 자동 연결됨.
2. **`08_seed_demo.sql` 실행** — SQL Editor에 붙여 실행. 당사자 10명 + 전 파이프라인 시드.
   07(차수·기관)·09(분류축·욕구사정 테이블)가 선행되어 있어야 함(없으면 명시적 예외로 중단).
3. **로그인 연결 확인** — 데모 당사자 계정으로 한 번 로그인(또는 이미 로그인 상태면
   `participants_autolink`가 자동 연결). 관리자·담당자로 로그인해 캐어로드 10명이
   목록에 뜨는지 확인.
4. **(선택) 데모 로그인 버튼 노출** — `.env`에 `NEXT_PUBLIC_DEMO_LOGIN_ENABLED=true`.
5. **(선택) 사진·서류 표시** — 갤러리 활동사진/영수증/신청서 원본은 경로만 시드됨.
   실제 이미지를 보려면 Storage `receipts`(또는 신설될 `activity-photos`) 버킷에
   경로 규칙 `{participant_id}/{usage_id}.jpg`로 샘플 파일을 수동 업로드.
   파일이 없으면 signed URL이 falsy라 갤러리가 조용히 걸러냄(에러 아님).

## 3. 되돌림 · 리스크

- **멱등**: `08`은 이메일·접수번호·(application/plan/allocation) 키와 "존재 시 건너뜀"
  가드로 재실행 안전. 다시 돌려도 중복 생성 없음.
- **데이터 영향**: 데모 데이터만 추가한다. 스키마 변경 없음(03/04/타입 무접촉).
- **롤백**: 데모 당사자 제거가 필요하면 이메일(`demo.participant`, `demo.p02`~`demo.p10`)로
  `participants` 행을 지우면 FK `ON DELETE CASCADE`로 하위(신청·계획·배정·이용·정산·
  모니터링·영수증·rule_check)가 함께 삭제된다. (운영 데이터와 이메일이 겹치지 않게 유의.)
- **자격증명**: 에이전트는 대시보드 실행·비밀번호 입력을 대신하지 않는다 — 위 1·2단계는
  사용자가 실행한다.

## 4. 후속 (별도 작업)

- **활동사진 테이블**: `seoul_activity_photos`(#117, main 695c0ab)가 머지되어 이 `08`에
  활동사진 시드 섹션을 **추가 완료**(origin/main 병합 후). 경로 위조 방지 트리거 규약에 맞춰
  `{participant_id}/{usage_id}/{photo_id}.jpg`로 시드.
- **사진 바이트**: SQL로 넣을 수 없으므로 실제 이미지는 수동 업로드 단계로 남는다
  (버킷 `activity-photos`/`receipts`, 경로는 위 규칙).
