# 프라이버시 — 가명처리 · 담당자 배정 스코핑 · 멀티테넌시 (W 설계·결정기록)

> PRD(`서울형_리빌딩_PRD_20260828.md`) 정합성 리뷰([docs/release/03](../docs/release/03-prd-alignment-review.md))가
> W에 넘긴 3결정을 사용자가 확정(2026-08-31)했다. 이 문서가 결정 기록 + 설계 정본.
> 로드맵 반영: [harness-plan.md](../docs/harness-plan.md) §8.3 B3·B4·B5. 레인: 설계·골든·`verify_*.sql`=**W**, 구현=**U**.

## 결정 로그 (2026-08-31 확정)

| # | 결정 | 근거 요지 |
|---|------|-----------|
| ① 가명처리 | **지금 전면 설계·구현 착수** | PRD 7장 유일한 실질 공백. 현재 AI 노출은 OCR뿐이나 요약·제안 확장 대비 게이트 선제. |
| ② 역할·배정 | **role 3종 유지 + 담당자 배정 스코핑 신설** | coordinator 권한차등 요구 미확인(과설계 회피). 진짜 공백은 "전 실무자 전 당사자 열람" → 배정 기반 RLS. |
| ③ 멀티테넌시 | **B3에 원칙·전제 명문화(구현 보류)** | 1개 기관 확정 → org FK 선제도입 YAGNI. 8기관·100명 확장 안전 원칙만 지금 고정. |

---

## §1. 가명처리 게이트웨이 (결정 ①)

### 1-1. PRD 7장 5단계 ↔ 우리 아키텍처 매핑
1. **목적설정** — AI 처리 목적 = OCR·(향후)요약·활동제안. 목적 외 식별자 전송 금지.
2. **위험성검토** — 식별자 유입점: 현재 `ocr.ts`(영수증 이미지 내 상호·금액; 우리 DB 당사자명은 미포함).
   향후 요약·제안은 **모니터링 텍스트·당사자명**을 `callAI`에 보냄 → 여기가 실질 위험.
3. **가명처리** — 앱층 공통 게이트 `src/utils/deidentify.ts`. 이름·기관명을 안정 토큰으로 치환 후 전송,
   AI 응답을 복원. 이미지 OCR 은 이미지 자체를 못 치환하므로 **OCR 결과 텍스트를 저장·표시 전** 게이트 통과.
4. **적정성검토** — 재식별 위험: 토큰 맵은 **요청 스코프 메모리에만**(DB·로그 저장 금지), 요청 종료 시 폐기.
   토큰은 요청 내에서만 안정 → 요청 간 링크 공격 불가.
5. **안전관리** — 원문을 로그·프롬프트 캐시에 남기지 않는다. `callAI`의 `cacheSystem`은 **치환 후** 텍스트에만.

### 1-2. `deidentify.ts` 순수 함수 계약 (골든: `src/utils/deidentify.test.ts`, U 구현)
```ts
export type PiiKind = 'person' | 'agency' | 'place'
export interface PiiTerm { value: string; kind: PiiKind }
export interface DeidResult { text: string; map: Record<string, string> } // map: 토큰 → 원문(복원용)
export function deidentify(text: string, terms: PiiTerm[]): DeidResult
export function reidentify(text: string, map: Record<string, string>): string
```
**불변식(골든이 못박음)**:
- 토큰 형식 = `[사람1]`·`[기관1]`·`[장소1]` — kind별 1부터 카운터. 같은 원문 value → 같은 토큰(호출 내 안정).
- **겹침 안전** — 긴 value 먼저 치환('김지수'가 '김' 토큰에 깨지지 않게).
- **왕복 무손실** — `reidentify(deidentify(t, terms).text, map) === t`(토큰 리터럴이 원문에 없다는 전제).
- 텍스트에 **미출현한 term 은 토큰·map 미생성**(불필요 토큰 금지).
- 빈 terms → `{ text: 원문, map: {} }`. 같은 value 중복 term → 토큰 하나.
- `reidentify` 는 map 의 모든 토큰을 전역 복원(등장 순서 무관).

### 1-3. 배선 (U)
- `ocr.ts`: OCR 결과에서 인식된 상호/이름을 저장·표시 전 마스킹(선택). AI **입력**은 이미지라 게이트 우회 불가 —
  이미지 최소화(영수증 crop)는 후속.
- (향후) 요약·제안 액션: `callAI(userText)` 직전 반드시 `deidentify(userText, terms)` → 응답에 `reidentify`.
  terms 는 해당 당사자의 이름 + 관련 기관명(조회는 액션 몫).

### 1-4. 그래프 노드 마스킹 (DB층 — B4 와 결합, 후속)
- `v_seoul_graph_nodes` 의 person 라벨을, 뷰어가 그 당사자에 **배정되지 않았으면**(§2 `is_assigned`) 이름 대신
  '○○님'으로. security_invoker 뷰 컨벤션 유지. W `verify_graph_mask.sql` 후속, U 뷰 수정.

---

## §2. 담당자 배정 스코핑 (결정 ②)

### 2-1. 테이블 · 헬퍼 (U 구현 — `supabase/seoul/` 빌드 SQL)
```sql
CREATE TABLE IF NOT EXISTS public.seoul_case_assignments (
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  supporter_id   UUID NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  assigned_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (participant_id, supporter_id)
);
-- admin 은 전체, supporter 는 배정된 당사자만. SECURITY DEFINER + search_path 고정.
CREATE OR REPLACE FUNCTION public.is_assigned(p_participant UUID) RETURNS boolean ...
```
- `is_assigned(p)` = 현재 사용자가 **admin** 이면 true; **supporter** 면 `seoul_case_assignments(p, auth.uid())` 존재; 아니면 false.
- 당사자 본인 접근은 기존 self 정책 유지(이 헬퍼는 실무자 경로에만 덧댐).

### 2-2. 적용 (U — 04_seoul_rls 대조)
- 당사자 개인정보 테이블의 **실무자 SELECT** 정책을 `is_assigned(participant_id)` 로 좁힘:
  `participants` · `seoul_monitoring_records` · `seoul_utilization_plans` · `seoul_budget_allocations` ·
  `transactions`/`seoul_service_usages` 등(정확 목록·컬럼은 U 가 04 대조). admin 은 override 로 전체.
- **초기 시드**: 현재 전원 열람 운영 → 도입 시 기존 담당관계를 `seoul_case_assignments` 에 시드하지 않으면
  실무자 화면이 빈다. 마이그레이션에 시드(또는 관리자 배정 화면 선행). **운영 마찰 주의**(대직 커버 = admin 대행/임시 배정).

### 2-3. verify 계약 (W 후속 — `Plan&Source/ontology/seoul/verify_assignment_rls.sql`)
- `is_assigned` prosecdef=true · search_path 고정 · `REVOKE ALL FROM PUBLIC` · admin 전체 가시.
- 미배정 supporter 가 타인 당사자 SELECT → **0행**. 배정 supporter → 그 당사자만. admin → 전체.
- graph 노드 마스킹(§1-4) 도입 시 같은 파일에 마스킹 케이스 추가.

---

## §3. 멀티테넌시 확장 진입점 (결정 ③ — 문서만, 구현 보류)

- **진입 테이블**: `participants`(+파생). org 스코프를 넣게 되면 `participants.agency_id UUID REFERENCES seoul_executing_agencies(id)`.
  지금은 **추가하지 않는다**(1개 기관 확정, YAGNI).
- **RLS 변경 지점**: §2 `is_assigned` 와 **같은 계층**. 확장 시 "배정된 당사자" 위에 "같은 기관" 스코프를 AND 로.
  admin 도 `super_admin`(전체) ↔ `org_admin`(자기 기관)으로 갈릴 수 있으나 **역할 확장은 그때**(지금 3종 유지).
- **확장 트리거**: 2번째 수행기관 온보딩이 실제로 결정되는 시점 = B3 착수 신호. 상한 전제 = **8기관·100명**.
- **원칙**: 어떤 신규 테이블도 기관을 고정 상수로 박지 않는다 — 항상 FK. 현 `03_seoul_schema.sql` 은 이미 FK 기반이라 상충 없음.

---

## U 핸드오프 체크리스트
1. **[B5·즉시]** `src/utils/deidentify.ts` 구현 → 골든 `deidentify.test.ts` green.
2. **[B4·DB]** `seoul_case_assignments` + `is_assigned()` → `supabase/seoul/` 빌드 SQL(멱등). `db-verify` build 배열 반영.
   초기 배정 시드 or 관리자 배정 화면. → W `verify_assignment_rls.sql` 작성 후 수동적용 게이트.
3. **[B4·04 RLS]** 당사자 개인정보 테이블 실무자 SELECT 를 `is_assigned` 로 좁힘(admin override).
4. **[후속]** 요약·제안 액션에 `deidentify`/`reidentify` 배선 · 그래프 노드 마스킹 뷰.
5. **[하지 않음]** `participants.agency_id` 등 org FK 선제 추가(§3, 보류).

## 남긴 판단 (진짜 W 복귀·후속)
- 배정 스코핑 초기 시드 방식(마이그레이션 시드 vs 관리자 배정 화면 선행) — 소규모 운영 마찰 최소화 관점에서 재확인.
- 그래프 노드 마스킹의 당사자 본인/가족 표시 범위(자기 관계망은 이름 보이는 게 맞음) — easy-read·자기결정 관점 후속.
