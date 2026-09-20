import Link from 'next/link'
import { requireAdmin } from '@/utils/supabase/staff'
import { describeAuditAction, auditActionOptions, auditCategoryLabel } from '@/utils/auditLabels'

export const metadata = { title: '감사 기록' }

/**
 * 관리자 감사 열람 대시보드 — seoul_audit_log 를 "누가 · 언제 · 누구 정보를 · 무엇" 으로 보여준다(축C 슈퍼비전).
 * 설계: Plan&Source/goala_audit_log_W.md §7(후속 열람 UI) · docs/release/14 P1(#7).
 *
 * seoul_audit_log 는 RLS 로 관리자만 SELECT(12_audit_log.sql). requireAdmin() 로 진입도 이중 차단.
 * 필터(기간·행위·당사자)는 searchParams 서버사이드(GET form) — 클라 상태 없음. 최근순 200건 상한.
 * actor·당사자 id 는 이름으로 해석해 표시(PII 는 화면 표시용이며 로그 자체엔 미저장 — §1 원칙).
 */

const PERIOD_OPTIONS = [
  { v: '7', l: '최근 7일' },
  { v: '30', l: '최근 30일' },
  { v: '90', l: '최근 90일' },
  { v: 'all', l: '전체' },
]
const ROW_LIMIT = 200

/** 최근 N일 컷오프 ISO — 컴포넌트 렌더 밖 헬퍼(react-compiler impure-in-render 회피). */
function cutoffISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function formatWhen(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

type AuditRow = {
  id: string
  actor_user_id: string | null
  actor_role: string | null
  action: string
  target_type: string | null
  target_id: string | null
  target_participant_id: string | null
  created_at: string
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; participant?: string; days?: string }>
}) {
  const { supabase } = await requireAdmin()
  const sp = await searchParams
  const days = sp.days ?? '30'
  const action = sp.action ?? ''
  const participant = sp.participant ?? ''

  let query = supabase
    .from('seoul_audit_log')
    .select(
      'id, actor_user_id, actor_role, action, target_type, target_id, target_participant_id, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT)
  if (action) query = query.eq('action', action)
  if (participant) query = query.eq('target_participant_id', participant)
  if (days !== 'all') {
    query = query.gte('created_at', cutoffISO(Number(days)))
  }

  const { data: rowsRaw } = await query
  const rows = (rowsRaw ?? []) as AuditRow[]

  // 행위자·당사자 id → 이름 해석(표시용). 당사자 목록은 필터 드롭다운용.
  const actorIds = [...new Set(rows.map((r) => r.actor_user_id).filter((v): v is string => !!v))]
  const targetPids = [...new Set(rows.map((r) => r.target_participant_id).filter((v): v is string => !!v))]
  const [{ data: actors }, { data: targetParts }, { data: allParts }] = await Promise.all([
    actorIds.length
      ? supabase.from('profiles').select('id, name, email').in('id', actorIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null }[] }),
    targetPids.length
      ? supabase.from('participants').select('id, name').in('id', targetPids)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
    supabase.from('participants').select('id, name').order('name', { ascending: true }),
  ])
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.name || a.email || '이름 미상']))
  const partName = new Map((targetParts ?? []).map((p) => [p.id, p.name || '이름 미등록']))
  const participantOptions = (allParts ?? []) as { id: string; name: string | null }[]

  const capped = rows.length >= ROW_LIMIT

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href="/admin"
          aria-label="뒤로 가기"
          className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-xl font-bold tracking-tight">감사 기록</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          누가 · 언제 · 누구의 정보를 · 무엇을 했는지 기록이에요. 관리자만 볼 수 있어요.
        </p>

        {/* 필터 — 서버사이드 GET */}
        <form method="get" className="flex flex-col gap-3 p-4 rounded-2xl bg-card ring-1 ring-border">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-bold">기간</span>
              <select
                name="days"
                defaultValue={days}
                className="min-h-[44px] px-3 rounded-xl bg-background ring-1 ring-border text-foreground"
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-bold">행위</span>
              <select
                name="action"
                defaultValue={action}
                className="min-h-[44px] px-3 rounded-xl bg-background ring-1 ring-border text-foreground"
              >
                <option value="">전체 행위</option>
                {auditActionOptions().map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-bold">당사자</span>
              <select
                name="participant"
                defaultValue={participant}
                className="min-h-[44px] px-3 rounded-xl bg-background ring-1 ring-border text-foreground"
              >
                <option value="">전체 당사자</option>
                {participantOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || '이름 미등록'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary-hover transition-colors"
            >
              적용
            </button>
            {(action || participant || days !== '30') && (
              <Link
                href="/admin/audit"
                className="min-h-[44px] px-4 rounded-xl bg-muted text-muted-foreground font-bold hover:text-foreground transition-colors flex items-center"
              >
                초기화
              </Link>
            )}
          </div>
        </form>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {capped ? `최근 ${ROW_LIMIT}건까지 보여요` : `${rows.length}건`}
        </p>

        {rows.length === 0 ? (
          <div className="p-8 rounded-2xl bg-card ring-1 ring-border text-center text-muted-foreground">
            <p className="text-2xl mb-2" aria-hidden="true">🗂️</p>
            <p className="font-bold text-foreground">기록이 없어요</p>
            <p className="text-sm mt-1 leading-relaxed">이 조건에 맞는 감사 기록이 아직 없어요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const meta = describeAuditAction(r.action)
              const who = r.actor_user_id ? actorName.get(r.actor_user_id) ?? '이름 미상' : '알 수 없음'
              const whom = r.target_participant_id ? partName.get(r.target_participant_id) ?? null : null
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-1 p-4 rounded-2xl bg-card ring-1 ring-border"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-muted text-foreground">
                        {auditCategoryLabel(meta.category)}
                      </span>
                      <span className="font-bold">{meta.label}</span>
                    </div>
                    <time className="text-xs text-muted-foreground tabular-nums" dateTime={r.created_at}>
                      {formatWhen(r.created_at)}
                    </time>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-medium">{who}</span>
                    {r.actor_role ? ` (${r.actor_role})` : ''}
                    {whom ? <> 님이 <span className="text-foreground font-medium">{whom}</span> 님</> : ''}
                    {' 관련 기록'}
                    {r.target_type ? ` · 대상: ${r.target_type}` : ''}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
