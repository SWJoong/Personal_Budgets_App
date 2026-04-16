이 프로젝트의 Storage signed URL 패턴을 안내해 드립니다.

`receipts`, `activity-photos`, `documents` 버킷은 모두 **private**입니다.
DB에 저장된 URL을 그대로 `<img src>` 에 넣으면 403 오류가 납니다.
반드시 signed URL로 변환해서 사용해야 합니다.

---

## 서버 컴포넌트에서 signed URL 생성

```typescript
import { createAdminClient } from '@/utils/supabase/server'
import { extractStoragePath } from '@/utils/supabase/storage'

// DB에 저장된 URL → storage 경로 추출 → signed URL 생성
async function getSignedUrl(dbUrl: string, bucket: 'receipts' | 'activity-photos' | 'documents') {
  if (!dbUrl) return null

  const path = extractStoragePath(dbUrl, bucket)
  if (!path) return null

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.storage
    .from(bucket)
    .createSignedUrl(path, 3600)  // 1시간 유효

  return error ? null : data.signedUrl
}
```

## 여러 URL 일괄 처리

```typescript
// 트랜잭션 목록의 영수증 URL을 한 번에 처리
const signedUrls = await Promise.all(
  transactions.map(async (tx) => ({
    id: tx.id,
    signedUrl: tx.receipt_image_url
      ? await getSignedUrl(tx.receipt_image_url, 'receipts')
      : null,
  }))
)
const signedUrlMap = Object.fromEntries(signedUrls.map(({ id, signedUrl }) => [id, signedUrl]))
```

## 적용 패턴

서버 컴포넌트(page.tsx)에서 signed URL을 미리 생성하고, 클라이언트 컴포넌트에 prop으로 전달합니다.

```typescript
// page.tsx (서버 컴포넌트)
const signedUrl = await getSignedUrl(transaction.receipt_image_url, 'receipts')
return <TransactionDetailClient receipt={signedUrl} ... />

// TransactionDetailClient.tsx (클라이언트 컴포넌트)
export function TransactionDetailClient({ receipt }: { receipt: string | null }) {
  return receipt ? <img src={receipt} alt="영수증" /> : null
}
```

## 주의사항

- signed URL 유효 기간: 3600초(1시간). 페이지 렌더 시점에 생성되므로 장시간 열어두면 만료될 수 있습니다.
- `createAdminClient()` 는 서버 사이드에서만 사용 (서비스 롤 키 노출 방지).
- `extractStoragePath()` 는 `src/utils/supabase/storage.ts` 에 있습니다.