# 활동 사진 Wave B — 업로드 · 설계·계약 (W)

> Wave A(#117, main 695c0ab) 후속. 저자 W(e6) → 구현 app-6c(U) → 검증 신선 서브에이전트 → 사람 머지.
> base: origin/main(Wave A 포함). 사용자 결정 범위 "읽기+쓰기" 중 **쓰기(업로드)**.

## 1. 목표

당사자·실무자가 지출을 기록할 때 **활동 사진(다건)** 을 함께 올릴 수 있게 한다. 영수증(단건, recordServiceUsage
내장)과 달리 활동사진은 **usage 당 N장** → 별도 서버액션. 버킷 activity-photos(Wave A/06_storage 기존),
테이블 seoul_activity_photos(Wave A), 경로위조 차단 트리거(Wave A) 전부 이미 main 에 있음.

## 2. 서버액션 — `src/app/actions/activityPhoto.ts` (app-6c 신설)

```ts
'use server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ActivityPhotoInput { base64: string; mimeType?: string }

export async function addActivityPhotos(
  usageId: string,
  photos: ActivityPhotoInput[],
): Promise<{ success?: true; added?: number; error?: string }>
```

**로직·보안(정본)**:
1. `createClient()`(user 스코프) + `auth.getUser()` — 미로그인 error. photos 비면 `{success, added:0}`.
2. ★**참여자 id 는 usage 에서 서버측 도출**(클라 신뢰 금지): `supabase.from('seoul_service_usages').select('participant_id').eq('id', usageId).maybeSingle()`. RLS 가 접근 가능한 usage 만 반환 → 없으면 error(권한/부재). `participantId = usage.participant_id`.
3. `admin = createAdminClient()`(storage 전용). 각 photo 마다:
   - `photoId = crypto.randomUUID()`, `ext = MIME_EXT[mimeType]`.
   - ★**경로는 서버가 구성**: `path = ${participantId}/${usageId}/${photoId}.${ext}` (클라가 경로를 못 준다 — 시그니처에 path 없음).
   - `admin.storage.from('activity-photos').upload(path, buffer, {contentType, upsert:true})`. 실패 시 skip.
   - `supabase.from('seoul_activity_photos').insert({ usage_id: usageId, storage_path: path })` (user 스코프 → **RLS 적용**: self-pending or staff). 실패 시 `admin.storage.from('activity-photos').remove([path])`(orphan 롤백) 후 skip.
   - 성공 시 added++.
4. `revalidatePath('/gallery')`·`revalidatePath('/')`. `{success, added}` 반환.

**보안 3중**: ① RLS(insert) = 이 usage 에 사진 붙일 권한(self-pending/staff) 있는가 · ② 서버가 경로 접두를 usage 소유 참여자로 강제(클라 위조 불가) · ③ Wave A 트리거가 접두 재검증(2차). recordServiceUsage 영수증 블록(serviceUsage.ts:81~103) 미러 + 참여자 도출만 서버화.

## 3. UI — 기록 화면 2곳에 활동사진(다건) 첨부

recordServiceUsage 는 usage 를 만들고 usageId 를 반환한다(`{success, usageId}`). 활동사진은 **usage 생성 후** 그
usageId 로 addActivityPhotos 를 호출한다(2단계). 두 화면 모두:

- **당사자**: `src/app/(participant)/receipt/ReceiptClient.tsx` — 영수증 입력(단건, 유지) 아래 '활동 사진'
  다건 입력(`type="file" accept="image/*" multiple`). handleSubmit 의 recordServiceUsage 성공 후,
  `if (activityPhotos.length && result.usageId) await addActivityPhotos(result.usageId, activityPhotos)`.
  성공 시 activityPhotos state clear. (기존 영수증 흐름·상태초기화·router.refresh 유지.)
- **실무자**: `src/app/(supporter)/supporter/[participantId]/transactions/new/NewTransactionClient.tsx` — 동일 패턴.

라벨·쉬운말은 W easy-read 소유(당사자 화면 문구는 '활동 사진' 통일, help 예: "활동한 모습을 사진으로 남겨요.").
파일→base64 변환은 기존 ReceiptClient 의 FileReader 패턴 재사용.

## 4. 계약 (RED)

- **`src/app/actions/activityPhoto.test.ts`** — 액션 로직(Supabase mock). 단언: (A) 단건 → activity-photos 버킷에
  `${usage.participant_id}/${usageId}/{uuid}.ext` 로 업로드 + seoul_activity_photos insert(storage_path=그 경로), added=1.
  ★경로 첫 세그먼트 = **mock usage 의 participant_id**(서버도출, 클라 미전달) — 위조 불가 설계 검증. (B) 다건 → N 업로드/insert.
  (D) usage 없음 → error, 업로드 0. (E) insert 실패 → `remove([path])` 호출(orphan 롤백), added 0. (F) 미로그인 → error.
  (G) photos 빈 배열 → added 0, 업로드 0.
- **`src/app/actions/activityPhoto.wiring.ap.test.ts`** — fs-scan: activityPhoto.ts 가 addActivityPhotos export;
  ReceiptClient.tsx·NewTransactionClient.tsx 가 `addActivityPhotos` 참조(=업로드 배선).

## 5. 게이트·그린어빌리티 (저자 자기점검)

- 액션 test: 참조구현으로 green 확인 후 참조구현 삭제(RED 유지). vitest + `tsc --noEmit`([[contract-tsc-gate]]).
- app-6c: `npm test`(신규계약 포함)·tsc·build·lint green. **08_seed_demo 금지**(2d). db-verify 변화 없음(스키마 무변경 — Wave A 트리거로 충분).

## 6. 레인

- **W(이 브랜치)**: 이 문서 · `src/app/actions/activityPhoto.test.ts` · `src/app/actions/activityPhoto.wiring.ap.test.ts`.
- **app-6c(U)**: `src/app/actions/activityPhoto.ts` · ReceiptClient/NewTransactionClient 배선. 스키마 무변경(Wave A 재사용). 08 금지.

## 7. 범위 밖(후속)

Wave C(실무자 갤러리 신설) · receipts 경로위조 리트로핏(보안 백로그) · 활동사진 삭제/편집 UI · 기존 usage 에 사후 첨부 UI(이번은 기록시점 첨부만).
