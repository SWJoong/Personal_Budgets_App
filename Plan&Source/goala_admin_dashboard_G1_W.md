# 관리자 대시보드 보강 (G1) — 설계·계약 (W)

> 관리자 QA 발견 **G1**. 현재 `/admin`(= 관리자 홈)은 `participantCount` 하나만 조회 →
> 히어로 + 빠른실행 2링크(등록/관리)뿐. 당사자 10명·전 파이프라인을 운영하는데 **오늘 할
> 일 한눈 요약이 0**. 담당자 홈도 동형(F3/#145가 담당자용은 링크그리드로 보강, 미머지).
> 사용자 결정: **상태카운트 + 그리드**(full).

## 목표
관리자가 첫 화면에서 (1)지금 처리해야 할 일의 건수와 (2)자주 쓰는 운영 화면 진입을
한눈에. 카운트는 **각 워크리스트의 pending 필터와 정확히 일치**해야 한다(클릭 시 그 건수가
그대로 보여야 신뢰).

## 상태 카운트 — 워크리스트 필터 미러 (검증된 정의)
| 카드 | 정의(실 워크리스트 필터) | 링크 |
|---|---|---|
| **검토 대기** 영수증 | `seoul_rule_checks.human_decision = 'pending'` 의 **distinct usage_id** 수 (review 화면 = `getRuleChecks(true)`) | `/supporter/review` |
| **심사 대기** 신청 | `seoul_applications.status IN ('received','screening')` | `/supporter/applications` |
| **심의 대기** 계획 | `seoul_utilization_plans.status IN ('submitted','under_review')` | `/supporter/plans` |

- 세 카드 모두 admin RLS 로 전량 카운트 가능(`seoul_can_access` = self OR staff, staff ⊇ admin).
- 카운트>0 이면 강조(색/굵게), 0 이면 muted. 각 카드 자체가 워크리스트 링크.
- 정산은 기간말 배치라 "대기" 정의가 모호 → 카운트 제외, **그리드 링크**로만 제공.

## 빠른 실행 그리드 (링크만 — 무쿼리)
➕ 당사자 등록 `/admin/participants/new` · 👥 당사자 관리 `/admin/participants` ·
📒 거래장부 `/supporter/transactions` · 🧮 정산 원장 `/supporter/settlements` ·
📁 서류 보관함 `/supporter/documents` · 🕸️ 관계망 `/supporter/network` ·
✉️ 사용자 초대 `/admin/invitations` · ⚙️ 시스템 설정 `/admin/settings`

## 구조 (테스트 가능하게 분리)
- **`src/app/(supporter)/admin/AdminDashboardCards.tsx`** (신규·프리젠테이션): props →
  히어로 + 상태카드 3 + 그리드 8. 훅·async 없음(정적) — RTL 로 계약 검증.
  ```ts
  interface AdminDashboardCardsProps {
    name: string
    participantCount: number
    pending: { review: number; screening: number; planReview: number }
  }
  ```
- **`admin/page.tsx`** (서버): 기존 participantCount + 3 pending 카운트 쿼리 →
  `<AdminDashboardCards name=.. participantCount=.. pending=.. />`. redirect 가드 유지.
  - review: `.from('seoul_rule_checks').select('usage_id').eq('human_decision','pending')`
    → `new Set(rows.map(r=>r.usage_id)).size` (distinct usage).
  - screening: `.from('seoul_applications').select('id',{count:'exact',head:true}).in('status',['received','screening'])`
  - planReview: `.from('seoul_utilization_plans').select('id',{count:'exact',head:true}).in('status',['submitted','under_review'])`
  - 각 쿼리 실패/`null` 은 0 으로 폴백(대시보드는 카운트 없어도 떠야 함).

## 계약 (RED) — `src/app/(supporter)/admin/AdminDashboardCards.test.tsx` (W)
next/link 을 `<a href>` 로 mock. 단언:
1. 히어로에 name·participantCount(예: "10") 렌더.
2. 검토 대기 카드: 카운트("3") + `href="/supporter/review"`.
3. 심사 대기 카드: 카운트("2") + `href="/supporter/applications"`.
4. 심의 대기 카드: 카운트("1") + `href="/supporter/plans"`.
5. 그리드에 복원된 회계 화면 링크 존재: `/supporter/transactions`·`/supporter/settlements`·`/supporter/documents`.
6. pending 전부 0 이어도 카드가 "0" 으로 렌더(대시보드 깨지지 않음).

## 게이트 / 범위
- U 레인: `AdminDashboardCards.tsx`(신규) + `admin/page.tsx`(쿼리·렌더). W 레인: 위 test + 이 문서.
- 재게이트: tsc·lint·vitest(계약 포함)·build + **라이브 브라우저 QA**(카운트가 실제 워크리스트 건수와 일치하는지·링크 이동·4모드 대비).
- 무관: DB 슬라이스 아님(순수 프론트). Manual-Ops 없음.
