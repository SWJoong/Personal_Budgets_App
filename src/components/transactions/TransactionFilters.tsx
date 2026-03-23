'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function TransactionFilters({
  fundingSources
}: {
  fundingSources: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentMonth = searchParams.get('month') || new Date().toISOString().slice(0, 7)
  const currentSource = searchParams.get('sourceId') || 'all'

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
      <div className="flex items-center space-x-2">
        <label htmlFor="month-filter" className="text-sm font-medium text-gray-700">조회 월:</label>
        <input 
          type="month" 
          id="month-filter"
          value={currentMonth}
          onChange={(e) => updateFilters('month', e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="source-filter" className="text-sm font-medium text-gray-700">재원 구분:</label>
        <select 
          id="source-filter"
          value={currentSource}
          onChange={(e) => updateFilters('sourceId', e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">전체보기</option>
          {fundingSources.map(fs => (
            <option key={fs.id} value={fs.id}>{fs.name}</option>
          ))}
        </select>
      </div>
      
      {/* Reset filters */}
      {(searchParams.has('month') || searchParams.has('sourceId')) && (
        <button 
          onClick={() => router.push(pathname)}
          className="text-sm text-gray-500 hover:text-gray-800 underline ml-auto"
        >
          필터 초기화
        </button>
      )}
    </div>
  )
}
