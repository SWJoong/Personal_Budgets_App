export const meta = {
  name: 'verify-pr',
  description: 'PR을 저자와 무관한 4관점 렌즈로 독립 검증하고, finding마다 반박 에이전트가 기각을 시도한 뒤, 살아남은 것만 판정 리포트로 종합한다',
  whenToUse: '/verify-pr <PR번호> — [HANDOFF→W] PR 머지 전 독립 검증(W 대행). 저자 세션이 자기 PR을 사인오프하지 않기 위해 쓴다.',
  phases: [
    { title: '범위', detail: 'PR 메타·변경 파일·계약 파일·CI 상태 수집' },
    { title: '검토', detail: '4관점 렌즈: 요구·타입 / 보안·RLS / 접근성·쉬운말 / 테스트·돌연변이' },
    { title: '반박', detail: 'finding마다 독립 반박자 2명이 기각 시도' },
    { title: '종합', detail: '생존 finding 순위화 + 판정' },
  ],
}

// ── 입력: /verify-pr 191   (args = "191" | 191 | ["191"] | {pr: 191}) ─────────────────
const raw = Array.isArray(args) ? args[0]
  : (args && typeof args === 'object' && args.pr !== undefined) ? args.pr
  : args
const pr = String(raw === undefined || raw === null ? '' : raw).replace(/^#/, '').trim()
if (!/^\d+$/.test(pr)) throw new Error('사용법: /verify-pr <PR번호>   예) /verify-pr 191')

// ── 스키마 ────────────────────────────────────────────────────────────────────
const SCOPE = {
  type: 'object',
  required: ['title', 'base', 'head', 'files', 'contracts', 'ci', 'summary', 'participant_copy_changed'],
  properties: {
    title: { type: 'string' },
    base: { type: 'string', description: 'baseRefName (보통 main)' },
    head: { type: 'string', description: 'headRefName' },
    files: { type: 'array', items: { type: 'string' } },
    contracts: { type: 'array', items: { type: 'string' }, description: '변경 파일 중 *.test.ts(x)·*.spec.ts(x)·src/test/**·verify_*.sql' },
    ci: { type: 'string', description: 'gh pr checks 요약: quality-check / db-verify 상태' },
    summary: { type: 'string', description: 'PR 이 무엇을 바꾸는지 5줄 이내' },
    participant_copy_changed: { type: 'boolean', description: '당사자 화면 노출 문구(라벨·안내·오류)가 바뀌었는가' },
  },
}
const FINDINGS = {
  type: 'object', required: ['findings'],
  properties: { findings: { type: 'array', items: {
    type: 'object', required: ['severity', 'title', 'file', 'evidence', 'why', 'fix'],
    properties: {
      severity: { type: 'string', enum: ['치명', '높음', '보통', '낮음'] },
      title: { type: 'string' },
      file: { type: 'string', description: '파일:줄' },
      evidence: { type: 'string', description: '재현 명령·출력·코드 인용. 추측이면 "미확인" 명시' },
      why: { type: 'string' },
      fix: { type: 'string', description: '제안 수정(텍스트만, 코드 수정 금지)' },
    } } } },
}
const VERDICTS = {
  type: 'object', required: ['verdicts'],
  properties: { verdicts: { type: 'array', items: {
    type: 'object', required: ['id', 'refuted', 'reason'],
    properties: { id: { type: 'string' }, refuted: { type: 'boolean' }, reason: { type: 'string' } } } } },
}

// ── 1. 범위 ───────────────────────────────────────────────────────────────────
phase('범위')
const scope = await agent(
  `PR #${pr} 의 검증 범위를 수집하라. 기준 브랜치는 반드시 origin/main(로컬 main 은 stale 일 수 있다).
실행: gh pr view ${pr} --json title,body,baseRefName,headRefName,files ; gh pr diff ${pr} --name-only ; gh pr checks ${pr}
contracts 에는 변경 파일 중 *.test.ts(x)·*.spec.ts(x)·src/test/**·verify_*.sql 만 넣어라.
participant_copy_changed 는 diff(gh pr diff ${pr})에 당사자 화면(src/app/(participant)/** 또는 당사자 노출 컴포넌트)의 문구 변경이 있으면 true.
코드를 수정하지 마라.`,
  { label: `scope #${pr}`, phase: '범위', schema: SCOPE, effort: 'low' },
)
if (!scope) throw new Error(`PR #${pr} 범위 수집 실패`)
log(`#${pr} ${scope.title} · 파일 ${scope.files.length}개 · 계약 ${scope.contracts.length}개 · CI: ${scope.ci}`)

const ctx = `대상: PR #${pr} 「${scope.title}」 (${scope.head} → ${scope.base})
요약: ${scope.summary}
변경 파일: ${scope.files.join(', ')}
계약 파일: ${scope.contracts.length ? scope.contracts.join(', ') : '(없음)'}
CI: ${scope.ci}
규칙: 기준은 origin/main. diff 는 gh pr diff ${pr}. 코드·테스트를 수정하지 마라(도구도 막는다).
각 finding 에는 파일:줄과 재현 가능한 증거를 붙여라. 추측은 severity 낮음 + evidence 에 "미확인" 표기. 문제가 없으면 빈 배열.
격리 worktree 가 필요하면: MAIN="$(git rev-parse --show-toplevel)"; WT="$(mktemp -d)/wt"; git fetch origin ${scope.head} && git worktree add "$WT" FETCH_HEAD && ln -s "$MAIN/node_modules" "$WT/node_modules" — 끝나면 git worktree remove --force "$WT".`

// ── 2·3. 검토 → 반박 (렌즈별 파이프라인: 한 렌즈가 끝나면 그 렌즈의 반박이 바로 시작) ──
const LENSES = [
  { key: '요구·타입', prompt: `${ctx}
렌즈: ①요구 충족 — PR 본문·설계·계약이 약속한 동작을 실제로 하는가, 빠진 경로·엣지(빈 값·권한 없는 사용자·view-as preview)
②타입 안전 — any·단언(as)·null 처리·src/types/database.ts 정합. 격리 worktree 에서 npx tsc --noEmit 을 실행해 결과를 증거로 써라.` },
  { key: '보안·RLS', prompt: `${ctx}
렌즈: 보안 — RLS 정책과 seoul_can_access/seoul_is_staff_for 스코프, service_role(createAdminClient) 노출 경계, 인증 확인 누락,
Storage 경로 위조, view-as 읽기전용 예외 우회, 감사로그 누락(target_participant_id), 당사자 이름·기관명이 AI 로 전송되기 전 마스킹 여부.` },
  { key: '접근성·쉬운말', prompt: `${ctx}
렌즈: 접근성 — 키보드 도달·포커스 관리(재마운트·달 이동 시 소실), ARIA 이름, LiveRegion 단일 채널(같은 문구 재안내), 색 대비 4.5:1,
터치 44px, 오류·성공 안내 단일 채널, jsx-a11y 규칙. ${scope.participant_copy_changed
    ? '당사자 노출 문구가 바뀌었다 — easy-read-review 절차(6영역)로 검수하고 70점 미만이면 finding 으로 올려라.'
    : '당사자 문구 변경 없음 — 쉬운말 검수는 생략한다.'}` },
  { key: '테스트·돌연변이', prompt: `${ctx}
렌즈: 테스트 — 계약이 구현을 실제로 조이는가. 격리 worktree 에서 계약(npx vitest run <계약파일>)이 green 인지 확인한 뒤,
구현을 임시로 망가뜨려(Bash 패치) 계약이 RED 가 되는지 최소 2종 돌연변이로 확인하고 **반드시 git checkout -- . 로 원복**하라.
원복 확인(git status 깨끗함)을 evidence 에 남겨라. 계약이 약화(assert 완화·skip·only)됐는지 diff 로 확인하라.
계약 파일이 없으면 "계약 부재" 를 보통 finding 으로 올려라.` },
]

const results = await pipeline(
  LENSES,
  l => agent(l.prompt, { label: `검토:${l.key}`, phase: '검토', schema: FINDINGS, agentType: 'w-verifier' }),
  (review, l) => {
    const fs = (review && review.findings ? review.findings : []).map((f, i) => ({ ...f, id: `${l.key}-${i + 1}`, lens: l.key }))
    if (!fs.length) return { lens: l.key, findings: [], verdicts: [] }
    const list = fs.map(f => `- ${f.id} [${f.severity}] ${f.title} @ ${f.file}\n  증거: ${f.evidence}\n  이유: ${f.why}`).join('\n')
    return parallel([1, 2].map(k => () => agent(
      `${ctx}
너는 반박자 ${k} 이다. 아래 findings 각각을 **기각**하려고 시도하라. 코드를 직접 읽고(gh pr diff ${pr}, 파일 열람, 필요하면 격리 worktree 에서 실행)
증거가 틀렸거나 재현되지 않거나 실제 영향이 없으면 refuted=true, 확인되면 refuted=false. 불확실하면 refuted=true 로 두되 reason 에 "미확인" 을 적어라.
id 는 그대로 돌려줘라. 코드를 수정하지 마라.

${list}`,
      { label: `반박${k}:${l.key}`, phase: '반박', schema: VERDICTS, agentType: 'w-verifier' },
    ))).then(vs => ({ lens: l.key, findings: fs, verdicts: vs.filter(Boolean).flatMap(v => v.verdicts) }))
  },
)

// ── 집계: 치명·높음은 반박자 1명이라도 확인하면 생존, 보통·낮음은 2명 모두 확인해야 생존 ──
const confirmed = [], rejected = []
for (const r of results.filter(Boolean)) {
  for (const f of r.findings) {
    const votes = r.verdicts.filter(v => v.id === f.id)
    const notRefuted = votes.filter(v => !v.refuted).length
    const serious = f.severity === '치명' || f.severity === '높음'
    const survives = votes.length === 0 ? true : (serious ? notRefuted >= 1 : notRefuted >= 2)
    ;(survives ? confirmed : rejected).push({ ...f, votes, unverified: votes.length === 0 })
  }
}
const order = { '치명': 0, '높음': 1, '보통': 2, '낮음': 3 }
confirmed.sort((a, b) => order[a.severity] - order[b.severity])
log(`findings ${confirmed.length + rejected.length}건 → 생존 ${confirmed.length} · 기각 ${rejected.length}`)

// ── 4. 종합 (모든 렌즈 결과가 필요하므로 여기서만 배리어) ─────────────────────
phase('종합')
const report = await agent(
  `PR #${pr} 「${scope.title}」 독립 검증 결과를 종합하라. 코드를 수정하지 마라.
CI: ${scope.ci}
생존 findings(${confirmed.length}): ${JSON.stringify(confirmed)}
기각 findings(${rejected.length}, 참고): ${JSON.stringify(rejected.map(f => ({ id: f.id, title: f.title, reasons: f.votes.map(v => v.reason) })))}
판정 규칙: 치명·높음 생존 → changes-requested / 보통만 생존 → approve-with-conditions / 낮음만·없음 → approve. CI 가 green 이 아니면 approve 불가.
아래 형식으로만 답하라(한국어):
=== VERIFY REPORT ===
TARGET: PR #${pr} (${scope.head} → ${scope.base})
VERDICT: approve | approve-with-conditions | changes-requested
CI: ...
MUTATION: 테스트·돌연변이 렌즈 결과 요약(RED 확인·원복)
FINDINGS: 생존 항목을 심각도순으로  - [심각도] id 제목 — 파일:줄 — 증거 — 제안
REJECTED: 기각 항목 id 와 한 줄 사유
SUMMARY: 3줄 이내. 머지 전 사람이 확인할 Manual-Ops 가 있으면 명시`,
  { label: '종합', phase: '종합', agentType: 'w-verifier' },
)
const m = (report || '').match(/VERDICT:\s*(\S+)/)
return { pr, verdict: m ? m[1] : 'unknown', confirmed, rejected, report }
