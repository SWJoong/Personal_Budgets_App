import Link from 'next/link'
import { requireAdmin } from '@/utils/supabase/staff'

export const metadata = { title: '시스템 설정' }

/**
 * 시스템 설정 (GOAL축 B, B3) — ComingSoon 대체. 읽기 전용 "제도 현황" 대시보드.
 * 설계 Plan&Source/goala_comingsoon_stubs_triage_W.md §4-7 (RESOLVED: 읽기전용, 사용자 2026-09-02).
 * 제도 데이터는 07 시드·env 라 앱에서 편집할 것이 없다 → 편집 UI 없음(과설계 회피).
 * ★env 값(허용도메인·슈퍼관리자)은 서버컴포넌트에서 표시만 — 편집·전송 없음. 슈퍼관리자 이메일 부분 마스킹.
 * RLS: 전부 seoul_is_admin() 열람(기존 정책 재사용). 순수 로직 없음 → 골든 없음.
 */

type Cohort = {
  id: string; code: string; name: string; period_months: number
  monthly_ceiling: number; total_ceiling: number; carry_over_allowed: boolean
  copay_rate: number; copay_max: number | null
  starts_on: string | null; ends_on: string | null; is_active: boolean
}
type Body = { id: string; name: string; body_role: string }
type Agency = { id: string; name: string; contact: string | null; is_active: boolean }
type Committee = { id: string; name: string; composition_note: string | null }
type Rule = { id: string; label: string; kind: string; enforcement: string; source_note: string | null }

const BODY_ROLE_LABEL: Record<string, string> = { city: '시', district: '자치구', foundation: '재단' }
const KIND_LABEL: Record<string, string> = { prohibition: '금지', criterion: '기준' }
const ENFORCEMENT: Record<string, { label: string; cls: string }> = {
  block: { label: '차단', cls: 'bg-red-50 text-red-700 ring-red-200' },
  warn: { label: '경고', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  flag: { label: '기록', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const pct = (r: number) => `${Number((r * 100).toFixed(2))}%`

/** 슈퍼관리자 이메일 부분 마스킹 — 로컬파트 첫 글자만 남기고 도메인은 유지. 표시 전용(편집·전송 없음). */
function maskEmail(email: string | undefined): string | null {
  if (!email) return null
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email[0]}${'*'.repeat(Math.max(3, at - 1))}${email.slice(at)}`
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white ring-1 ring-zinc-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/60">
        <h2 className="text-sm font-bold text-zinc-800">{title}</h2>
        {hint && <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">{hint}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

const empty = <p className="text-sm text-zinc-400 leading-relaxed">등록된 정보가 없습니다.</p>

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin()

  const [cohortsRes, bodiesRes, agenciesRes, committeesRes, rulesRes] = await Promise.all([
    supabase.from('seoul_cohorts').select('*').order('code', { ascending: false }),
    supabase.from('seoul_administering_bodies').select('*').order('created_at'),
    supabase.from('seoul_executing_agencies').select('*').order('created_at'),
    supabase.from('seoul_review_committees').select('*').order('created_at'),
    supabase.from('seoul_spending_rules').select('*').eq('is_active', true).order('code'),
  ])
  const cohorts = (cohortsRes.data ?? []) as Cohort[]
  const bodies = (bodiesRes.data ?? []) as Body[]
  const agencies = (agenciesRes.data ?? []) as Agency[]
  const committees = (committeesRes.data ?? []) as Committee[]
  const rules = (rulesRes.data ?? []) as Rule[]

  // ★env: 표시 전용. 서버컴포넌트에서만 읽어 마스킹/정제한 결과만 클라이언트로 내려간다.
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? '').split(',').map((d) => d.trim()).filter(Boolean)
  const superAdmin = maskEmail(process.env.SUPER_ADMIN_EMAIL)
  const blockCount = rules.filter((r) => r.enforcement === 'block').length

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href="/admin"
          aria-label="대시보드로 가기"
          className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">시스템 설정</h1>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200">
            읽기 전용
          </span>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-5">
        <p className="text-sm text-zinc-500 leading-relaxed">
          제도 데이터는 서버 시드와 환경변수로 관리됩니다. 이 화면은 현재 운영 전제를 확인하는 용도이며, 여기서 값을 바꾸지 않습니다.
        </p>

        {/* ① 운영 기관 */}
        <Section title="운영 기관" hint="사업을 시행하고 수행하는 기관입니다.">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold text-zinc-400 mb-2">시행주체</p>
              {bodies.length === 0 ? empty : (
                <ul className="flex flex-col gap-1.5">
                  {bodies.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-sm">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 shrink-0">
                        {BODY_ROLE_LABEL[b.body_role] ?? b.body_role}
                      </span>
                      <span className="font-medium text-zinc-800">{b.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 mb-2">수행기관</p>
              {agencies.length === 0 ? empty : (
                <ul className="flex flex-col gap-1.5">
                  {agencies.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-zinc-800">{a.name}</span>
                      {a.contact && <span className="text-zinc-500">· {a.contact}</span>}
                      {!a.is_active && <span className="text-xs text-zinc-400">(비활성)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>

        {/* ② 사업 차수 */}
        <Section title="사업 차수" hint="차수별 예산 한도와 본인부담금 기준입니다.">
          {cohorts.length === 0 ? empty : (
            <ul className="flex flex-col gap-3">
              {cohorts.map((c) => (
                <li key={c.id} className="rounded-xl bg-zinc-50 ring-1 ring-zinc-100 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-bold text-zinc-800">{c.name}</span>
                    <span className="text-xs text-zinc-400">{c.code}</span>
                    {c.is_active && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                        진행 중
                      </span>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600">
                    <div className="flex justify-between"><dt className="text-zinc-400">기간</dt><dd>{c.starts_on && c.ends_on ? `${c.starts_on} ~ ${c.ends_on}` : `${c.period_months}개월`}</dd></div>
                    <div className="flex justify-between"><dt className="text-zinc-400">총 한도</dt><dd>{won(c.total_ceiling)}</dd></div>
                    <div className="flex justify-between"><dt className="text-zinc-400">월 한도</dt><dd>{won(c.monthly_ceiling)}</dd></div>
                    <div className="flex justify-between"><dt className="text-zinc-400">이월</dt><dd>{c.carry_over_allowed ? '총액 내 허용' : '월 한도 고정'}</dd></div>
                    <div className="flex justify-between"><dt className="text-zinc-400">본인부담률</dt><dd>{pct(c.copay_rate)}{c.copay_max ? ` (최대 ${won(c.copay_max)})` : ''}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ③ 심의위원회 */}
        <Section title="심의위원회" hint="이용계획을 심의하는 위원회입니다.">
          {committees.length === 0 ? empty : (
            <ul className="flex flex-col gap-2">
              {committees.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium text-zinc-800">{c.name}</span>
                  {c.composition_note && <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">{c.composition_note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ④ 지출 정책 */}
        <Section title="지출 정책" hint="지출을 자동으로 막지 않습니다. 규칙은 기록·안내에만 쓰이고, 판단은 담당자가 합니다.">
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className={`font-bold px-2 py-1 rounded-lg ring-1 ${blockCount === 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
              자동 차단 규칙 {blockCount}건
            </span>
            <span className="text-zinc-500">{blockCount === 0 ? '막지 않고 기록하는 원칙을 지키고 있습니다.' : '차단 규칙이 있어 확인이 필요합니다.'}</span>
          </div>
          {rules.length === 0 ? empty : (
            <ul className="flex flex-col gap-1.5">
              {rules.map((r) => {
                const e = ENFORCEMENT[r.enforcement] ?? { label: r.enforcement, cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200' }
                return (
                  <li key={r.id} className="flex items-start gap-2 text-sm py-1">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 shrink-0 ${e.cls}`}>{e.label}</span>
                    <span className="text-[11px] text-zinc-400 shrink-0 mt-0.5">{KIND_LABEL[r.kind] ?? r.kind}</span>
                    <div className="min-w-0">
                      <span className="text-zinc-800">{r.label}</span>
                      {r.source_note && <p className="text-xs text-zinc-400 leading-relaxed">{r.source_note}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        {/* ⑤ 접근 정책 */}
        <Section title="접근 정책" hint="로그인을 허용하는 기준입니다. 값은 환경변수로 관리되며 여기서는 확인만 합니다.">
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-xs font-bold text-zinc-400 mb-1.5">허용 이메일 도메인</dt>
              <dd>
                {allowedDomains.length === 0 ? (
                  <span className="text-sm text-zinc-400">설정된 도메인이 없습니다.</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {allowedDomains.map((d) => (
                      <span key={d} className="text-xs font-medium px-2 py-1 rounded-lg bg-zinc-100 text-zinc-700">@{d}</span>
                    ))}
                  </div>
                )}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-xs font-bold text-zinc-400">슈퍼관리자</dt>
              <dd className="text-zinc-700 font-mono text-xs">{superAdmin ?? '미설정'}</dd>
            </div>
          </dl>
        </Section>
      </main>
    </div>
  )
}
