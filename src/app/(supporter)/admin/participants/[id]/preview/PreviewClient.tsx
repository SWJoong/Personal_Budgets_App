'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import HomeDashboard from '@/components/home/HomeDashboard'
import PreviewBanner from '@/components/admin/PreviewBanner'
import PreviewEditPanel from '@/components/admin/PreviewEditPanel'
import { UIPreferences, DEFAULT_PREFERENCES } from '@/types/ui-preferences'

interface PreviewClientProps {
  participant: any
  allParticipants: any[]
  fundingSources: any[]
  recentTransactions: any[]
  remainingDays: number
  totalDaysInMonth: number
  elapsedDays: number
  dailyTransactions: any[]
  monthlyTrend: any[]
}

export default function PreviewClient({
  participant,
  allParticipants,
  fundingSources,
  recentTransactions,
  remainingDays,
  totalDaysInMonth,
  elapsedDays,
  dailyTransactions,
  monthlyTrend,
}: PreviewClientProps) {
  const [isEditMode, setIsEditMode] = useState(false)
  const router = useRouter()

  // 블록 설정 공유 상태 — participant.ui_preferences로 초기화
  // 관리자가 체크박스를 변경하면 즉시 미리보기에 반영됨
  const rawPrefs = participant.ui_preferences as any
  const initialPrefs: UIPreferences = rawPrefs?.enabled_blocks
    ? { enabled_blocks: rawPrefs.enabled_blocks }
    : DEFAULT_PREFERENCES
  const [blockPrefs, setBlockPrefs] = useState<UIPreferences>(initialPrefs)

  const handleSave = () => {
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-zinc-200 flex flex-col">
      {/* 미리보기 모드 배너 */}
      <PreviewBanner
        currentParticipant={{ id: participant.id, name: participant.name }}
        allParticipants={allParticipants || []}
        onEditModeToggle={setIsEditMode}
      />

      {/* 편집 패널 — blockPrefs 공유 */}
      <PreviewEditPanel
        participant={participant}
        isVisible={isEditMode}
        onSave={handleSave}
        blockPrefs={blockPrefs}
        onBlockPrefsChange={setBlockPrefs}
      />

      {/* 폰 프레임 컨테이너 */}
      <div className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="relative w-full max-w-[390px]">
          {/* 폰 외형 */}
          <div className="relative w-full rounded-[3rem] overflow-hidden shadow-2xl ring-4 ring-zinc-800 bg-white" style={{ minHeight: '844px' }}>
            {/* 노치 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-zinc-800 rounded-b-2xl z-40 pointer-events-none" />

            {/* 실제 당사자 앱 렌더링 — blockPrefs 반영 */}
            <div className="pt-7">
              <HomeDashboard
                participant={participant}
                participantId={participant.id}
                fundingSources={fundingSources || []}
                recentTransactions={recentTransactions || []}
                remainingDays={remainingDays}
                totalDaysInMonth={totalDaysInMonth}
                userName={participant.name || ''}
                dailyTransactions={dailyTransactions || []}
                monthlyTrend={monthlyTrend}
                uiPreferences={blockPrefs}
              />
            </div>
          </div>

          {/* 홈버튼 */}
          <div className="flex justify-center mt-4">
            <div className="w-32 h-1 bg-zinc-600 rounded-full opacity-60" />
          </div>
        </div>
      </div>
    </div>
  )
}
