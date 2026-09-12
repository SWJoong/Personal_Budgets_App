# 08 · 접근성 적용(remediation) — 3역할 WAI-ARIA·키보드·인지

> 사용자 목표(2026-09-12): WAI-ARIA 를 **당사자·실무자·관리자** 3역할에 적용 / 당사자=인지 접근성
> (지적·시각·청각·뇌병변 등 다양한 장애유형 고려) / 실무자·관리자=업무 효율 + **키보드만으로 업무 처리 가능**.
> 설계권위: [`Plan&Source/goala_a11y_remediation_W.md`](../../Plan&Source/goala_a11y_remediation_W.md).
> 토대: [`07-a11y-kwcag-1st-eval.md`](07-a11y-kwcag-1st-eval.md)(KWCAG 2.2 1차·2차 감사).

## 0. 한 줄 요약
정밀 스캔 결과 코드베이스는 **이미 접근성이 견고**(07 성과: 토큰 4테마 AA·skip-link·landmark·Modal 포커스·
FormField·`:focus-visible`·aria-current/pressed/expanded 3역할 배치). 남은 **실 결함은 소수**였고 전부
수정했으며, 같은 결함이 재발하지 않도록 **소스 스캔 회귀 가드 3종**을 CI 에 고정했다.

## 1. 적용 내역 (수정)

### 슬라이스 1 — 탐색·맥락 WAI-ARIA (3역할 공통)
- **화살표 컨트롤 접근명 5곳** — 맨 `←`/`→`(스크린리더가 "왼쪽 화살표"로 읽음)를 접근명으로 교정:
  `admin/participants`(대시보드로 가기)·`admin/participants/new`×2(당사자 관리로 가기)·`participant/more`
  (홈으로 가기)·`MoreMenu` 서류 링크(→ aria-hidden). aria-label 또는 aria-hidden 글리프 + 형제 텍스트.
- **새 창 예고 2곳(인지)** — `target="_blank"` 링크에 맥락 변화 예고: `login` GitHub = 가시 문구 "(새 창)",
  `MoreMenu` 서류 = `aria-label="… (새 창으로 열림)"`. (발달장애 당사자에 특히 중요.) rel=noopener 는 기존.
- **죽은 status CSS 제거** — `.status-safe/.caution/.danger`(AA 미달 2.55:1 포함·사용처 0, 07 §5-3).

### 슬라이스 2 — 키보드 전용 (실무자·관리자)
- **키보드 조작성 스캔 결과 실 결함 0건.** onClick 을 단 비인터랙티브 요소는 3곳뿐이며 **전부
  `aria-hidden` 장식 배경(백드롭)** + 접근 가능한 닫기 버튼/Esc(Modal·라이트박스·모바일 메뉴) → 키보드 정상.
- **WAI-ARIA 상태 확증**: 세그먼트 토글(#4 예산실행)=`role=group`+`aria-pressed`, 드롭다운=`aria-expanded`,
  현재 페이지=`aria-current="page"`(NavDropdown·AdminSidebar·TabBar 3역할 네비 전부), 탭 위젯=role=tab.

### 슬라이스 3 — 인지 접근성 (당사자)
- **autoComplete 추가** — 본인 이름 반복 입력 필드(당사자 프로필 편집·온보딩)에 `autoComplete="name"`
  (반복 입력 부담 경감). ※남의 정보를 입력하는 실무자 폼에는 의도적으로 넣지 않음(오자동완성 방지).

## 2. 회귀 가드 (CI 고정 — "적용됨"의 기계 검증)
소스 스캔 fitness 테스트(`aiGateBoundary` 패턴). 신규 화면이 같은 결함을 추가하면 CI 실패:
| 가드 | 규칙 |
|---|---|
| `src/test/a11yArrowGlyphs.test.ts` | `←`/`→` 화살표 컨트롤은 접근명 필수(aria-label 또는 aria-hidden 글리프) |
| `src/test/a11yExternalLinks.test.ts` | `target="_blank"` 는 새 창 예고 문구 + `rel=noopener` |
| `src/test/a11yKeyboardClickable.test.ts` | 클릭 가능한 비인터랙티브 요소는 키보드 조작(role+tabIndex+onKeyDown) 또는 aria-hidden 장식 |

## 3. 검증
- 게이트: tsc0 · lint 0 errors · **vitest 874 통과**(가드 3종 포함·회귀 0) · build0.
- 라이브(관리자 로그인, 브라우저): skip-link "본문 바로가기"=첫 포커스 · 수정한 back-링크 접근명
  "대시보드로 가기"+← aria-hidden 실측 · aria-current 등 상태 라이브 확인.

## 4. 남은 것 — 장애인 사용자 평가 (자동·에이전트가 대체 못 함, 07 §6-2)
아래는 코드·자동검사·에이전트 관찰로 대체 불가하며 **실제 당사자·전문가 심사**가 필요하다:
- **시각(스크린리더)**: 로그인→홈→지출기록→갤러리를 음성만으로(landmark·초점 복귀·alt 실효).
- **지체(키보드 전용)**: 마우스 없이 전 업무 플로우(탭 순서·포커스 가시성·모달 트랩) — 구조는 충족, 실사용 확인 권장.
- **저시력**: 고대비·노랑·글자확대 테마에서 레이아웃 붕괴·잘림.
- **인지/발달장애(핵심)**: 쉬운 말 이해·오류 복구·맥락 변화 혼란 — `easy-read-review` 연계 + 당사자 참여 평가.
- **뇌병변**: 큰 터치타깃(44px 충족)·오조작 취소·시간압박 없음(충족) 실사용 확인.

품질인증(전문가 95%·사용자 100%·평균 90)은 인증기관 공지 재확인 필요(07 §7). 이 문서는 개발 축의 적용·검증
기록이며 인증 통과를 단정하지 않는다.
