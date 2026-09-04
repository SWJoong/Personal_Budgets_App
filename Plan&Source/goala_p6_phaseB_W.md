# P6 Phase B — 프리미티브 소비자 접근성 배선 계약 (W 설계·검증)

> 저자: W(설계·검증 축, 독립 저자). 대상 impl: U 세션(app-6c).
> 브랜치: `test/w-p6-phaseB` (origin/main 기준 저작 — 파일 무겹침).
> 선례: P3~P6 계약 관례 = `render` + `jest-dom` 으로 **행위/ARIA 만** 단언
> (`getByRole`/`getByLabelText`/`toHaveAttribute`/`document.activeElement`/`fireEvent`).
> CSS/레이아웃/z-index/애니메이션 등 jsdom 불가 항목은 **하드 RED 금지 → 설계문 가이드**.

---

## 0. 한 줄 요약 (정직한 관측)

**원래 P6 Phase B 스코프("프리미티브 미연결 폼/모달/라이브영역을 배선한다")는 main 에서 대부분 이미
초록이다.** `FormField`·`Modal`·`LiveRegion` 프리미티브가 이미 착지했고
(`src/components/ui/{FormField,Modal,LiveRegion}.tsx` + 각 `.test.tsx`),
`LiveRegionProvider` 는 앱 루트 `src/app/layout.tsx:38` 에 상시 마운트되어 있으며
`useToast().announce` 는 이미 ~10개 소비자에서 호출된다.

따라서 "앱 전체 role=status/alert 0건" 이라는 원 전제는 **낡았다(stale)**. Phase B 의 실질 가치는
아래 **딱 3종의 진짜 공백(RED)** + **회귀잠금(GUARD/ALIGN)** + **설계결정(DESIGN-DOC)** 으로 재정의한다.

거짓 RED 금지: 이미 초록인 기본기를 RED 로 다시 박지 않는다. 각 계약은 `it` 이름/주석에 버킷을 명시했다.

### 4개 버킷
| 버킷 | 의미 | main 상태 |
|------|------|-----------|
| **RED** | 진짜 실패 → impl 강제 | 빨강 |
| **GUARD** | 프리미티브가 구성상 이미 제공 → 회귀잠금 | 초록 |
| **ALIGN** | 이미 연결된 소비자 재확인(라벨/닫기 배선), 신규 RED 없음 | 초록 |
| **DESIGN-DOC** | jsdom 불가 or 설계결정 — 테스트로 박지 않고 문서 가이드 | (테스트 없음/관측잠금) |

---

## 1. 진짜 RED — 딱 3종(테스트 5건)

### (A) FormField 필드별 검증 미배선 — 2개 폼
- 대상: `src/app/(supporter)/supporter/applications/new/page.tsx`,
  `src/app/(supporter)/admin/participants/new/page.tsx`
- 검증필: 두 파일 모두 `error=` 를 FormField 에 **단 한 번도 전달하지 않는다**(grep 확인).
  빈 필수값 제출 시 `fail()` 이 ①form 레벨 `<div>{error}</div>`(role=alert 아님)만 그리고
  ②`announce(assertive)` 로 LiveRegion alert 에 문구를 넣을 뿐 — 문제의 **컨트롤**에는
  `aria-invalid` 도, `aria-describedby` 로 연결된 오류문도 붙지 않는다.
- RED 단언: `getByLabelText(field).toHaveAttribute('aria-invalid','true')` +
  컨트롤의 `aria-describedby` → `role=alert` 오류노드(`{id}-error`) 존재.
- ★함정 회피: `getByRole('alert')` 로 단언하지 않는다 — `fail()` 의 assertive 공지가
  LiveRegion alert 에 들어가 그 쿼리는 통과해 RED 를 가린다. 반드시 **컨트롤의 aria-invalid +
  필드연결 오류노드**로 단언한다.
- impl(U): 필드별 오류 상태(`participantError`/`cohortError`, `nameError`/`emailError` 등)를 두고
  해당 FormField 에 `error=` 를 넘긴다. 기존 form 레벨 `announce(assertive)` 는 유지 가능(공지),
  이 RED 가 요구하는 건 **필드↔오류의 DOM 연결**이다.
- 참조구현: `ReceiptClient` 의 amount FormField(`error={amountError}`)가 정확히 이 모델이다(§3 ALIGN).

### (B) LiveRegion 문구 — 쉬운말(능동/짧게/~했어요체)
- 대상: `src/app/(participant)/settings/profile/ProfileEditClient.tsx`
- 검증필 L35: 저장 성공 공지가 수동태·격식체 `'프로필이 저장되었습니다.'`(polite→role=status).
- RED 단언: `within(getByRole('status')).getByText('저장했어요.')` → 오늘 실패.
- impl(U): 문구를 쉬운 정보 기준 `'저장했어요.'` 로 교체(능동태·짧게·~했어요체).
  W 가 더 느슨한 단언을 원하면 `/저장했어요|저장을 마쳤어요/` 且 `not /저장되었습니다/` 로 완화 가능;
  기본은 정확문자열 `'저장했어요.'`.

> ※ "action→region 반영" 자체(announce 텍스트가 status/alert 영역에 나타남)는 프로바이더 상시마운트 +
> 소비자 announce 호출로 **이미 초록**이다. 그래서 성공 경로의 유일한 RED 는 '문구'다(§3 GUARD 와 구분).

---

## 2. 소비자별 매핑 표

| 소비자 | FormField | LiveRegion | Modal | 버킷 | Phase A(#103) 겹침 |
|--------|-----------|-----------|-------|------|---------------------|
| applications/new | **RED**(필드 error 미배선) | GUARD(fail assertive) | — | RED+GUARD | ✗ (rebase 불요) |
| admin/participants/new | **RED**(동일) | GUARD | — | RED+GUARD | ✗ |
| ProfileEditClient | GUARD(라벨/필수) | **RED**(문구) + GUARD(실패 alert) | — | RED+GUARD | ✗ |
| ReceiptClient | ALIGN(amount error=참조구현) | GUARD(OCR polite·금액 assertive) | — | ALIGN+GUARD | ✔ **rebase** |
| OnboardingClient | DESIGN-DOC(휴면 배선) + GUARD(라벨/필수) | (announce 이미 배선) | — | GUARD+DESIGN | ✔ **rebase** |
| FaqButton(FaqModal) | — | — | ALIGN(이름+닫기) | ALIGN | ✗ |
| HelpSlideshow | — | — | ALIGN(이름+onClose) | ALIGN | ✗ |
| AdminHelpModal | — | — | ALIGN(이름+onClose) | ALIGN | ✗ |
| NavDropdown | — | — | ALIGN(haspopup/expanded+열닫) | ALIGN | ✗ |
| login 이스터에그 | — | — | DESIGN-DOC(§5) | — | ✗ |
| ImageLightbox | — | — | GUARD(기존 테스트) | — | ✗ |

저작한 테스트 파일(모두 `*.p6.test.tsx`, W 레인):
`applications/new/page`, `admin/participants/new/page`, `ProfileEditClient`, `ReceiptClient`,
`OnboardingClient`, `FaqButton`, `HelpSlideshow`, `AdminHelpModal`, `NavDropdown`.

---

## 3. GUARD / ALIGN 상세 (회귀잠금, RED 아님)

- **FF-GUARD**(5폼 라벨/필수/도움말): 모든 입력이 `getByLabelText` 로 도달, 필수는 `aria-required`,
  도움말은 `aria-describedby`→`{id}-help`. FormField 프리미티브가 구성상 제공 → 초록. RED 로 박으면 거짓 RED.
- **FF-ALIGN-receipt**: `ReceiptClient` 는 원 스펙의 'FormField 미연결' 분류가 틀렸다 — amount FormField 가
  이미 `error={amountError}` 를 받는 **참조구현**이다. 빈 금액 제출 → amount 컨트롤 `aria-invalid`. §1(A)가
  맞춰야 할 모델. (NewTransactionClient·AssessmentClient 와 함께 '이미 연결' 군으로 이동.)
- **LR-GUARD**: `ReceiptClient` OCR 진행(polite→status) / 금액오류(assertive→alert),
  `ProfileEditClient` 저장실패(assertive→alert). announce 는 이미 배선 → 초록. 회귀잠금만.
  - jsdom 주의: OCR 테스트는 `URL.createObjectURL`(jsdom 미구현) 스텁 필요, 모의 OCR 이 즉시 resolve 해
    polite 영역이 '읽는 중'→'다 읽었어요'로 갱신되므로 **종단 문구('다 읽었어요')**로 단언한다.
- **MODAL-ALIGN**(4모달): 소비자가 넘긴 `label`(=접근성 이름)과 자체 ✕/확인 배선만 잠근다.
  NavDropdown 은 추가로 트리거의 `aria-haspopup="dialog"`·`aria-expanded` 토글을 잠근다.

### ★프리미티브 소유 경계(리뷰 강제 규칙 — 중복작성 금지)
`Modal.test.tsx`(8건)가 이미 잠근 것: `role=dialog`·`aria-modal`·접근성 이름·**Esc 닫기**·오버레이 클릭 닫기·
**포커스 이동(열림)**·**포커스 트랩(Tab/Shift+Tab)**·**포커스 복원(닫힘)**·**body scroll-lock**·`!open→null`.
포커스 트랩은 수동 capture-keydown JS라 **jsdom 에서 실제 검증됨**(프리미티브에서). → **소비자 계약은
이것들을 재작성하지 않는다**(중복). 소비자는 오직 자기 `label`·자기 닫기 트리거·자기 haspopup/expanded 만.

---

## 4. CSS-level / jsdom 불가 → 설계문 가이드 (테스트로 박지 않음)

- **Modal 시각 계층**: 실제 z-index 스태킹, 바텀시트/중앙/우측드로어 배치, 슬라이드/페이드 애니메이션,
  pointer-events → jsdom 이 레이아웃/히트테스트를 하지 않음. **코드리뷰로 커버**.
  - 예: `ImageLightbox` 가 패널을 `w-full h-full` override 해 프리미티브 오버레이를 덮는 특수케이스 —
    "배경 탭 닫기"를 이미지의 **형제 레이어**로 복원한 #58 회귀는 `ImageLightbox.test.tsx` 가 DOM 구조
    불변식으로 이미 잠갔다(핸들러 배선/버블링 경로). z-index 자체는 리뷰.
- **Tab 트랩 순환의 시각적 정확성**: 어느 요소가 시각적으로 위/아래인지는 jsdom 밖. 프리미티브가 manual
  capture-keydown 으로 포커스 순환을 강제(초록). 소비자는 관여 안 함.

---

## 5. 설계결정(DESIGN-DOC) — W 판단 필요, 지금은 하드 RED 로 박지 않음

1. **온보딩 단일선택 그룹(돈의 종류/선생님/담당 당사자) 시맨틱**
   - 관측(main): 각 그룹은 `<fieldset><legend>` + `aria-pressed` **토글버튼**. 네이티브 라디오 아님 →
     `getByRole('radiogroup')`/`getByRole('radio')` 는 실패한다.
   - **하드 RED 로 박지 않음**(P6 CSS/시맨틱-선택 관례). 선택지:
     (1) 단일선택 그룹을 `role=radiogroup`+`role=radio` 로 전환(SR 시맨틱 정확) —선택 시 RED **그때** 추가,
     (2) `aria-pressed` 토글 패턴을 의도적으로 유지하고 radio 단언은 폐기. 어느 쪽이든 fieldset/legend 유지.
   - 테스트로는 fieldset/legend + aria-pressed 존재만 GUARD 로 잠갔다.

2. **온보딩 이름 오류 경로 휴면**
   - 관측: `onboarding-name` 은 `error={nameError}` 배선을 갖추었으나 제출 버튼이
     `disabled={loading || !name.trim()}` 라 **빈 이름 제출 자체가 막혀** nameError→aria-invalid 경로가
     UI 로 도달 불가(휴면). disabled 가드가 인라인 오류 노출을 대체 중.
   - W 결정: disabled-가드 유지 vs 인라인 오류(FormField error) 노출로 전환 중 택1.
   - 테스트로는 "빈 이름 → 버튼 disabled → aria-invalid 미발생"을 관측잠금(가드 제거 시 환기).

3. **login 이스터에그 모달**(`(auth)/login/page.tsx`, `버트런드 러셀 인용`)
   - 이미 Modal 소비(내부 `easterEggOpen`). 다만 login 페이지는 `useSearchParams`(Suspense 경계)·데모 인증
     액션을 얽어 jsdom 렌더가 취약 → 소비자 align 테스트를 **보류**하고 문서로만 남긴다. `login/page.p6.test.tsx`
     는 W 레인이므로, 렌더 격리가 마련되면 dialog 이름(`버트런드 러셀 인용`)+닫기만 align 추가.

4. **7번째 Modal 소비자**: `src/app/(supporter)/admin/invitations/InvitationsClient.tsx` 도 Modal(확인
   대화상자)을 import 한다 — P6 여섯에 없던 소비자. 동일 align 잠금을 추가할지 W 판단.

---

## 6. ★시퀀싱 — Phase A(#103) 머지 후 impl(rebase)

- 모든 계약은 **origin/main 기준**으로 저작(파일 무겹침). 그러나 impl 은 Phase A(#103) 머지 **후** 착지한다.
- `ReceiptClient`·`OnboardingClient` 는 Phase A 와 파일이 겹친다 → **U 는 #103 머지 후 이 두 테스트 파일과
  해당 impl 을 rebase** 한다(선례: "[HANDOFF→U] 브랜치 이미구현 함정" 메모리).
- §1 의 두 RED 폼(applications/new·admin/participants/new)·ProfileEditClient 는 Phase A 와 겹치지 않음 →
  rebase 불요, 바로 초록화 가능.

---

## 7. impl 착수 순서 제안 (U)

1. `ProfileEditClient` 문구 1줄 교체 → RED(B) 초록. (겹침 없음, 가장 저비용)
2. `applications/new`·`admin/participants/new` 에 필드별 오류 상태 + `error=` 배선 → RED(A) 초록.
   (`ReceiptClient` amount 패턴을 그대로 이식)
3. (#103 머지 후) `ReceiptClient`·`OnboardingClient` 테스트 rebase → 회귀 초록 확인.
4. §5 설계결정(온보딩 그룹 시맨틱·이름 오류 노출·login align·InvitationsClient)은 W 확정 후 별도 계약.

검증 게이트: `npx vitest run` — 위 5 RED 만 빨강(미배선 사유), 나머지 291건 초록·기존 무손상(저작 시점 실측).
