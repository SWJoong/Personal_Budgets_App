# 03 · 서울형 개인예산제 리빌딩 PRD 정합성 리뷰

날짜: 2026-08-28 · 담당: U(구현·배포 축) · 입력: 사용자 업로드 PRD(`서울형_리빌딩_PRD_20260828.md`)

## 요약

업로드된 PRD(1개 기관·30명 규모 확정, PostgreSQL 단일 원장 + 그래프 투영 계층 이원화안)를 현재
저장소 상태와 대조한 결과, 세 갈래로 나뉜다.

1. **이미 구현·머지 완료** — PRD가 "신규 제안"으로 쓴 상당 부분(특히 9장 온톨로지 그래프 시각화 전체,
   4장 마이그레이션 단순화)은 실제로 이미 설계·구현·머지까지 끝난 작업이다. PRD 문서 자체가 최신
   진행 상황을 반영하지 못한 스냅샷이다.
2. **실제 공백** — 가명처리·마스킹(7장)은 DB에 전혀 반영되어 있지 않은 진짜 미구현 항목이다.
3. **스코프 재확인 필요** — 역할모델(코디네이터), 멀티테넌시 전제, EASYREAD MCP 연동은 PRD와 저장소
   현황이 다르지만 "틀렸다"기보다 확인·조율이 필요한 지점이다(사용자 확인 완료, 아래 반영).

## 절별 대조표

| PRD 절 | PRD 주장 | 실제 상태 |
|---|---|---|
| 6장 AI 스택 | OpenAI GPT-4o 직접 호출 | **이미 Claude(Anthropic)로 전환 완료**. `src/utils/ai.ts` `callAI` 단일 진입점, GPT-4o 토큰 중단으로 런타임 실패 → Claude 교체(머지 완료). 모델은 용도별 티어(OCR=Haiku, 요약/제안=Sonnet). PRD 표기가 구식. |
| 6장 프론트 | Next.js 16 | 실제는 Next.js 15(CLAUDE.md 기술스택 표). 사소한 오기. |
| 9장 온톨로지 그래프 시각화(전체) | "신규" 1단계: PostgreSQL 뷰 + Cytoscape.js/React Flow 제안 | **이미 구현·머지 완료.** `supabase/seoul/05_seoul_graph.sql`(`v_seoul_graph_nodes`/`edges`, 전부 `security_invoker=true`, `seoul_graph_walk()` 재귀 CTE), `src/utils/egoGraph.ts`(무향 BFS·`nodeGroup`·`edgeDirection`), `(supporter)/supporter/network`(cytoscape 관계망 화면, PR #51), `11_provider_domains.sql`(자산지도 발견 SECURITY DEFINER 함수 + `src/utils/assetMap.ts` `buildDiscoveryAssets`, PR #52). PRD 9.2~9.4는 "제안"이 아니라 "완료 기록"으로 다시 써야 한다. 9.3(Neo4j vs TypeDB 조건부 2단계 판단)만 여전히 유효한 미래 검토 항목. |
| 4장 DB 단순화·마이그레이션 정리 | 04~30번 마이그레이션 단순화 필요 | **이미 완료.** D0 컷오버로 `supabase/migrations/_archive/` 이관, `supabase/seoul/`(00~11번, `09_ontology_classification`·`10_fk_ization`·`11_provider_domains`까지)이 정본. |
| 3장 역할모델(4단계: 당사자·지원자·코디네이터·관리자) | 4단계 role | DB `role` CHECK 제약은 **`admin`/`supporter`/`participant` 3종뿐**(`src/types/database.ts` `UserRole`도 동일). "코디네이터"는 서울형 제도 문서상 실무자 호칭일 뿐 별도 DB role이 아니며, 코드 전체에 `coordinator` 문자열이 없다. |
| 7장 가명처리·마스킹 | 목적설정→위험성검토→가명처리→적정성검토→안전관리 5단계, 그래프 노드 마스킹 | **실질 공백.** DB 컬럼·트리거·마스킹 로직 없음. `Plan&Source/온톨로지_사례관리_개편_검토보고서_v1.md`에 `deidentify.ts`(AI 호출 전 이름·기관명 토큰 치환) 제안만 존재, 게이트웨이 미구현. |
| 7장 감사로그 | 별도 audit trail 테이블, 권한 변경 이력 3년 보관 | 통합 `audit_log` 테이블 없음. 대신 `flag_criteria`/`set_copay`/`check_usage`/`recheck_copay`/`appeal_due` 등 도메인별 트리거가 개별 테이블(`seoul_rule_checks` 등)에 감사성 기록을 남기는 방식 — 기능적 등가물은 있으나 통합 조회·3년 보관 정책은 미확인. |
| 4장 스코프(1개 기관 고정) | `organization_id` 고정값/단일 행 참조로 단순화 | 사용자 확인: **1차 구현은 PRD대로 1개 기관·30명 유지**. 단 서울형 개인예산제 수행기관이 8곳·100명 규모로 이미 운영 중이므로, `docs/harness-plan.md` GOAL축B3(organizations 멀티테넌시)로 이어질 확장 가능성을 지금 설계에서 배제하지 않는다. |
| 8장 EASYREAD MCP 연동 | MCP 도구 4종(`validate_easy_read` 등) 연동 | 이 저장소엔 MCP 서버 연동이 없음(`.mcp.json` 없음), 자체 프롬프트 기반 스킬 `.claude/skills/easy-read-review/`만 존재. 사용자 확인: EASYREAD MCP는 **별도로 실제 제작된 서버**이며, 즉시 연동 대상은 아니고 향후 "쉬운 정보 변환" 기능이 커질 때 연동 후보. |
| 8장 접근성 CI | `validate_easy_read`·axe-core CI 편입 제안 | **이미 그 이상 진행됨.** jsx-a11y recommended + CI 회귀 차단(#57), Modal/LiveRegion/FormField 접근성 프리미티브(#56), skip-link·랜드마크 파운데이션(#55). 남은 것은 Phase C 리트로핏(폼·핸드롤 모달 4개 warn 규칙 → 0건 수렴 → error 승격, 계획은 이미 `docs/a11y/phase-c-plan.md`에 있음, 미머지). |
| 9.4 로드맵 1단계(온톨로지 문서화) | `docs/ontology/` 신설 제안 | 이미 `Plan&Source/ontology/seoul/`에 RDF(`seoul_ontology.rdf`/`_ko.rdf`)·스키마 초안·그래프 오버레이·다이어그램으로 PRD 제안보다 더 진전된 형태로 존재. 경로만 다르다. |

## 신규/보완 백로그 후보 (phase 반영 제안)

우선순위 순:

1. **[신규-공백] 가명처리·마스킹 설계 착수** — 유일하게 실제 미구현인 보안 항목. `deidentify.ts`
   제안(검토보고서)을 정식 설계로 승격할지, 우선순위를 어디에 둘지는 W 판단 필요. 대상 범위: AI 호출
   전 이름/기관명 토큰화, 그래프 노드 마스킹(현재 PRD 9장 §마스킹 원칙과 이미 합치).
2. **[검토] 코디네이터 역할 세분화 필요성** — 현재 `supporter` 단일 role. 서울형 제도상 코디네이터와
   일반 실무자 사이 권한 차등이 실무에 필요한지는 기능 요구가 아니라 정책 판단이라 W에게 넘김.
3. **[가이드] 멀티테넌시 확장성** — GOAL축B3(organizations) 설계 시 "1개 기관 고정값"으로 하드코딩하지
   말고 FK 참조 구조를 유지할 것(현재 `03_seoul_schema.sql`은 이미 FK 기반이라 이 원칙과 상충하지 않음).
   8개 수행기관·100명 확장 전제를 `docs/harness-plan.md`에 명문화할지는 W 판단.
4. **[메모-보류] EASYREAD MCP 연동** — 즉시 착수 아님. "쉬운 정보 변환" 기능이 실제로 필요해지는
   시점에 연동 여부를 재검토.
5. **[정정] PRD 자체 기술스택 오기** — OpenAI→Claude, Next.js 16→15. PRD 원본을 사용자가 갱신할지는
   사용자 몫이며, 이 문서가 정정 근거로 쓰인다.

## 결론

이번 PRD가 준 실질적 신규 가치는 **가명처리 설계 공백을 명시적으로 지적한 것**과 **장기 멀티테넌시
확장 필요성을 환기한 것** 두 가지다. 9장 온톨로지 그래프 시각화를 포함한 나머지 상당수는 이미 완료된
작업(PR #51·#52 등)의 재발견이며, PRD를 "이번 phase의 신규 작업 지시"로 그대로 받아들이면 중복
설계가 발생한다.

## 관련 파일

- `docs/harness-plan.md`(W 소유, GOAL축A/B 로드맵) · `CLAUDE.md`「현재 작업 현황」
- `supabase/seoul/05_seoul_graph.sql` · `11_provider_domains.sql` · `src/utils/egoGraph.ts` · `src/utils/assetMap.ts`
- `Plan&Source/온톨로지_사례관리_개편_검토보고서_v1.md`(가명처리 제안 원문)
- `docs/a11y/phase-c-plan.md`(접근성 잔여 작업)
