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

### 1-3. 배선 — 선제 게이트 (사용자 확정 2026-09-01)
현재 텍스트→AI 액션은 없다(요약·제안 미구현, `callAI` 소비자는 `ocr.ts` 뿐, 그마저 이미지+식별자 없는 프롬프트).
게이트를 **선제로** 세워 요약·제안이 생기는 순간 가명처리가 자동 보장되게 한다:
- **래퍼 `callAIDeidentified(userText, terms, opts)`**(U 구현 `src/utils/aiDeidentify.ts`): `deidentify → callAI →
  reidentify` 단일 경로. 골든 `src/utils/aiDeidentify.test.ts`(W). 텍스트 AI 액션은 이 래퍼만 부른다.
- **경계 강제 `src/utils/aiGateBoundary.test.ts`**(W): 서버 액션이 `callAI` 를 직접 import 하면 CI 실패
  (`ocr.ts` 예외). → 우회 불가 — 요약·제안 액션은 반드시 래퍼 경유하게 강제된다.
- `ocr.ts`: 입력이 이미지라 게이트 우회 불가·프롬프트에 식별자 없음 → 예외. OCR **결과** 텍스트의 저장·표시 전
  마스킹은 선택 후속(영수증 crop 등).
- 액션이 넘길 `terms` = 해당 당사자 이름 + 관련 기관명(조회는 액션 몫).

### 1-4. 그래프 노드 마스킹 (DB층 — B4 와 결합, 후속)
- `v_seoul_graph_nodes` 의 person 라벨을, 뷰어가 그 당사자에 **배정되지 않았으면**(§2 `is_assigned`) 이름 대신
  '○○님'으로. security_invoker 뷰 컨벤션 유지. W `verify_graph_mask.sql` 후속, U 뷰 수정.

---

## §2. 담당자 배정 스코핑 (결정 ②) — ★정정: 이미 구현됨

### 2-0. 실측 정정 (실 W, 2026-09-01)
원안은 신규 M:N `seoul_case_assignments` + `is_assigned()` 를 제안했으나, **실측 결과 배정 스코핑은 이미
구현·작동 중**이다. 신규 테이블 없이:
- `participants.assigned_supporter_id`(01_core §7 · 1:1 FK·인덱스·시드)
- `seoul_is_staff_for(p)` = `admin OR assigned_supporter_id = auth.uid()`(01_core:310) — `is_assigned` 의 1:1 판
- `seoul_can_access(p)` = `self OR seoul_is_staff_for(p)`(01_core:324)
- **04_seoul_rls 당사자 개인정보 SELECT = 전부 `seoul_can_access(participant_id)`**, `participants_select`(02_core:38)=`seoul_can_access(id)` → **실무자는 이미 배정된 당사자만 열람.**

PRD 리뷰의 "모든 실무자가 모든 당사자 열람"(검토보고서 ⑥)은 **리빌드 이전 옛 상태**였고 seoul 빌드가 이미
고쳤다. → 결정 ②의 실질 남은 일 = **이 동작을 회귀로부터 잠그는 verify** 뿐. (이 정정을 놓치고 원안대로
핸드오프했으면 U가 중복 테이블을 만들 뻔했다 — 핸드오프 직전 실측의 가치.)

### 2-1. W 조치 — 회귀 잠금 verify (작성됨)
`Plan&Source/ontology/seoul/verify_assignment_rls.sql`: 지원자3(배정2·미배정1)+관리자+당사자2 시드로
**교차 supporter 격리**를 잠근다 — 배정=자기 당사자만·타인 격리(A1b·A2b), 미배정=0행(A3), admin=전체(A4),
`seoul_is_staff_for` prosecdef·search_path(A0). 기존 메커니즘에 대해 **GREEN이어야 정상**(스코핑 작동 실증).
U는 `db-verify.yml` verify 배열에 1줄 추가만(구현 변경 없음).

### 2-2. PR #66 (M:N 확장) — 채택 보류
U가 원안대로 `seoul_case_assignments`(M:N junction) + `is_assigned()` 를 #66으로 구현(additive·멱등, 04 RLS
축소는 이 verify 확정까지 보류 — 규율 좋음). 그러나 2-0 로 1:1 기존 메커니즘이 이미 충분하고 사용자가 지금
M:N(공동배정)을 택하지 않았으므로(결정 ②) **#66 채택 보류**. 사유: 배정 소스 이중화(`assigned_supporter_id`
↔ `seoul_case_assignments` 드리프트 위험) · 미배선 junction(죽은 코드).
→ **공동배정(참여자당 복수 담당자)이 실제 요구가 되면** #66 을 되살려 04 RLS 를 `is_assigned` 로 전환(§3 멀티테넌시
확장과 같은 계층에서). 그때 graph 노드 마스킹(§1-4)도 같은 verify 에 케이스 추가.

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
1. **[B5·완료]** `src/utils/deidentify.ts` 구현 → 골든 green (PR #65 머지).
2. **[B4·완료]** 배정 스코핑은 이미 구현됨(§2-0). `verify_assignment_rls.sql`(회귀잠금) + `db-verify.yml` 배선
   완료(PR #68 머지). CI 에서 스코핑 작동 실증(A0~A4).
3. **[B4·보류]** PR #66(`seoul_case_assignments` M:N)·04 RLS `is_assigned` 전환은 **공동배정 실요구 시까지 보류**(§2-2).
4. **[B5·게이트]** `callAIDeidentified` 래퍼(U 구현 `src/utils/aiDeidentify.ts`) → 골든 `aiDeidentify.test.ts` green.
   경계 `aiGateBoundary.test.ts` 가 서버 액션의 직접 `callAI` 사용 차단(§1-3). 요약·제안 액션은 래퍼 경유.
   그래프 노드 마스킹 뷰(§1-4)는 후속.
5. **[하지 않음]** `participants.agency_id` 등 org FK 선제 추가(§3, 보류).

## 남긴 판단 (진짜 W 복귀·후속)
- 배정 스코핑 초기 시드 방식(마이그레이션 시드 vs 관리자 배정 화면 선행) — 소규모 운영 마찰 최소화 관점에서 재확인.
- 그래프 노드 마스킹의 당사자 본인/가족 표시 범위(자기 관계망은 이름 보이는 게 맞음) — easy-read·자기결정 관점 후속.
