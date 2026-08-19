# 서울형 전용 앱 — DB 빌드

이 디렉터리는 서울형 개인예산제 전용 앱의 **정본 DB 빌드**입니다.
`supabase/migrations/`(기존 아름드리꿈터 앱 이력)는 이 브랜치에서 쓰지 않습니다 —
그쪽은 코어 7개 테이블(`profiles`·`participants` 등)을 만들지 않아 빈 프로젝트에서
첫 파일부터 실패합니다. 자세한 배경은 `Plan&Source/서울형_온톨로지_설계_v1.md`
§5-1과 이 세션의 커밋 로그를 참고하세요.

## 실행 순서

**새 Supabase 프로젝트**(리전: Seoul, ap-northeast-2)를 만든 뒤 **대시보드 > SQL Editor**에서
아래 순서대로 **수동 실행**합니다(로컬 `supabase db push` 미사용 — CLAUDE.md 규칙).

```
00_extensions.sql      pgcrypto
01_core.sql            profiles / participants / user_invitations
                       + 신원 연결 함수 + RLS 헬퍼 함수
02_core_rls.sql        코어 3개 테이블 RLS 정책
03_seoul_schema.sql    서울형 27 테이블 / 6 트리거 / 7 뷰 / 14 인덱스
04_seoul_rls.sql       서울형 74개 RLS 정책
05_seoul_graph.sql     그래프 오버레이 (FK → 트리플 투영)
06_storage.sql         Storage 버킷 3종(private) + 소유권 범위 정책
07_seed_program.sql    제도 데이터 (차수·시행주체·수행기관·심의위원회)
```

여기까지가 **운영 환경에도 그대로 실행하는 부분**입니다. 이어서 데모 계정이 필요하면:

```
scripts/seed-demo-auth.mjs   (터미널에서 실행 — SQL 아님)
08_seed_demo.sql              데모 참여자 1명을 신청→선정→계획→배정→이용까지 채움
```

모든 SQL 파일은 **재실행 가능(idempotent)**합니다. 중간에 실패해도 고친 뒤 처음부터
다시 돌리면 됩니다 (`CREATE TABLE/INDEX IF NOT EXISTS`, 트리거·정책은 `DROP ... IF EXISTS` 후
재생성, 시드는 `ON CONFLICT`/`WHERE NOT EXISTS`).

**요구 버전**: PostgreSQL 15 이상 (뷰의 `security_invoker` 옵션 필요).

## 신원 모델 — 이 빌드의 핵심 결정

기존 앱은 `participants.id`가 로그인 계정 id와 같다고 가정한 코드가 화면 곳곳에 있었고,
실제로는 그렇지 않아 구글 로그인을 켜는 순간 당사자가 자기 데이터를 못 보는 결함이었습니다.

이 빌드에서는:
- `participants.id` — 기관이 발급하는 내부 키. 로그인 계정과 무관.
- `participants.auth_user_id` — 로그인 계정과의 연결 고리. 처음엔 `NULL`.
- 연결은 **이메일 일치로 자동**. 관리자가 참여자를 이메일과 함께 등록 → 그 사람이
  구글로 로그인 → `handle_new_user()` 트리거가 이메일이 일치하는 미연결 참여자 행을 찾아
  `auth_user_id`를 채웁니다. 참여자 등록이 로그인보다 늦어도(반대 순서) `participants_autolink`
  트리거가 같은 일을 합니다 — 어느 순서로 일어나도 연결됩니다.
- RLS는 전부 `auth_user_id` 경유로 본인을 판정합니다(`seoul_is_self()`). `participants.id = auth.uid()`
  로 비교하는 코드는 전부 틀린 것입니다.

## 대시보드 수동 작업 (SQL로 안 되는 것)

1. **프로젝트 리전을 Seoul(ap-northeast-2)로 생성** — 나중에 못 바꿉니다.
2. **Authentication > Providers > Google** 활성화, Client ID/Secret 입력.
   Google Cloud Console의 승인된 리디렉션 URI는 `https://<project-ref>.supabase.co/auth/v1/callback`
   (Supabase 자체 URL이지 앱 URL이 아닙니다).
3. **Authentication > URL Configuration** — Site URL = 운영 Vercel URL, Redirect URLs에
   `http://localhost:3000/**`, `https://<project>.vercel.app/**`, `https://<project>-*.vercel.app/**`
   (프리뷰 배포용 와일드카드 — 빠뜨리면 PR 프리뷰마다 로그인이 깨집니다).
4. **Authentication > Providers > Email** — 활성 유지하되 "Allow new users to sign up"은 끕니다.
   (Admin API로 만드는 데모 계정은 이 설정과 무관하게 생성됩니다. 일반 가입만 막습니다.)
5. Storage 버킷 3종이 `06_storage.sql` 실행 후 실제로 Public이 꺼져 있는지 대시보드에서 눈으로 확인.
6. **Kakao Developers > 플랫폼 > Web**에 새 Vercel 도메인 등록 (지도 기능 쓸 경우).

## 검증

`Plan&Source/ontology/seoul/verify_*.sql` 하네스를 이 빌드에 맞게 재사용합니다.
로컬 임시 PostgreSQL 클러스터에서 `00 → 01 → 02 → 03 → 04 → 05` 실행 후
검증 스크립트를 돌립니다. 정확한 명령은 이 세션의 커밋 메시지와
`Plan&Source/ontology/seoul/README.md` §검증 재현하기를 참고하세요(클러스터 기동 절차는 동일).
