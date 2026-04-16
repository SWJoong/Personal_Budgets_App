이 프로젝트의 패턴에 맞는 서버 액션을 생성해 주세요.

먼저 다음을 확인해 주세요:
- 어떤 기능의 서버 액션인지 (예: 거래 등록, 평가 저장, 파일 업로드 등)
- 대상 테이블 및 주요 필드
- 호출 후 어떤 경로를 revalidate 해야 하는지

### 기본 템플릿

```typescript
'use server'

import { createClient } from '@/utils/supabase/server'
// Storage 작업이 있으면: import { createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function actionName(formData: FormData) {
  const supabase = await createClient()

  // 인증 확인 (데모 모드에서는 createClient()가 데모 유저를 반환함)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증이 필요합니다.' }

  // FormData 파싱
  const field = formData.get('field') as string

  try {
    const { error } = await supabase
      .from('table_name')
      .insert({ field, created_by: user.id })

    if (error) return { error: error.message }

    revalidatePath('/path-to-revalidate')
    return { success: true }
  } catch {
    return { error: '오류가 발생했습니다.' }
  }
}
```

### 클라이언트 선택 기준

| 상황 | 클라이언트 |
|------|-----------|
| 일반 DB 조회·수정 (RLS 적용) | `createClient()` |
| Storage 업로드·signed URL 생성 | `createAdminClient()` |
| 관리자 전용 (RLS 우회) | `createAdminClient()` |

### 반환 타입 패턴

```typescript
// 성공
return { success: true, data: result }

// 실패
return { error: '오류 메시지' }
```

클라이언트에서는 `if ('error' in result)` 로 분기 처리합니다.

### revalidatePath 위치

- 거래장부: `/supporter/transactions`
- 당사자 목록: `/admin/participants`
- 평가: `/supporter/evaluations`
- 홈 대시보드: `/` (당사자 화면)

파일은 `src/app/actions/` 디렉토리에 생성합니다.
기존 액션 파일이 있으면 해당 파일에 함수를 추가합니다.