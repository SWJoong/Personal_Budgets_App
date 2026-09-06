# 06 · 활동사진 백엔드 (Wave A) — 스키마·RLS·갤러리 2소스

날짜: 2026-09-06 · 담당: U(app-6c, backend·frontend) · W 계약: `test/w-activity-photos`
(`Plan&Source/goala_activity_photos_W.md` · `verify_activity_photos.sql` · `gallery.test.ts` 골든 · `gallery.wiring.ap.test.ts`)

## 요약
갤러리를 **영수증 단일 소스 → 활동사진 우선 + 영수증 후순위 2소스**로 승격하는 백엔드 토대(Wave A).
활동사진 메타행을 담는 `seoul_activity_photos` 테이블(영수증 미러) + RLS 를 신설하고, 당사자 갤러리
페이지를 두 소스를 병합해 렌더하도록 배선했다. 업로드 UI(Wave B)·실무자 갤러리(Wave C)는 후속.

사용자 결정(P7-3): 갤러리 정체성 = **활동사진 우선 → 영수증 후순위**(영수증만이면 영수증만), 이름 '활동 사진'.
병합 규칙은 순수 함수 `mergeGalleryPhotos`(골든 10/10)로 못 박음 — 각 소스를 날짜 내림차순 정렬 후
`[...활동, ...영수증]` concat(소스 간 dedup 없음).

## 1. 변경 파일
| 구분 | 파일 | 내용 | 수동반영 |
|---|---|---|---|
| 스키마 | `supabase/seoul/03_seoul_schema.sql` | `seoul_activity_photos` 테이블 + 인덱스 + **★경로위조 방지 트리거** `seoul_check_activity_photo_path`(BEFORE INSERT/UPDATE) | **필요** |
| RLS | `supabase/seoul/04_seoul_rls.sql` | `_select`(열람) · `_write`(쓰기) 정책 2종 | **필요** |
| 스토리지 | `supabase/seoul/06_storage.sql` | **무변경** — `activity-photos` 버킷·정책은 컷오버부터 이미 존재(L37, L62 FOREACH) | 확인만 |
| 타입 | `src/types/database.ts` | `seoul_activity_photos` Row/Insert/Update/Relationships | 없음(앱) |
| CI | `.github/workflows/db-verify.yml` | `verify_activity_photos` 계약 등재 | 없음(CI) |
| 로직 | `src/utils/gallery.ts` | `mergeGalleryPhotos`(순수 병합) — 골든 정본 | 없음(앱) |
| 화면 | `src/app/(participant)/gallery/page.tsx` | 2소스 읽어 `GalleryPhoto[]` → `mergeGalleryPhotos` | 없음(앱) |

08_seed_demo(활동사진 시드)는 **이 릴리스 범위 밖** — 별도 세션(2d)이 단독 소유. Wave A 머지 후 위임.

## 2. 수동 절차 체크리스트 (대시보드 SQL Editor, 순서대로)
> **전제(Manual-Ops Gate)**: `db-verify` CI 가 **green**(verify_activity_photos 포함)일 때만 반영한다.
> 초록 아닌 스키마를 수동 반영하지 않는다.

1. **`supabase/seoul/03_seoul_schema.sql` 재실행** — 목적: 활동사진 메타행 테이블 + 경로위조 방지 트리거 생성.
   `CREATE TABLE IF NOT EXISTS` 라 기존 26테이블은 무영향, 신규 `seoul_activity_photos` 만 추가.
   컬럼: `id`(PK) · `usage_id`(→`seoul_service_usages` ON DELETE CASCADE, NOT NULL) · `storage_path`
   (NOT NULL, private 버킷 경로 — 공개 URL 저장 금지) · `caption` · `taken_at` · `created_at`.
   같은 파일 끝(테이블·인덱스 바로 뒤)에 `seoul_check_activity_photo_path()` 함수 + `trg_…` 트리거도 함께
   설치(`CREATE OR REPLACE` · `DROP TRIGGER IF EXISTS`+`CREATE`) — 재실행 안전. 상세는 §3 보안.
2. **`supabase/seoul/04_seoul_rls.sql` 재실행** — 목적: 테이블 접근제어(영수증과 동일 정책).
   `DROP POLICY IF EXISTS` + `CREATE` 라 재실행 안전.
   - `_select`: usage 의 당사자에 `seoul_can_access` 인 사용자만 열람(본인·담당자·관리자).
   - `_write`: `seoul_is_staff_for` **또는** (`seoul_is_self` **그리고** 정산 `pending`) — 실무자는 항상,
     당사자 본인은 정산 확정 전까지만 쓰기(영수증과 대칭).
3. **`activity-photos` 버킷 존재 확인** — 대시보드 Storage. 컷오버 때 `06_storage.sql` 을 적용했다면
   이미 private 버킷(10MB, 이미지 MIME)으로 존재. 없으면 `06_storage.sql` 재실행(Supabase 전용 —
   `storage.*` 스키마 의존이라 db-verify 빌드에선 제외되는 파일).

> **비-SQL 수동작업 없음** — Auth/URL/버킷 신설 불필요(버킷은 기존). 위 SQL 2개 재실행이 전부.

## 3. 보안 — 경로 위조 방지 트리거 (사용자 결정 Option 3)
`_write` RLS 는 본인이 자기 pending 지출에 사진행을 넣는 것을 허용하되 **`storage_path` 소유 접두를
강제하지 않는다**. 갤러리는 signed URL 을 **admin 클라이언트(RLS 우회)**로 발급하므로, 참여자가 직접 API 로
자기 지출에 *남의 경로*(`{남의_participant_id}/…`)를 INSERT 하면 남의 비공개 사진 URL 을 얻을 수 있다
(남의 participant/usage/photo UUID 3개를 알아야 함 · 열거 불가). W 보안검증(#117)에서 HIGH 로 포착.
- **결정(사용자)**: **DB 레벨 원천 차단**을 **활동사진만** 적용(receipts 와 분기), **Wave A(#117) 안**에서.
- **방식**: `BEFORE INSERT OR UPDATE` 트리거 `seoul_check_activity_photo_path` — `storage_path` 첫 폴더
  세그먼트(`split_part(path,'/',1)`)가 지출 소유 참여자 id 와 다르거나 NULL 이면 `RAISE`. **role 무관**
  (user·admin·직접 SQL 전부) 차단 = 가장 철저. RLS `WITH CHECK` 는 admin 서명경로(Wave B 업로드)를
  못 잡지만 트리거는 잡는다. 위조행 생성 자체가 불가하므로 **읽기시점 접두검증은 불필요**(page.tsx 미추가).
- **경로 규약**: `{participantId}/{usageId}/{photoId}` — **첫 세그먼트 = participantId**. 스토리지 RLS
  `seoul_storage_owner = foldername[1]::uuid` 와 정합.
- **계약**: `verify_activity_photos.sql` **S2b**(본인이 남의 접두 경로 INSERT → 트리거 RAISE → 0건)가
  트리거가 load-bearing 임을 증명(트리거 없으면 실패). db-verify CI 에서 자동 실행.
- **범위 밖(별도 보안 백로그)**: `seoul_receipts` 동일 패턴은 이번에 손대지 않음. **Wave B 필수요건**:
  업로드 서버액션이 `storage_path` 접두=참여자 id 를 **서버강제**(클라이언트 신뢰 금지).

## 4. 되돌림 · 리스크 · 멱등성
- **멱등성**: 03(`IF NOT EXISTS` · 함수 `CREATE OR REPLACE` · 트리거 `DROP…IF EXISTS`+`CREATE`)·
  04(`DROP…IF EXISTS`+`CREATE`) 전부 재실행 무오류. db-verify 가 03 재적용까지 자동 검증.
- **데이터 영향**: 순수 가산 — 기존 테이블·행 무접촉. 위험도 낮음.
- **롤백**: `DROP TABLE IF EXISTS public.seoul_activity_photos CASCADE;`(테이블·정책·인덱스·FK·트리거
  동시 제거) + `DROP FUNCTION IF EXISTS public.seoul_check_activity_photo_path();`. 버킷/`storage.objects`
  는 건드리지 않음.
- **읽기 경로 안전**: 버킷/행이 없어도 갤러리는 signed URL 실패분을 조용히 필터 → `EmptyState`("아직
  사진이 없어요")로 정상 저하. 즉 테이블만 있고 사진이 0건이어도 화면은 깨지지 않음.

## 5. 관련 파일
- 계약(W, `test/w-activity-photos`): `Plan&Source/goala_activity_photos_W.md` ·
  `Plan&Source/ontology/seoul/verify_activity_photos.sql` · `src/utils/gallery.test.ts` ·
  `src/app/(participant)/gallery/gallery.wiring.ap.test.ts`
- 정본 실행순서: `supabase/seoul/README.md` · 수동 반영 직전 브리핑: CLAUDE.md 「수동 작업 게이트」
