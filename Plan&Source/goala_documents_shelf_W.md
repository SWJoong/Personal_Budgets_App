# GOAL축 B · B2 `supporter/documents` 증빙/서류 보관함 — 설계·계약 (W → U)

> 작성: **W(설계·검증, `/pl` `/ux-ui` `/backend`(계약)) · 2026-09-03** · 대상: **U(구현)** · test-first
> 트리아지 `goala_comingsoon_stubs_triage_W.md` §4-6 확장. 현행 `supporter/documents/page.tsx` =
> `<ComingSoon>` 스텁. B2 는 **열람 우선**(업로드는 후속) — 담당 실무자/관리자가 담당 당사자 전원의
> 신청서·동의서 원본을 한 화면에서 당사자별로 본다.
> 레인: 이 스펙 · 골든(`src/utils/documentShelf.test.ts`) · verify(`verify_documents_shelf_rls.sql`) = **W** ·
> 나열 액션 · 화면 · 네비 = **U**.

---

## 0. 정찰 결론 — "이미 있는 것" vs "실제 공백"

`03/04/06_*.sql` · `application.ts` · `serviceUsage.ts` 실측(2026-09-03):

| 조각 | 상태 | 근거 |
|---|---|---|
| 메타 테이블 `seoul_application_documents` | ✅ 존재 | 03_seoul_schema.sql:313 — `participant_id` 직접 컬럼 + `doc_type`·`file_name`·`storage_path`(UNIQUE)·`note`·`created_at` |
| 테이블 RLS(본인+담당staff+admin 읽기, staff만 쓰기) | ✅ 존재 | 04_seoul_rls.sql:73-98 — SELECT `seoul_can_access(participant_id)` / 쓰기 `seoul_is_staff_for` |
| 스토리지 `documents` 버킷(private)·정책 | ✅ 존재 | 06_storage.sql:39·92-101 — read `seoul_can_access`, write `seoul_is_staff_for` |
| 경로→소유자 판별 `seoul_storage_owner` | ✅ 존재·검증됨 | verify_08_records.sql R5 |
| **본인** 서류 RLS(자기 것 보임/남 것 0/삭제 차단) | ✅ 검증됨 | verify_08_records.sql R6 |
| 단건 조회 `getApplicationDocuments(applicationId)` + signed URL `getApplicationDocumentUrl(documentId)` | ✅ 존재 | application.ts:320-357 — **정본 보안 패턴**(§2) |
| **across-application 서류함 나열**(담당 당사자 전원, 당사자별 그룹) | ❌ **공백** | 기존은 신청 1건 단위. 서류함이 요구하는 org 뷰 없음 |
| **staff 스코핑 RLS 검증**(담당 실무자↔담당 당사자 전원 / 비담당 0 / admin 전량) | ❌ **미검증** | R6 은 본인 차원만. 정책엔 있으나 회귀잠금 없음 → §4 |

→ **정책·인가는 이미 옳다.** B2 가 새로 만드는 것은 **① 나열 액션(org 뷰) ② 화면** 둘뿐이고,
W 가 못박을 것은 **③ 나열 액션이 admin 클라이언트로 인가를 넘기지 않게 하는 계약**(§2) +
**④ 집계 순수로직 골든**(§3) + **⑤ staff 스코핑 회귀잠금 verify**(§4).

---

## 1. IA — 담당자 화면 (표준어 가능, 당사자 노출 아님 → easy-read 대상 아님)

```
[헤더] 서류 보관함
① 요약 바: 전체 {n}건 · 당사자 {m}명
② (관리자만) 당사자 필터
③ 당사자별 그룹 (buildDocumentShelf, §3):
   ▸ {이름}   서류 {count}건   [최근 {latestDate}]
       └ 문서 행: [유형칩 신청서|동의서|기타]  {file_name}   {created_at}   [열기]
              · note 있으면 회색 보조문구
   그룹 정렬: 최근 서류일(latestDate) 내림차순 → 동률 이름 오름차순
   문서 정렬: created_at 내림차순 → 동률 file_name 오름차순
④ 빈 상태: "아직 등록된 서류가 없어요." (담당 당사자에 서류 0건)
```

- **[열기]** = 클릭 시 `getDocumentSignedUrl(documentId)`(§2-B) 호출 → 새 탭/뷰어. private 버킷이라
  URL 은 매번 발급(1시간). 목록 렌더 시 전량 사전발급 금지(N개 signed URL 낭비·만료) — **클릭 시 발급**.
- 업로드/삭제 컨트롤 **없음**(이번 스코프 = 열람. 등록은 신청 흐름 `application.ts` 가 이미 담당. 쓰기는
  트리아지 Q3 = 별도 W 계약).
- 진입점: AdminSidebar `증빙/서류` · 실무자 메뉴(현 `soon` → 구현 시 제거, 트리아지 §2-3).

---

## 2. ★보안 계약 (이 화면의 핵심 위험 — U 가 반드시 지켜야 함)

**위험**: `documents` 버킷 signed URL 은 `createAdminClient()`(서비스 롤)로 발급되므로 **스토리지 RLS 를
우회**한다(06_storage.sql:103-105 주석 명시 — "앱 경로에선 이 정책이 발동하지 않는다"). 따라서 나열/열람이
admin 클라이언트로 **행을 조회**하면 RLS 가 안 걸려 **남의 당사자 서류까지 유출**된다.

**계약(정본 패턴 = application.ts:320-357 · serviceUsage.ts:143-160 그대로)**:

### 2-A. 나열 액션 `getDocumentShelf()` — 조회는 반드시 `createClient()`(RLS)
```ts
// src/app/actions/document.ts (U 신설) — 무인자: RLS 가 범위를 정한다(admin=전체·supporter=담당분)
export async function getDocumentShelf(): Promise<{ error?: string; rows: ShelfDocRow[] }>
```
- **반드시 `createClient()`** 로 `seoul_application_documents` 조회 + `participants(name)` 조인.
  RLS `seoul_can_access(participant_id)` 가 담당 범위로 스코프 → **admin 클라이언트로 이 조회 금지**.
- 반환 행을 `ShelfDocRow`(§3) 로 매핑 → 화면이 `buildDocumentShelf()` 로 그룹핑.
- 인증 없으면 `{ rows: [] }`(기존 액션과 동일한 방어).

### 2-B. 열람 URL `getDocumentSignedUrl(documentId)` — RLS 인가 후에만 admin 서명
```ts
export async function getDocumentSignedUrl(documentId: string): Promise<{ error?: string; url: string | null }>
```
- **`createClient()`** 로 `seoul_application_documents` 에서 `id = documentId` 의 `storage_path` 조회.
  RLS 가 볼 수 있는 행만 돌려주므로 **여기서 조회되면 열람 권한이 있는 것**(application.ts:344 불변식).
- 조회 실패(=권한 없음) → `{ error:'볼 수 없는 서류예요.', url:null }`.
- **그 다음에만** `createAdminClient().storage.from('documents').createSignedUrl(path, 3600)`.
  admin 은 **RLS 가 이미 인가한 경로에 서명만** — 인가 판단을 admin 으로 하지 않는다.

> U 는 `getApplicationDocumentUrl`(application.ts:339)을 거의 그대로 복제하면 된다. 유일한 차이는
> "신청 1건" 대신 "documentId 직접". **admin 클라이언트가 인가 게이트를 대신하는 코드가 있으면 리뷰 반려.**

---

## 3. 집계 순수로직 골든 (RED → U green) — `buildDocumentShelf`

`orgLedger` 형제. `src/utils/documentShelf.ts`(U 구현), 골든 `src/utils/documentShelf.test.ts`(W 작성·RED).
DB 행 shape 과 분리한 명시적 입력. **함수는 스코프하지 않는다 — RLS 로 이미 스코프된 "보이는 행"만 집계**
(orgLedger.ts 주석 철학 동일).

```ts
// src/utils/documentShelf.ts (U 구현 대상)
export type DocType = 'application_form' | 'consent_form' | 'other'

export interface ShelfDocRow {
  id: string
  participantId: string
  participantName: string
  docType: DocType | string   // 미지값 허용 → 라벨에서 '기타'로 안전 강제
  fileName: string
  note: string | null
  createdAt: string           // ISO
}
export interface ShelfDoc {
  id: string
  docTypeLabel: string        // '신청서' | '동의서' | '기타'
  fileName: string
  note: string | null
  createdAt: string
}
export interface ShelfParticipant {
  participantId: string
  participantName: string
  count: number
  latestDate: string | null   // 그룹 내 최신 createdAt
  docs: ShelfDoc[]            // created_at 내림차순 → 동률 fileName 오름차순
}
export interface DocumentShelf {
  totalDocuments: number
  participants: ShelfParticipant[]  // latestDate 내림차순 → 동률 participantName 오름차순
}
export function buildDocumentShelf(rows: ShelfDocRow[]): DocumentShelf
```

### 골든이 못박는 불변식 (`documentShelf.test.ts`)
1. **그룹핑**: 같은 `participantId` → 한 그룹(`count`·`docs`). 이름 대표값.
2. **doc_type 라벨**: `application_form`→`신청서`·`consent_form`→`동의서`·`other`→`기타`,
   **미지 문자열→`기타`**(누락·크래시 금지). 4건 입력 시 4건 전부 생존.
3. **`latestDate`**: 그룹 내 최신 `createdAt`(문자열 아닌 `Date` 파싱).
4. **정렬 결정성**: 그룹 = `latestDate` 내림차순 → 동률 `participantName` 오름차순(localeCompare);
   그룹 내 `docs` = `createdAt` 내림차순 → 동률 `fileName` 오름차순.
5. **빈 입력** → `totalDocuments:0, participants:[]`.
6. **교차 합치성**: `totalDocuments == Σ count == Σ docs.length`(그룹핑 유실·중복 0 = 무결성).

> 이 골든이 RED 인 동안 U 가 `buildDocumentShelf` 구현해 green. 화면(§1 ③)이 이 함수 소비.

---

## 4. staff 스코핑 회귀잠금 verify (W) — `verify_documents_shelf_rls.sql`

verify_08 R6 은 **본인** 차원만 봤다. B2 는 실무자 서류함이라 **staff 차원**을 못박아야 한다. 정책
(`seoul_can_access`)에 이미 있으므로 이 verify 는 **GREEN 회귀잠금**(RED 아님) — 미래 정책 회귀 방어.
docker PG(로컬 임시) 또는 대시보드에서 실행. db-verify.yml 배열에 U 가 1줄 배선(§6).

**픽스처**: 담당 실무자 S(→당사자 A·B 배정) · 비담당 실무자 T · admin · A·B 각각 서류 1건.
**단언(RLS 하 SELECT count)**:
- `S` → A·B 서류 **2건 보임** ✅ (담당 당사자 전원)
- `T`(비담당) → **0건** ✅ 차단
- `admin` → **2건**(또는 전체) ✅
- `A` → 자기 1건만(=R6 재확인, 교차 없음)
- `T` 가 A 서류 UPDATE/DELETE 시도 → **0행 영향**(쓰기 `seoul_is_staff_for` 차단)
- ★삭제 여부는 R6 처럼 **RLS 밖(RESET ROLE)에서** 센다(안 보임 ≠ 지워짐 구분).

> W 가 docker PG 로 GREEN 실측 후 `[HANDOFF→U]`(1줄 배선). #78 처럼 db-verify.yml union 규칙 유의
> (배열 마지막 줄에 append — 동시 배선 시 union 충돌 가능, 그때 둘 다 유지).

---

## 5. easy-read / a11y

- 서류함은 **담당자 화면** → 표준어 허용, `validate_easy_read` 대상 아님. (당사자에게 노출되는 신규 문구
  없음 — 열람 주체가 실무자/관리자.)
- a11y: 유형칩 색상만으로 의미 전달 금지(텍스트 라벨 병기) · [열기] 44px 터치 · 그룹 펼침 `aria-expanded` ·
  빈 상태 문구 스크린리더 노출. 목록→외부 signed URL 이동은 `rel="noopener"`.

---

## 6. U 핸드오프 체크리스트 (B2)

1. **[골든 green]** `src/utils/documentShelf.ts` 구현 → `documentShelf.test.ts`(§3, 6불변식) green.
2. **[나열 액션]** `src/app/actions/document.ts` `getDocumentShelf()` — **`createClient()`(RLS)** 로
   `seoul_application_documents` + `participants(name)` 조인 → `ShelfDocRow[]`. (admin 클라이언트 금지.)
3. **[열람 URL]** `getDocumentSignedUrl(documentId)` — RLS 조회로 인가 → 그 다음에만 admin `createSignedUrl`
   (application.ts:339 복제). 목록은 클릭 시 발급(사전 전량발급 금지).
4. **[화면]** `supporter/documents/page.tsx` 스텁 → 서버컴포넌트에서 `getDocumentShelf()` →
   `buildDocumentShelf()` → §1 IA 렌더. [열기]는 클라이언트 액션.
5. **[네비]** 서류함 `soon` 뱃지 제거(트리아지 §2-3).
6. **[verify 배선]** W 가 GREEN 실측한 `verify_documents_shelf_rls.sql` 를 db-verify.yml 배열에 1줄 추가.
7. 업로드/삭제 UI 는 이번 스코프 밖(Q3) — 필요 시 별도 W 쓰기 계약.

## 7. 스코프 밖(기록)
- **업로드/삭제**: 이번 열람 우선. 등록은 신청 흐름(`uploadApplicationDocument`)이 이미 담당.
- **preview(B4) 연계 없음**: 서류함은 담당자 org 뷰, preview 는 당사자 홈 대리 렌더 — 별개.
- **감사로그(#77)**: 서류 열람 이벤트 감사는 audit_log 도입 후 훅 후속(preview 와 함께 §별도).
