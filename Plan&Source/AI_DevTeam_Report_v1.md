테크 리드(Tech Lead)로서 PM, 프론트엔드(FE), 백엔드(BE), QA 엔지니어의 모든 의견과 클라이언트의 요구사항을 종합하여 **해커톤 데모 시연에 최적화된 최종 실행 가이드라인**을 배포합니다. 

본 문서는 단순 요약이 아닌, 즉시 저장소(`SWJoong/Personal_Budgets_App`)에 적용해야 할 **실제 코드 변경 가이드**입니다. 각 파트 담당자는 아래의 Step-by-step 지침에 따라 코드를 수정해 주시기 바랍니다.

---

# 🚀 [Tech Lead Report] 해커톤 데모 최적화 실행 가이드

## 1. 현재 문제점 및 개선 목표 요약

현재 시스템은 데모 시연을 위한 매끄러운 흐름이 끊기는 **크리티컬 버그(P0, P1)**와 시연의 완성도를 낮추는 **UI/UX 미비점(P2)**을 안고 있습니다. 

*   **P0 (시연 블로커 해결):** 구글 인증 연동으로 인한 신규 당사자 등록 불가(RLS 및 참조 오류), 관리자/당사자 화면 전환의 불편함.
*   **P1 (기능 오류 해결):** 영수증/서류 등록 시 파일 객체 직렬화 오류(Server Component 에러), 지원자 계정 접속 오류.
*   **P2 (시각화 및 UX 강화):** 지출 감소 물컵 애니메이션, 계절 나무 그래픽, 1x7 주간 지출 사진 그리드, 전체 라이트 모드 고정.
*   **P3 (관리 편의성):** PCP 평가 C/D 기능 추가, 역할 변경 시 즉각적인 화면 렌더링(Refresh).

**💡 테크 리드 목표:** 심사위원이 별도의 인증/로그아웃 과정 없이 드롭다운 하나로 모든 권한과 화면을 오가며, 직관적이고 시각적인(물컵, 계절 나무 등) 데모를 경험할 수 있도록 프론트엔드와 백엔드를 즉각 수정합니다.

---

## 2. 단계별 코드 변경 가이드 & 3. 구체적인 코드 스니펫

### Step 1: 전체 테마 설정 및 최초 로그인 관리자 지정 (FE/BE)
**목표:** 전체 라이트 모드 강제 적용 및 데모 시연을 위해 첫 가입자를 Admin으로 자동 설정합니다.

*   **1-1. 라이트 모드 강제 적용**
    *   **파일:** `src/app/globals.css`
    *   **변경:** 다크모드 미디어 쿼리를 제거하거나 덮어씌웁니다.
    ```css
    /* [수정 후] src/app/globals.css */
    :root {
      --color-background: #ffffff;
      --color-foreground: #111827;
    }
    body {
      background-color: var(--color-background) !important;
      color: var(--color-foreground) !important;
    }
    /* 다크모드 관련 설정(@media (prefers-color-scheme: dark)) 주석 처리 또는 삭제 */
    ```

*   **1-2. 최초 로그인 Admin 자동 할당 로직 적용**
    *   **파일:** `src/app/layout.tsx` (또는 auth 관련 최상단 컴포넌트)
    *   **변경:** `assignRoleForFirstUser()` 함수 호출 추가.
    ```tsx
    // [수정 후] src/app/layout.tsx
    import { assignRoleForFirstUser } from '@/utils/admin'; // 경로에 맞게 수정
    
    export default async function RootLayout({ children }) {
      // 서버 사이드에서 세션 확인 후 최초 유저인지 검증 및 권한 부여
      await assignRoleForFirstUser(); 
      
      return (
        <html lang="ko">
          <body>{children}</body>
        </html>
      );
    }
    ```

### Step 2: 당사자 등록 오류 해결 및 스키마 수정 (BE/FE)
**목표:** 당사자는 구글 계정(profiles 테이블) 없이도 독립적으로 생성 가능해야 합니다.

*   **2-1. Supabase DB 스키마 및 RLS 수정 (SQL)**
    *   `participants` 테이블의 `id`가 `profiles.id`를 참조하는 외래키(FK)를 해제하고, `disability_type`를 삭제합니다.
    ```sql
    -- Supabase SQL Editor 실행
    ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_id_fkey;
    ALTER TABLE participants DROP COLUMN IF EXISTS support_grade;
    
    -- 지원자(supporter)는 삭제(DELETE) 제외 모든 권한 허용 (RLS 수정)
    DROP POLICY IF EXISTS "supporter_policy" ON participants;
    CREATE POLICY "supporter_crud_except_delete" ON participants
      FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'supporter'))
      ) WITH CHECK (
        auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'supporter'))
      );
    -- 당사자 삭제는 오직 admin만 가능하도록 별도 추가
    CREATE POLICY "admin_delete_participant" ON participants
      FOR DELETE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
    ```

*   **2-2. 새 당사자 등록 폼 로직 전면 수정**
    *   **파일:** `src/app/(supporter)/admin/participants/new/page.tsx` (또는 연결된 Server Action)
    *   **변경:** Profiles 연동 로직 제거, UUID 직접 생성.
    ```tsx
    // [Diff: Before -> After] Server Action 로직 수정
    
    // --- Before ---
    // const user = await findUserInProfiles(email);
    // if (!user) throw new Error("가입된 유저가 아닙니다.");
    // await supabase.from('participants').insert({ id: user.id, name, support_grade });
    
    // --- After ---
    import { crypto } from 'crypto'; // Node 환경
    
    export async function createParticipant(formData: FormData) {
      const newId = crypto.randomUUID();
      const name = formData.get('name') as string;
      const email = formData.get('email') as string;
      // support_grade 변수 삭제
      
      const { error } = await supabase.from('participants').insert({
        id: newId,
        name: name,
        email: email,
        // 구글 로그인 없이 UUID로 단독 레코드 생성
      });
      
      if (error) throw new Error(error.message);
      revalidatePath('/admin/participants');
    }
    ```

### Step 3: Server Component 직렬화 에러 (파일 업로드) 해결 (FE)
**목표:** 영수증(OCR), 서류, 장부 사진 등록 시 발생하는 Server Component 렌더링 에러 해결.

*   **3-1. Client Component와 Server Action 분리**
    *   **문제 원인:** `File` 객체 자체를 Server Component/Action으로 넘기려 해서 발생합니다. `FormData`로 감싸서 전달해야 합니다.
    ```tsx
    // [수정 후] Client Component (예: DocumentUploadForm.tsx)
    'use client';
    import { uploadDocumentAction } from './actions';
    
    export default function DocumentUploadForm() {
      const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // 클라이언트에서 File 검증 (QA 요구사항 반영)
        const file = formData.get('file') as File;
        if (file && file.size > 5 * 1024 * 1024) return alert("파일은 5MB 이하여야 합니다.");
        
        // File 객체가 아닌 FormData 전체를 Server Action으로 전달
        await uploadDocumentAction(formData); 
      };
      
      return (
        <form onSubmit={handleSubmit}>
          <input type="file" name="file" accept="image/*,.pdf" />
          <button type="submit">저장</button>
        </form>
      );
    }
    ```

### Step 4: 시각화 및 UI 컴포넌트 추가 (P2) (FE)
**목표:** 물컵 애니메이션, 계절 나무, 1x7 사진 그리드 적용

*   **4-1. 지출 감소 물컵 애니메이션 (`WaterCupChart.tsx`)**
    ```tsx
    // src/components/charts/WaterCupChart.tsx
    'use client';
    import { motion } from 'framer-motion';
    
    export default function WaterCupChart({ totalBudget, currentSpend }: { totalBudget: number, currentSpend: number }) {
      const remainingRatio = Math.max(0, ((totalBudget - currentSpend) / totalBudget) * 100);
      
      return (
        <div className="relative w-32 h-48 border-4 border-blue-300 rounded-b-lg overflow-hidden bg-white">
          <motion.div 
            className="absolute bottom-0 w-full bg-blue-500 opacity-80"
            initial={{ height: '100%' }}
            animate={{ height: `${remainingRatio}%` }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 flex items-center justify-center font-bold z-10">
            {remainingRatio.toFixed(0)}% 남음
          </div>
        </div>
      );
    }
    ```

*   **4-2. 주간 지출 1x7 사진 그리드 (`WeeklyPhotoGrid.tsx`)**
    *   **QA 피드백 반영:** 데이터가 없는 날짜 빈 셀 처리, 여러 개인 경우 첫 번째 사진만 표시 (썸네일).
    ```tsx
    // src/components/dashboard/WeeklyPhotoGrid.tsx
    export default function WeeklyPhotoGrid({ weeklyData }: { weeklyData: any[] }) {
      // weeklyData는 길이 7의 배열(일~토)이라고 가정
      return (
        <div className="grid grid-cols-7 gap-2 my-4">
          {weeklyData.map((day, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="text-xs text-gray-500">{day.dayOfWeek}</span>
              <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center overflow-hidden">
                {day.photoUrl ? (
                   /* Next.js Image 컴포넌트로 리사이징/Lazy Loading (QA 반영) */
                  <img src={day.photoUrl} alt="지출" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-gray-300 text-xs">없음</span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    ```

### Step 5: 권한 스위처 및 UI 동기화 (FE)
*   **5-1. 역할 변경 후 즉각 렌더링 (`router.refresh`)**
    ```tsx
    // 사용자 관리 > 권한 변경 훅 또는 함수
    import { useRouter } from 'next/navigation';
    
    const changeRole = async (userId: string, newRole: string) => {
      await updateRoleApi(userId, newRole);
      alert("역할이 변경되었습니다.");
      router.refresh(); // [핵심] 알림 후 서버 컴포넌트 강제 리렌더링
    };
    ```

---

## 4. 아키텍처 및 보안 고려사항 (QA & BE)

개발팀은 코드를 병합하기 전 다음 아키텍처/보안 리스크가 해결되었는지 반드시 확인하십시오.

1.  **Race Condition 방지 (최초 로그인):**
    *   `layout.tsx`에서 `assignRoleForFirstUser()`를 호출할 때, `profiles` 테이블에 `role = 'admin'`인 계정이 0개일 때만 업데이트를 수행하도록 UPSERT가 아닌 `SELECT count` 후 조건부 `UPDATE`를 트랜잭션 레벨로 처리하거나, Edge Function에서 처리하는 것을 권장합니다.
2.  **데이터 무결성 및 RLS (권한 제어):**
    *   지원자 계정 접속 오류를 우회하기 위해 권한을 상향 조정(P0)하더라도, **`DELETE` 권한만큼은 반드시 관리자(Admin)에게만 격리**해야 합니다. (Step 2-1 SQL 스크립트 참조)
3.  **파일 업로드 검증 (Security):**
    *   Client Component 폼 제출 시, 반드시 `accept="image/*,.pdf"` 속성을 추가하고, Server Action 내부에서도 파일 크기(예: 5MB 제한)와 MIME Type을 이중 검증하여 악성 스크립트(SVG 기반 XSS 등) 업로드를 차단하세요.
4.  **권한 스위칭 시 상태(State) 초기화:**
    *   전역 상태(Zustand 등)를 이용해 관리자 ↔ 당사자 뷰를 전환할 때, 이전 권한에서 작성 중이던 폼 데이터(예: 서류 작성 내용)가 캐싱되어 넘어가지 않도록, 전환 이벤트 발생 시 `store.reset()` 함수를 반드시 호출하십시오. 
5.  **성능 최적화 (Performance):**
    *   1x7 그리드 및 수동 장부에 첨부되는 이미지가 많아지면 시연 환경 브라우저 메모리가 터질 수 있습니다. `<img>` 태그 대신 Next.js의 `<Image>` 컴포넌트를 사용하고 버킷 요청 시 리사이징 옵션 또는 `loading="lazy"`를 필수로 적용하세요.

---
**[테크 리드 코멘트]**
본 가이드는 당장의 해커톤 데모 시연(심사위원 경험 최적화)을 위한 최단 경로(Shortcut)를 포함하고 있습니다. 팀원들은 **P0(당사자 등록 오류 및 권한 스위처)와 P1(서류 등록 에러)을 오늘 자정까지 최우선으로 PR 올리고**, 이후 P2(시각화 컴포넌트) 작업에 착수해 주시기 바랍니다. 모든 작업은 지정된 branch 단위로 진행 후 Merge Request 부탁드립니다.