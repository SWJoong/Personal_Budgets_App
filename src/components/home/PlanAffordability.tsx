'use client'

import { useState } from 'react'
import WaterCupPlanPreview from './WaterCupPlanPreview'

interface PlanOption {
  name: string
  cost: number
}

/**
 * 물컵 계획 미리보기 선택 래퍼 — WaterCupPlanPreview 는 controlled(selectedIndex prop)라
 * 이 클라이언트 래퍼가 선택 상태를 쥐고, 범례 항목 클릭으로 선택/해제를 반영한다(고아 복원 §2 배선).
 */
export default function PlanAffordability({
  currentBalance,
  totalBudget,
  options,
}: {
  currentBalance: number
  totalBudget: number
  options: PlanOption[]
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  return (
    <WaterCupPlanPreview
      currentBalance={currentBalance}
      totalBudget={totalBudget}
      options={options}
      selectedIndex={selectedIndex}
      onSelect={(next) => setSelectedIndex(next)}
    />
  )
}
