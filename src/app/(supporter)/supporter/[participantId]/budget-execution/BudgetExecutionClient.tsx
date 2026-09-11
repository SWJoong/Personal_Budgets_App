'use client'

import { useState } from 'react'
import { bucketUsages, type BucketMode, type UsageForBucket } from '@/utils/usageBuckets'
import type { DomainFlowRow } from '@/utils/domainAxisReport'
import { settlementLabel, settlementIntent } from '@/utils/settlementStatus'
import { copayStatusLabel, copayIntent, describeCopay } from '@/utils/copay'
import { formatCurrency } from '@/utils/budget-visuals'
import { formatDate } from '@/utils/formatDate'
import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * 예산 실행 통합 뷰(#4) — 한 화면 4구획. 설계: Plan&Source/goala_budget_execution_view_W.md §3.
 * ①편성/심의 ②계획 대비 실제 ③사용 내역(건/일/주/월 시간버킷) ④자부담 점검.
 * 시간버킷 그룹핑은 순수 util bucketUsages 를 클라에서 돌려(토글 즉시 반영) 렌더한다.
 * Easy Read: 쉬운 말·leading-relaxed·44px·시맨틱 토큰·비색큐(라벨/부호/아이콘 병기)·light/dark.
 */

/** v_seoul_budget_balance 에서 이 화면이 쓰는 열만. */
export interface ExecutionBalance {
  allocated_amount: number | null
  spent: number | null
  remaining: number | null
  total_ceiling: number | null
  monthly_ceiling: number | null
  copay_amount: number | null
  copay_status: string | null
  unplanned_count: number | null
}

const MODES: { value: BucketMode; label: string }[] = [
  { value: 'item', label: '건별' },
  { value: 'day', label: '일별' },
  { value: 'week', label: '주별' },
  { value: 'month', label: '월별' },
]

export default function BudgetExecutionClient({
  participantName,
  balance,
  domainFlow,
  usages,
}: {
  participantName: string
  balance: ExecutionBalance | null
  domainFlow: DomainFlowRow[]
  usages: UsageForBucket[]
}) {
  const [mode, setMode] = useState<BucketMode>('month')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const allocated = Number(balance?.allocated_amount ?? 0)
  const spent = Number(balance?.spent ?? 0)
  const remaining = Number(balance?.remaining ?? 0)
  const totalCeiling = balance?.total_ceiling != null ? Number(balance.total_ceiling) : null
  const monthlyCeiling = balance?.monthly_ceiling != null ? Number(balance.monthly_ceiling) : null
  const copayAmount = Number(balance?.copay_amount ?? 0)
  const copayStatus = balance?.copay_status ?? 'not_applicable'
  const hasAllocation = balance != null && balance.allocated_amount != null

  // 진행바(쓴 돈 / 승인) — 초과면 danger, 80% 이상 warning, 그 외 positive. budgets/[id] 와 동일 규칙.
  const pct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0
  const barColor = spent > allocated ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-positive'

  const copay = describeCopay(copayStatus, copayAmount)
  const grouped = bucketUsages(usages, mode)

  return (
    <>
      <p className="text-sm text-muted-foreground leading-relaxed px-1">
        {participantName}님의 예산을 <b className="text-foreground">편성·심의</b>부터{' '}
        <b className="text-foreground">실제 사용</b>까지 한 곳에서 봐요.
      </p>

      {/* ① 편성 / 심의 */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">예산 편성과 심의</h2>
          {hasAllocation && (
            <StatusPill label="심의 통과" intent="success" icon={<span aria-hidden="true">✅</span>} />
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-0.5">승인된 예산</p>
          <p className="text-4xl font-black tracking-tight">
            <MoneyText value={allocated} emphasis="hero" />
          </p>
        </div>
        {(totalCeiling != null || monthlyCeiling != null) && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {totalCeiling != null && (
              <div>
                <dt className="text-xs text-muted-foreground">전체 한도</dt>
                <dd className="font-medium text-foreground">
                  <MoneyText value={totalCeiling} emphasis="body" />
                </dd>
              </div>
            )}
            {monthlyCeiling != null && (
              <div>
                <dt className="text-xs text-muted-foreground">한 달 한도</dt>
                <dd className="font-medium text-foreground">
                  <MoneyText value={monthlyCeiling} emphasis="body" />
                </dd>
              </div>
            )}
          </dl>
        )}
        <div className="flex items-center justify-between gap-2 text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">자부담(내가 낼 돈) 상태</span>
          <StatusPill label={copayStatusLabel(copayStatus)} intent={copayIntent(copayStatus)} />
        </div>
      </Card>

      {/* ② 계획 대비 실제 */}
      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">계획한 돈과 실제로 쓴 돈</h2>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              쓴 돈{' '}
              <b>
                <MoneyText value={spent} emphasis="body" />
              </b>
            </span>
            <span className="text-muted-foreground">
              승인 <MoneyText value={allocated} emphasis="muted" />
            </span>
          </div>
          <div
            className="h-3 w-full rounded-full bg-muted overflow-hidden"
            role="img"
            aria-label={`승인된 돈의 ${pct}%를 썼어요`}
          >
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">
            남은 돈{' '}
            <b className="text-foreground">
              <MoneyText value={remaining} emphasis="body" />
            </b>
            {spent > allocated && allocated > 0 && (
              <span className="ml-2 font-bold text-danger">· 승인된 돈보다 많이 썼어요.</span>
            )}
          </p>
        </div>

        {domainFlow.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-muted-foreground">영역별로 쓴 돈</h3>
            <ul className="flex flex-col gap-2">
              {domainFlow.map((d, i) => {
                const amount = Number(d.금액 ?? 0)
                const unplanned = Number(d.계획외_금액 ?? 0)
                return (
                  <li
                    key={`${d.domain_id ?? 'none'}-${i}`}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted ring-1 ring-border"
                  >
                    <span className="font-medium text-foreground truncate">{d.영역 ?? '미분류'}</span>
                    <span className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                      <MoneyText value={amount} emphasis="body" />
                      {unplanned > 0 && (
                        <StatusPill
                          label={`계획 밖 ${formatCurrency(unplanned)}원`}
                          intent="info"
                          icon={<span aria-hidden="true">📌</span>}
                        />
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </Card>

      {/* ③ 사용 내역 (시간버킷) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold px-1">사용 내역</h2>
        <div role="group" aria-label="시간 단위로 묶어 보기" className="flex flex-wrap gap-2">
          {MODES.map((m) => {
            const active = mode === m.value
            return (
              <Button
                key={m.value}
                onClick={() => {
                  setMode(m.value)
                  setOpenKey(null)
                }}
                aria-pressed={active}
                variant={active ? 'primary' : 'secondary'}
                size="sm"
              >
                {/* 선택 표시는 색뿐 아니라 채움(primary)·앞 체크(✓)로도 — 비색큐 */}
                {active && <span aria-hidden="true">✓ </span>}
                {m.label}
              </Button>
            )
          })}
        </div>

        {usages.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="아직 기록된 지출이 없어요."
            description="지출을 적으면 여기에 시간별로 모여요."
            variant="inline"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {grouped.map((b) => {
              const isOpen = openKey === b.key
              return (
                <li key={b.key} className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
                  <button
                    onClick={() => setOpenKey(isOpen ? null : b.key)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-3 p-4 min-h-[44px] text-left hover:bg-muted-hover transition-colors"
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground truncate">{b.label}</span>
                      <span className="text-xs text-muted-foreground">{b.count}건</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <MoneyText value={b.total} emphasis="body" />
                      <span aria-hidden="true" className="text-muted-foreground text-xs">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="border-t border-border">
                      {b.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border first:border-t-0"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm text-foreground truncate">
                              {it.description || '(내용 없음)'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(it.usage_date)}
                              {it.domainLabel ? ` · ${it.domainLabel}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusPill
                              label={settlementLabel(it.settlement_status ?? '')}
                              intent={settlementIntent(it.settlement_status ?? '')}
                            />
                            <MoneyText value={it.amount} emphasis="body" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ④ 자부담 점검 */}
      <Card variant={copay.pending ? 'warning' : 'default'} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">자부담 점검</h2>
          <StatusPill label={copayStatusLabel(copayStatus)} intent={copayIntent(copayStatus)} />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground">내가 낼 돈</span>
          <span className="text-xl font-bold">
            <MoneyText value={copayAmount} emphasis="body" />
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {copay.show
            ? copay.note
            : '이 예산은 자부담(내가 따로 내는 돈) 제도가 없는 차수예요. 지금은 따로 낼 돈이 없어요.'}
        </p>
      </Card>
    </>
  )
}
