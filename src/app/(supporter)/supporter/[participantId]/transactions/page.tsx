import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { getServiceUsages } from '@/app/actions/serviceUsage'
import { settlementLabel, settlementIntent } from '@/utils/settlementStatus'
import { PageHeader } from '@/components/ui/PageHeader'
import { LinkButton } from '@/components/ui/LinkButton'
import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { StatusPill } from '@/components/ui/StatusPill'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * 거래장부 (GOAL축 A) — 당사자의 지출(seoul_service_usages) 목록. 실무자·본인 열람.
 * (기존 ComingSoon 스텁 대체. 지출 기록 폼(/new)·영수증·분류(domain) 연결은 이후 단계.)
 * 정산상태 라벨·intent 는 org 원장과 공용 모듈 settlementStatus.ts 로 통일.
 */

export const metadata = { title: '거래장부' }

export default async function TransactionsPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  const { usages, error } = await getServiceUsages(participantId)
  const total = usages.reduce((sum, u) => sum + Number(u.amount), 0)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <PageHeader
        title={`${participant.name ?? ''}님의 거래장부`}
        backHref="/supporter/participants"
        action={
          <LinkButton href={`/supporter/${participantId}/transactions/new`}>+ 지출 기록</LinkButton>
        }
      />

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {error && (
          <Card as="div" variant="danger" className="text-sm">
            {error}
          </Card>
        )}

        <Card as="div" variant="muted">
          <div className="text-xs text-muted-foreground">전체 지출</div>
          <div className="text-2xl font-bold">
            <MoneyText value={total} emphasis="hero" />
          </div>
          <div className="text-xs text-muted-foreground mt-1">{usages.length}건</div>
        </Card>

        {usages.length === 0 ? (
          <EmptyState emoji="📭" title="아직 지출 기록이 없어요." variant="inline" />
        ) : (
          <ul className="flex flex-col gap-2">
            {usages.map((u) => (
              <li key={u.id}>
                <Card
                  as="div"
                  variant="default"
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-bold text-foreground truncate">{u.description || '(내용 없음)'}</span>
                    <span className="text-xs text-muted-foreground">{u.usage_date}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-bold">
                      <MoneyText value={Number(u.amount)} emphasis="body" />
                    </span>
                    <StatusPill
                      label={settlementLabel(u.settlement_status)}
                      intent={settlementIntent(u.settlement_status)}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
