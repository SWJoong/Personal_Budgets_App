'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { MapTransaction } from '@/components/map/KakaoMap'
import ImportResultModal from './ImportResultModal'
import { updateTransactionStatus, deleteTransaction } from '@/app/actions/transaction'

const KakaoMap = dynamic(() => import('@/components/map/KakaoMap'), { ssr: false })

interface Transaction {
  id: string
  date: string
  activity_name: string
  amount: number
  status: string
  category?: string
  payment_method?: string
  memo?: string
  participant?: { name?: string }
}

interface Participant { id: string; name: string }

interface TransactionTableClientProps {
  transactions: Transaction[]
  participants: Participant[]
  participantFundingSources?: Record<string, { id: string; name: string }[]>
  categories: string[]
  paymentMethods: string[]
  currentFilters: {
    participant?: string; status?: string; category?: string
    paymentMethod?: string; dateFrom?: string; dateTo?: string
    sort?: string; keyword?: string
  }
  mapApiKey?: string
  mapTransactions?: MapTransaction[]
}

type SortField = 'date' | 'amount' | 'name' | 'category'
type SortDir = 'asc' | 'desc'

function parseSortParam(sort: string): { field: SortField; dir: SortDir } {
  if (!sort) return { field: 'date', dir: 'desc' }
  if (sort === 'amount_asc')    return { field: 'amount',   dir: 'asc'  }
  if (sort === 'amount_desc')   return { field: 'amount',   dir: 'desc' }
  if (sort === 'date_asc')      return { field: 'date',     dir: 'asc'  }
  if (sort === 'name_asc')      return { field: 'name',     dir: 'asc'  }
  if (sort === 'name_desc')     return { field: 'name',     dir: 'desc' }
  if (sort === 'category_asc')  return { field: 'category', dir: 'asc'  }
  if (sort === 'category_desc') return { field: 'category', dir: 'desc' }
  return { field: 'date', dir: 'desc' }
}

export default function TransactionTableClient({
  transactions, participants, participantFundingSources = {},
  categories, paymentMethods, currentFilters,
  mapApiKey = '', mapTransactions = [],
}: TransactionTableClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'table' | 'map'>('table')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [filters, setFilters] = useState({
    participant: currentFilters.participant || '',
    status: currentFilters.status || '',
    category: currentFilters.category || '',
    paymentMethod: currentFilters.paymentMethod || '',
    dateFrom: currentFilters.dateFrom || '',
    dateTo: currentFilters.dateTo || '',
    sort: currentFilters.sort || '',
    keyword: currentFilters.keyword || '',
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const currentSort = parseSortParam(filters.sort)

  // ── 필터/정렬 ──
  const applyFilters = () => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
    router.push(`/supporter/transactions?${params.toString()}`)
  }

  const clearFilters = () => {
    setFilters({ participant: '', status: '', category: '', paymentMethod: '', dateFrom: '', dateTo: '', sort: '', keyword: '' })
    router.push('/supporter/transactions')
  }

  const quickFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value }
    const params = new URLSearchParams()
    Object.entries(next).forEach(([k, v]) => { if (v) params.set(k, v) })
    setFilters(next)
    router.push(`/supporter/transactions?${params.toString()}`)
  }

  // ── 컬럼 정렬 토글 ──
  function handleColSort(field: SortField) {
    let newSort: string
    if (currentSort.field === field) {
      newSort = currentSort.dir === 'desc' ? `${field}_asc` : `${field}_desc`
    } else {
      newSort = `${field}_desc`
    }
    // date_desc = 기본값 → 빈 문자열
    if (newSort === 'date_desc') newSort = ''
    quickFilter('sort', newSort)
  }

  function SortIcon({ field }: { field: SortField }) {
    if (currentSort.field !== field)
      return <span className="opacity-30 ml-0.5 text-[10px]">↕</span>
    return currentSort.dir === 'asc'
      ? <span className="text-blue-500 ml-0.5 text-[11px]">↑</span>
      : <span className="text-blue-500 ml-0.5 text-[11px]">↓</span>
  }

  // ── 행 선택 ──
  const allSelected = transactions.length > 0 && selected.size === transactions.length
  const someSelected = selected.size > 0 && selected.size < transactions.length

  function toggleAll() {
    setSelected(prev =>
      prev.size === transactions.length ? new Set() : new Set(transactions.map(t => t.id))
    )
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── 일괄 작업 ──
  async function bulkConfirm() {
    if (!confirm(`선택한 ${selected.size}건을 모두 확정 처리할까요?`)) return
    setBulkLoading(true)
    try {
      for (const id of Array.from(selected)) {
        await updateTransactionStatus(id, 'confirmed')
      }
      setSelected(new Set())
      router.refresh()
    } finally {
      setBulkLoading(false)
    }
  }

  async function bulkDeleteAll() {
    if (!confirm(`선택한 ${selected.size}건을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return
    setBulkLoading(true)
    try {
      for (const id of Array.from(selected)) {
        await deleteTransaction(id)
      }
      setSelected(new Set())
      router.refresh()
    } finally {
      setBulkLoading(false)
    }
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n)

  return (
    <>
      {showImport && (
        <ImportResultModal
          participants={participants}
          participantFundingSources={participantFundingSources}
          onClose={() => setShowImport(false)}
          onImported={() => { router.refresh(); setShowImport(false) }}
        />
      )}

      {/* 탭 토글 */}
      <div className="flex gap-2 print:hidden">
        {(['table', 'map'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:ring-zinc-400'
            }`}
          >
            {tab === 'table' ? '📋 목록' : (
              <>🗺️ 지도{mapTransactions.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px]">{mapTransactions.length}</span>
              )}</>
            )}
          </button>
        ))}
      </div>

      {/* ── 지도 탭 ── */}
      {activeTab === 'map' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-400 font-medium">
            장소 정보가 등록된 거래를 지도에서 확인합니다. 같은 장소에 여러 건이 있으면 숫자 핀으로 묶어 표시합니다.
          </p>
          <KakaoMap apiKey={mapApiKey} transactions={mapTransactions} height="520px" />
        </div>
      )}

      {/* ── 목록 탭 ── */}
      {activeTab === 'table' && (
        <>
          {/* 필터 영역 */}
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-hidden print:hidden">
            <div className="p-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-zinc-500 mr-1">필터:</span>
              {[
                { label: '전체보기', value: '' },
                { label: '임시대기', value: 'pending', active: 'bg-orange-500 text-white', inactive: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' },
                { label: '확정됨',   value: 'confirmed', active: 'bg-green-600 text-white', inactive: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' },
              ].map(({ label, value, active, inactive }) => (
                <button
                  key={label}
                  onClick={() => quickFilter('status', value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
                    filters.status === value
                      ? (active || 'bg-zinc-900 text-white')
                      : (inactive || 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')
                  }`}
                >{label}</button>
              ))}

              <div className="w-px h-6 bg-zinc-200 mx-1" />

              <div className="flex items-center gap-1 flex-1 min-w-[180px]">
                <input
                  type="text" value={filters.keyword}
                  onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && applyFilters()}
                  placeholder="🔍 활동명 또는 메모 검색..."
                  className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={applyFilters} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 shrink-0">검색</button>
              </div>

              <div className="flex items-center gap-2 ml-auto shrink-0">
                <button onClick={() => setShowImport(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 print:hidden">📤 CSV 가져오기</button>
                <a
                  href={`/api/export/transactions?${new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))}`}
                  download
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1"
                >📥 CSV</a>
                <button onClick={() => window.print()} className="px-3 py-1.5 bg-zinc-700 text-white rounded-lg text-sm font-bold hover:bg-zinc-900 transition-colors print:hidden">🖨️ 인쇄</button>
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg text-sm font-bold hover:bg-zinc-200">
                  {showAdvanced ? '▲ 닫기' : '▼ 고급 필터'}
                </button>
              </div>
            </div>

            {showAdvanced && (
              <div className="px-4 pb-4 border-t border-zinc-100">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: '당사자', key: 'participant', type: 'select', opts: participants.map(p => ({ value: p.id, label: p.name })) },
                    { label: '분류',   key: 'category',    type: 'select', opts: categories.map(c => ({ value: c, label: c })) },
                    { label: '결제수단', key: 'paymentMethod', type: 'select', opts: paymentMethods.map(p => ({ value: p, label: p })) },
                  ].map(({ label, key, opts }) => (
                    <div key={key}>
                      <label className="block text-xs font-bold text-zinc-500 mb-1">{label}</label>
                      <select
                        value={(filters as any)[key]}
                        onChange={e => setFilters({ ...filters, [key]: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">전체</option>
                        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-1">정렬</label>
                    <select value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">날짜 최신순</option>
                      <option value="date_asc">날짜 오래된순 ↑</option>
                      <option value="amount_desc">금액 높은순 ↓</option>
                      <option value="amount_asc">금액 낮은순 ↑</option>
                      <option value="name_asc">활동명 가나다순 ↑</option>
                      <option value="name_desc">활동명 역순 ↓</option>
                      <option value="category_asc">분류 가나다순 ↑</option>
                      <option value="category_desc">분류 역순 ↓</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-1">시작 날짜</label>
                    <input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-1">종료 날짜</label>
                    <input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={applyFilters} className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors">필터 적용</button>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg font-bold hover:bg-zinc-300 transition-colors">초기화</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 일괄 작업 바 */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 ring-1 ring-blue-200 rounded-xl print:hidden animate-fade-in-up">
              <span className="text-sm font-black text-blue-700">{selected.size}건 선택됨</span>
              <button
                onClick={bulkConfirm}
                disabled={bulkLoading}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-black hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                ✓ 일괄 확정
              </button>
              <button
                onClick={bulkDeleteAll}
                disabled={bulkLoading}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-black hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                🗑 일괄 삭제
              </button>
              {bulkLoading && (
                <span className="text-xs text-blue-600 font-bold animate-pulse">처리 중...</span>
              )}
              <button
                onClick={() => setSelected(new Set())}
                className="ml-auto text-xs text-blue-500 hover:text-blue-700 font-bold"
              >
                선택 해제 ✕
              </button>
            </div>
          )}

          {/* 데이터 테이블 */}
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-hidden print:ring-0 print:shadow-none">
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-sm whitespace-nowrap print:whitespace-normal print:text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold text-[11px] tracking-wider">
                  <tr>
                    {/* 체크박스 열 */}
                    <th className="px-3 py-3 print:hidden w-9">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el: HTMLInputElement | null) => { if (el) el.indeterminate = someSelected }}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                        aria-label="전체 선택"
                      />
                    </th>
                    <th className="px-4 py-3 uppercase">상태</th>
                    <th className="px-4 py-3">
                      <button
                        onClick={() => handleColSort('date')}
                        className="flex items-center uppercase hover:text-zinc-900 transition-colors"
                      >
                        거래일자<SortIcon field="date" />
                      </button>
                    </th>
                    <th className="px-4 py-3 uppercase">당사자</th>
                    <th className="px-4 py-3">
                      <button
                        onClick={() => handleColSort('category')}
                        className="flex items-center uppercase hover:text-zinc-900 transition-colors"
                      >
                        분류<SortIcon field="category" />
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        onClick={() => handleColSort('name')}
                        className="flex items-center uppercase hover:text-zinc-900 transition-colors"
                      >
                        활동 내역<SortIcon field="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleColSort('amount')}
                        className="flex items-center uppercase hover:text-zinc-900 transition-colors ml-auto"
                      >
                        금액<SortIcon field="amount" />
                      </button>
                    </th>
                    <th className="px-4 py-3 uppercase text-center print:hidden">결제수단</th>
                    <th className="px-4 py-3 uppercase print:hidden">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                        <span className="text-4xl mb-3 block">📋</span>
                        조회된 거래 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx: any) => {
                      const isSelected = selected.has(tx.id)
                      return (
                        <tr
                          key={tx.id}
                          className={`hover:bg-zinc-50 transition-colors group ${isSelected ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                        >
                          <td className="px-3 py-3 print:hidden">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOne(tx.id)}
                              className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                              aria-label={`${tx.activity_name} 선택`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {tx.status === 'confirmed' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">확정</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">대기</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">{tx.date}</td>
                          <td className="px-4 py-3 font-medium text-zinc-900">{tx.participant?.name || '알 수 없음'}</td>
                          <td className="px-4 py-3 text-zinc-500">{tx.category || '-'}</td>
                          <td className="px-4 py-3 font-bold text-zinc-900">
                            <div>
                              {tx.activity_name}
                              {tx.memo && <p className="text-xs text-zinc-400 font-normal truncate max-w-[200px]">{tx.memo}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-zinc-900">{fmt(tx.amount)}원</td>
                          <td className="px-4 py-3 text-center text-zinc-500 text-xs print:hidden">{tx.payment_method || '-'}</td>
                          <td className="px-4 py-3 print:hidden">
                            <Link href={`/supporter/transactions/${tx.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-bold underline">
                              상세 및 승인
                            </Link>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
