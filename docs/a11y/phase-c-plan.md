# Phase C — 화면별 KRDS 리트로핏 계획 (초안)

> 프리미티브(#56: `Modal`·`LiveRegion`/`useToast`·`FormField`) + 파운데이션(#55) 위에서
> 각 화면을 KRDS/KWCAG 패턴으로 리트로핏. **전제: #55·#56 머지.** (파일 겹침 회피)
> **완료 신호**: jsx-a11y 진행중 4규칙(45건) warn → **0** → #57 config 에서 **error 승격**.
> 라인 번호는 감사 시점 참고값 — #55 머지로 이동하므로 착수 시 `npm run lint`(warn) 로 재확인.

---

## 0. 전역 배선 (가장 먼저)

- **`LiveRegionProvider` 마운트** — `src/app/layout.tsx` 루트(`AccessibilityProvider` 안)에 1회 → 앱 전역 `useToast().announce` 사용 가능.
- 이후 모든 토스트·상태·오류를 `useToast` 로 통일.

---

## 1. 모달 리트로핏 → `Modal` 프리미티브
핸드롤 모달들을 `Modal` 로 감싸 **role=dialog·aria-modal·focus 이동/트랩/복원·Esc·scroll-lock** 확보.

| 화면/컴포넌트 | 현재 | 조치 |
|---|---|---|
| `ui/FaqButton.tsx`(FaqModal) | 오버레이 div onClick, dialog 시맨틱 없음 | `Modal` 로 교체 |
| `help/HelpSlideshow.tsx` | 동일 | `Modal` 로 교체(내부 슬라이드 유지) |
| `help/AdminHelpModal.tsx` | 동일 | `Modal` 로 교체 |
| `ui/ImageLightbox.tsx` | Esc 만 있음 | `Modal` 로 교체(이미지 뷰어) |
| `login/page.tsx` 이스터에그 | dialog 시맨틱 없음 | `Modal` 로 교체 |
| `layout/NavDropdown.tsx` | 이미 role=dialog+Esc(부분) | 포커스 진입/트랩/복원 보강(또는 Modal 패턴 통일) |

**해소 규칙**: `click-events-have-key-events`·`no-static-element-interactions`·`no-noninteractive-element-interactions`(오버레이 div onClick 이 Modal 내장으로 사라짐).

---

## 2. 폼 리트로핏 → `FormField` (우선순위 순)
`FormField` render-prop 로 감싸 **보이는 label 연결·aria-required·aria-invalid·aria-describedby·role=alert 오류문** 확보.

| 순위 | 화면 | 라벨 미연결(감사) | 추가 조치 |
|---|---|---|---|
| 1 | `receipt/ReceiptClient.tsx` ★당사자 주 플로우 | :194,215,226,241,252,306 | 오류 announce·required·§3 파일업로드 동반 |
| 2 | `onboarding/OnboardingClient.tsx` | :205,320 | 역할/참여자 선택 버튼 `aria-pressed`; 오류(:184) role=alert |
| 3 | `settings/profile/ProfileEditClient.tsx` | :65,108 | 라디오 그룹 `fieldset/legend`; 토스트→useToast |
| 4 | `supporter/applications/new/page.tsx` | :143,163,178,193 | select 변경 자동제출 금지 확인(일부 fieldset 있음) |
| 5 | `admin/participants/new/page.tsx` | :111,123,139 | `fieldset` 안 `label`→`legend` 정정 |

**해소 규칙**: `label-has-associated-control`(25건 대부분). ※이미 htmlFor 연결된 `NewTransactionClient`·`AssessmentClient` 는 FormField 로 정렬만.

---

## 3. 파일 업로드(영수증) — C2
`receipt/ReceiptClient.tsx` 업로드 UI:
- 파일 **유형·크기·개수 제한 안내** 텍스트
- 업로드 후에도 **파일 선택 버튼 유지** + 파일 항목·삭제 버튼
- **자동 제출 금지**, 오류 시 구체 메시지(useToast/role=alert), 파일명 **한 줄** 표시

## 4. 날짜 입력 — C3
`[participantId]/transactions/new/NewTransactionClient.tsx` 등 날짜 필드:
- 레이블 + **형식 도움말**("예: 2026-08-27"), 다중 필드면 '년/월/일' 레이블(FormField.help 활용)

## 5. 셀렉트/라디오/체크박스 — C4
- 모든 `<select>` : **값 변경만으로 폼 자동 제출 금지** 점검
- 라디오/체크박스 그룹 : `fieldset/legend` 또는 `role=radiogroup`
- 버튼형 선택(Onboarding 역할/참여자) : `aria-pressed`

## 6. 라이브 영역 배선 — (§8)
`useToast` 로 전환: `ProfileEditClient` 토스트 · `ReceiptClient` OCR 진행/실패(:210) · `DisplaySettingsClient` 저장상태(:87) · **모든 폼 제출 오류**. (성공/진행=polite/status, 오류=assertive/alert)

## 7. 필터링·정렬 — C5
`supporter/[participantId]/transactions`(필터) · `(participant)/map/MapTabsClient`(영역 필터):
- **현재 적용 필터 명시** · **초기화** 제공 · **결과 수** 안내

## 8. 네비게이션 상태 — C6
- `layout/AdminSidebar.tsx` : **`aria-current="page"`**(현재 시각만) · 서브메뉴 토글 **`aria-expanded`** · 키보드(Esc/방향키). '빠른 설정' 토글도 `aria-expanded`.
- `layout/NavDropdown.tsx` : 드로어 **포커스 진입/복원**(1번 Modal 통일 시 자동 해결).

## 9. 링크 — C7
외부/새 창 링크에 표시: `MoreMenuClient.tsx` 파일 링크(`target=_blank`) · `login/page.tsx` GitHub 링크 → `aria-label` 에 "(새 창)" + 시각 큐(아이콘).

## 10. 당사자 상시 nav — W4 결정 반영
**죽은 `layout/TabBar.tsx` 를 하단 탭으로 부활**(W 결정, 결과서 §3). `(participant)/layout.tsx` 에 마운트. TabBar 는 이미 `aria-label`+`aria-current` 보유 → 배선 위주. (홈에 흩어진 ⚙ 단독 링크 정리.)

---

## 랜딩 전략 (여러 PR 분할)
#55·#56 머지 후 main 기반. 규모가 커 분할 제안:
1. **PR-C1** 전역배선(LiveRegionProvider) + 모달 6종 Modal 통일
2. **PR-C2** 폼 FormField (ReceiptClient→Onboarding→ProfileEdit→applications/new→admin/participants/new) + 라이브영역 오류 배선
3. **PR-C3** 파일업로드·날짜·셀렉트/라디오·필터
4. **PR-C4** nav 상태(AdminSidebar/NavDropdown)·외부링크·TabBar 부활
5. **마무리** jsx-a11y 4규칙 warn=0 확인 → `#57`/eslint.config 4규칙 **error 승격** 커밋

각 PR 게이트: tsc·lint·build·vitest green + **W a11y·easy-read 리뷰**(신규 오류문·힌트·라벨은 W5). Modal focus-trap 등은 #56 계약 테스트로 회귀 고정.

## 의존/비고
- Phase C 는 프리미티브(#56)·파운데이션(#55) 없이는 시작 불가.
- A3(대비)와 파일 겹침(ReceiptClient·MoreMenuClient) → A3 와 Phase C 착수 순서/브랜치 조율 필요(둘 다 #55 머지 후). 한 브랜치에서 같이 처리하는 것도 옵션.
- 브레드크럼·페이지네이션은 범위상 N/A(도입 안 함).
