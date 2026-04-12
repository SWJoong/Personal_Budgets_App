"use client"

import { useState, useMemo } from 'react'
import { saveSisAssessment, deleteSisAssessment } from '@/app/actions/sisAssessment'
import { calculateSisA, SIS_SUB_SCALES } from '@/utils/sis-a'
import type { SisSubScale } from '@/utils/sis-a'
import type { SisAssessmentRow } from '@/app/actions/sisAssessment'

interface Props {
  participantId: string
  participantName: string
  onSaved?: (row: SisAssessmentRow) => void
  onCancel?: () => void
}

// ─── 인라인 SVG 라인 차트 (6개 표준점수, 1~20 스케일) ─────────────────────
function SisChart({ scores }: { scores: Record<SisSubScale, number> }) {
  const W = 340, H = 160, PAD_L = 28, PAD_B = 24, PAD_T = 12, PAD_R = 12
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const scales = SIS_SUB_SCALES.map(s => s.key)
  const labels = SIS_SUB_SCALES.map(s => s.label.split(' ')[0]) // 첫 단어만

  const xStep = innerW / (scales.length - 1)
  const yScale = (v: number) => PAD_T + innerH - ((v - 1) / 19) * innerH

  const points = scales.map((k, i) => ({
    x: PAD_L + i * xStep,
    y: yScale(scores[k]),
    v: scores[k],
  }))

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  // 격자선 (y = 5, 10, 15, 20)
  const gridLines = [5, 10, 15, 20].map(v => ({
    y: yScale(v),
    label: v.toString(),
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* 격자 */}
      {gridLines.map(g => (
        <g key={g.label}>
          <line x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y} stroke="#e4e4e7" strokeWidth="1" />
          <text x={PAD_L - 4} y={g.y + 4} textAnchor="end" fontSize="8" fill="#a1a1aa">{g.label}</text>
        </g>
      ))}
      {/* 채워진 영역 */}
      <polygon
        points={`${PAD_L},${PAD_T + innerH} ${polyline} ${PAD_L + (scales.length - 1) * xStep},${PAD_T + innerH}`}
        fill="rgba(59,130,246,0.12)"
      />
      {/* 라인 */}
      <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
      {/* 포인트 + 라벨 */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#3b82f6" strokeWidth="2" />
          <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1d4ed8">{p.v}</text>
          <text x={p.x} y={H - 6} textAnchor="middle" fontSize="8" fill="#71717a">{labels[i]}</text>
        </g>
      ))}
    </svg>
  )
}

// ─── 결과 표시 카드 ────────────────────────────────────────────────────────
function SisResult({ data, onSave, saving, onDelete, hasExisting }:
  { data: ReturnType<typeof calculateSisA>; onSave: () => void; saving: boolean; onDelete?: () => void; hasExisting: boolean }) {
  const stdScores = SIS_SUB_SCALES.reduce((acc, s) => {
    acc[s.key] = data.std[s.key]
    return acc
  }, {} as Record<SisSubScale, number>)

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* 결과 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900 text-white text-center">
          <p className="text-[10px] font-black opacity-60 uppercase tracking-wider mb-1">표준점수 합계</p>
          <p className="text-2xl font-black">{data.totalStd}</p>
        </div>
        <div className="p-4 rounded-2xl bg-blue-600 text-white text-center">
          <p className="text-[10px] font-black opacity-60 uppercase tracking-wider mb-1">지원요구지수</p>
          <p className="text-2xl font-black">{data.indexScore}</p>
        </div>
        <div className="p-4 rounded-2xl bg-blue-50 text-blue-900 text-center">
          <p className="text-[10px] font-black opacity-60 uppercase tracking-wider mb-1">백분위</p>
          <p className="text-2xl font-black">{data.percentile}</p>
        </div>
      </div>

      {/* 차트 */}
      <div className="bg-white rounded-2xl p-4 ring-1 ring-zinc-200">
        <p className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-3">표준점수 프로파일</p>
        <SisChart scores={stdScores} />
      </div>

      {/* 상세 표 */}
      <div className="bg-white rounded-2xl ring-1 ring-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-black text-zinc-400 uppercase tracking-wider">하위 척도 영역</th>
              <th className="px-4 py-2 text-center text-xs font-black text-zinc-400 uppercase tracking-wider">원점수</th>
              <th className="px-4 py-2 text-center text-xs font-black text-zinc-400 uppercase tracking-wider">표준점수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {SIS_SUB_SCALES.map(({ key, label }) => (
              <tr key={key}>
                <td className="px-4 py-2 text-zinc-700"><span className="font-bold text-zinc-400 mr-2">{key}</span>{label}</td>
                <td className="px-4 py-2 text-center text-zinc-600">{/* raw shown in parent */}</td>
                <td className="px-4 py-2 text-center font-black text-blue-700">{data.std[key]}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-50 border-t border-zinc-200">
            <tr>
              <td colSpan={2} className="px-4 py-2 text-xs font-black text-zinc-500 uppercase tracking-wider">표준점수 합계</td>
              <td className="px-4 py-2 text-center font-black text-zinc-900">{data.totalStd}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 저장 버튼 */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-4 rounded-2xl bg-zinc-900 text-white font-black text-base active:scale-95 disabled:bg-zinc-300 transition-all shadow-md"
        >
          {saving ? '저장 중...' : hasExisting ? '💾 이 결과로 저장' : '💾 결과 저장하기'}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-5 py-4 rounded-2xl bg-red-50 text-red-500 font-black hover:bg-red-100 transition-all"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  )
}

// ─── 메인 폼 ───────────────────────────────────────────────────────────────
export default function SisAForm({ participantId, participantName, onSaved, onCancel }: Props) {
  const emptyRaw: Record<SisSubScale, string> = { '2A': '', '2B': '', '2C': '', '2D': '', '2E': '', '2F': '' }

  const [rawInputs, setRawInputs] = useState(emptyRaw)
  const [assessedAt, setAssessedAt] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const allFilled = SIS_SUB_SCALES.every(s => rawInputs[s.key] !== '')

  const result = useMemo(() => {
    if (!allFilled) return null
    const raw = {} as Record<SisSubScale, number>
    for (const s of SIS_SUB_SCALES) {
      raw[s.key] = parseInt(rawInputs[s.key]) || 0
    }
    return calculateSisA(raw)
  }, [rawInputs, allFilled])

  async function handleSave() {
    if (!result) return
    setSaving(true)
    setMessage('')
    try {
      const raw = {} as Record<SisSubScale, number>
      for (const s of SIS_SUB_SCALES) {
        raw[s.key] = parseInt(rawInputs[s.key]) || 0
      }
      const res = await saveSisAssessment(participantId, raw, assessedAt)
      if (res.success && res.data) {
        setMessage('✅ SIS-A 결과가 저장되었습니다.')
        setRawInputs(emptyRaw)
        onSaved?.(res.data)
      } else {
        setMessage('❌ ' + (res.error ?? '저장 실패'))
      }
    } catch (e: any) {
      setMessage('❌ 오류: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-zinc-900">{participantName} 님 SIS-A 평가</p>
          <p className="text-xs text-zinc-400 mt-0.5">원점수 6개 입력 → 표준점수 자동 변환</p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-zinc-400 hover:text-zinc-600 text-sm font-bold">✕ 닫기</button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm font-bold ${
          message.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* 평가일 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-black text-zinc-400 uppercase tracking-wider ml-1">평가일</label>
        <input
          type="date"
          value={assessedAt}
          onChange={e => setAssessedAt(e.target.value)}
          className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none text-sm w-full sm:w-48"
        />
      </div>

      {/* 원점수 입력 */}
      <div className="bg-white rounded-2xl p-5 ring-1 ring-zinc-200">
        <p className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-4">원점수 입력</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SIS_SUB_SCALES.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-zinc-500">
                <span className="text-blue-600 mr-1">{key}</span>{label}
              </label>
              <input
                type="number"
                min={0}
                max={999}
                value={rawInputs[key]}
                onChange={e => setRawInputs(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder="0"
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none text-center text-lg font-black transition-all"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 결과 (모든 항목 입력 시 표시) */}
      {allFilled && result ? (
        <SisResult
          data={result}
          onSave={handleSave}
          saving={saving}
          hasExisting={false}
        />
      ) : (
        <div className="p-4 rounded-2xl bg-zinc-50 text-center text-sm text-zinc-400">
          6개 원점수를 모두 입력하면 표준점수와 지원요구지수가 자동으로 계산됩니다.
        </div>
      )}
    </div>
  )
}
