'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  deleteParticipant,
  updateParticipant,
  updateFundingSource,
  deleteFundingSource,
  createFundingSource,
} from '@/app/actions/admin'
import { formatCurrency } from '@/utils/budget-visuals'

interface ParticipantDetailClientProps {
  participant: any
  fundingSources: any[]
  recentTransactions: any[]
  monthPercentage: number
  totalMonthBalance: number
  totalYearBalance: number
  totalMonthlyBudget: number
  backUrl: string
  isAdmin: boolean
}

export default function ParticipantDetailClient({
  participant,
  fundingSources: initialFundingSources,
  recentTransactions,
  monthPercentage,
  totalMonthBalance,
  totalYearBalance,
  totalMonthlyBudget,
  backUrl,
  isAdmin,
}: ParticipantDetailClientProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // 기본 정보 편집 상태
  const [formData, setFormData] = useState({
    name: participant.name || '',
    email: participant.email || '',
    monthlyBudget: participant.monthly_budget_default || 0,
    yearlyBudget: participant.yearly_budget_default || 0,
    startDate: participant.budget_start_date || '',
    endDate: participant.budget_end_date || '',
    alertThreshold: participant.alert_threshold || 0,
  })
  const [isSavingInfo, setIsSavingInfo] = useState(false)

  // 재원 편집 상태
  const [fundingSources, setFundingSources] = useState<any[]>(initialFundingSources)
  const [editingFsId, setEditingFsId] = useState<string | null>(null)
  const [fsForm, setFsForm] = useState({ name: '', monthlyBudget: 0, yearlyBudget: 0 })
  const [isSavingFs, setIsSavingFs] = useState(false)
  const [showAddFs, setShowAddFs] = useState(false)
  const [newFs, setNewFs] = useState({ name: '', monthlyBudget: 0, yearlyBudget: 0 })
  const [isAddingFs, setIsAddingFs] = useState(false)

  const handleDelete = async () => {
    const confirmed = confirm(
      `정말로 "${participant.name}" 당사자를 삭제하시겠습니까?\n\n관련된 모든 거래 내역, 계획, 평가, 재원 데이터가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await deleteParticipant(participant.id)
      if (result.error) {
        alert(`삭제 실패: ${result.error}`)
        setIsDeleting(false)
      } else {
        alert('삭제되었습니다.')
        router.push('/admin/participants')
        router.refresh()
      }
    } catch {
      alert('삭제 중 오류가 발생했습니다.')
      setIsDeleting(false)
    }
  }

  const handleSaveInfo = async () => {
    setIsSavingInfo(true)
    try {
      const result = await updateParticipant(participant.id, formData)
      if (result.error) {
        alert(`저장 실패: ${result.error}`)
      } else {
        router.refresh()
        setIsEditing(false)
      }
    } catch {
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSavingInfo(false)
    }
  }

  const startEditFs = (fs: any) => {
    setEditingFsId(fs.id)
    setFsForm({
      name: fs.name || '',
      monthlyBudget: Number(fs.monthly_budget) || 0,
      yearlyBudget: Number(fs.yearly_budget) || 0,
    })
  }

  const handleSaveFs = async (fsId: string) => {
    setIsSavingFs(true)
    try {
      const result = await updateFundingSource(fsId, {
        name: fsForm.name,
        monthlyBudget: fsForm.monthlyBudget,
        yearlyBudget: fsForm.yearlyBudget,
      })
      if (result.error) {
        alert(`저장 실패: ${result.error}`)
      } else {
        setFundingSources(prev =>
          prev.map(fs => fs.id === fsId
            ? { ...fs, name: fsForm.name, monthly_budget: fsForm.monthlyBudget, yearly_budget: fsForm.yearlyBudget, current_month_balance: fsForm.monthlyBudget, current_year_balance: fsForm.yearlyBudget }
            : fs
          )
        )
        setEditingFsId(null)
      }
    } catch {
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSavingFs(false)
    }
  }

  const handleDeleteFs = async (fsId: string, fsName: string) => {
    if (!confirm(`"${fsName}" 재원을 삭제하시겠습니까?`)) return
    try {
      const result = await deleteFundingSource(fsId)
      if (result.error) {
        alert(`삭제 실패: ${result.error}`)
      } else {
        setFundingSources(prev => prev.filter(fs => fs.id !== fsId))
      }
    } catch {
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleAddFs = async () => {
    if (!newFs.name.trim()) {
      alert('재원 이름을 입력해주세요.')
      return
    }
    setIsAddingFs(true)
    try {
      const result = await createFundingSource(participant.id, {
        name: newFs.name,
        monthlyBudget: newFs.monthlyBudget,
        yearlyBudget: newFs.yearlyBudget,
      })
      if (result.error) {
        alert(`추가 실패: ${result.error}`)
      } else {
        router.refresh()
        setShowAddFs(false)
        setNewFs({ name: '', monthlyBudget: 0, yearlyBudget: 0 })
      }
    } catch {
      alert('추가 중 오류가 발생했습니다.')
    } finally {
      setIsAddingFs(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="text-zinc-400 hover:text-zinc-600 transition-colors">←</Link>
          <h1 className="text-xl font-bold tracking-tight">{participant.name || '당사자'}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isAdmin && (
            <button
              onClick={() => {
                setIsEditing(!isEditing)
                setEditingFsId(null)
                setShowAddFs(false)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                isEditing
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <span>✏️</span>
              <span>{isEditing ? '편집 종료' : '정보 편집'}</span>
            </button>
          )}
          <Link
            href={`/admin/participants/${participant.id}/report`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
          >
            <span>🖨️</span>
            <span>월간 보고서</span>
          </Link>
          <Link
            href={`/admin/participants/${participant.id}/preview`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
          >
            <span>👁</span>
            <span>앱 미리보기</span>
          </Link>
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              <span>🗑</span>
              <span>{isDeleting ? '삭제 중...' : '삭제'}</span>
            </button>
          )}
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${
            monthPercentage <= 20 ? 'bg-red-50 text-red-500' :
            monthPercentage <= 40 ? 'bg-orange-50 text-orange-500' :
            'bg-zinc-100 text-zinc-500'
          }`}>
            {monthPercentage}% 남음
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 예산 요약 카드 */}
        <section className="p-6 rounded-3xl bg-zinc-900 text-white shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">이번 달 잔액</p>
              <p className="text-4xl font-black mt-1">{formatCurrency(totalMonthBalance)}원</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">올해 잔액</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalYearBalance)}원</p>
            </div>
          </div>
          <div className="h-2 w-full bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                monthPercentage <= 20 ? 'bg-red-500' :
                monthPercentage <= 40 ? 'bg-orange-500' :
                'bg-white'
              }`}
              style={{ width: `${monthPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            <span>0원</span>
            <span>{formatCurrency(totalMonthlyBudget)}원</span>
          </div>
        </section>

        {/* 기본 정보 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between ml-1">
            <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">기본 정보</h2>
            {isEditing && (
              <button
                onClick={handleSaveInfo}
                disabled={isSavingInfo}
                className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSavingInfo ? '저장 중...' : '💾 저장'}
              </button>
            )}
          </div>
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-zinc-400 text-xs font-medium block mb-1">이름</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs font-medium block mb-1">이메일</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs font-medium block mb-1">운영 시작일</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs font-medium block mb-1">운영 종료일</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs font-medium block mb-1">월 기본 예산 (원)</label>
                  <input
                    type="number"
                    value={formData.monthlyBudget}
                    onChange={e => setFormData({ ...formData, monthlyBudget: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <p className="text-[11px] text-zinc-400 mt-0.5">{formatCurrency(formData.monthlyBudget)}원</p>
                </div>
                <div>
                  <label className="text-zinc-400 text-xs font-medium block mb-1">경고 기준액 (원)</label>
                  <input
                    type="number"
                    value={formData.alertThreshold}
                    onChange={e => setFormData({ ...formData, alertThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <p className="text-[11px] text-zinc-400 mt-0.5">{formatCurrency(formData.alertThreshold)}원</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-400 text-xs font-medium">운영 기간</span>
                  <p className="font-bold text-zinc-800">{participant.budget_start_date} ~ {participant.budget_end_date}</p>
                </div>
                <div>
                  <span className="text-zinc-400 text-xs font-medium">담당 지원자</span>
                  <p className="font-bold text-zinc-800">{participant.supporter?.name || '미지정'}</p>
                </div>
                <div>
                  <span className="text-zinc-400 text-xs font-medium">이메일</span>
                  <p className="font-bold text-zinc-800">{participant.email || '—'}</p>
                </div>
                <div>
                  <span className="text-zinc-400 text-xs font-medium">월 예산 (기본)</span>
                  <p className="font-bold text-zinc-800">{formatCurrency(participant.monthly_budget_default)}원</p>
                </div>
                <div>
                  <span className="text-zinc-400 text-xs font-medium">경고 기준액</span>
                  <p className="font-bold text-zinc-800">{formatCurrency(participant.alert_threshold)}원</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 재원 목록 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between ml-1">
            <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">재원 ({fundingSources.length}개)</h2>
            {isEditing && (
              <button
                onClick={() => { setShowAddFs(true); setEditingFsId(null) }}
                className="px-3 py-1 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-700 transition-colors"
              >
                + 재원 추가
              </button>
            )}
          </div>

          {fundingSources.map((fs: any) => {
            const fsPercentage = Number(fs.monthly_budget) > 0
              ? Math.round((Number(fs.current_month_balance) / Number(fs.monthly_budget)) * 100)
              : 0
            const isEditingThis = editingFsId === fs.id

            return (
              <div key={fs.id} className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
                {isEditingThis ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-zinc-400 text-xs font-medium block mb-1">재원 이름</label>
                      <input
                        type="text"
                        value={fsForm.name}
                        onChange={e => setFsForm({ ...fsForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-zinc-400 text-xs font-medium block mb-1">월 예산 (원)</label>
                        <input
                          type="number"
                          value={fsForm.monthlyBudget}
                          onChange={e => setFsForm({ ...fsForm, monthlyBudget: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <p className="text-[11px] text-zinc-400 mt-0.5">{formatCurrency(fsForm.monthlyBudget)}원</p>
                      </div>
                      <div>
                        <label className="text-zinc-400 text-xs font-medium block mb-1">연 예산 (원)</label>
                        <input
                          type="number"
                          value={fsForm.yearlyBudget}
                          onChange={e => setFsForm({ ...fsForm, yearlyBudget: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <p className="text-[11px] text-zinc-400 mt-0.5">{formatCurrency(fsForm.yearlyBudget)}원</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => handleSaveFs(fs.id)}
                        disabled={isSavingFs}
                        className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {isSavingFs ? '저장 중...' : '저장'}
                      </button>
                      <button
                        onClick={() => setEditingFsId(null)}
                        className="flex-1 py-2 bg-zinc-100 text-zinc-600 text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-zinc-800">{fs.name}</p>
                        <p className="text-xs text-zinc-400">월 {formatCurrency(fs.monthly_budget)}원</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="text-right">
                          <p className={`text-lg font-black ${
                            fsPercentage <= 20 ? 'text-red-600' :
                            fsPercentage <= 40 ? 'text-orange-600' :
                            'text-zinc-900'
                          }`}>{formatCurrency(fs.current_month_balance)}원</p>
                          <p className="text-[10px] text-zinc-400">{fsPercentage}% 남음</p>
                        </div>
                        {isEditing && (
                          <div className="flex flex-col gap-1 ml-1">
                            <button
                              onClick={() => startEditFs(fs)}
                              className="p-1 rounded text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                              title="편집"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteFs(fs.id, fs.name)}
                              className="p-1 rounded text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                              title="삭제"
                            >
                              🗑
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          fsPercentage <= 20 ? 'bg-red-500' :
                          fsPercentage <= 40 ? 'bg-orange-500' :
                          'bg-zinc-900'
                        }`}
                        style={{ width: `${fsPercentage}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )
          })}

          {/* 재원 추가 폼 */}
          {showAddFs && (
            <div className="p-5 rounded-2xl bg-blue-50 ring-1 ring-blue-200 shadow-sm">
              <p className="text-xs font-bold text-blue-700 mb-3">새 재원 추가</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-zinc-500 text-xs font-medium block mb-1">재원 이름</label>
                  <input
                    type="text"
                    placeholder="예: 활동지원급여"
                    value={newFs.name}
                    onChange={e => setNewFs({ ...newFs, name: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-500 text-xs font-medium block mb-1">월 예산 (원)</label>
                    <input
                      type="number"
                      value={newFs.monthlyBudget}
                      onChange={e => setNewFs({ ...newFs, monthlyBudget: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="text-[11px] text-zinc-400 mt-0.5">{formatCurrency(newFs.monthlyBudget)}원</p>
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs font-medium block mb-1">연 예산 (원)</label>
                    <input
                      type="number"
                      value={newFs.yearlyBudget}
                      onChange={e => setNewFs({ ...newFs, yearlyBudget: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="text-[11px] text-zinc-400 mt-0.5">{formatCurrency(newFs.yearlyBudget)}원</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={handleAddFs}
                    disabled={isAddingFs}
                    className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isAddingFs ? '추가 중...' : '추가'}
                  </button>
                  <button
                    onClick={() => { setShowAddFs(false); setNewFs({ name: '', monthlyBudget: 0, yearlyBudget: 0 }) }}
                    className="flex-1 py-2 bg-zinc-100 text-zinc-600 text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 빠른 이동 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">빠른 이동</h2>
          <div className="grid grid-cols-3 gap-3">
            <Link
              href={`/supporter/transactions?participant=${participant.id}`}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm hover:ring-zinc-900 transition-all active:scale-[0.97] group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">📒</span>
              <span className="text-xs font-black text-zinc-700 text-center">거래 장부</span>
            </Link>
            <Link
              href={`/supporter/evaluations?participant_id=${participant.id}`}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm hover:ring-zinc-900 transition-all active:scale-[0.97] group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">📝</span>
              <span className="text-xs font-black text-zinc-700 text-center">계획과 평가</span>
            </Link>
            <Link
              href={`/supporter/documents?participant_id=${participant.id}`}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm hover:ring-zinc-900 transition-all active:scale-[0.97] group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">📁</span>
              <span className="text-xs font-black text-zinc-700 text-center">증빙 서류</span>
            </Link>
          </div>
        </section>

        {/* 최근 사용 내역 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">최근 사용 내역</h2>
          {(!recentTransactions || recentTransactions.length === 0) ? (
            <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 text-center text-zinc-400 text-sm font-medium">
              아직 사용 내역이 없습니다.
            </div>
          ) : (
            recentTransactions.map((tx: any) => (
              <Link key={tx.id} href={`/supporter/transactions/${tx.id}`} className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 flex justify-between items-center hover:ring-zinc-400 transition-colors active:scale-[0.99]">
                <div>
                  <p className="font-bold text-zinc-800 text-sm">{tx.activity_name}</p>
                  <p className="text-xs text-zinc-400">{tx.date} · {tx.category || '미분류'}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="font-bold text-zinc-900">{formatCurrency(tx.amount)}원</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    tx.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {tx.status === 'confirmed' ? '확정' : '임시'}
                  </span>
                </div>
              </Link>
            ))
          )}
        </section>
      </main>
    </div>
  )
}
