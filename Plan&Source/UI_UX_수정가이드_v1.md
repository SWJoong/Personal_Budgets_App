# 🛠 Personal Budgets App — UI/UX 수정 가이드 v1

> **작성일**: 2026-03-26  
> **기준 브랜치**: `main` (`14bf173`)  
> **대상 앱**: [아름드리꿈터 개인예산 관리 앱](https://personal-budgets-app-gp8t.vercel.app/)  
> **스택**: Next.js 15 / React 19 / TypeScript / Tailwind CSS / Supabase / OpenAI GPT-4o

---

## 목차

1. [가상 데이터 생성](#1-가상-데이터-생성)
2. [최초 로그인 계정 자동 관리자 설정](#2-최초-로그인-계정-자동-관리자-설정)
3. [당사자 계정 최초 접속 안내 온보딩](#3-당사자-계정-최초-접속-안내-온보딩)
4. [기능별 오류 점검](#4-기능별-오류-점검)
   - [4-0. 공통 — 권한 체계 및 라이트 모드 기본값](#4-0-공통--권한-체계-및-라이트-모드-기본값)
   - [4-1. 관리자 — 당사자 관리](#4-1-관리자--당사자-관리)
   - [4-2. 관리자 — 회계/거래장부](#4-2-관리자--회계거래장부)
   - [4-3. 관리자 — 증빙 및 서류 관리](#4-3-관리자--증빙-및-서류-관리)
   - [4-4. 관리자 — 평가 관리 CRUD](#4-4-관리자--평가-관리-crud)
   - [4-5. 관리자 — 시스템 설정 / 사용자 목록](#4-5-관리자--시스템-설정--사용자-목록)
   - [4-6. 당사자 — 홈 통합보기 대시보드](#4-6-당사자--홈-통합보기-대시보드)
   - [4-7. 당사자 — AI 추천 및 예산 계획](#4-7-당사자--ai-추천-및-예산-계획)
   - [4-8. 영수증 OCR 저장 오류 및 사진 첨부](#4-8-영수증-ocr-저장-오류-및-사진-첨부)
   - [4-9. 달력 — 날짜 마커를 활동 사진으로 교체](#4-9-달력--날짜-마커를-활동-사진으로-교체)
   - [4-10. 더보기 탭 — 프로필 수정 삭제 및 아이콘 변경](#4-10-더보기-탭--프로필-수정-삭제-및-아이콘-변경)
   - [4-11. 지원자 계정 — UI/UX 오류 정비](#4-11-지원자-계정--uiux-오류-정비)

---

## 1. 가상 데이터 생성

### 목표
- 당사자 12명, 최소 3개월치(약 2026-01-01 ~ 2026-03-31), 주 2~3회 빈도의 거래 내역 삽입
- 당사자 구글 계정 인증 불필요 (관리자가 등록하는 형태)

### 대상 파일
| 파일 | 역할 |
|------|------|
| `supabase/seed.sql` | 기존 테스트 데이터 파일 — 이 파일에 가상 데이터 추가 |
| `src/types/database.ts` | 타입 참조용 (수정 불필요) |

### 작업 내용

#### 1-1. `supabase/seed.sql` — 당사자 12명 profiles + participants 삽입

```sql
-- 1) profiles 테이블: 당사자 12명 (role = 'participant', google_auth 불필요)
-- auth.users 없이 직접 profiles에 UUID만 삽입
INSERT INTO profiles (id, email, display_name, role, onboarding_completed)
VALUES
  ('p-uuid-001', 'participant01@demo.local', '김민준', 'participant', true),
  ('p-uuid-002', 'participant02@demo.local', '이서연', 'participant', true),
  ('p-uuid-003', 'participant03@demo.local', '박지호', 'participant', true),
  ('p-uuid-004', 'participant04@demo.local', '최수아', 'participant', true),
  ('p-uuid-005', 'participant05@demo.local', '정도윤', 'participant', true),
  ('p-uuid-006', 'participant06@demo.local', '강하은', 'participant', true),
  ('p-uuid-007', 'participant07@demo.local', '윤지우', 'participant', true),
  ('p-uuid-008', 'participant08@demo.local', '임재원', 'participant', true),
  ('p-uuid-009', 'participant09@demo.local', '오나연', 'participant', true),
  ('p-uuid-010', 'participant10@demo.local', '한승호', 'participant', true),
  ('p-uuid-011', 'participant11@demo.local', '신예린', 'participant', true),
  ('p-uuid-012', 'participant12@demo.local', '배현우', 'participant', true);

-- 2) participants 테이블: 당사자별 테마 및 색상 매핑
INSERT INTO participants (id, profile_id, theme, birth_year)
VALUES
  (gen_random_uuid(), 'p-uuid-001', 'stable',     2001),
  (gen_random_uuid(), 'p-uuid-002', 'luxury',     2003),
  (gen_random_uuid(), 'p-uuid-003', 'observing',  2000),
  (gen_random_uuid(), 'p-uuid-004', 'shrinking',  2002),
  (gen_random_uuid(), 'p-uuid-005', 'stable',     1999),
  (gen_random_uuid(), 'p-uuid-006', 'luxury',     2004),
  (gen_random_uuid(), 'p-uuid-007', 'observing',  2001),
  (gen_random_uuid(), 'p-uuid-008', 'warning',    2000),
  (gen_random_uuid(), 'p-uuid-009', 'stable',     2003),
  (gen_random_uuid(), 'p-uuid-010', 'critical',   1998),
  (gen_random_uuid(), 'p-uuid-011', 'luxury',     2002),
  (gen_random_uuid(), 'p-uuid-012', 'shrinking',  2001);
```

#### 1-2. `supabase/seed.sql` — transactions 삽입 (3개월, 주 2~3회)

> 아래는 `p-uuid-001` 예시입니다. 동일 패턴을 12명 × 약 30건(3개월 × 주 2.5회)으로 반복 작성하세요.

```sql
-- 예시: 김민준(p-uuid-001)의 1~3월 지출 내역
INSERT INTO transactions (id, participant_id, amount, type, category, description, date, payment_method, status)
SELECT
  gen_random_uuid(),
  p.id,
  amount,
  'expense',
  category,
  description,
  date::date,
  payment_method,
  'confirmed'
FROM participants p
CROSS JOIN (VALUES
  (12000, '식비',   '편의점 간식',    '2026-01-07', 'cash'),
  (8500,  '교통비', '버스 교통카드',  '2026-01-09', 'card'),
  (15000, '여가',   '영화 관람',      '2026-01-14', 'card'),
  (6000,  '식비',   '분식집 점심',    '2026-01-16', 'cash'),
  (20000, '쇼핑',   '문구 구매',      '2026-01-21', 'card'),
  (9000,  '식비',   '카페 음료',      '2026-01-23', 'cash'),
  (11000, '교통비', '지하철 충전',    '2026-01-28', 'card'),
  (14000, '식비',   '분식집 저녁',    '2026-02-04', 'cash'),
  (7500,  '여가',   '공원 자전거',    '2026-02-06', 'cash'),
  (18000, '쇼핑',   '생활용품 구매',  '2026-02-11', 'card'),
  (5000,  '식비',   '빵집 간식',      '2026-02-13', 'cash'),
  (13000, '교통비', '버스 교통카드',  '2026-02-18', 'card'),
  (22000, '여가',   '볼링장',         '2026-02-20', 'card'),
  (8000,  '식비',   '편의점 도시락',  '2026-02-25', 'cash'),
  (16000, '쇼핑',   '간식 세트',      '2026-02-27', 'card'),
  (10000, '식비',   '국밥집 점심',    '2026-03-04', 'cash'),
  (6500,  '교통비', '지하철 충전',    '2026-03-06', 'card'),
  (19000, '여가',   '수영장 이용',    '2026-03-11', 'card'),
  (7000,  '식비',   '카페 음료',      '2026-03-13', 'cash'),
  (25000, '쇼핑',   '봄옷 구매',      '2026-03-18', 'card'),
  (12000, '식비',   '칼국수 점심',    '2026-03-20', 'cash'),
  (9500,  '교통비', '버스 교통카드',  '2026-03-25', 'card')
) AS t(amount, category, description, date, payment_method)
WHERE p.profile_id = 'p-uuid-001';
```

> **나머지 11명도 동일한 패턴**으로 날짜를 1~3일씩 차이를 두어 작성하면 됩니다.  
> 헬퍼 스크립트가 필요하면 `scripts/generate-seed.ts` 파일을 별도 생성하여 TypeScript로 SQL을 출력해도 됩니다.

#### 1-3. Supabase RLS 유의사항
- `participants` 테이블의 RLS 정책이 `auth.uid()`를 참조하는 경우, seed 데이터에서 `auth.users` 없이 삽입 시 오류 발생 가능
- **해결**: `supabase/seed.sql` 맨 위에 `SET session_replication_role = replica;` 추가 또는 service role key로 실행

---

## 2. 최초 로그인 계정 자동 관리자 설정

### 목표
- 데모 앱에서 **최초로 구글 로그인한 신규 계정**은 자동으로 `role = 'admin'`으로 설정

### 대상 파일
| 파일 | 역할 |
|------|------|
| `src/app/onboarding/OnboardingClient.tsx` | 온보딩 시 역할 결정 로직 |
| `src/app/actions/admin.ts` | 서버 액션 — 역할 설정 |
| `supabase/migrations/` | RLS 정책 마이그레이션 |

### 작업 내용

#### 2-1. `src/app/actions/admin.ts` — 최초 사용자 감지 함수 추가

```typescript
// 기존 admin.ts 파일에 아래 함수 추가
export async function assignRoleForFirstUser(userId: string): Promise<'admin' | 'supporter'> {
  const supabase = createClient(); // service role client

  // profiles 테이블에서 admin이 한 명도 없으면 최초 사용자 → admin 부여
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin');

  const role = count === 0 ? 'admin' : 'supporter';

  await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  return role;
}
```

#### 2-2. `src/app/onboarding/OnboardingClient.tsx` — 온보딩 완료 시 호출

```typescript
// onboarding 완료 버튼 핸들러 내부에 추가
import { assignRoleForFirstUser } from '@/app/actions/admin';

// 기존 profile 저장 직후:
const assignedRole = await assignRoleForFirstUser(session.user.id);
// assignedRole 에 따라 router.push('/admin') 또는 router.push('/supporter')
```

#### 2-3. Supabase 마이그레이션 — `profiles` 테이블 RLS 예외 허용

```sql
-- supabase/migrations/03_first_user_admin.sql
-- INSERT 시에는 자신의 row만 쓸 수 있으나, role 컬럼은 서버에서만 SET
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 서비스 롤 키를 사용하는 서버 액션은 RLS bypass
-- 클라이언트 직접 role 변경 차단 정책 유지
```

---

## 3. 당사자 계정 최초 접속 안내 온보딩

### 목표
- 당사자 계정으로 **처음 앱에 접속**하면 앱 사용 안내 모달/슬라이드 표시
- 이후 접속 시에는 표시 안 함 (`onboarding_completed = true` 조건)

### 대상 파일
| 파일 | 역할 |
|------|------|
| `src/app/(participant)/participant/` | 당사자 라우트 진입점 |
| `src/components/layout/` | 온보딩 모달 컴포넌트 신규 생성 위치 |
| `supabase/migrations/02_onboarding_fields.sql` | `onboarding_completed` 필드 참조 |

### 작업 내용

#### 3-1. 신규 컴포넌트 생성: `src/components/layout/ParticipantOnboardingModal.tsx`

```tsx
// 당사자 최초 접속 안내 모달 (3~4단계 슬라이드)
// 슬라이드 내용 예시:
// 1단계: "안녕하세요! 이 앱은 내 돈을 관리할 수 있어요 💰"
// 2단계: "돈을 쓸 때 사진을 찍어서 기록해요 📸"
// 3단계: "지원 선생님이 함께 도와줄 거예요 🤝"
// 4단계: "시작해볼까요? ▶"

'use client';
import { useState, useEffect } from 'react';
import { updateOnboardingComplete } from '@/app/actions/profile';

interface Props {
  participantId: string;
  isFirstVisit: boolean;
}

export function ParticipantOnboardingModal({ participantId, isFirstVisit }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(isFirstVisit);

  const slides = [
    { emoji: '💰', title: '안녕하세요!', body: '이 앱에서 내 돈을 관리할 수 있어요.' },
    { emoji: '📸', title: '사진으로 기록해요', body: '돈을 쓸 때 영수증이나 사진을 찍어요.' },
    { emoji: '🤝', title: '선생님이 도와줘요', body: '지원 선생님과 함께 계획을 세울 수 있어요.' },
    { emoji: '▶', title: '시작해볼까요?', body: '아래 버튼을 누르면 바로 시작해요!' },
  ];

  const handleClose = async () => {
    await updateOnboardingComplete(participantId);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="앱 사용 안내"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-fade-in-up">
        <div className="text-center space-y-4">
          <div className="text-6xl">{slides[step].emoji}</div>
          <h2 className="text-2xl font-bold">{slides[step].title}</h2>
          <p className="text-lg leading-relaxed text-muted-foreground">{slides[step].body}</p>
        </div>

        {/* 진행 도트 */}
        <div className="flex justify-center gap-2 mt-6">
          {slides.map((_, i) => (
            <div key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === step ? 'bg-primary w-6' : 'bg-muted'}`} />
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 rounded-2xl border-2 border-border font-bold text-lg">
              이전
            </button>
          )}
          {step < slides.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-lg">
              다음
            </button>
          ) : (
            <button onClick={handleClose}
              className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-lg">
              시작하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 3-2. 당사자 layout 또는 홈 페이지에 모달 삽입

```tsx
// src/app/(participant)/participant/page.tsx 또는 layout.tsx
import { ParticipantOnboardingModal } from '@/components/layout/ParticipantOnboardingModal';

// profile에서 onboarding_completed 값을 조회한 뒤:
<ParticipantOnboardingModal
  participantId={profile.id}
  isFirstVisit={!profile.onboarding_completed}
/>
```

---

## 4. 기능별 오류 점검

---

### 4-0. 공통 — 권한 체계 및 라이트 모드 기본값

#### 권한 정의 요약
| 기능 | 관리자(admin) | 지원자(supporter) | 당사자(participant) |
|------|:---:|:---:|:---:|
| 당사자 등록/수정/삭제 | ✅ CRUD | ✅ CRU (삭제 불가) | ❌ |
| 거래 내역 CRUD | ✅ | ✅ | 자신만 CRU |
| 서류 관리 CRUD | ✅ | ✅ | ❌ |
| 평가 CRUD | ✅ | ✅ | 자신만 R |
| 사용자 역할 변경 | ✅ | ❌ | ❌ |
| 시스템 설정 | ✅ | ❌ | ❌ |

#### 라이트 모드 기본값 강제 설정

**대상 파일**: `src/app/globals.css`

```css
/* 기존 @media (prefers-color-scheme: dark) 블록을 제거하거나 주석 처리 */
/* 앱 전체가 항상 라이트 모드로 동작하도록 */

/* 삭제 또는 주석 처리: */
/*
@media (prefers-color-scheme: dark) {
  @theme { ... }
}
*/
```

**대상 파일**: `src/app/layout.tsx`

```tsx
// <html> 태그에 data-theme="light" 고정 추가
<html lang="ko" data-theme="light">
```

> ⚠️ 다크 모드가 필요한 경우 추후 시스템 설정에서 토글하도록 설계하되, 현재는 라이트 모드만 활성화

---

### 4-1. 관리자 — 당사자 관리

#### 오류 1: "new row violates row-level security policy for table participants"

**원인**: `participants` 테이블의 INSERT RLS 정책이 `auth.uid() = profile_id` 조건만 허용, 관리자가 **다른 사람의 당사자**를 등록할 때 차단됨

**대상 파일**: `supabase/migrations/` (신규 마이그레이션 파일 추가)

```sql
-- supabase/migrations/04_fix_participants_rls.sql

-- 기존 INSERT 정책 삭제
DROP POLICY IF EXISTS "participants_insert_own" ON participants;

-- 관리자와 지원자는 모든 당사자 INSERT 가능
CREATE POLICY "participants_insert_admin_supporter"
ON participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'supporter')
  )
);

-- 관리자는 모든 당사자 DELETE 가능
CREATE POLICY "participants_delete_admin"
ON participants FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 지원자는 당사자 DELETE 불가 (policy 미생성 = 불가)
```

**대상 파일**: `src/app/actions/admin.ts`  
서버 액션에서 `supabaseAdmin` (service role) 클라이언트 사용 여부 확인:

```typescript
// admin.ts — 관리자 당사자 등록 함수
import { createClient } from '@/utils/supabase/server'; // ← service role 클라이언트인지 확인

export async function registerParticipant(data: ParticipantFormData) {
  // service role 클라이언트 사용 시 RLS bypass 가능
  const supabase = createAdminClient(); // SUPABASE_SERVICE_ROLE_KEY 사용
  // ...
}
```

#### 오류 2: 당사자 화면 보기 클릭 시 화면이 넘어가지 않는 문제

**원인**: 라우터 push 또는 redirect 함수가 role 가드에 막혀 돌아오는 현상 추정

**대상 파일**: 당사자 목록 페이지 (관리자 라우트 내 participant list 컴포넌트)

```tsx
// 당사자 보기 버튼 클릭 핸들러
// 현재: router.push('/participant/[id]') → 권한 없어 redirect 발생

// 수정: 관리자/지원자가 당사자 뷰를 미리보기 드롭다운으로 보도록 변경
```

#### 드롭다운 미리보기 구현

```tsx
// 관리자 대시보드 헤더에 당사자 선택 드롭다운 추가
// 선택 시: 화면 하단 또는 오른쪽 패널에 해당 당사자의 홈 대시보드 미리보기 렌더링
// '관리자' 선택 시: 미리보기 패널 닫히고 원래 관리자 화면으로 복귀

interface ParticipantPreviewDropdownProps {
  participants: Participant[];
}

// 상태: selectedId = null → 관리자 뷰
// selectedId = 'p-uuid-001' → 해당 당사자 미리보기 패널 표시

const [selectedId, setSelectedId] = useState<string | null>(null);

// 드롭다운 옵션: ['관리자 (기본)', ...participants.map(p => p.name)]
// selectedId가 null이 아닐 때: <ParticipantPreviewPanel participantId={selectedId} />
```

---

### 4-2. 관리자 — 회계/거래장부

#### 오류: 지출/수입 내역 직접 등록 시 파일 첨부 불가

**대상 파일**: `src/components/transactions/TransactionForm.tsx`

```tsx
// 기존: 금액, 날짜, 설명만 입력
// 추가: 파일 첨부 필드 (사진, 영수증, 기타 문서)

// TransactionForm.tsx 내 파일 첨부 섹션 추가
<div className="space-y-2">
  <label className="font-bold text-sm">사진 / 파일 첨부 (선택)</label>
  <input
    type="file"
    accept="image/*,application/pdf"
    multiple
    onChange={handleFileChange}
    className="drop-zone p-4 rounded-2xl w-full cursor-pointer"
  />
  {/* 첨부된 파일 미리보기 썸네일 */}
  <div className="flex flex-wrap gap-2 mt-2">
    {previewUrls.map((url, i) => (
      <img key={i} src={url} alt="첨부 이미지" className="w-16 h-16 object-cover rounded-xl border" />
    ))}
  </div>
</div>
```

Supabase Storage 업로드 (`transaction.ts`):
```typescript
// src/app/actions/transaction.ts — 파일 업로드 추가
const uploadedUrls: string[] = [];
for (const file of attachments) {
  const { data, error } = await supabase.storage
    .from('transaction-attachments')
    .upload(`${participantId}/${Date.now()}_${file.name}`, file);
  if (!error && data) {
    uploadedUrls.push(data.path);
  }
}
// transactions 테이블의 attachment_urls 컬럼(jsonb array)에 저장
```

#### 거래장부 메인 화면 — 필터 및 검색 기능 추가

**대상 파일**: `src/components/transactions/TransactionFilters.tsx`

```tsx
// 기존 필터에 추가할 항목:
// 1. 날짜 범위 (DateRangePicker)
// 2. 결제수단 (카드/현금/계좌이체 등 select)
// 3. 금액 정렬 (오름/내림차순 toggle)
// 4. 키워드 검색 (description, category 대상 텍스트 검색)

interface FilterState {
  dateFrom: string;
  dateTo: string;
  paymentMethod: string;          // '' | 'card' | 'cash' | 'transfer'
  amountSort: 'asc' | 'desc' | null;
  keyword: string;
}
```

---

### 4-3. 관리자 — 증빙 및 서류 관리

#### 오류 1: 서류 종류 '기타' 선택 시 직접 입력 불가

**대상 파일**: 서류 등록 폼 컴포넌트 (documents 관련 컴포넌트)

```tsx
// 드롭다운 onChange 핸들러
{docType === 'etc' && (
  <input
    type="text"
    placeholder="서류 종류를 직접 입력해주세요"
    value={etcTypeText}
    onChange={e => setEtcTypeText(e.target.value)}
    className="mt-2 w-full border-2 rounded-2xl px-4 py-2"
  />
)}
```

#### 오류 2: 필터 및 그룹화

```tsx
// 서류 목록 페이지에 추가할 필터:
// - 서류 제목 (keyword 검색)
// - 대상자 (participant select)
// - 종류 (docType select)
// - 날짜 범위 (DateRangePicker)
// - 대상자별 그룹화 toggle: groupBy === 'participant' ? groupedView : flatView
```

#### 오류 3: 파일 업로드 서버 컴포넌트 렌더 에러

**에러 메시지**: `An error occurred in the Server Components render. [...] A digest property is included...`

**원인**: `document.ts` Server Action에서 파일(`File` 객체 또는 `Blob`)을 직접 전달 시 직렬화 오류 발생

**대상 파일**: `src/app/actions/document.ts`

```typescript
// 현재 문제: Server Action에 File 객체 직접 전달 → 직렬화 불가
// 수정: FormData 방식으로 전환

// 클라이언트 컴포넌트에서:
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('docType', docType);
// ...
await uploadDocument(formData); // Server Action에 FormData 전달

// document.ts Server Action:
export async function uploadDocument(formData: FormData) {
  'use server';
  const file = formData.get('file') as File;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(`${Date.now()}_${file.name}`, buffer, {
      contentType: file.type,
    });
  // ...
}
```

---

### 4-4. 관리자 — 평가 관리 CRUD

#### 오류: 월별 PCP 평가 관리에 추가/삭제 없음 (RU만 있음)

**대상 파일**: `src/components/evaluations/` 내 평가 목록 컴포넌트  
**대상 파일**: `src/app/actions/evaluation.ts`

```tsx
// 평가 목록 헤더에 "새 평가 추가" 버튼 추가
<button
  onClick={() => setShowCreateForm(true)}
  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-2xl font-bold">
  <Plus size={18} />
  새 평가 추가
</button>

// 각 평가 항목 우측에 삭제 버튼 추가
<button
  onClick={() => handleDeleteEvaluation(evaluation.id)}
  className="text-danger hover:bg-danger/10 p-2 rounded-xl"
  aria-label="평가 삭제">
  <Trash2 size={16} />
</button>
```

`evaluation.ts` Server Action에 Create/Delete 추가:
```typescript
// 평가 생성
export async function createEvaluation(data: EvaluationCreateInput) {
  const supabase = createAdminClient();
  return supabase.from('evaluations').insert(data);
}

// 평가 삭제
export async function deleteEvaluation(evaluationId: string) {
  const supabase = createAdminClient();
  return supabase.from('evaluations').delete().eq('id', evaluationId);
}
```

---

### 4-5. 관리자 — 시스템 설정 / 사용자 목록

#### 오류 1: 역할 변경 후 화면에 반영 안 됨

**원인**: 역할 변경 후 클라이언트 상태가 서버 데이터로 revalidate되지 않음

**대상 파일**: 시스템 설정 사용자 목록 컴포넌트  
**대상 파일**: `src/app/actions/admin.ts`

```typescript
// admin.ts — updateUserRole 함수에 revalidatePath 추가
import { revalidatePath } from 'next/cache';

export async function updateUserRole(userId: string, newRole: UserRole) {
  const supabase = createAdminClient();
  await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  revalidatePath('/admin/settings'); // 또는 실제 경로에 맞게 수정
  return { success: true };
}
```

클라이언트에서는 `router.refresh()` 추가:
```tsx
const handleRoleChange = async (userId: string, role: UserRole) => {
  await updateUserRole(userId, role);
  toast.success('역할이 변경되었습니다.');
  router.refresh(); // ← 이 줄 추가 (현재 누락된 것으로 추정)
};
```

#### 오류 2: 계정별 이름 및 구글 계정 주소 표시

```tsx
// 사용자 목록 컴포넌트 — 각 항목에 email 및 display_name 표시
<div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold">
    {user.display_name?.[0] ?? '?'}
  </div>
  <div>
    <p className="font-bold">{user.display_name ?? '이름 없음'}</p>
    <p className="text-sm text-muted-foreground">{user.email}</p>
  </div>
  {/* 역할 배지 */}
  <RoleBadge role={user.role} />
  {/* 연필 아이콘 — 역할 변경 */}
  <button onClick={() => openRoleEditor(user.id)} aria-label="역할 변경">
    <Pencil size={16} />
  </button>
</div>
```

#### 오류 3: 계정별 컴포넌트 다크 모드 고정 문제

**대상 파일**: 사용자 목록 컴포넌트 (className에 `dark:` 접두사 하드코딩 확인)

```tsx
// 문제 패턴 예시:
// className="bg-gray-900 text-white" ← 다크 모드 하드코딩 → 제거

// 수정 패턴:
// className="bg-card text-card-foreground" ← CSS 변수 토큰 사용
```

`globals.css`에서 라이트 모드 강제 후 (4-0 참조), `dark:` 접두사 클래스가 있는 컴포넌트 전수 검색:
```bash
grep -r "dark:" src/components/ --include="*.tsx" | grep -v "node_modules"
```
위 명령으로 찾은 파일에서 `dark:bg-*`, `dark:text-*` 클래스를 CSS 변수 토큰으로 교체

---

### 4-6. 당사자 — 홈 통합보기 대시보드

> 이 항목은 중복 번호가 있어 첫 번째(당사자 계정 선등록 데이터 표시)와 두 번째(UI 수정)를 모두 반영

#### 4-6-A. 당사자 Google 계정 기반 기등록 데이터 바로 표시

**대상 파일**: 당사자 홈 페이지 (`src/app/(participant)/participant/page.tsx`)

```typescript
// 로그인한 사용자의 email과 participants.profile_id → profiles.email 매핑
// 이미 등록된 당사자 데이터가 있으면 온보딩 없이 바로 대시보드 렌더링

const { data: participant } = await supabase
  .from('participants')
  .select('*, profiles!inner(email)')
  .eq('profiles.email', session.user.email) // 구글 계정 email 기준 매핑
  .single();

if (participant) {
  // 기등록 데이터 있음 → 바로 대시보드
} else {
  // 신규 당사자 → 온보딩 안내
}
```

#### 4-6-B. 이번 주 지출 — 바 그래프 축 보정 및 1×7 사진 표

**대상 파일**: `src/components/home/HomeDashboard.tsx`

**① 이번 주 지출 바 그래프 X축 보정**
```tsx
// 기존: X축 최대값이 크게 설정되어 바가 작아 보임
// 수정: X축 max를 해당 주의 실제 최대 일별 지출 × 1.2로 동적 설정

const weeklyMax = Math.max(...dailyExpenses.map(d => d.amount), 1000);
// chart domain: [0, weeklyMax * 1.2]
```

**② 이번 주 지출 — 1×7 사진 표로 교체**
```tsx
// 기존 바 차트 대신 (또는 아래에 추가):
// 월~일 7칸 그리드, 각 칸에 그날 가장 최근 거래의 첨부 사진 표시
// 사진 없으면 카테고리 이모티콘으로 대체

<div className="grid grid-cols-7 gap-1 mt-4">
  {weekDays.map((day, i) => {
    const tx = transactionsByDay[day.date];
    return (
      <div key={i} className="flex flex-col items-center gap-1">
        <span className="text-xs text-muted-foreground">
          {['월','화','수','목','금','토','일'][i]}
        </span>
        <div className="w-full aspect-square rounded-xl overflow-hidden bg-muted flex items-center justify-center">
          {tx?.photo_url ? (
            <img src={tx.photo_url} alt="활동 사진" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">{tx ? getCategoryEmoji(tx.category) : '—'}</span>
          )}
        </div>
        <span className="text-xs font-bold">
          {tx ? `${tx.amount.toLocaleString()}원` : ''}
        </span>
      </div>
    );
  })}
</div>
```

**③ 돈주머니 차트 기본 열림 상태 설정**

**대상 파일**: `src/components/home/InteractivePouchSection.tsx`

```tsx
// 기존: const [isOpen, setIsOpen] = useState(false);
// 수정: const [isOpen, setIsOpen] = useState(true);  ← 기본값 true
```

**④ "YEARLY TOTAL" → 한글 변경**

**대상 파일**: `src/components/home/BudgetTrendChart.tsx` 또는 `HomeDashboard.tsx`

```tsx
// 검색: "YEARLY TOTAL"
// 교체: "올해 전체 잔액"
```

**⑤ 계절 나무 시각화 컴포넌트 신규 추가**

**새 파일**: `src/components/home/SeasonTreeVisual.tsx`

```tsx
// 월 기준 계절 판별
const getSeason = (month: number): 'spring' | 'summer' | 'autumn' | 'winter' => {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
};

// 계절별 SVG 나무 또는 이모지 표현
const seasonConfig = {
  spring: { emoji: '🌸', label: '봄', color: 'text-pink-400', desc: '새싹이 피어나는 봄' },
  summer: { emoji: '🌳', label: '여름', color: 'text-green-500', desc: '무성한 여름' },
  autumn: { emoji: '🍂', label: '가을', color: 'text-orange-400', desc: '물드는 가을' },
  winter: { emoji: '❄️', label: '겨울', color: 'text-blue-300', desc: '고요한 겨울' },
};

// 1년 12개월을 4계절 블록으로 표현, 현재 월 하이라이트
// 바 그래프 바로 아래 배치
```

---

### 4-7. 당사자 — AI 추천 및 예산 계획

#### AI 추천 보조 역할 재정의

**대상 파일**: `src/components/plans/` 내 AI 추천 관련 컴포넌트

```tsx
// 현재: AI 추천이 메인 화면에 위치
// 수정: AI 추천은 "도우미" 섹션으로 하단 이동 또는 접힌 상태로 기본 제공

// 화면 구성 순서 변경:
// 1. 오늘의 계획 (메인)
// 2. 지원자와 텍스트로 계획 세우기 (채팅 인터페이스)
// 3. AI 도우미 추천 (접힌 상태, 펼치기 가능)
```

#### 지원자와 텍스트 채팅으로 계획 수립

```tsx
// 새 컴포넌트: src/components/plans/PlanChatInput.tsx
// 지원자(또는 AI)에게 텍스트 질문 → 일정 제안 반환 → 당사자가 선택 후 저장

<div className="rounded-3xl border-2 p-4 space-y-3">
  <p className="font-bold text-lg">📝 계획 세우기</p>
  <p className="text-muted-foreground">무엇을 하고 싶은지 말해보세요!</p>
  <textarea
    placeholder="예: 다음 주에 영화 보고 싶어요"
    className="w-full border-2 rounded-2xl p-3 text-lg"
    rows={3}
  />
  <button className="w-full bg-primary text-white py-3 rounded-2xl font-bold text-lg">
    계획 제안 받기
  </button>
</div>
```

#### 예산 미리보기 — 물컵 잔액 감소 애니메이션

**대상 파일**: `src/components/plans/PlanComparison.tsx`  
또는 `src/utils/budget-visuals.ts`

```tsx
// 기존: 금액 숫자만 표시
// 수정: SVG 물컵 애니메이션으로 잔액 변화 표현

// 물 높이 비율 = 잔여잔액 / 총예산
// CSS clip-path 또는 SVG rect height로 애니메이션
// 선택한 계획에 따라 물 높이가 줄어드는 트랜지션

<svg viewBox="0 0 100 160" className="w-24 mx-auto">
  {/* 컵 외곽선 */}
  <path d="M15,10 L10,150 L90,150 L85,10 Z" fill="none" stroke="currentColor" strokeWidth="3" />
  {/* 물 (잔여 비율만큼 채움) */}
  <clipPath id="cupClip">
    <path d="M15,10 L10,150 L90,150 L85,10 Z" />
  </clipPath>
  <rect
    x="0" y={160 - waterLevel * 1.5} width="100" height="150"
    fill="hsl(207 73% 70% / 0.6)"
    clipPath="url(#cupClip)"
    className="transition-all duration-1000"
  />
</svg>
```

#### 점선 비교 차트

```tsx
// PlanComparison.tsx — A/B/C 계획 선택 시 점선으로 차이 표시
// recharts 또는 SVG 직접 사용
// 선택된 계획: 실선, 비교 계획: 점선(strokeDasharray="5,5")
```

#### 저장된 계획 → 오늘 계획 화면 연동

```typescript
// plan.ts — AI 추천 후 선택한 계획을 today_plan 으로 저장
export async function savePlanAsToday(planId: string, participantId: string) {
  const supabase = createClient();
  return supabase
    .from('plans')
    .update({ is_today: true, selected_date: new Date().toISOString().split('T')[0] })
    .eq('id', planId)
    .eq('participant_id', participantId);
}
// 홈 대시보드에서 is_today = true인 계획 조회하여 표시
```

---

### 4-8. 영수증 OCR 저장 오류 및 사진 첨부

#### 오류: OCR 후 내용 저장 실패

**대상 파일**: `src/app/actions/ocr.ts`  
**대상 파일**: `src/components/transactions/ReceiptUploadForm.tsx`

```typescript
// ocr.ts — 저장 실패 원인 추적
// 1) Supabase Storage 버킷 권한 확인 (public / private)
// 2) transactions INSERT 시 participant_id가 올바르게 전달되는지 확인
// 3) RLS 정책: 당사자 본인 또는 관리자/지원자만 INSERT 가능한지 확인

export async function processReceiptOCR(formData: FormData) {
  'use server';
  const file = formData.get('receipt') as File;
  const participantId = formData.get('participantId') as string;

  // Step 1: Storage 업로드
  const supabase = createAdminClient(); // service role로 업로드
  const { data: storageData, error: storageError } = await supabase.storage
    .from('receipts')
    .upload(`${participantId}/${Date.now()}_receipt.jpg`, file);

  if (storageError) {
    console.error('Storage 업로드 실패:', storageError);
    return { error: 'upload_failed' };
  }

  // Step 2: GPT Vision OCR
  const imageUrl = supabase.storage.from('receipts').getPublicUrl(storageData.path).data.publicUrl;
  const ocrResult = await callGPTVisionOCR(imageUrl);

  // Step 3: transactions 테이블 INSERT
  const { error: insertError } = await supabase
    .from('transactions')
    .insert({
      participant_id: participantId,
      amount: ocrResult.amount,
      description: ocrResult.description,
      date: ocrResult.date ?? new Date().toISOString().split('T')[0],
      category: ocrResult.category ?? '기타',
      receipt_url: storageData.path,
      status: 'pending',
    });

  if (insertError) {
    console.error('DB 저장 실패:', insertError);
    return { error: 'db_insert_failed', detail: insertError.message };
  }

  return { success: true };
}
```

#### 활동 사진 함께 업로드

```tsx
// ReceiptUploadForm.tsx — 활동 사진 추가 input 필드
<div className="space-y-2 mt-4">
  <label className="font-bold">활동 사진 (선택)</label>
  <input
    type="file"
    accept="image/*"
    multiple
    onChange={handleActivityPhotoChange}
    className="drop-zone p-4 rounded-2xl w-full"
  />
  <p className="text-sm text-muted-foreground">영수증과 함께 활동 사진도 올릴 수 있어요</p>
</div>

// 저장 시 activity_photo_urls: string[] 로 transactions 테이블 또는
// 별도 transaction_photos 테이블에 저장
```

---

### 4-9. 달력 — 날짜 마커를 활동 사진으로 교체

**대상 파일**: `src/components/transactions/TransactionCalendar.tsx`

```tsx
// 기존: has-transaction::after 가상 요소로 점 마커 표시 (globals.css)
// 수정: 날짜 셀 안에 해당 날짜의 가장 최근 활동 사진 썸네일 표시

// TransactionCalendar.tsx 날짜 렌더링 부분
const renderDay = (date: Date) => {
  const dateKey = format(date, 'yyyy-MM-dd');
  const dayTransactions = transactionMap[dateKey] ?? [];
  const photoUrl = dayTransactions.find(t => t.photo_url)?.photo_url;

  return (
    <div className="calendar-day relative flex flex-col items-center justify-start pt-1">
      <span className="text-sm font-medium">{date.getDate()}</span>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="활동 사진"
          className="w-8 h-8 rounded-lg object-cover mt-0.5 border border-border"
        />
      ) : dayTransactions.length > 0 ? (
        <span className="text-lg mt-0.5">{getCategoryEmoji(dayTransactions[0].category)}</span>
      ) : null}
      {dayTransactions.length > 1 && (
        <span className="text-xs text-muted-foreground">+{dayTransactions.length - 1}</span>
      )}
    </div>
  );
};
```

`globals.css`에서 기존 점 마커 CSS 제거:
```css
/* 삭제: */
/* .calendar-day.has-transaction::after { ... } */
```

---

### 4-10. 더보기 탭 — 프로필 수정 삭제 및 아이콘 변경

**대상 파일**: 더보기 탭 컴포넌트 (탭바 관련 layout 또는 더보기 페이지)

```tsx
// 1. 프로필 수정 메뉴 항목 제거
// 검색: "프로필 수정" 또는 route '/profile/edit' 참조하는 링크/버튼 → 삭제

// 2. 더보기 탭 이모지 → 톱니바퀴 아이콘으로 변경
// 기존:
<span>⋯</span>  // 또는 더보기 관련 이모지

// 변경 후 (lucide-react 사용):
import { Settings } from 'lucide-react';
<Settings size={24} aria-label="더보기 설정" />
```

탭바 아이템 배열 업데이트 예시:
```tsx
const tabItems = [
  { href: '/participant/home',       icon: <Home size={24} />,     label: '홈' },
  { href: '/participant/calendar',   icon: <Calendar size={24} />, label: '달력' },
  { href: '/participant/receipt',    icon: <Camera size={24} />,   label: '영수증' },
  { href: '/participant/plan',       icon: <Lightbulb size={24} />,label: '계획' },
  { href: '/participant/more',       icon: <Settings size={24} />, label: '더보기' }, // ← 수정
];
```

---

### 4-11. 지원자 계정 — UI/UX 오류 정비

#### 목표
- 지원자 계정 접속 시 오류 해결
- 관리자 계정과 동일한 UI/UX 레이아웃 적용 (권한 차이만 유지)

#### 대상 파일
| 파일 | 역할 |
|------|------|
| `src/app/(supporter)/supporter/` | 지원자 라우트 |
| `src/components/layout/` | 공통 레이아웃 컴포넌트 |

#### 작업 내용

**① 지원자 레이아웃을 관리자 레이아웃 기반으로 리팩터링**

```tsx
// 현재 관리자 레이아웃과 지원자 레이아웃이 별도로 구현되어 있다면
// 공통 AdminSupporterLayout 컴포넌트로 통합

// src/components/layout/AdminSupporterLayout.tsx (신규)
interface Props {
  role: 'admin' | 'supporter';
  children: React.ReactNode;
}

export function AdminSupporterLayout({ role, children }: Props) {
  // 관리자/지원자 공통 사이드바 + 헤더
  // role에 따라 일부 메뉴 항목 숨김 처리
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar role={role} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

**② AdminSidebar에서 role에 따른 메뉴 분기**

```tsx
// src/components/admin/AdminSidebar.tsx 수정
const menuItems = [
  { href: '/admin/participants', label: '당사자 관리', icon: Users, roles: ['admin', 'supporter'] },
  { href: '/admin/transactions', label: '회계/거래장부', icon: BookOpen, roles: ['admin', 'supporter'] },
  { href: '/admin/documents',    label: '증빙 서류', icon: FileText, roles: ['admin', 'supporter'] },
  { href: '/admin/evaluations',  label: '평가 관리', icon: ClipboardList, roles: ['admin', 'supporter'] },
  { href: '/admin/settings',     label: '시스템 설정', icon: Settings, roles: ['admin'] }, // ← admin 전용
];

// 렌더링 시:
menuItems.filter(item => item.roles.includes(currentRole))
```

**③ 지원자 라우트에서 발생하는 404/redirect 오류 추적**

```bash
# 빌드 후 지원자 계정으로 접속 시 콘솔에서 오류 경로 확인
# 주로 발생하는 문제:
# - /supporter 경로 내 page.tsx 미존재
# - middleware에서 role guard가 supporter를 admin 전용 경로로 차단
# - layout.tsx에서 getUser() 실패 시 redirect loop
```

미들웨어(`src/middleware.ts` 또는 `src/proxy.ts`) 확인:
```typescript
// role guard 로직에서 'supporter'가 누락된 경로 허용 목록 확인
const SUPPORTER_ALLOWED = [
  '/admin/participants',
  '/admin/transactions',
  '/admin/documents',
  '/admin/evaluations',
];
// supporter 접근 시 위 경로 허용, '/admin/settings'는 차단
```

---

## 수정 작업 우선순위

| 우선순위 | 항목 | 예상 난이도 |
|:---:|------|:---:|
| 🔴 P0 | 4-1 RLS 오류 수정 (참가자 등록 불가) | 낮음 |
| 🔴 P0 | 4-8 OCR 저장 실패 수정 | 중간 |
| 🔴 P0 | 4-5 역할 변경 revalidation 누락 | 낮음 |
| 🟠 P1 | 4-0 라이트 모드 기본값 강제 | 낮음 |
| 🟠 P1 | 4-3 서버 컴포넌트 직렬화 오류 | 중간 |
| 🟠 P1 | 4-11 지원자 계정 오류 정비 | 중간 |
| 🟡 P2 | 1 가상 데이터 생성 (seed.sql) | 낮음 |
| 🟡 P2 | 2 최초 사용자 admin 자동 설정 | 낮음 |
| 🟡 P2 | 4-4 평가 관리 CRUD 완성 | 낮음 |
| 🟢 P3 | 4-6 홈 대시보드 UI 개선 | 높음 |
| 🟢 P3 | 4-7 AI 계획 UI 재구성 + 물컵 애니메이션 | 높음 |
| 🟢 P3 | 4-9 달력 활동 사진 마커 | 중간 |
| 🟢 P3 | 3 당사자 온보딩 모달 | 중간 |
| 🔵 P4 | 4-10 더보기 아이콘/메뉴 정리 | 낮음 |
| 🔵 P4 | 4-2 거래장부 필터/검색 추가 | 중간 |

---

## 브랜치 운영 제안

```
main
 └── fix/rls-participants        ← 4-1 RLS 오류 (P0)
 └── fix/ocr-save-error          ← 4-8 OCR 저장 (P0)
 └── fix/role-change-revalidate  ← 4-5 역할 변경 (P0)
 └── feat/seed-data-12           ← 1 가상 데이터
 └── feat/first-user-admin       ← 2 최초 관리자
 └── feat/participant-onboarding ← 3 당사자 온보딩
 └── feat/home-dashboard-v2      ← 4-6, 4-9 홈/달력 UI
 └── feat/plan-ui-rework         ← 4-7 AI 계획 UI
 └── fix/supporter-layout        ← 4-11 지원자 계정
```

---

*이 문서는 `Personal_Budgets_App` 레포지토리의 UI/UX 수정 작업을 위한 개발 가이드입니다.*  
*최종 구현 시 실제 파일 경로 및 컴포넌트명을 현재 코드베이스와 대조하여 반영하세요.*
