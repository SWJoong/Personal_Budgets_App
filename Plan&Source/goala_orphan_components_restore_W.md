# 고아 컴포넌트 복원 — 설계권위 (W)

> 확장 고아 스캔(컴포넌트·액션) 결과 중 **컴포넌트 2종** 복원(사용자 결정: 둘 다). 인지/저시력 접근성.
> 앱 전용. 액션 12개는 대부분 **미구축(신규 UI)**이라 별도 백로그(§3).

## §1 ImageLightbox — 사진 확대 (PhotoGallery 배선)
- 배경: `ImageLightbox`(Modal 기반 확대·포커스트랩·Esc, 이미 견고)는 소비처 0. 갤러리 사진을 크게 못 봄
  (저시력·인지에 확대 중요). 계약: `PhotoGallery.test.tsx`.
- 구현: `PhotoGallery`(현재 순수 서버 컴포넌트)를 **클라이언트**로 전환(또는 클라 래퍼) — 각 사진을
  `<button>`(접근명=label)로 만들어 클릭 시 `ImageLightbox`(선택 사진 src/alt) 오픈, 닫으면 트리거로 포커스 복귀.
  빈 배열 EmptyState 회귀 유지. 사진 alt/label 그대로.

## §2 WaterCupPlanPreview — "쓰면 얼마 남을까" 미리보기 (토큰화 + /plan 배선)
- 배경: `WaterCupPlanPreview`(물컵으로 옵션 선택 시 잔액 변화 시각화)는 소비처 0 + **raw hex 색**(테마 미대응).
  계약: `WaterCupPlanPreview.test.tsx`(텍스트 특성 고정).
- 구현:
  1. **토큰화**: `OPTION_COLORS` 등 raw hex(#3b82f6…)를 시맨틱 토큰으로 이관(정보/성공/경고 계열 + 물색은
     currentColor+토큰). 텍스트 특성(옵션·남는 돈·"돈이 모자라요"·"고른 후")은 계약대로 유지. 다크/고대비 안전.
  2. **선택 래퍼**: `WaterCupPlanPreview` 는 controlled(selectedIndex prop) — `/plan` 용 클라 래퍼가
     `selectedIndex` 상태 관리(옵션 클릭 시 선택/해제, 버튼 role·aria-pressed·44px).
  3. **/plan 배선**: `(participant)/plan/page.tsx`("해보고 싶은 것")에서 당사자 이용계획의 요청 서비스
     (requested_services: 이름=서비스/영역 라벨, cost=estimated_cost)를 옵션으로, 잔액=v_seoul_budget_balance
     (remaining=currentBalance, allocated=totalBudget) 로 래퍼 렌더. 요청 서비스 없으면 부드러운 안내(빈 상태).

## §3 액션 고아 12개 — 백로그(미구축·신규 UI 필요, 이번 범위 밖)
조사 결과 대부분 "리빌드 유실 배선"이 아니라 "UI 미구축":
- **미구축(신규 화면 필요)**: 당사자 수정/삭제(updateParticipant/deleteParticipant — 상세페이지는 모니터링·정산·이의용),
  역할관리·사용자목록(updateUserRole/getAllUsers — 화면 없음), 동의철회·수급상태·동의목록(withdrawConsent/
  getBenefitStatus/getConsentRecords — 화면 없음), getServiceDomains/Subdomains, getSelectionDecision.
- **부분유실(생성/삭제만 있고 수정 없음)**: updateNeedsAssessment(사정 수정), updateUtilizationPlan(계획 수정).
→ 접근성 목표와 별개인 기능 완성도. 우선순위·범위는 사용자 결정 후 개별 슬라이스로.

## 게이트
tsc0·lint0·vitest(PhotoGallery·WaterCup 계약+회귀0)·build0. 앱 전용.
