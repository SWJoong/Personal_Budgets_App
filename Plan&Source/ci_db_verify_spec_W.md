# CI DB 계약 검증 잡 — 설계 스펙 (W 설계·검증 권위)

> 작성: **W(설계·검증, `/qa` `/devops-검증측`)** · 대상: **U(구현·배포, `.github/workflows/`)** · test-first
> 목적: `supabase/seoul/` 빌드 SQL + `Plan&Source/ontology/seoul/verify_*.sql` 계약을
> **매 PR마다 임시 Postgres에서 자동 실행**해 (1) 저자(U)와 **독립된 검증 게이트**를 세우고,
> (2) 지금까지 수동(docker PG15)이던 verify 를 **머지 게이트로 승격**한다.
> 상태: 확정 — `[HANDOFF→U]` (워크플로 YAML 구현 요청).

---

## 1. 왜 (하네스 관점)
- 현재 verify 합격 기준(`verify_*.sql`)은 **W-lane 고정 파일**이라 U가 못 바꾼다 → 판정 신뢰는 이미 OK.
  하지만 **실행 자체**는 U(구현자)가 수동으로 돌렸다. CI가 대신 돌리면 "저자↔검증자 분리"가 완성되고,
  사람 손 없이 매 변경마다 재현된다. (지금 하네스의 유일한 공백 = W쪽 postgres 부재)
- **Supabase CLI 불필요**: `verify_00_auth_stub.sql` 이 순수 Postgres 용 `auth`/`storage` 스텁
  (`auth.users`·`auth.uid()`·`authenticated` 롤·`storage.foldername`)을 만든다.
  → **`postgres:17` 도커 서비스 + `psql`** 만으로 충분하다. (클라우드 db push·config.toml 손댈 필요 없음)

## 2. 계약 — 무엇이 "통과"인가 (2단계)
**① 빌드 단계**: auth 스텁 + seoul 빌드 SQL 을 순서대로 적용. **`psql -v ON_ERROR_STOP=1`** —
  SQL 오류가 **1건이라도** 나면 잡 실패. (= seoul 빌드가 빈 DB에서 깨끗이 선다는 계약.
  대표 파일 재적용 1회로 **멱등성**도 확인.)

**② 검증 단계**: `verify_*.sql` 을 순서대로 실행. 이 파일들은 `\set ON_ERROR_STOP off` 라
  실패해도 psql 이 종료코드 0 으로 끝나고 화면에 **`❌`** 를 출력한다.
  → **출력에 `❌` 가 하나라도 있으면 잡 실패**로 만든다.

### ★ 하드 요구사항 2가지 (이걸 틀리면 게이트가 가짜다)
1. **빌드 단계 = `ON_ERROR_STOP=1`** → 빌드 SQL 오류 = 즉시 실패.
2. **검증 단계 = `❌` 문자열 감지로 실패 판정** (psql 종료코드 아님).
   - 음성 테스트가 내는 psql `ERROR:`(RLS 차단·FK 위반 등)는 **정상** — 파일이 결과를 `✅/❌` 로
     자체 판정하므로 **`❌` 만 본다**. `ERROR:` 로 판정하면 음성 테스트에서 위양성 실패가 난다.
   - 추가 안전장치: 출력에 **`✅` 가 하나도 없으면**(=verify 미실행/연결 오류) 실패시킨다.

## 3. 실행 순서 (권장 시작점 — U가 픽스처 자립성 확인 후 확정)
**빌드 세트**(플레인 PG 적용 가능):
`verify_00_auth_stub` → `supabase/seoul/00,01,02,03,04,05,07,09,10`
- **제외**: `06_storage.sql`(Supabase `storage.objects`/버킷 의존) · `08_seed_demo.sql`(Admin API
  `scripts/seed-demo-auth.mjs` 필요). → 이 둘에 의존하는 verify 가 있으면 **Supabase-only 로 분리**(CI 밖).

**검증 세트**:
`verify_01_behaviour · 02_rls · 03_graph · 04_phase2 · 05_phase3 · 06_copay · 07_spending_rules ·
 08_records · verify_service_domains · verify_classification_link`
- 각 verify 는 자기 픽스처를 만드는 게 원칙(예: 04_phase2 는 7-접두, classification 은 9b-접두 픽스처 자체 생성).
  **08_seed_demo 데이터에 의존하는 verify 가 있으면** 세트에서 빼고 사유를 회신.

## 4. 트리거·환경
- **트리거**: `pull_request → main` + `push → main`. (경로필터는 선택. **필수 상태체크로 쓰려면 항상 실행 권장** —
  경로필터를 걸면 DB 미변경 PR 에서 체크가 pending 으로 남아 필수체크를 막는다.)
- **러너/DB**: `ubuntu-latest` + 서비스 `postgres:17`. (config.toml `major_version=17`·프로덕션 패리티.
  최소 요건은 15+ — 뷰 `security_invoker`. U가 PG15 로 이미 실측 green.)
- **배치**: 기존 `ci.yml` 의 `quality-check` 와 **별도 워크플로**(`.github/workflows/db-verify.yml`) 권장 —
  quality-check(tsc·lint·test·build) 무간섭.

## 5. 참고 구현 (U가 조정 — `.github/workflows/db-verify.yml`)
> psql 클라이언트는 `ubuntu-latest` 러너에 기본 포함. 없으면 `sudo apt-get install -y postgresql-client`.

```yaml
name: DB Contract Verify

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  db-verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: verify
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      PGHOST: localhost
      PGUSER: postgres
      PGPASSWORD: postgres
      PGDATABASE: verify
    steps:
      - uses: actions/checkout@v4

      - name: Build — auth stub + seoul (ON_ERROR_STOP=1)
        run: |
          set -euo pipefail
          build=(
            "Plan&Source/ontology/seoul/verify_00_auth_stub.sql"
            supabase/seoul/00_extensions.sql
            supabase/seoul/01_core.sql
            supabase/seoul/02_core_rls.sql
            supabase/seoul/03_seoul_schema.sql
            supabase/seoul/04_seoul_rls.sql
            supabase/seoul/05_seoul_graph.sql
            supabase/seoul/07_seed_program.sql
            supabase/seoul/09_ontology_classification.sql
            supabase/seoul/10_fk_ization.sql
          )
          for f in "${build[@]}"; do
            echo "=== apply $f ==="
            psql -v ON_ERROR_STOP=1 -q -f "$f"
          done
          # 멱등성 — 대표 파일 재적용도 무오류여야
          for f in supabase/seoul/03_seoul_schema.sql \
                   supabase/seoul/09_ontology_classification.sql \
                   supabase/seoul/10_fk_ization.sql; do
            psql -v ON_ERROR_STOP=1 -q -f "$f"
          done

      - name: Verify — run contracts, fail on ❌
        run: |
          set -uo pipefail
          verify=(
            verify_01_behaviour verify_02_rls verify_03_graph verify_04_phase2
            verify_05_phase3 verify_06_copay verify_07_spending_rules verify_08_records
            verify_service_domains verify_classification_link
          )
          out="$(mktemp)"
          for v in "${verify[@]}"; do
            f="Plan&Source/ontology/seoul/$v.sql"
            echo "=== $f ===" | tee -a "$out"
            psql -q -f "$f" 2>&1 | tee -a "$out"
          done
          echo "----- scan -----"
          grep -q "✅" "$out" || { echo "::error::verify 미실행(✅ 없음 — 연결/경로 확인)"; exit 1; }
          if grep -q "❌" "$out"; then
            echo "::error::verify 계약 실패 — ❌ 발견"
            grep -n "❌" "$out"
            exit 1
          fi
          echo "전 계약 통과 ✅"
```

## 6. U 확인·회신 요청 (구현 시)
1. 빌드 세트에서 `06_storage`·`08_seed_demo` 제외가 맞는지 — 08 시드에 의존하는 verify 가 있는지.
2. 각 verify 가 플레인 PG17 에서 **자기 픽스처로 완주**하는지(안 되는 건 Supabase-only 로 분리 + 사유).
3. 전 verify 초록 확인되면 이 잡을 **필수 상태 체크**로 승격할지 여부(브랜치 보호 = 사용자/U 결정).

## 7. 레인·후속
- 이 스펙 + `verify_*.sql` = **W-lane**. `.github/workflows/**` = **U-lane**(YAML 구현). 브랜치 보호 = 사용자.
- 완료되면: W 가 CI 로그로 **독립 검증** 확보 → 이후 FK-ization·copay·RLS 변경도 자동 계약 게이트를 통과해야 머지.
- (참고) 클라우드 실제 배포는 여전히 대시보드 수동(리전·Auth Provider·Storage·Kakao) — 이 잡은 **스키마 계약 검증**이지 배포 자동화가 아니다.
