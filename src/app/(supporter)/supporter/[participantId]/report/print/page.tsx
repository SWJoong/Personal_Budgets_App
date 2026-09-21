import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { won } from '@/utils/won'
import { formatDate } from '@/utils/formatDate'
import { describeCopay } from '@/utils/copay'
import { aggregateSettlement } from '@/utils/kpiAggregate'
import PrintButton from '@/components/ui/PrintButton'

export const metadata = { title: '월간 실적 보고서' }

/**
 * 월간 실적 보고서 — 제출/인쇄용 출력본(축B). 설계: docs/release/14 P2(#15). 기본 양식(사용자 확정):
 * 당사자·담당자·기간 → 예산 집행 → 활동·변화(모니터링) → 정산 현황 → 서명란.
 *
 * requireStaff + 각 뷰/테이블 RLS 로 담당 당사자만. 브라우저 인쇄(PDF 저장) — @media print(globals.css:763)가
 * 사이드바·내비를 숨기고 본문만 출력한다. 집계는 기존 순수함수(aggregateSettlement) 재사용.
 * ★기관 지정 양식이 확정되면 이 구성을 교체(현재는 범용 v1).
 */

const METHOD_LABEL: Record<string, string> = { visit: '방문', phone: '전화', app: '앱', document: '서류' }

export default async function MonthlyReportPrintPage({
  params,
}: {
  params: Promise<{ participantId: string }>
}) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name, assigned_supporter_id')
    .eq('id', participantId)
    .maybeSingle()
  if (!participant) notFound()

  const [{ data: supporter }, { data: balance }, { data: monitoring }] = await Promise.all([
    participant.assigned_supporter_id
      ? supabase.from('profiles').select('name').eq('id', participant.assigned_supporter_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string | null } | null }),
    supabase
      .from('v_seoul_budget_balance')
      .select('*')
      .eq('participant_id', participantId)
      .order('ends_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('seoul_monitoring_records')
      .select('monitoring_date, method, observed_change, participant_voice')
      .eq('participant_id', participantId)
      .order('monitoring_date', { ascending: false }),
  ])

  const { data: usages } = balance
    ? await supabase.from('seoul_service_usages').select('settlement_status').eq('allocation_id', balance.allocation_id)
    : { data: [] as { settlement_status?: string | null }[] }
  const settle = aggregateSettlement((usages ?? []) as { settlement_status?: string | null }[])

  const monitoringRows = (monitoring ?? []) as {
    monitoring_date: string
    method: string | null
    observed_change: string | null
    participant_voice: string | null
  }[]

  const allocated = Number(balance?.allocated_amount ?? 0)
  const spent = Number(balance?.spent ?? 0)
  const remaining = Number(balance?.remaining ?? 0)
  const executionPct = allocated > 0 ? Math.round((1000 * spent) / allocated) / 10 : null
  const copay = balance ? describeCopay(balance.copay_status, Number(balance.copay_amount)) : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 액션 바 — 인쇄물에는 숨김 */}
      <div className="print:hidden flex items-center justify-between gap-2 p-4 border-b border-border sticky top-0 bg-background/90 backdrop-blur z-10">
        <Link
          href={`/supporter/${participantId}/report`}
          className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors min-h-[44px] flex items-center"
        >
          ← 돌아가기
        </Link>
        <PrintButton />
      </div>

      <main id="main-content" tabIndex={-1} className="max-w-2xl mx-auto p-6 sm:p-10 flex flex-col gap-6">
        <header className="text-center border-b-2 border-foreground pb-4">
          <h1 className="text-2xl font-black">월간 실적 보고서</h1>
          <p className="text-sm text-muted-foreground mt-1">서울형 개인예산제</p>
        </header>

        {/* ① 기본 정보 */}
        <section className="flex flex-col gap-1.5 text-sm">
          <InfoRow label="당사자" value={participant.name ?? '이름 미등록'} />
          <InfoRow label="담당자" value={supporter?.name ?? '미지정'} />
          <InfoRow
            label="보고 기간"
            value={balance?.starts_on ? `${formatDate(balance.starts_on)} ~ ${formatDate(balance.ends_on)}` : '예산 배정 전'}
          />
        </section>

        {/* ② 예산 집행 */}
        <ReportSection title="예산 집행">
          {balance ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Cell label="배정액" value={won(allocated)} />
              <Cell label="집행액" value={won(spent)} />
              <Cell label="잔액" value={won(remaining)} />
              <Cell label="집행률" value={executionPct == null ? '—' : `${executionPct}%`} />
              {copay?.show && <Cell label={copay.title} value={won(copay.amount)} />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">아직 배정된 예산이 없습니다.</p>
          )}
        </ReportSection>

        {/* ③ 활동·변화 (모니터링) */}
        <ReportSection title="활동 · 변화 기록">
          {monitoringRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">기록된 모니터링이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {monitoringRows.map((m, i) => (
                <li key={i} className="text-sm border-b border-border pb-2 last:border-b-0">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{m.method ? METHOD_LABEL[m.method] ?? '기록' : '기록'}</span>
                    <span>{formatDate(m.monitoring_date)}</span>
                  </div>
                  {m.observed_change && (
                    <p className="leading-relaxed">
                      <span className="font-bold">관찰 </span>
                      {m.observed_change}
                    </p>
                  )}
                  {m.participant_voice && (
                    <p className="leading-relaxed">
                      <span className="font-bold">당사자 말 </span>
                      {m.participant_voice}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ReportSection>

        {/* ④ 정산 현황 */}
        <ReportSection title="정산 현황">
          <div className="grid grid-cols-4 gap-2">
            <Cell label="정산 대기" value={`${settle.pending}건`} />
            <Cell label="정산 완료" value={`${settle.accepted}건`} />
            <Cell label="반려" value={`${settle.rejected}건`} />
            <Cell label="환수" value={`${settle.recovered}건`} />
          </div>
        </ReportSection>

        {/* ⑤ 서명란 */}
        <section className="grid grid-cols-2 gap-6 pt-10 mt-2">
          <SignatureBox label="담당자" />
          <SignatureBox label="관리자" />
        </section>
      </main>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 font-bold text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-2.5 rounded-lg bg-muted">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-black tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-black border-b border-foreground pb-1">{title}</h2>
      {children}
    </section>
  )
}

function SignatureBox({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="h-12 border-b border-foreground" />
      <span className="text-[11px] text-muted-foreground text-right">(서명 또는 날인)</span>
    </div>
  )
}
