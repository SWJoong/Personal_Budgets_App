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

## 8. 열린 결정 (사용자/U 확인 요망)
- Q1: 서울형 `seoul_service_domains`(기존)와 신규 `service_domains(program='seoul')` — **통합**(권장: 신규로 일원화, 뷰로 호환) vs **병존**?
- Q2: 복지부 트랙(program='mohw')은 시드만 준비하고 화면은 GOAL축 A 완료 후 착수 확인.
