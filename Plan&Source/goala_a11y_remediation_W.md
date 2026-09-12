# 접근성 적용(remediation) 프로그램 — 설계권위 (W)

> 사용자 목표(2026-09-12): **WAI-ARIA 를 당사자·실무자·관리자 3역할 화면 전반에 적용**.
> - **당사자**: 인지 접근성 중심 — 지적·시각·청각·뇌병변 등 다양한 장애유형 사용 고려.
> - **실무자·관리자**: 업무 효율성 접근성 + **키보드만으로 업무 처리 가능** 수준.
>
> 토대: [`docs/release/07-a11y-kwcag-1st-eval.md`](../docs/release/07-a11y-kwcag-1st-eval.md)(KWCAG 2.2
> 1차 baseline + 2차 인증화면 라이브 감사). 이미 견고 — 시맨틱 토큰 4테마 AA·skip-link·landmark·
> Modal 포커스·FormField·`:focus-visible`·`prefers-reduced-motion`. **이 프로그램은 "감사"가 아니라
> 남은 실 결함의 "적용(수정)" + 회귀 방지 가드 + 3역할 심층 검증.**

## 원칙
- **회귀 방지 우선**: 고칠 수 있는 결함 유형은 소스 스캔 **fitness 테스트**(aiGateBoundary 패턴)로 못 박아
  신규 화면이 같은 결함을 못 만들게 한다. "적용됨"을 기계검증 가능하게.
- **자동검사는 참고**: 전문가·사용자 심사를 대체하지 않는다(07 §9 면책 유지). 장애유형별 사용자 평가는
  자동이 대체 못 함(07 §6-2). 이 문서는 개발 축의 적용·검증 기록.

## 슬라이스 (누적 → 단일 PR)

### 슬라이스 1 — 탐색·맥락 WAI-ARIA + 회귀 가드 (3역할 공통) ✅
정밀 감사 결과 실 결함은 소수(대부분 이미 준수). 검증된 것만 수정 + 가드:
- **화살표 컨트롤 접근명 5곳**: 맨 `←`/`→`(SR 이 "화살표"로 읽음) → aria-label 또는 `aria-hidden` 글리프.
  admin/participants·admin/participants/new(×2)·participant/more·MoreMenu 파일링크(→).
- **새 창 예고 2곳**: `target="_blank"`(login GitHub·MoreMenu 서류) → "(새 창)" 문구/aria-label + rel noopener
  (맥락 변화 예고 = 인지 접근성).
- **죽은 status CSS 제거**: `.status-safe/.caution/.danger`(AA 미달 2.55:1 포함·사용처 0·07 §5-3).
- **가드(W)**: `a11yArrowGlyphs.test.ts`(화살표 컨트롤은 접근명 필수) · `a11yExternalLinks.test.ts`
  (새 창 링크는 예고+rel noopener). → 회귀 고정.

### 슬라이스 2 — 키보드 전용 + WAI-ARIA 심층 (실무자·관리자 + 복합 위젯)
복합 인터랙션의 키보드 조작·역할·포커스 검증·수정: #4 예산실행 토글·#5 관계망 그래프(키보드 노드선택 기존)·
#6 점검제안·필터 select·거래장부·모달·드롭다운. 포커스 순서·가시성·트랩·Esc·Enter/Space.

### 슬라이스 3 — 인지 접근성 심층 (당사자)
당사자 화면 쉬운 말(easy-read-review)·오류 복구 문구·autoComplete(반복입력 경감)·맥락 변화 예고·상태
색+텍스트+아이콘 병기 실효. 다양한 장애유형(지적·시각·청각·뇌병변) 관점 점검.

### 마무리 — 감사 기록 갱신
`docs/release/08-a11y-remediation.md`: 3역할 심층 결과·수정 내역·남은 수동/사용자심사 항목(정직 고지).

## 게이트
각 슬라이스 tsc0·lint0·vitest(신규 가드+회귀0)·build0 + 대표 화면 라이브 키보드 QA. DB/Manual-Ops 없음(앱 전용).
