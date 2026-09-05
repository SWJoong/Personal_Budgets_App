'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PreviewBanner from './PreviewBanner'
import DisplaySettingsClient from '@/app/(participant)/settings/display/DisplaySettingsClient'
import { BLOCK_METADATA, type BlockId, type UIPreferences } from '@/utils/uiPreferences'
import type { BudgetDomainRow, BudgetStatus } from '@/utils/budgetByDomain'
import type { CopayDisplay } from '@/utils/copay'

/**
 * 관리자 대리 렌더 — 당사자 홈을 그 사람 눈으로 본다. 설계: goala_comingsoon_stubs_triage_W.md §4-8.
 *
 * ★뮤테이션 안전(§4-8-2, 이 컴포넌트의 핵심 계약): 당사자 홈에는 쓰기 동작(FAB 지출기록·영수증 업로드·
 * 화면설정 저장)이 있다. 관리자가 preview 중 이를 누르면 관리자 권한(RLS admin)으로 그 당사자 데이터에
 * 실제 기록될 수 있다(유령 지출·오설정). 이 컴포넌트는:
 *  - 보기 모드: 읽기 위젯만 렌더. FAB 는 실제 `/receipt` 로 내비게이션하지 않는 비활성 replica 로만 표시
 *    (클릭 시 안내 문구, 진짜 이동 없음).
 *  - 편집 모드(PreviewBanner ✏️): 허용되는 쓰기는 `ui_preferences` 대리 설정 하나로 한정(이미 계약된
 *    saveUIPreferences(participantId, …) 경로를 그대로 재사용 — 새 서버 액션 없음). 지출·계획 등 다른
 *    쓰기는 편집 모드에서도 만들지 않는다(정본 화면에서 하도록 유도).
 *
 * (participant)/page.tsx 의 공유 뷰 추출(ParticipantHomeView)은 §4-8-1 이 권장하지만, 그 파일이 별도
 * 진행 중인 PR 과 겹쳐 이번 스코프에서는 보류하고 홈 렌더 로직을 여기서 중복 유지한다(후속 과제).
 */

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

/** 선택 블록 중 바로가기(shortcut) 카드의 라우트. (participant)/page.tsx 와 동일. */
const SHORTCUT_HREF: Partial<Record<BlockId, string>> = {
  calendar_shortcut: '/calendar',
  plan_shortcut: '/plan',
  map_shortcut: '/map',
  gallery: '/gallery',
}

/** 당사자용 영역 상태 라벨 — (participant)/page.tsx 와 동일(담당자용과 별도). */
const PARTICIPANT_STATUS: Record<BudgetStatus, { label: string; cls: string }> = {
  ok: { label: '쓰는 중이에요', cls: 'bg-success-bg text-success-fg ring-success-fg/20' },
  unused: { label: '아직 안 썼어요', cls: 'bg-info-bg text-info-fg ring-info-fg/20' },
  over: { label: '조금 넘게 썼어요', cls: 'bg-warning-bg text-warning-fg ring-warning-fg/20' },
  unplanned: { label: '계획에 없이 썼어요', cls: 'bg-warning-bg text-warning-fg ring-warning-fg/20' },
  none: { label: '아직 없어요', cls: 'bg-neutral-bg text-neutral-fg ring-neutral-fg/20' },
}

/** 서울형 6영역 아이콘 — (participant)/page.tsx 와 동일. */
const DOMAIN_ICON: Record<string, string> = {
  일상생활: '🧺',
  사회생활: '🤝',
  '취·창업활동': '💼',
  자기개발: '📚',
  '건강·안전': '🩺',
  주거환경개선: '🏠',
}

export interface PreviewBalance {
  remaining: number
  allocatedAmount: number
  spent: number
}

export interface PreviewRecentUsage {
  id: string
  usageDate: string
  amount: number
  description: string | null
}

interface Props {
  currentParticipant: { id: string; name: string }
  allParticipants: { id: string; name: string }[]
  prefs: UIPreferences
  balance: PreviewBalance | null
  copay: CopayDisplay | null
  budgetRows: BudgetDomainRow[]
  showDomains: boolean
  recentUsages: PreviewRecentUsage[]
}

export default function ParticipantHomePreviewClient({
  currentParticipant,
  allParticipants,
  prefs,
  balance,
  copay,
  budgetRows,
  showDomains,
  recentUsages,
}: Props) {
  const router = useRouter()
  const [isEditMode, setIsEditMode] = useState(false)
  const [fabNotice, setFabNotice] = useState(false)
  const enabled = new Set(prefs.enabled_blocks)

  const handleEditModeToggle = (next: boolean) => {
    setIsEditMode(next)
    // 편집→보기 전환 시 방금 저장한 화면 설정을 서버에서 다시 읽어온다(대리 저장은 saveUIPreferences 가
    // revalidatePath('/')만 하므로, 이 미리보기 라우트는 refresh 로 직접 최신화한다).
    if (!next) router.refresh()
  }

  const shortcuts = (Object.keys(SHORTCUT_HREF) as BlockId[]).filter((b) => enabled.has(b))

  return (
    <div className="flex flex-col min-h-screen bg-muted/60">
      <PreviewBanner
        currentParticipant={currentParticipant}
        allParticipants={allParticipants}
        onEditModeToggle={handleEditModeToggle}
      />

      <div className="flex-1 w-full lg:max-w-[600px] mx-auto bg-background flex flex-col">
        <header className="flex h-16 items-center px-4 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight">{currentParticipant.name}님의 예산</h1>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col gap-6 max-w-sm mx-auto w-full pb-28">
          {isEditMode ? (
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-black text-foreground">무엇을 볼지 골라요.</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {currentParticipant.name}님의 화면 설정을 대신 바꿔요. 바꾸면 바로 저장돼요.
                </p>
              </div>
              {/* 대리 쓰기는 이 하나로 한정(§4-8-2) — 기존 saveUIPreferences(participantId,…) 경로 그대로 재사용. */}
              <DisplaySettingsClient participantId={currentParticipant.id} initial={prefs} />
            </section>
          ) : (
            <>
              {!balance ? (
                <section className="p-8 rounded-3xl bg-muted text-center">
                  <p className="text-muted-foreground font-medium leading-relaxed">
                    아직 정해진 예산이 없어요.<br />선생님들이 확인하면 여기에 나와요.
                  </p>
                </section>
              ) : (
                <>
                  <section className="p-8 rounded-3xl bg-hero text-hero-foreground flex flex-col gap-2">
                    <span className="text-sm font-bold text-hero-foreground/70">지금 쓸 수 있는 돈</span>
                    <span className="text-4xl font-black tracking-tight">{won(balance.remaining)}</span>
                    <span className="text-xs font-medium text-hero-foreground/70 leading-relaxed">
                      전체 {won(balance.allocatedAmount)} 중 {won(balance.spent)} 사용했어요
                    </span>
                  </section>

                  {copay?.show && (
                    <section
                      className={`p-6 rounded-3xl flex flex-col gap-1.5 ring-1 ${
                        copay.pending ? 'bg-warning-bg ring-warning-fg/20' : 'bg-card ring-border'
                      }`}
                    >
                      <span className="text-sm font-bold text-muted-foreground">{copay.title}</span>
                      {copay.amount > 0 && (
                        <span className="text-2xl font-black tracking-tight">{won(copay.amount)}</span>
                      )}
                      <span className="text-xs font-medium text-muted-foreground leading-relaxed">{copay.note}</span>
                    </section>
                  )}

                  {showDomains && enabled.has('domain_breakdown') && (
                    <section className="flex flex-col gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-muted-foreground">영역별로 보기</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">어디에 썼는지 봐요.</p>
                      </div>
                      <ul className="flex flex-col gap-3">
                        {budgetRows.map((r) => {
                          const st = PARTICIPANT_STATUS[r.status]
                          const icon = DOMAIN_ICON[r.label] ?? '📁'
                          const dim = r.status === 'none'
                          const canSpendMore = r.status === 'ok' || r.status === 'unused'
                          return (
                            <li
                              key={r.domainId}
                              className={`p-5 rounded-3xl ring-1 flex flex-col gap-2 ${dim ? 'bg-muted ring-border' : 'bg-card ring-border'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-bold flex items-center gap-2 ${dim ? 'text-muted-foreground' : 'text-foreground'}`}>
                                  <span aria-hidden="true" className="text-lg">{icon}</span>
                                  {r.label}
                                </span>
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${st.cls}`}>{st.label}</span>
                              </div>
                              {canSpendMore ? (
                                <div>
                                  <span className="text-2xl font-black tracking-tight">{won(Math.max(0, r.remaining))}</span>
                                  <p className="text-xs text-muted-foreground mt-0.5">이만큼 더 쓸 수 있어요.</p>
                                </div>
                              ) : dim ? null : (
                                <p className="text-sm text-muted-foreground">{won(r.usageSum)} 썼어요.</p>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )}
                </>
              )}

              {shortcuts.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="text-sm font-bold text-muted-foreground">바로 가기</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {shortcuts.map((b) => (
                      <Link
                        key={b}
                        href={SHORTCUT_HREF[b]!}
                        className="p-4 rounded-2xl bg-card ring-1 ring-border flex items-center gap-3 hover:bg-muted transition-colors min-h-[44px]"
                      >
                        <span aria-hidden="true" className="text-2xl">{BLOCK_METADATA[b].icon}</span>
                        <span className="font-bold text-foreground">{BLOCK_METADATA[b].label}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {enabled.has('recent_usages') && (
                <section className="flex flex-col gap-3">
                  <h2 className="text-sm font-bold text-muted-foreground">최근에 쓴 돈</h2>
                  {recentUsages.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {recentUsages.map((u) => (
                        <li key={u.id} className="p-4 rounded-2xl bg-card ring-1 ring-border flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-bold leading-relaxed">{u.description ?? '활동'}</span>
                            <span className="text-xs text-muted-foreground">{u.usageDate}</span>
                          </div>
                          <span className="font-bold">{won(u.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm leading-relaxed">아직 쓴 돈이 없어요.</p>
                  )}
                </section>
              )}
            </>
          )}
        </main>

        {/* FAB replica — 절대 /receipt 로 이동하지 않는다(§4-8-2 뮤테이션 안전). 보기 전용, 클릭해도 안내만. */}
        {!isEditMode && (
          <div
            style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            className="fixed left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2"
          >
            {fabNotice && (
              <p role="status" className="text-xs font-bold text-hero-foreground bg-hero px-3 py-1.5 rounded-full shadow-lg leading-relaxed">
                미리보기에서는 기록할 수 없어요
              </p>
            )}
            <button
              type="button"
              aria-disabled="true"
              aria-label="내가 쓴 돈 적기 — 미리보기에서는 기록할 수 없어요"
              onClick={() => setFabNotice(true)}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[72px] min-h-[72px] px-6 rounded-full bg-muted-foreground text-background shadow-2xl ring-4 ring-background cursor-not-allowed"
            >
              <span className="text-2xl leading-none" aria-hidden="true">📷</span>
              <span className="text-xs font-bold whitespace-nowrap">내가 쓴 돈 적기</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
