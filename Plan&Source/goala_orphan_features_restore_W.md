# 고아 기능 복원 — 설계권위 (W)

> 사용자 요청(2026-09-12): "선제적으로 고아 패턴 스캔" → 잔액 위젯과 **같은 회귀**(리빌드가 유틸·설정은
> 남기고 화면 배선을 빠뜨림)로 잠든 기능 복원. 사용자 결정: A군 3개 전부 + 죽은 코드 함께 정리.
> 앱 전용·DB/Manual-Ops 없음. 목표: 당사자 인지 접근성.

## 스캔 결과(고아 확정)
| 유틸(존재) | 상태 | 조치 |
|---|---|---|
| emojiCatalog(loadEmojiCatalog/searchEmoji/getEmojisByGroup) | 소비처 0·선택기 UI 없음 | §1 복원 |
| getBudgetChangeInfo(전월 대비 변동) | 소비처 0·테스트 없음 | §2 복원 |
| getSpendingPaceAlert(소비 속도 경고) | 소비처 0·테스트 없음 | §2 복원 |
| getActivityEmoji(활동→이모지) | 소비처 0 | §3 복원 |
| getBudgetVisualInfo | #157 BalanceWidget 이 대체 | §4 삭제 |
| date.ts(normalizeMonth/parseMonth/getRecentMonths)·getCurrentParticipantWithUser | 소비처 0 | 저위험 dead — 이번엔 보존(별도 정리) |
| extractStoragePath | 소비처 0이나 CLAUDE.md 문서화 API | 보존 |
(거짓양성: sis-a·superAdmin·egoGraph·domainAxisReport·budgetByDomain 내부헬퍼, tts.speak=guide 사용 중.)

## §1 이모지 선택기 (잔액 위젯 emoji 스타일 완성)
- **신규 `src/components/ui/EmojiPicker.tsx`** ('use client'): props `{ value:string, onSelect:(e:string)=>void }`.
  마운트 시 `loadEmojiCatalog()`(비동기·동적 import) → 그룹 탭(GROUP_ORDER/LABELS 한글) + 이모지 격자.
  `searchbox` 입력 시 `searchEmoji(catalog, q)`로 격자 대체. 이모지 버튼 클릭 → `onSelect(emoji)`. 접근성:
  버튼 접근명에 이모지 포함, 44px, focus-visible, 로딩 상태 안내. 계약: `EmojiPicker.test.tsx`.
- **`DisplaySettingsClient.tsx` 배선**: "잔액 이모지 고르기"(현재 `balance_emoji` 표시 + 열기) → EmojiPicker
  로 고르면 `saveUIPreferences(participantId, { …현행, balance_widget_style, balance_emoji: 고른값 })`.
  (emoji 스타일일 때 특히 의미 — 하지만 항상 저장 허용.)

## §2 예산 변동·소비속도 알림 (당사자 홈·인지)
두 함수는 **순수·색클래스 없음**(메시지+아이콘만) — 그대로 재사용, 색은 컴포넌트가 토큰으로.
- **신규 `src/components/home/BudgetAlerts.tsx`**(프리젠테이셔널): props 로 `changeInfo`(getBudgetChangeInfo 결과)
  ·`paceAlert`(getSpendingPaceAlert 결과) 받아, `changed`/`alert` 인 것만 카드로. 시맨틱 토큰(변동↑=info,
  ↓=warning, pace 경고=warning). aria-hidden 아이콘 + 텍스트. 쉬운 말.
- **홈 `page.tsx` 배선**: 현재 배정의 **전월 배정** 조회(seoul_budget_allocations 를 ends_on desc 2건 →
  이전 allocated_amount) → getBudgetChangeInfo(prev, current). 소비속도: 현재 배정 starts_on~ends_on 로
  경과일/총일수 계산 + balance.spent + monthly_ceiling(또는 allocated) → getSpendingPaceAlert. 결과를
  BudgetAlerts 로. 데이터 없으면(전월 없음·경과일0) 카드 미표시(함수가 이미 그렇게 반환). 잔액 위젯 아래 배치.
- 계약: budget-visuals.test(§2 golden 추가됨).

## §3 활동 자동 이모지 (거래·활동 목록·시각 인지)
- **홈 `page.tsx` 최근 사용 목록**: 각 항목 설명 앞에 `getActivityEmoji(u.description ?? '활동')` 이모지
  (aria-hidden 장식 — 설명 텍스트가 접근명). 최소 이 목록. (여력되면 supporter 거래장부도 후속.)
- 계약: `activityEmoji.test.ts`(golden 추가됨).

## §4 정리(죽은 코드)
- `getBudgetVisualInfo`(budget-visuals.ts) 삭제 — BalanceWidget 이 대체·소비처 0·테스트 없음(budget-visuals.test
  는 formatCurrency 만). 삭제 후 tsc/vitest 회귀0 확인.

## 게이트
tsc0·lint0·vitest(신규 계약 EmojiPicker·activityEmoji·budget-visuals + 회귀0)·build0. 앱 전용.
