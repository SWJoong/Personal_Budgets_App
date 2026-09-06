# 활동 사진 Wave C — 실무자 갤러리 · 설계·계약 (W)

> Wave A(#117)·B(#118) 후속. base origin/main(6b464fd). 사용자 결정 "실무자 갤러리 신설".
> 저자 W(e6) → 구현 app-6c(U) → 검증 신선 서브에이전트 → 사람 머지.

## 1. 목표

실무자·관리자(admin=최상위)가 **담당 당사자의 활동 사진을 열람**하는 화면 신설. 당사자 갤러리와 같은
2소스(활동사진 우선 → 영수증 후순위, mergeGalleryPhotos 재사용)를 staff 스코프로 보여준다.

## 2. 라우트 · 데이터 (app-6c 신설)

`src/app/(supporter)/supporter/[participantId]/gallery/page.tsx` (server component). transactions/page.tsx 패턴 미러:

- `const { participantId } = await params` · `const { supabase } = await requireStaff()` (supporter+admin 게이트 + user 스코프 클라이언트 → RLS 적용).
- `participants.select('id,name').eq('id', participantId).maybeSingle()` → 없으면 `notFound()`.
  (★RLS 로 staff 는 접근 가능한 당사자만 조회됨 → 미승인 participantId 는 notFound = 권한차단. admin 은 전체.)
- 그 당사자의 usages → `seoul_activity_photos`(activity-photos 버킷) + `seoul_receipts`(receipts 버킷) 읽어
  `GalleryPhoto[]` 매핑(Wave A page.tsx 로직과 동일) → `mergeGalleryPhotos(activity, receipt)`. signed URL 은
  `createAdminClient()`(RLS 우회는 서명만; 어떤 행을 읽을지는 user 클라 RLS 가 이미 스코프).
- 헤더 "{이름}님의 활동 사진", backHref `/supporter/${participantId}/transactions`. 본문은 §3 PhotoGallery.

## 3. 공용 컴포넌트 — `src/components/ui/PhotoGallery.tsx` (app-6c 신설)

당사자 갤러리와 실무자 갤러리의 그리드 렌더를 DRY 화. 순수 프레젠테이셔널(프롭 구동, 서버 컴포넌트 OK — 훅 없음):

```ts
import type { GalleryPhoto } from '@/utils/gallery'
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }): React.ReactElement
```

- photos 비면 `EmptyState`(emoji 🖼️, title "아직 사진이 없어요.", description "지출을 기록할 때 사진을 함께 남겨보세요.").
- 아니면 `<ul className="grid grid-cols-2 gap-3">` 안에 photo 당 `<li>`(img alt={p.label} + caption span). Wave A page.tsx:96~113 그리드와 동일 마크업.
- ★두 갤러리 모두 이 컴포넌트를 쓴다: 당사자 `(participant)/gallery/page.tsx` 는 인라인 그리드 → `<PhotoGallery photos={photos} />` 로 교체(회귀 없음 — 동일 출력, 기존 gallery.twosource/sort/p6c 골든 유지). 실무자 페이지도 동일 사용.

## 4. 진입점 (엔트리)

실무자가 갤러리로 가는 링크: `src/app/(supporter)/supporter/[participantId]/transactions/page.tsx`(당사자 staff 허브) 헤더 action 에 '활동 사진' LinkButton → `/supporter/${participantId}/gallery`. (거래장부 옆, 발견성 확보.)

## 5. 접근 제어

- `(supporter)/layout.tsx` 가 supporter+admin 만 통과(그 외 `/` 리다이렉트) → 화면 자체 staff 전용.
- 데이터는 RLS(`seoul_can_access`)로 스코프: supporter 는 담당 당사자만, admin 은 전체(=최상위 열람자, 사용자 결정). URL 에 남의 participantId 를 넣어도 participants 조회가 RLS 로 비어 notFound.

## 6. 계약 (RED)

- **`src/components/ui/PhotoGallery.test.tsx`** — 프롭 구동 렌더 골든: photos 순서대로 listitem 렌더 · 빈배열 → EmptyState("사진이 없어요") · 각 사진 img(alt=label). (Supabase mock 불필요 = 견고.)
- **`src/app/(supporter)/supporter/[participantId]/gallery/gallery.staff.wiring.ap.test.ts`** — fs-scan:
  (1) 실무자 gallery/page.tsx 가 `requireStaff`·`participantId`·`seoul_activity_photos`·`mergeGalleryPhotos`·`PhotoGallery` 참조.
  (2) 당사자 gallery/page.tsx 가 `PhotoGallery` 사용(DRY 교체).
  (3) transactions/page.tsx 가 `/supporter/${participantId}/gallery` 링크(진입점).

## 7. 게이트·레인

- W(이 브랜치): 이 문서 · PhotoGallery.test.tsx · gallery.staff.wiring.ap.test.ts.
- app-6c(U): PhotoGallery.tsx · 실무자 gallery/page.tsx · 당사자 gallery/page.tsx(PhotoGallery 교체) · transactions/page.tsx(링크). 스키마·08 무접촉. `npm test`·tsc·build·lint green.
- 범위 밖(후속): 부분실패 안내 fast-follow(Wave B CONCERN) · receipts 보안 리트로핏(백로그) · 활동사진 삭제/편집.
