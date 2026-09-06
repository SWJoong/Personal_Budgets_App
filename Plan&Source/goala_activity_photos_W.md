# 활동 사진 백엔드 (seoul_activity_photos) — 설계·계약 (W)

> 상태: RED 계약 핸드오프 (Wave A). 저자 W(e6) → 구현 app-6c(U) → 검증 신선 서브에이전트 → 사람 머지.
> 로드맵 P1~P7 완결 후 신규 백엔드 기능. 사용자 지시: "갤러리 활동사진 백엔드 착수 + 3역할 화면 체크".

## 1. 배경 · 갭

- `activity-photos` 스토리지 버킷 + RLS 정책은 **이미 존재**(`supabase/seoul/06_storage.sql:37`, private 10MB, 본인·담당 staff).
- 그런데 이를 가리키는 **DB 테이블이 없다** → 갤러리(`src/app/(participant)/gallery/page.tsx`)가 `seoul_receipts`(receipts 버킷)를 '활동 사진'으로 대신 읽고 있음.
- 즉 오늘 앱에는 **진짜 활동사진이 없다**(영수증만). 이 기능이 그 조각을 채운다.

## 2. 3역할 화면 체크 (감사 결과)

| 역할 | 현황 |
|---|---|
| 이용자 participant | `/gallery` 존재(영수증-백드). 홈 '활동 사진' 블록 토글 예약(uiPreferences `gallery`, 기본 on). |
| 관리자·서비스제공자 supporter+admin | 활동사진/갤러리 화면 **없음**. review/transactions 에서 영수증 `<img>`만. 기록 시 영수증 업로드 UI 존재(`serviceUsage.ts:81`). |
| 최고관리자 super-admin | **역할·화면 미구현**. `profiles.is_super_admin` 컬럼 있으나 코드 미사용. `SUPER_ADMIN_EMAIL`은 로그인 게이트 전용. 역할값 `participant/supporter/admin` 3개뿐. |

## 3. 사용자 결정 (2026-09-06)

1. 최고관리자 = **admin 을 최상위 열람자로**(별도 super-admin 역할·라우트 신설 안 함).
2. 범위 = **읽기 + 쓰기**(기록 화면 업로드 UI) + **실무자 갤러리 신설**.
3. 갤러리 우선순위(P7 이월) = **활동사진 우선 → 영수증 후순위 → 영수증만인 usage 는 영수증만**.

## 4. 세션 간 조율 (★중요)

데모 데이터 세션 `personal-budgets-app-2d`가 **`supabase/seoul/08_seed_demo.sql` 단독 소유**(당사자 10명 페르소나 대규모 재작성 중). 합의:
- **app-6c(U)는 `08_seed_demo.sql` 을 절대 건드리지 않는다.** 활동사진 시드는 2d 가 이 테이블 머지 후 08 에 추가.
- app-6c 담당: `03_seoul_schema.sql`(테이블) · `04_seoul_rls.sql`(RLS) · `src/types/database.ts`(타입) · `src`(읽기/쓰기/실무자 갤러리) · `.github/workflows/db-verify.yml`(verify 목록에 이 파일 등록) · `docs/release/`(수동 업로드 노트).
- 이미지 바이트는 SQL 로 못 넣음 → 시드 행이 있어도 파일 없으면 signed URL 이 falsy → 갤러리가 **조용히 필터**(에러 아님). 이 동작 유지.

## 5. 스키마 (app-6c 가 03/04 에 붙여넣을 정본)

### 5-1. 테이블 — `03_seoul_schema.sql` (seoul_receipts 바로 뒤, ~L536)

```sql
-- 활동 사진 — 지출/활동에 붙는 기록 사진. 영수증(seoul_receipts)과 의미가 다르다:
--   영수증 = 정산 증빙(receipts 버킷) / 활동사진 = 활동 기록·회상(activity-photos 버킷).
-- usage 당 여러 장 가능(갤러리는 활동당 N장이 자연스럽다). provider_id 없음(활동사진은 업체 발행이 아님).
CREATE TABLE IF NOT EXISTS public.seoul_activity_photos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_id       UUID NOT NULL REFERENCES public.seoul_service_usages(id) ON DELETE CASCADE,
  storage_path   TEXT NOT NULL,
  caption        TEXT,
  taken_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN public.seoul_activity_photos.storage_path IS
  'activity-photos 버킷의 경로. 공개 URL 저장 금지 — private 버킷이므로 signed URL 로 변환해 노출한다.';
CREATE INDEX IF NOT EXISTS idx_seoul_activity_photo_usage ON public.seoul_activity_photos (usage_id);
```

### 5-2. RLS — `04_seoul_rls.sql` (seoul_receipts 정책 바로 뒤, ~L289) — 영수증과 **동일 규칙 미러**

```sql
-- 활동 사진 — 영수증과 동일: 본인·담당 staff 열람 / 쓰기는 staff 항상, 본인은 정산 전(pending)까지.
ALTER TABLE public.seoul_activity_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_activity_photos_select ON public.seoul_activity_photos;
CREATE POLICY seoul_activity_photos_select ON public.seoul_activity_photos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_service_usages u
                  WHERE u.id = usage_id AND public.seoul_can_access(u.participant_id)));
DROP POLICY IF EXISTS seoul_activity_photos_write ON public.seoul_activity_photos;
CREATE POLICY seoul_activity_photos_write ON public.seoul_activity_photos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_service_usages u
                  WHERE u.id = usage_id
                    AND (public.seoul_is_staff_for(u.participant_id)
                         OR (public.seoul_is_self(u.participant_id) AND u.settlement_status = 'pending'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seoul_service_usages u
                  WHERE u.id = usage_id
                    AND (public.seoul_is_staff_for(u.participant_id)
                         OR (public.seoul_is_self(u.participant_id) AND u.settlement_status = 'pending'))));
```

### 5-3. 타입 — `src/types/database.ts` (seoul_receipts 블록 미러; provider_id 제거, caption/taken_at 추가)

```ts
seoul_activity_photos: {
  Row: {
    caption: string | null
    created_at: string
    id: string
    storage_path: string
    taken_at: string | null
    usage_id: string
  }
  Insert: {
    caption?: string | null
    created_at?: string
    id?: string
    storage_path: string
    taken_at?: string | null
    usage_id: string
  }
  Update: {
    caption?: string | null
    created_at?: string
    id?: string
    storage_path?: string
    taken_at?: string | null
    usage_id?: string
  }
  Relationships: [
    {
      foreignKeyName: "seoul_activity_photos_usage_id_fkey"
      columns: ["usage_id"]
      isOneToOne: false
      referencedRelation: "seoul_service_usages"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "seoul_activity_photos_usage_id_fkey"
      columns: ["usage_id"]
      isOneToOne: false
      referencedRelation: "v_seoul_unplanned_usages"
      referencedColumns: ["usage_id"]
    },
  ]
}
```
> `generate-types` 를 실측 DB 로 돌릴 수 있으면 그 산출물이 정본. 위는 손 미러(오프라인)용.

## 6. Wave A — 읽기(갤러리 2소스 우선순위) · 계약 2건

### 6-1. 순수 병합 함수 — `src/utils/gallery.ts` (app-6c 신설)

```ts
export interface GalleryPhoto {
  usageId: string
  url: string
  label: string            // caption(활동) 또는 usage.description(영수증)
  date: string             // 정렬 키. usage_date 또는 taken_at (ISO). '' 허용(맨 뒤로)
  kind: 'activity' | 'receipt'
}

/** 갤러리 2소스 병합 — 활동사진 우선, 영수증 후순위. 각 그룹 내 date 내림차순(안정).
 *  url 이 falsy 인 항목은 버린다(파일 미업로드 = 조용히 필터). 입력 배열은 변형하지 않는다. */
export function mergeGalleryPhotos(activity: GalleryPhoto[], receipt: GalleryPhoto[]): GalleryPhoto[]
```

**의미(사용자 결정 3의 정본 해석)**: 결과 = `[…활동사진(date desc), …영수증(date desc)]`.
- 활동사진 블록이 항상 영수증 블록보다 앞선다(날짜와 무관 — 오래된 활동사진도 최신 영수증보다 앞).
- 활동사진이 0장이면 영수증만 남는다("영수증만이면 영수증만" 자연 충족).
- 둘 다 있으면 둘 다 보인다(영수증 "그 다음으로").
- 계약: `src/utils/gallery.test.ts` 골든(아래).

### 6-2. 갤러리 배선 — `src/app/(participant)/gallery/page.tsx`

- `seoul_activity_photos`(activity-photos 버킷) + `seoul_receipts`(receipts 버킷) 둘 다 읽어 각각 signed URL → `GalleryPhoto[]` 로 매핑 → `mergeGalleryPhotos(activity, receipt)`.
- falsy signed URL 필터 유지. 빈 결과면 기존 EmptyState.
- 계약: `gallery.wiring.ap.test.ts`(fs-scan) — page.tsx 가 `seoul_activity_photos`·`activity-photos`·`mergeGalleryPhotos` 참조.

## 7. Wave B — 쓰기(업로드) · Wave C — 실무자 갤러리 (후속 계약)

- **Wave B**: `src/app/actions/activityPhoto.ts` — `addActivityPhotos(usageId, files[])`(admin 클라이언트 업로드 → activity-photos 버킷 경로 `${participantId}/${usageId}/${n}.${ext}` → `seoul_activity_photos` insert, orphan 롤백). `serviceUsage.ts:81~103` 미러. `getActivityPhotoSignedUrls(usageId)`. UI: 당사자 `ReceiptClient` · 실무자 `NewTransactionClient` 에 활동사진(다건) 첨부.
- **Wave C**: `(supporter)/supporter/[participantId]/gallery` 신설(실무자·admin 이 담당 당사자 활동사진 열람). supporter 레이아웃이 이미 supporter+admin 게이트.
- B/C 계약은 A 머지 후 별도 RED 핸드오프.

## 8. 게이트 · 그린어빌리티 (저자 자기점검 — [[contract-greenability]])

- verify SQL: 로컬 docker postgres:15 로 00~08 빌드 후 (1) 테이블 **없이** 실행 → T0 ❌(RED 확인) (2) 5-1/5-2 적용 후 실행 → 전 항목 ✅(그린어빌리티 확인). 실행노트는 아래.
- 골든: 참조 구현으로 `src/utils/gallery.test.ts` green, 현재(util 부재) RED 확인.
- app-6c: `.github/workflows/db-verify.yml` 의 `verify=(...)` 배열에 **`verify_activity_photos` 추가**(안 하면 CI 가 계약을 안 돌림). `npm test`(골든 포함)·`tsc --noEmit`([[contract-tsc-gate]])·`build`·`lint` green.

## 9. 파일 소유(레인)

- **W(이 브랜치)**: `Plan&Source/goala_activity_photos_W.md`(이 문서) · `Plan&Source/ontology/seoul/verify_activity_photos.sql` · `src/utils/gallery.test.ts` · `src/app/(participant)/gallery/gallery.wiring.ap.test.ts`.
- **app-6c(U, feat 브랜치)**: 03/04/types/src 구현 + db-verify.yml 등록 + docs/release 노트. **08 금지**(2d 소유).
