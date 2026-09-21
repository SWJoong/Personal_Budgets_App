import Link from 'next/link'
import { requireAdmin } from '@/utils/supabase/staff'
import { buildSupervision, type StaffMember } from '@/utils/supervision'

export const metadata = { title: '실무자 현황' }

/**
 * 관리자 슈퍼비전 — 담당자별 업무량(담당 당사자 수)·최근 활동(감사로그)을 한눈에(축C 슈퍼비전).
 * 설계: docs/release/14 P2(#13). 감사 열람 대시보드(/admin/audit)와 데이터 소스 공유.
 *
 * requireAdmin + seoul_audit_log RLS(관리자 SELECT)로 이중 게이트. 최근 활동 = 최근 30일 감사로그.
 * 집계는 순수 함수(buildSupervision)로 분리(테스트 가능). 활동 원문(무엇을 했나)은 /admin/audit 에서 본다.
 */

const WINDOW_DAYS = 30

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function formatWhen(ts: string | null): string {
  if (!ts) return '활동 없음'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '활동 없음'
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(d)
}

const ROLE_LABEL: Record<string, string> = { supporter: '실무자', admin: '관리자' }

export default async function AdminSupervisionPage() {
  const { supabase } = await requireAdmin()
  const cutoff = daysAgoISO(WINDOW_DAYS)

  const [{ data: staff }, { data: participants }, { data: audit }] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role').in('role', ['supporter', 'admin']),
    supabase.from('participants').select('assigned_supporter_id'),
    supabase.from('seoul_audit_log').select('actor_user_id, created_at').gte('created_at', cutoff),
  ])

  const rows = buildSupervision(
    (staff ?? []) as StaffMember[],
    (participants ?? []) as { assigned_supporter_id?: string | null }[],
    (audit ?? []) as { actor_user_id?: string | null; created_at?: string | null }[],
  )

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
        <h1 className="text-xl font-bold tracking-tight">실무자 현황</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          담당자별 업무량과 최근 활동이에요. 자세한 활동 내역은{' '}
          <Link href="/admin/audit" className="underline font-bold hover:text-foreground">
            감사 기록
          </Link>
          에서 봐요.
        </p>

        {rows.length === 0 ? (
          <div className="p-8 rounded-2xl bg-card ring-1 ring-border text-center text-muted-foreground">
            <p className="text-2xl mb-2" aria-hidden="true">🧑‍💼</p>
            <p className="font-bold text-foreground">실무자가 없어요</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 p-4 rounded-2xl bg-card ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{r.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-muted text-muted-foreground">
                    {ROLE_LABEL[r.role] ?? r.role}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    담당 <span className="font-black text-foreground tabular-nums">{r.assignedCount}</span>명
                  </span>
                  <span className="text-muted-foreground">
                    최근 30일 활동 <span className="font-black text-foreground tabular-nums">{r.actions}</span>건
                  </span>
                  <span className="text-muted-foreground">
                    마지막 활동 <span className="font-bold text-foreground">{formatWhen(r.lastActiveAt)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
          ※ 활동은 최근 {WINDOW_DAYS}일 감사로그 기준이에요(감사로그 라이브 반영 후 집계돼요).
        </p>
      </main>
    </div>
  )
}
