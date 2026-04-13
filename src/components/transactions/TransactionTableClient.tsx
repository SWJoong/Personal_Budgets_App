'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { MapTransaction } from '@/components/map/KakaoMap'
import ImportResultModal from './ImportResultModal'

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
  participant?: {
    profiles?: { name: string }
    name?: string
  }
}

interface Participant {
  id: string
  name: string
}

interface TransactionTableClientProps {
  transactions: Transaction[]
  participants: Participant[]
  participantFundingSources?: Record<string, { id: string; name: string }[]>
  categories: string[]
  paymentMethods: string[]
  currentFilters: {
    participant?: string
    status?: string
    category?: string
    paymentMethod?: string
    dateFrom?: string
    dateTo?: string
    sort?: string
    keyword?: string
  }
  mapApiKey?: string
  mapTransactions?: MapTransaction[]
}

export default function TransactionTableClient({
  transactions,
  participants,
  participantFundingSources = {},
  categories,
  paymentMethods,
  currentFilters,
  mapApiKey = '',
  mapTransactions = [],
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

  const applyFilters = () => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    router.push(`/supporter/transactions?${params.toString()}`)
  }

  const clearFilters = () => {
    setFilters({
      participant: '', status: '', category: '', paymentMethod: '',
      dateFrom: '', dateTo: '', sort: '', keyword: ''
    })
    router.push('/supporter/transactions')
  }

  const quickFilter = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value }
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    setFilters(newFilters)
    router.push(`/supporter/transactions?${params.toString()}`)
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount)
  }

  return (
    <>
      {/* CSV 임포트 모달 */}
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
        <button
          onClick={() => setActiveTab('table')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'table' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:ring-zinc-400'
          }`}
        >
          📋 목록
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'map' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:ring-zinc-400'
          }`}
        >
          🗺️ 지도
          {mapTransactions.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px]">
              {mapTransactions.length}
            </span>
          )}
        </button>
      </div>

      {/* 지도 탭 */}
      {activeTab === 'map' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-400 font-medium">
            장소 정보가 등록된 거래를 지도에서 확인합니다. 거래 등록 시 장소를 검색하면 이 지도에 표시됩니다.
          </p>
          <KakaoMap
            apiKey={mapApiKey}
            transactions={mapTransactions}
            height="520px"
          />
        </div>
      )}

      {/* 목록 탭 */}
      {activeTab === 'table' && (
      <>
      {/* 필터 영역 */}
      <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-hidden print:hidden">
        {/* 빠른 필터 + 검색 */}
        <div className="p-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-zinc-500 mr-1">필터:</span>

          <button
            onClick={() => quickFilter('status', '')}
            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
              !filters.status ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >전체보기</button>

          <div className="w-px h-6 bg-zinc-200 mx-1" />

          <button
            onClick={() => quickFilter('status', 'pending')}
            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
              filters.status === 'pending' ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >임시대기</button>

          <button
            onClick={() => quickFilter('status', 'confirmed')}
            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
              filters.status === 'confirmed' ? 'bg-green-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >확정됨</button>

          <div className="w-px h-6 bg-zinc-200 mx-1" />

          {/* 키워드 검색 */}
          <div className="flex items-center gap-1 flex-1 min-w-[180px]">
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="🔍 활동명 또는 메모 검색..."
              className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={applyFilters}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 shrink-0"
            >검색</button>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 print:hidden"
              title="카카오뱅크 CSV 가져오기"
            >
              📤 CSV 가져오기
            </button>
            <a
              href={(() => {
                const params = new URLSearchParams()
                Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
                return `/api/export/transactions?${params.toString()}`
              })()}
              download
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1"
              title="현재 필터 기준으로 CSV 다운로드"
            >
              📥 CSV
            </a>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-zinc-700 text-white rounded-lg text-sm font-bold hover:bg-zinc-900 transition-colors flex items-center gap-1 print:hidden"
              title="현재 목록 인쇄 / PDF 저장"
            >
              🖨️ 인쇄
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg text-sm font-bold hover:bg-zinc-200"
            >
              {showAdvanced ? '▲ 닫기' : '▼ 고급 필터'}
            </button>
          </div>
        </div>

        {/* 고급 필터 */}
        {showAdvanced && (
          <div className="px-4 pb-4 border-t border-zinc-100">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
              {/* 당사자 */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">당사자</label>
                <select
                  value={filters.participant}
                  onChange={(e) => setFilters({ ...filters, participant: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체</option>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">분류</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 결제수단 */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">결제수단</label>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체</option>
                  {paymentMethods.map(pm => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>

              {/* 정렬 */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">정렬</label>
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">날짜순 (최신)</option>
                  <option value="amount_asc">금액 오름차순 ↑</option>
                  <option value="amount_desc">금액 내림차순 ↓</option>
                </select>
              </div>

              {/* 시작 날짜 */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">시작 날짜</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 종료 날짜 */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">종료 날짜</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={applyFilters}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
              >필터 적용</button>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg font-bold hover:bg-zinc-300 transition-colors"
                >초기화</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 데이터 테이블 */}
      <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-hidden flex flex-col print:ring-0 print:shadow-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-sm whitespace-nowrap print:whitespace-normal print:text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">거래일자</th>
                <th className="px-4 py-3">당사자</th>
                <th className="px-4 py-3">분류</th>
                <th className="px-4 py-3">활동 내역</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3 text-center print:hidden">결제수단</th>
                <th className="px-4 py-3 print:hidden">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    <span className="text-4xl mb-3 block">📋</span>
                    조회된 거래 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-zinc-50 transition-colors group">
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
                    <td className="px-4 py-3 text-right font-black text-zinc-900">{formatAmount(tx.amount)}원</td>
                    <td className="px-4 py-3 text-center text-zinc-500 text-xs print:hidden">{tx.payment_method || '-'}</td>
                    <td className="px-4 py-3 print:hidden">
                      <Link
                        href={`/supporter/transactions/${tx.id}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-bold underline"
                      >
                        상세 및 승인
                      </Link>
                    </td>
                  </tr>
                ))
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
