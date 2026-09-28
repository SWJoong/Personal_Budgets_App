---
name: stacked-pr-verification
description: 스택 PR(base≠main) 검증 체크리스트 — CI 미실행, base squash-머지·삭제 시 PR 자동 CLOSED·재개설, 옛 head 재타깃 시 파일 부활, 검증 중 head 이동
metadata:
  type: reference
---

스택 PR 을 검증할 때 반복되는 결함·함정.

- CI(`ci.yml`·`db-verify.yml`)는 `pull_request: branches: [main]` 에서만 돈다 → base 가 스택 브랜치면 quality-check·db-verify 가 **아예 없다**. `gh pr checks` 에 Vercel 만 보이면 이 경우. 게이트는 격리 worktree 에서 직접 돌리고, CI 는 main 대상 PR 에서 확인한다.
- base PR 이 squash 머지되고 base 브랜치가 지워지면 GitHub 가 스택 PR 을 **CLOSED** 로 만든다(timeline `base_ref_deleted` → `closed`). 오케스트레이터는 main 위로 리베이스해 **새 PR 번호·새 head** 로 다시 연다. `gh pr view` 의 headRefOid 는 닫힌 뒤 갱신이 멈추므로 `git ls-remote` · `gh pr list` 로 현재 head 를 따로 본다.
- 패치 동일성은 `git range-diff <oldbase>..<oldhead> <newbase>..<newhead>` 가 `=` 인지로 증명한다. 리포트 헤더 head 는 **머지될 PR 의 현재 head** 여야 한다(머지 게이트가 head 일치를 본다).
- 리베이스 없이 옛 head 를 main 으로 재타깃하면 merge-base 가 squash 이전 커밋이 되어, base PR 이 **추가**하고 스택 PR 이 **삭제**한 파일이 3-way 병합에서 되살아나고 겹친 문서는 충돌한다. `git merge-tree --write-tree origin/main <oldhead>` 결과 트리에서 `git cat-file -e` 로 확인.

**Why:** 한 번의 검증 동안 base 머지 → PR 닫힘 → 재개설이 실제로 일어났고, CI 는 한 번도 돌지 않은 채 옛 head 기준 리포트가 새 PR 에 붙을 뻔했다.
**How to apply:** 검증 시작 때와 리포트 직전에 PR state·head 를 다시 조회한다. 스택 PR 이면 위 네 항목을 먼저 확인한다. [[harness-config-probes]]
