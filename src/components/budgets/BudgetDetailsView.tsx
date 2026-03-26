'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BudgetEditModal from './BudgetEditModal'
import FundingSourceModal from './FundingSourceModal'
import DeleteConfirmModal from './DeleteConfirmModal'

interface FundingSource {
  id: string
  name: string
  monthly_budget: number
  description?: string
}

interface Transaction {
  id: string
  date: string
  activity_name: string
  amount: number
  status: string
  category?: string
}

interface Participant {
  id: string
  name?: string
  email?: string
  monthly_budget_default?: number
  created_at: string
  updated_at?: string
}

interface BudgetDetailsViewProps {
  participant: Participant
  fundingSources: FundingSource[]
  recentTransactions: Transaction[]
  thisMonthSpent: number
  totalMonthlyBudget: number
  userRole: string
}

export default function BudgetDetailsView({
  participant,
  fundingSources,
  recentTransactions,
  thisMonthSpent,
  totalMonthlyBudget,
  userRole
}: BudgetDetailsViewProps) {
  const router = useRouter()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isFundingModalOpen, setIsFundingModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedFundingSource, setSelectedFundingSource] = useState<FundingSource | null>(null)

  const remainingBudget = totalMonthlyBudget - thisMonthSpent
  const budgetUsagePercent = totalMonthlyBudget > 0 ? (thisMonthSpent / totalMonthlyBudget) * 100 : 0

  const handleEditFundingSource = (fs: FundingSource) => {
    setSelectedFundingSource(fs)
    setIsFundingModalOpen(true)
  }

  const handleAddFundingSource = () => {
    setSelectedFundingSource(null)
    setIsFundingModalOpen(true)
  }

  const handleDeleteBudget = async () => {
    try {
      const response = await fetch(`/api/budgets/${participant.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete budget')
      }

      router.push('/supporter')
      router.refresh()
    } catch (error) {
      console.error('Error deleting budget:', error)
      alert('예산 삭제에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex h-16 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/supporter" className="text-zinc-500 hover:text-zinc-900">
            ← 뒤로
          </Link>
          <h1 className="text-xl font-bold tracking-tight">예산 상세</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
          >
            수정
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
            >
              삭제
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-4xl w-full mx-auto">
        {/* Participant Info */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-zinc-200 mb-6">
          <h2 className="text-lg font-bold mb-4">참여자 정보</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-zinc-500">이름</p>
              <p className="font-semibold">{participant.name || '알 수 없음'}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">이메일</p>
              <p className="font-semibold">{participant.email || '알 수 없음'}</p>
            </div>
          </div>
        </section>

        {/* Budget Summary */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-zinc-200 mb-6">
          <h2 className="text-lg font-bold mb-4">이번 달 예산 현황</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-zinc-500">총 예산</p>
              <p className="text-2xl font-bold">{totalMonthlyBudget.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">사용 금액</p>
              <p className="text-2xl font-bold text-red-500">{thisMonthSpent.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">잔액</p>
              <p className="text-2xl font-bold text-green-500">{remainingBudget.toLocaleString()}원</p>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-zinc-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${budgetUsagePercent > 100 ? 'bg-red-500' : budgetUsagePercent > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(budgetUsagePercent, 100)}%` }}
            />
          </div>
          <p className="text-sm text-zinc-500 mt-2">
            사용률: {budgetUsagePercent.toFixed(1)}%
          </p>
        </section>

        {/* Funding Sources */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-zinc-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">재원 목록</h2>
            <button
              onClick={handleAddFundingSource}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
            >
              + 재원 추가
            </button>
          </div>
          {fundingSources.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">등록된 재원이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {fundingSources.map((fs) => (
                <div
                  key={fs.id}
                  className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg border border-zinc-200"
                >
                  <div>
                    <p className="font-semibold">{fs.name}</p>
                    {fs.description && (
                      <p className="text-sm text-zinc-500">{fs.description}</p>
                    )}
                    <p className="text-lg font-bold text-blue-600 mt-1">
                      {Number(fs.monthly_budget).toLocaleString()}원/월
                    </p>
                  </div>
                  <button
                    onClick={() => handleEditFundingSource(fs)}
                    className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                  >
                    수정
                  </button>
                </div>
              ))}
            </div>
          )}
          {participant.monthly_budget_default && participant.monthly_budget_default > 0 && (
            <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700">
                기본 예산: {Number(participant.monthly_budget_default).toLocaleString()}원/월
              </p>
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-zinc-200">
          <h2 className="text-lg font-bold mb-4">최근 거래 내역</h2>
          {recentTransactions.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">거래 내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{tx.activity_name}</p>
                    <p className="text-sm text-zinc-500">
                      {new Date(tx.date).toLocaleDateString('ko-KR')}
                      {tx.category && ` • ${tx.category}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{Number(tx.amount).toLocaleString()}원</p>
                    <p className={`text-sm ${
                      tx.status === 'approved' ? 'text-green-600' :
                      tx.status === 'rejected' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {tx.status === 'approved' ? '승인됨' :
                       tx.status === 'rejected' ? '거절됨' :
                       '대기 중'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Link
              href={`/supporter/${participant.id}/transactions`}
              className="block text-center py-2 text-blue-600 hover:underline"
            >
              전체 거래 내역 보기 →
            </Link>
          </div>
        </section>
      </main>

      {/* Modals */}
      {isEditModalOpen && (
        <BudgetEditModal
          participant={participant}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false)
            router.refresh()
          }}
        />
      )}

      {isFundingModalOpen && (
        <FundingSourceModal
          participantId={participant.id}
          fundingSource={selectedFundingSource}
          onClose={() => {
            setIsFundingModalOpen(false)
            setSelectedFundingSource(null)
          }}
          onSuccess={() => {
            setIsFundingModalOpen(false)
            setSelectedFundingSource(null)
            router.refresh()
          }}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteConfirmModal
          title="예산 삭제"
          message={`정말로 ${participant.name || '이 참여자'}의 예산을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDeleteBudget}
          onCancel={() => setIsDeleteModalOpen(false)}
        />
      )}
    </div>
  )
}
