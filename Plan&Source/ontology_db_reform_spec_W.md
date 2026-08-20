# GOAL축 B — 온톨로지 기반 DB 구조 개편 설계 스펙 (W 설계 권위)

> 작성: **W(설계·검증, `/pl`)** · 대상: **U(구현·배포, `/backend`)** · test-first
> 목적: 현재 여러 파일에 흩어진 "지원영역 분류"를 **온톨로지 참조테이블로 승격**하고,
> 사정→목표→예산→거래→평가를 **단일 분류축(FK)**으로 연결한다.
> 상태: 초안 — 확정 시 `[HANDOFF→U]` 로 마이그레이션·서버액션·타입재생성 요청.

---

## 1. 문제 (U 조사 + W 확인)
현재 분류축이 세 곳에 분산·비정규화:
- TS 상수(`care-plans` 관련) + 자유텍스트(`transactions.category`, `budget_line_items.category`, `support_goals.support_area`) + JSONB.
- → 같은 "일상생활"이 화면마다 문자열로 재입력되어 **집계·추적 불가**, 온톨로지(RDF) 설계와 단절.

## 2. 판정 D-B1 — 분류는 **프로그램-스코프 참조테이블**로 (두 온톨로지 병존)
서울형(6도메인)과 복지부(8대분류×중분류)는 **다른 사업의 분류체계**다. 하나로 강제 통합하지 않고
`program` 스코프로 **한 테이블에 병존**시킨다(우선순위: 서울형 먼저 운영, 복지부는 시드만 준비).

```sql
-- 대분류 (서울형 domain / 복지부 대분류 공통)
CREATE TABLE public.service_domains (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program    TEXT NOT NULL CHECK (program IN ('seoul','mohw')),
  code       TEXT NOT NULL,
  label      TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0,
  UNIQUE (program, code)
);
-- 중분류 (복지부 3단 구조. 서울형은 flat → 중분류 없이 domain 직접 참조 허용)
CREATE TABLE public.service_subdomains (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id  UUID NOT NULL REFERENCES public.service_domains(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  label      TEXT NOT NULL,
  examples   TEXT[],                       -- 지원 예시(복지부 서식 §4)
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (domain_id, code)
);
```

- **서울형 시드**(6, 기존 `seoul_service_domains` 와 code 정합 유지): daily_living, social_life, employment, self_development, health_safety, housing.
- **복지부 시드**(8 대분류 → 중분류; 서식 §4 원문):
  - 신체적건강: 건강증진·재활·장애인보조기기·의료용소모품·기타건강제품
  - 정신적건강: 정신건강증진·검사진단·상담치료·기타
  - 주거: 주택개조·주거지원서비스·주거지원물품
  - 일상생활: 일상생활유지돌봄·일상생활용품·이동지원·기타
  - 일자리: 직업상담연계·직업교육훈련·창업지원·물품·기타
  - 법률및권익보장: 법률및권익보장
  - 문화및여가: 문화여가활동·평생교육·기타
  - 바우처유연화: 활동지원·발달장애인주간활동
- **RDF 대조(V-onto)**: `seoul_ontology.rdf` domain individuals == service_domains(program='seoul') · `pcp_ontology`(복지부) == program='mohw'. W가 verify.

## 3. `needs_assessment` 엔티티 신설 (복지부 서식 §4 욕구사정)
```sql
CREATE TABLE public.needs_assessment (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  program       TEXT NOT NULL CHECK (program IN ('seoul','mohw')),
  domain_id     UUID NOT NULL REFERENCES public.service_domains(id) ON DELETE RESTRICT,
  subdomain_id  UUID REFERENCES public.service_subdomains(id) ON DELETE SET NULL, -- 서울형 flat이면 NULL
  support_example TEXT,        -- 지원 예시
  limitation    TEXT,          -- 제한점
  need_hope     TEXT,          -- 욕구와 희망
  assessed_by   UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 4. `category` FK화 — 자유텍스트 → 참조 FK
| 대상 | 현재 | 변경 |
|---|---|---|
| `support_goals.support_area` | 자유텍스트 | `domain_id UUID FK` 추가(nullable→백필→NOT NULL) |
| `budget_line_items.category` | 자유텍스트 | `subdomain_id UUID FK` 추가 |
| `transactions.category` | 자유텍스트 | `subdomain_id UUID FK` 추가(지출을 분류축에 연결) |
- 백필: 기존 문자열 → code 매핑표로 1회 변환(매핑 불가값은 로그 후 NULL 유지, 수동 정리).

> **컷오버(#16) 반영 — 실제 seoul 테이블 매핑** (구 표의 이름은 컷오버로 소멸):
> - `support_goals` → **`seoul_requested_services`** (`domain_id` 이미 보유 ✅)
> - `budget_line_items` → **`seoul_budget_allocations`** (분류 FK 미부착 → 추가 필요)
> - `transactions` → **`seoul_service_usages`** (`domain_id` ✅ / `subdomain_id` 추가 필요)
> - 평가 → **`seoul_settlements`** (분류 FK 미부착 → 추가 필요)

## 5. 연결 축 (온톨로지의 목적)
`needs_assessment.domain` → `support_goals.domain` → `budget_allocations/line_items.subdomain` → `transactions.subdomain` → `evaluations`.
→ **동일 분류축으로 "사정→목표→예산→지출→평가"를 추적**. (예: '이동지원' 욕구가 목표·예산·실제 지출·평가까지 한 축으로 집계)

## 6. 마이그레이션 순서 (U 구현)
1. `service_domains` + `service_subdomains` + 시드(seoul 6 / mohw 8×중분류)
2. `needs_assessment`
3. FK 컬럼 추가(nullable) → 백필 → NOT NULL/인덱스
4. RLS(기관 스코프 — GOAL축 B의 `organizations` 멀티테넌시와 연동)
5. `npm run generate-types` → `database.ts` 재생성

## 7. W 계약(골든) 테스트 — test-first (구현 전 실패로 박음)
- `verify_service_domains.sql`: seoul 6행/mohw 8행 존재, (program,code) UNIQUE.
- `verify_classification_link.sql`: 무결성(고아 FK 0), 연결축 조인 쿼리가 사정→평가까지 도달.
- TS: 매핑표 순수함수(자유텍스트→code) 골든 — 대표 입력 커버.
- **의존성**: 이 스펙은 D0(base→main) **이후** supabase/seoul/ 위에 얹는다(중복 방지).

## 8. 결정 기록 (W 설계권위 · 2026-08-19 확정)
PR #17(구현 U) 검토 결과 아래로 **확정**한다. 초안 §2 의 신규 `service_domains` 스케치는 컷오버 후 실제 스키마에 맞춰 아래로 대체됨.

- **Q1 — RESOLVED: 기존 `seoul_service_domains` 확장(program 스코프) 채택** (신규 병렬 테이블 X).
  근거: 컷오버(#16)로 `seoul_service_domains` 가 정본이 되었고, 이미 3개 FK가 이를 참조
  (`seoul_spending_rules.domain_id`·`seoul_requested_services.domain_id`·`seoul_service_usages.domain_id`).
  신규 테이블로 갈아끼우면 3 FK 이관+백필+뷰호환이 필요 → 확장이 **더 낮은 위험으로 같은 목적**(단일 분류축) 달성.
  → 스펙 §2 의 `service_domains`/`service_subdomains` 는 `seoul_service_domains`/`seoul_service_subdomains` 로 읽는다.
- **네이밍 — RESOLVED: `seoul_` 접두 채택** (`seoul_service_subdomains`·`seoul_needs_assessment`). 컷오버 `seoul_*` 관례와 일관.
- **중분류 코드셋 — RESOLVED: 승인.** 09 시드(대분류 8·중분류 27)를 복지부 서식 §4 원문과 1:1 대조 확인.
  계약: `verify_service_domains.sql`(개수·코드셋·(program,code) UNIQUE·병존).
- **Q2 — 유지:** 복지부(program='mohw')는 시드만. 화면은 GOAL축 A 완료 후.

### 8-1. 신규 계약(정합성) — 다음 FK-ization 단계로 이월
- **(domain,subdomain) 일치 · (program,domain) 일치**: `seoul_needs_assessment` 는 domain/subdomain 를 각각
  독립 FK 로만 걸어 **교차 불일치가 가능**(예: domain=seoul/daily_living 인데 subdomain=mohw 하위). 미방어.
  → 권장: `seoul_service_subdomains(id, domain_id)` 복합 UNIQUE + `needs_assessment` 복합 FK(또는 트리거).
  `verify_classification_link.sql [B]` 가 이를 **실패로 박음** — U 가 다음 단계에서 초록화.
- **5노드 단일축 완성**: `budget_allocations`·`service_usages(subdomain)`·평가(`settlements`) 에 분류 FK 미부착.
  `verify_classification_link.sql [D]` 가 목표를 명시(현재 ❌). 백필 설계 확정 후 착수.

### 8-2. 욕구사정 삭제 권한 — RESOLVED: 담당 실무자 허용 (2026-08-19)
PR #22(욕구사정 화면) 검토에서 발견: 화면은 담당자에게 삭제를 노출하나 09 의 delete 정책은 `seoul_is_admin()`
(관리자 전용) 이라 **작성 담당자 본인도 삭제 불가**. 사용자 결정 = **담당자 허용**.
- U: `09_ontology_classification.sql` 의 `seoul_needs_assessment_delete` → `USING (public.seoul_is_staff_for(participant_id))`
  (insert/update 와 일관. `seoul_is_staff_for` 가 admin 포함이라 관리자 삭제도 유지).
- 부수: `src/app/actions/needsAssessment.ts` 의 "RLS 는 관리자만 DELETE" 주석 갱신(U).
- 계약: `verify_needs_assessment_rls.sql` — [3] 담당자 삭제 허용이 현재 ❌ → 변경 후 ✅ (test-first).

### 8-3. 백필 설계 — RESOLVED: **1회 백필 불필요** (W 독립 검증, 2026-08-20)
U 의 `10_fk_ization.sql`(#… FK-ization) 이 "자유텍스트 백필 불필요"로 처리한 것을 W 가 **독립 확인**하고 확정한다.
- **근거(스키마 실검증)**: 스펙 §4 의 "nullable→백필→NOT NULL" 은 컷오버(#16) 이전 자유텍스트 테이블
  (`transactions.category`·`budget_line_items.category`)을 전제로 쓴 것이다. 그 테이블들은 컷오버로 소멸했고,
  seoul 대상 3테이블에는 **매핑할 자유텍스트 분류 컬럼이 없다**:
  - `seoul_budget_allocations` = 금액·한도만(`03` L443–473). 분류 컬럼 없음.
  - `seoul_service_usages` = `domain_id` 를 이미 보유(`03` L511). 신설은 `subdomain_id` 뿐.
  - `seoul_settlements` = 금액·기간만(`03` L571–584). 분류 컬럼 없음.
  → 문자열→code 매핑 대상이 0건이므로 1회 백필은 **개념적으로 존재하지 않는다**(스펙 §6.3 이 부분은 seoul 에선 무효).
- **신규 분류 컬럼 = nullable 유지 (NOT NULL 금지)**: 백필할 과거 행이 없고 데모시드(`08`)에도 값이 없어,
  DB 레벨 NOT NULL 은 신규 insert 를 깨뜨린다. 채움은 앞으로 서버액션/UI 가 담당(§8-4). 신규 행 필수화는
  필요 시 앱 레벨 검증 또는 트리거로(하드 NOT NULL 아님).
- **데모 가시성**: `08_seed_demo` 가 `service_usages.domain_id` 를 이미 시드(L156–160)해 `v_seoul_domain_flow`
  가 실행 즉시 실데이터를 낸다 → 도메인 레벨 축 리포트는 **오늘 시연 가능**. 다음 hop 컬럼
  (`subdomain_id`·예산·정산 domain)의 시드 채움은 선택(더 풍부한 시연용, 비필수).
- **계약 상태**: `verify_classification_link.sql [A][B][C][D]` = db-verify CI 가 `10_fk` 적용 후 실행,
  main(2462643) **green 실측**. [D] 5노드 축 완성 ✅.
- **→ U GO**: 지출↔분류축 UI(지출폼 domain/subdomain 선택) 착수 가능. 백필 스텝 없음.

### 8-4. 분류축 조인 강건성 — RESOLVED: **라벨→domain_id 조인** (test-first, U 구현)
W qa 관찰(라벨 조인 취약점)을 계약으로 승격. 분류 참조테이블이 `program` 스코프(seoul·mohw 병존, §2)라
라벨('일상생활'·'주거' 등)이 **프로그램 간 충돌**한다 — 라벨 조인은 서로 다른 도메인의 지출을 조용히 합치거나
엉뚱한 스파인 행에 귀속시킨다(에러 없이 금액 오염). mohw 는 현재 시드전용이라 **잠복**이나 구조적 확실성이다.
- **골든(W, RED→green)**: `src/utils/domainAxisReport.test.ts` — 라벨충돌 회귀를 추가해 라벨 조인에서 **실패**로 박음
  (현재 util 대비 `99999≠10000` RED 실측). id 조인 시 green.
- **구현(U)**: ①`v_seoul_domain_flow`(05) 가 `domain_id`(+`program`) 를 SELECT/GROUP BY 에 emit(뷰는 이미
  `u.domain_id` 로 조인 중 — 컬럼만 노출). ②`domainAxisReport.ts` 의 `DomainFlowRow` 에 `domain_id` 추가,
  `buildDomainAxisReport` 가 `flowByLabel`→`flowById(domain_id)` 로 조인. ③`npm run generate-types`.
  `report/page.tsx` 는 `select('*')`·시그니처 불변이라 무수정.

### 8-5. 예산·정산 hop 그레인 — OPEN: U 확인 요망 (UI 착수 전)
`10_fk` 가 `budget_allocations.domain_id`·`settlements.domain_id` 를 추가했으나 **그레인이 축과 어긋난다**:
- **예산**: `seoul_budget_allocations` 는 `UNIQUE(plan_id)` = 플랜당 1행(`03` L470)인데, 한 플랜은
  `seoul_requested_services` 를 통해 **여러 domain 에 걸친다**. 단일 `allocation.domain_id` 는 **손실적**(어느 한
  domain 만 임의 선택). → **예산-by-domain 은 `requested_services`(domain_id·estimated_cost) 그레인으로 집계**해야
  맞다. **권장: `budget_allocations.domain_id` 에 UI 를 얹지 말 것**(컬럼은 무해·미사용이나 채우면 오해석 유발).
- **정산**: `seoul_settlements.domain_id` 는 `allocation_id`→`budget_allocations.domain_id` 로 **파생 가능**하며
  현재 리포트 미소비. 저장 시 배정 domain 과 **드리프트** 위험 → (a) 뷰에서 배정 조인으로 파생하거나
  (b) 컬럼 유지 시 배정과 일치 가드(트리거/복합 FK) 추가. 정산 레벨 domain 이 실제 필요한지부터 U 확인.
- 결론: 축의 domain 신호는 **사정·요청서비스·지출(domain_id)** 노드가 정본. 예산·정산은 파생/집계로 읽는다.
