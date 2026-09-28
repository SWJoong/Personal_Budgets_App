---
name: a11y-class-contract-probes
description: jsdom 클래스·aria 구조 계약(p6c 류)이 놓치는 것 — 공통 컴포넌트 추출 시 클릭 배선(setter) 미계약, disclosure 첫 항목만 단언, 구현+계약 한 커밋, ::before 히트영역·테마 CSS 는 클래스만 단언 → setter 교차 돌연변이·Tailwind postcss 컴파일 프로브로 확인
metadata:
  type: reference
---

a11y 리트로핏 PR(터치타깃 44px·aria-hidden·role=switch 등)의 p6c 계약은 **클래스 토큰·aria 속성·접근명**만 본다. 반복 확인할 구멍:

- **배선 미계약**: 여러 컨트롤을 공통 컴포넌트(예: SettingSwitch)로 추출하면서 onClick → onToggle 로 다시 배선해도, 훅(useAccessibility 등)을 `vi.fn()` 으로 모킹만 하고 클릭 후 호출을 단언하지 않는다. 돌연변이 ① setter 교차(다크 스위치 → setEasyTerms) ② onClick 무동작 이 관련 디렉터리 전체 스위트에서 생존하는지 본다. 생존하면 "클릭 → 해당 setter 가 !현재값 으로 1회" 계약을 제안(W 레인).
- **CSS 방출 확인**: jsdom 은 CSS 를 적용하지 않는다. `before:h-11` 같은 pseudo 히트영역·토큰 색이 실제로 생성되는지는 worktree 에서 `postcss([require('@tailwindcss/postcss')({base})]).process(globals.css)` 로 컴파일해 `.before\:h-11 { &::before { content: var(--tw-content); … } }` 를 grep 한다(스크립트는 worktree 안에 임시로 두고 지운다 — ESM import 해석이 cwd node_modules 기준).
- **테마 덮어쓰기**: `globals.css` 의 `html.{high-contrast,dark-mode} .participant-view [class*="rounded-"]:not(button)…` 는 !important 로 배경·테두리를 덮는다. 상태 색은 button/a 자신에 있어야 살아남고, 고대비는 `.participant-view button` 에 2px 테두리를 더한다(border-box 안쪽 absolute 자식 위치가 2px 밀림). Modal 은 createPortal 이라 `.participant-view` 밖 → 이 규칙이 안 걸린다.

- **disclosure 첫 항목만**: aria-expanded 계약이 목록 0번만 클릭·단언하면 `aria-expanded={openIdx === 0 && i === 0}` 류가 생존한다(FAQ 질문 목록).
- **구현+계약 한 커밋**: 커밋 author 가 전부 같은 계정이라 컨텍스트 분리는 git 으로 증명 불가. `git show --stat` 로 테스트(W 레인)와 구현(U 레인)이 한 커밋에 섞였는지 보고, 섞였으면 독립 돌연변이로 보강하고 "미확인" 으로 적는다.
- **요령**: 전체 스위트를 도는 worktree 에선 돌연변이하지 말고 두 번째 worktree 를 쓴다. 기저 RED 는 `git show origin/main:<구현> > <구현>`(인덱스 불변) 뒤 계약 실행 → `git checkout -- .` · `git status --porcelain` 빈 줄 확인. 생존 돌연변이는 임시 클릭 프로브 테스트로 "현재 구현은 맞고 한 줄 테스트로 잡힌다" 를 보인 뒤 지운다.

**Why:** 한 PR 에서 계약 돌연변이 4종은 모두 RED 였지만, 공통 스위치 추출 뒤의 배선 돌연변이 2종은 16파일·77테스트를 전부 통과했다.
**How to apply:** 컴포넌트 추출·핸들러 재배선이 있는 a11y PR 이면 배선 돌연변이를 기본으로 추가하고, pseudo/테마 CSS 를 근거로 한 주장은 컴파일 프로브로 확인한다. [[tier-glob-gaps]]
