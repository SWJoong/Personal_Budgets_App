# Track A — 실무자 회계·거래장부·서류 보강 (설계·계약 authority, W 레인)

> 사용자 방향(2026-09-10): "기존에 제작한 실무자 기준으로 회계/거래장부 기능이나 서류 기능 등이
> 사라진 점을 고려해 보강." 착수순서 **A 먼저**, 범위 **"구멍 메우기 + 회계 확장"(서울형 신규)**.
> (트랙 B 관계망 CRUD 는 `goala_relationship_network_W.md` 계열에서 별도. B 착수 시 "파생그래프 +
> 수동 큐레이션" 모델로.)

## §0 배경 — 무엇이 언제 사라졌나 (정직한 정정)

P1–P7 재구성(#82–#115)은 **이 영역에서 아무것도 삭제하지 않았다**(순수 토큰화/a11y 리스타일).
실제 제거는 그 이전이다:

- **서울형 리빌딩** `036a8d1`(2026-07-29): 제네릭 회계 원장(정렬 컬럼·재원·카테고리·결제수단·상태
  필터), 거래 CSV export API(`src/app/api/export/transactions/route.ts`), 거래 편집 화면
  (`TransactionDetailClient.tsx`) 제거 → 얇은 **열람 전용** 서버컴포넌트로 대체.
- **ComingSoon 정리** `#64`(`f4edf9d`)·`#72`(`56052f2`): 이용계획서 서류 라우트
  (`documents/care-plans/...`), 레거시 정산/평가 라우트 제거, `transactions/new` → redirect 축소.

⇒ 얇아진 열람 전용 껍데기를 P1–P7 이 리스타일했기에 "재구성 때 사라진 것처럼" 체감됨.
**복원 방침**: 옛 제네릭 원장(재원/결제수단/카테고리)을 그대로 되살리지 **않는다**. 서울형
데이터모델(배정 `seoul_budget_allocations` · 영역 `seoul_service_domains/subdomains` · 정산
`seoul_settlements` 생애주기 · copay)에 맞는 회계로 다시 짓는다.

## §1 현재 실무자 회계·서류 인벤토리 (조사 확정)

| 영역 | 라우트/파일 | 현재 상태 | 뮤테이션 |
|---|---|---|---|
| 거래장부(org) | `(supporter)/supporter/transactions/{page,OrgLedgerClient}.tsx` · `utils/orgLedger.ts` | 열람 전용(합계·건수·상태칩·정산상태 필터·참여자 그룹 최근5) | 없음 |
| 거래 상세 | `.../transactions/[id]/page.tsx` | 열람 전용("편집은 스코프 밖") | 없음 |
| 참여자별 거래 | `.../supporter/[participantId]/transactions/{page,new/NewTransactionClient}.tsx` | 목록+합계 · **생성 유일 경로** | `recordServiceUsage`(생성만) |
| 서류함 | `.../supporter/documents/{page,DocumentShelfClient}.tsx` · `actions/document.ts` | 열람/열기 전용(signed URL) | 없음(추가는 신청서 상세 `uploadApplicationDocument` 에서만) |
| 영수증 검토 | `.../supporter/review/{page,ReviewQueueClient}.tsx` | 결정(인정/제외) | `decideRuleCheck` |
| 정산 | `actions/settlement.ts` · `admin/participants/[id]/ParticipantDetailClient.tsx` | 등록=**관리자 전용** · 실무자 라우트 없음 | `recordSettlement`(관리자) |

액션 인벤토리: `serviceUsage.ts` = `recordServiceUsage`·`getServiceUsages`·`getReceiptSignedUrl`
(**update/delete 없음**) · `document.ts` = `getDocumentShelf`·`getDocumentSignedUrl`(**upload/delete 없음**) ·
`settlement.ts` = `recordSettlement`(관리자)·`getSettlements`.

## §2 슬라이스 계획 (각 = RED 계약 → 신선 서브에이전트 구현 → 독립 재검증 1 PR)

### A1 — 정산 반려/환수 입력 노출 【ACTIVE】
- **갭**: `recordSettlement`/`SettlementInput` 은 이미 `rejectedAmount`·`recoveredAmount` 를 받아
  저장(`settlement.ts:13-14,38-39`)하고 표시도 4개 다 함(`ParticipantDetailClient.tsx:277`).
  그러나 **등록 폼**은 정산기간·인정·미사용만 수집(상태 59-61 · 핸들러 88-114 · JSX 286-313) →
  **반려·환수를 UI 로 기록 불가**.
- **설계**: 폼에 `rejectedAmount`·`recoveredAmount` state + input 2개(placeholder `반려 금액`·
  `환수 금액`) 추가, `handleAddSettlement` 가 `recordSettlement` 로 전달, 등록 후 리셋. 레이아웃은
  U 재량(권장: 2×2 그리드 인정/반려 · 환수/미사용). 검증규칙 불변(정산기간+인정 필수, 나머지 선택).
- **계약**: `ParticipantDetailClient.settlement.test.tsx`(신규, W) — (1) allocationId 있으면 반려/환수
  input 렌더 (2) 값 입력+등록 → `recordSettlement` 가 rejectedAmount·recoveredAmount(숫자) 포함
  객체로 호출. 배치·토큰 미단언(행위만).
- **구현힌트(U)**: `unusedAmount` 패턴 복제(`x ? Number(x) : undefined`). `ParticipantDetailClient.tsx`
  만 수정. 게이트 tsc0·lint0·vitest·build0.

### A2 — 지출 수정/삭제 【ACTIVE】
- **갭**: `serviceUsage.ts` 에 update/delete 없음(생성만) → 잘못 기록한 지출을 실무자가 못 고침.
- **조사 확정**:
  - 스키마 변경 **불필요** — `seoul_service_usages` RLS(04:188-205)가 이미 staff UPDATE/DELETE 허용
    (`seoul_is_staff_for(participant_id)`), self 는 pending 까지만. → **Manual-Ops Gate 없음**.
  - `settlement_status` 값 = `pending·accepted·rejected·recovered`(03:520-521, DEFAULT pending).
  - 트리거: `trg_seoul_check_usage`=BEFORE INSERT **OR UPDATE**(금지항목은 편집도 재검증 → 트리거
    에러 그대로 전달) · `trg_seoul_flag_criteria`=AFTER **INSERT만**(편집은 계획외 재플래그 안 됨).
- **정책(정한 기본값)**: 편집·삭제 **모두 settlement_status='pending' 일 때만** 허용. 검토 끝난
  지출(accepted/rejected/recovered)은 액션이 거부("정산 검토가 끝난 지출은 수정/삭제할 수 없어요").
  근거: flag_criteria 가 INSERT-only 라 검토 후 편집 시 리뷰가 stale · 정산기록/감사추적 보호 · RLS
  self-rule(pending-only)과 일관. 앱이 RLS 보다 보수적(staff 라도 pending 만) — 완화는 후속 결정.
  ★사용자에게 이 기본값을 플래그(더 강한 제약이므로).
- **편집 필드(A2 범위)**: `amount·usage_date·description`(오기 정정 핵심). domain/subdomain/provider·
  영수증 재업로드는 A2 밖(분류=A4·영수증=별도 백로그).
- **설계**: `updateServiceUsage(usageId, {amount?,usageDate?,description?})` · `deleteServiceUsage(usageId)`
  — auth · `viewAsWriteBlock` · **pending 가드**(먼저 settlement_status select) · `auditLog`(둘 다, 금전
  삭제 감사추적) · 트리거 에러 `friendlyDbError` 전달 · `revalidatePath`. UI = 새 클라이언트
  `TransactionEditClient`(`[id]/page.tsx` 서버컴포넌트가 `canEdit=pending`·초기값 prop 전달) — pending
  이면 프리필 폼(금액/날짜/내용)+삭제(확인), 아니면 "검토 끝나 수정불가" 안내. NewTransactionClient
  필드 스타일 참조. 삭제 성공 시 목록으로, 수정 성공 시 refresh.
- **계약(W)**: 액션 `serviceUsage.mutate.test.ts` — update/delete × pending허용/non-pending거부 4건
  (supabase thenable 모킹). UI `TransactionEditClient.test.tsx` — canEdit 시 폼·삭제 노출, 아니면 미노출.

### A3 — 서류함 업로드/삭제 【ACTIVE】
- **갭**: 서류 추가가 신청서 상세(`uploadApplicationDocument`)에서만 가능 → 서류함
  (`DocumentShelfClient`)에서 직접 올리거나 지울 수 없음.
- **조사 확정(스키마 변경 0)**:
  - 테이블 `seoul_application_documents` RLS(04:78-85 staff-write 루프)가 이미 staff INSERT/UPDATE/
    DELETE 허용. Storage `documents` 버킷(06:98-100) write/delete 도 `seoul_is_staff_for(owner)` 허용,
    read 는 `seoul_can_access`(self 포함). → **Manual-Ops 불필요**.
  - ★제약: `application_id UUID NOT NULL`(03) — 모든 서류 행이 신청서에 종속. 서류함(참여자 단위)
    업로드는 서버가 참여자의 **최신 seoul_applications** 를 자동 해결해 그 application_id 로 넣는다
    (스키마 변경 회피). 신청이 없는 당사자는 업로드 불가(명확한 에러) — 첫 서류는 여전히 신청서 상세.
  - 경로 첫 세그먼트 = 참여자 id(06 `seoul_storage_owner`). 서류함 업로드 경로 = `{participantId}/
    shelf/{uuid}.{ext}`(소유자 규칙 준수).
- **설계**:
  - `uploadShelfDocument({participantId,docType,fileName,base64,mimeType?,note?})` — `assertStaff` →
    최신 application 해결(없으면 에러) → admin.storage upload(경로접두 강제) → 세션client insert
    (RLS staff) → 실패 시 파일 롤백 → `auditLog`·revalidate. `uploadApplicationDocument` 패턴 복제.
  - `deleteShelfDocument(documentId)` — `assertStaff` → 세션client 로 storage_path 조회(RLS 인가) →
    행 delete(RLS staff) → admin.storage remove → `auditLog`·revalidate.
  - UI(`DocumentShelfClient`) — 문서별 **삭제**(확인) + 참여자 그룹별 **서류 추가**(docType 3종·파일·
    메모, base64 변환). `useToast` announce + `router.refresh()`.
  - ★UI 범위: 업로드는 셸프에 이미 있는 참여자(서류≥1)에 한함(그룹 컨텍스트). 서류 0건 신규 참여자
    첫 업로드는 신청서 상세 유지(후속에서 전체 참여자 picker 확장 가능).
- **계약(W)**: 액션 `document.mutate.test.ts` — 업로드(application 해결·경로 participantId 접두·insert)·
  application 없음 거부·삭제(행+파일)·미인가 삭제 거부 4건. UI `DocumentShelfClient.mutate.test.tsx` —
  삭제 노출·배선·업로드 어포던스·배선.

### A4 — 원장 기간 필터 + 참여자별 지출상태 내역 【ACTIVE】
- **갭**: org 원장이 org 전체 합계/상태칩 + 참여자별 total/count 뿐. 기간 필터 없음, 참여자별
  상태(대기/인정/반려/환수) 금액 내역 없음.
- **조사 확정**: `OrgLedgerClient` 는 이미 정산상태 필터 보유(all/대기/완료/반려/환수). rows(LedgerRow)=
  id·participant·amount·settlementStatus·usageDate·description — **domain/provider 없음**(page 가
  getServiceUsages 만 쓰고 domain_id 미포함). 순수·클라이언트 확장이라 서버/액션 무변경. 기존 golden은
  필드단위 단언이라 참여자 객체에 필드 추가해도 안 깨짐.
- **범위(정한 것)**:
  - **기간 필터**(usageDate from/to, 클라이언트) 추가.
  - **참여자별 상태 내역** — `buildOrgLedger` 의 `OrgLedgerParticipant` 에 `byStatus`(버킷별 amount/
    count) 추가(가산). 각 참여자 행이 대기/인정/반려/환수 금액을 보여줌.
  - **연기**: 영역/제공기관 필터 = getServiceUsages 에 domain_id 노출 + 라벨 배선 필요 → **A5**(export
    가 영역 라벨을 어차피 필요로 하므로 함께 배선). **실제 정산기록(미사용 포함)** = **A6** 정산 라우트
    (정산 전용 표면)에서.
- **계약(W)**: `orgLedger.byparticipant.test.ts` golden(참여자별 byStatus·교차합치) +
  `OrgLedgerClient.filter.test.tsx`(기간 필터 좁힘·참여자 상태 내역 렌더).

### A5 — 회계 export (+ 영역 라벨 배선)
- **갭**: export 전무(리빌딩 때 제거).
- **설계**: 서버액션/route 로 CSV(Excel BOM) 생성 — 서울형 컬럼(날짜·당사자·영역·제공기관·금액·
  정산상태·메모). 다운로드는 **사용자 브라우저**가 수행(에이전트 대행 아님). 원장/참여자거래에 버튼.
  ★A4 에서 연기한 **영역/제공기관 필터**를 여기서 함께: getServiceUsages 에 domain_id 노출 +
  seoul_service_domains/providers 라벨 배선(export 컬럼과 원장 필터가 공유).
- **계약**: CSV 직렬화 golden(컬럼·이스케이프·BOM) + (영역 배선 시) 원장 영역 필터.

### A6 — `/supporter/settlements` 라우트
- **갭**: `settlement.ts:62` 가 존재하지 않는 `/supporter/settlements` 를 revalidate. 정산은 관리자
  참여자 상세 안에만 있음.
- **설계**: 실무자 **열람** 정산 원장 라우트 신설(`getSettlements` RLS 스코프). 기록은 관리자 유지
  (`recordSettlement` = `assertAdmin`). 실무자는 담당 참여자 정산을 모아 봄.
- **계약**: 라우트 렌더 + RLS 스코프(담당 외 미노출) 계약.

## §3 공통 원칙

- **구현≠검증**: 계약·설계 = W(이 문서) · 구현 = 신선 서브에이전트(U) · 재검증 = 독립(W/신선). 저자가
  자기 구현을 채점하지 않음.
- **RLS·정책**: staff-write = `seoul_is_staff_for(participant_id)` · 관리자 = `assertAdmin`. 회계
  무결성상 정산완료/환수 레코드는 하위 뮤테이션 차단.
- **금액 표시**: 화면 금액 = `MoneyText`/`formatCurrency`(§8·§9 통일 완료 준수). 새 raw 팔레트 클래스
  금지(tokenFoundation GREEN 유지).
- **Manual-Ops Gate**: 새 테이블/스키마 변경(A2·A3 는 스키마 변경 없음 — 기존 테이블) 발생 시 대시보드
  수동적용 브리핑 후 사용자 실행. A1 은 스키마 변경 0.
- **main 직접 push 금지** — 항상 PR·CI 경유. 머지는 사람.

## §4 상태 (2026-09-10)
- A1 완료(#131). A2 완료(#132). A3 완료(#133). A4 ACTIVE(이 PR). A5–A6 계획 확정, 순차 착수.
- A4→A5 이월: 영역/제공기관 필터(도메인 라벨 배선). A4→A6 이월: 실제 정산기록(미사용) 표면.
