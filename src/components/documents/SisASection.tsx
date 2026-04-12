"use client"

import { useState } from 'react'
import SisAForm from '@/components/documents/SisAForm'
import { deleteSisAssessment } from '@/app/actions/sisAssessment'
import type { SisAssessmentRow } from '@/app/actions/sisAssessment'
import { SIS_SUB_SCALES } from '@/utils/sis-a'
import type { SisSubScale } from '@/utils/sis-a'

interface Participant { id: string; name?: string }

interface Props {
  participants: Participant[]
  initialAssessments: SisAssessmentRow[]
}

// 간략 SVG 바 차트 (리스트용)
function MiniBarChart({ row }: { row: SisAssessmentRow }) {
  const keys: SisSubScale[] = ['2A', '2B', '2C', '2D', '2E', '2F']
  const stdMap: Record<SisSubScale, number> = {
    '2A': row.std_2a, '2B': row.std_2b, '2C': row.std_2c,
    '2D': row.std_2d, '2E': row.std_2e, '2F': row.std_2f,
  }
  const W = 120, H = 32, barW = 14, gap = 6
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-28 h-8 shrink-0">
      {keys.map((k, i) => {
        const barH = (stdMap[k] / 20) * (H - 4)
        const x = i * (barW + gap)
        return (
          <rect key={k} x={x} y={H - barH} width={barW} height={barH}
            fill="#3b82f6" opacity="0.7" rx="2" />
        )
      })}
    </svg>
  )
}

// 상세 결과 모달
function DetailModal({ row, participantName, onClose, onDelete }: {
  row: SisAssessmentRow
  participantName: string
  onClose: () => void
  onDelete: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('이 SIS-A 평가 기록을 삭제하시겠습니까?')) return
    setDeleting(true)
    await deleteSisAssessment(row.id)
    onDelete()
  }

  const stdMap: Record<SisSubScale, number> = {
    '2A': row.std_2a, '2B': row.std_2b, '2C': row.std_2c,
    '2D': row.std_2d, '2E': row.std_2e, '2F': row.std_2f,
  }
  const rawMap: Record<SisSubScale, number> = {
    '2A': row.raw_2a, '2B': row.raw_2b, '2C': row.raw_2c,
    '2D': row.raw_2d, '2E': row.raw_2e, '2F': row.raw_2f,
  }

  const W = 300, H = 140, PAD_L = 24, PAD_B = 20, PAD_T = 10, PAD_R = 8
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B
  const scales = SIS_SUB_SCALES.map(s => s.key)
  const xStep = innerW / (scales.length - 1)
  const yScale = (v: number) => PAD_T + innerH - ((v - 1) / 19) * innerH
  const points = scales.map((k, i) => ({
    x: PAD_L + i * xStep, y: yScale(stdMap[k as SisSubScale]), v: stdMap[k as SisSubScale],
  }))
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')
  const labels = SIS_SUB_SCALES.map(s => s.label.split(' ')[0])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 flex flex-col gap-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-zinc-900">{participantName} 님</p>
              <p className="text-xs text-zinc-400">
                {new Date(row.assessed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">✕</button>
          </div>

          {/* 요약 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-zinc-900 text-white text-center">
              <p className="text-[9px] font-black opacity-60 uppercase mb-0.5">합계</p>
              <p className="text-xl font-black">{row.total_std}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-600 text-white text-center">
              <p className="text-[9px] font-black opacity-60 uppercase mb-0.5">지원요구지수</p>
              <p className="text-lg font-black leading-tight">{row.index_score}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-900 text-center">
              <p className="text-[9px] font-black opacity-60 uppercase mb-0.5">백분위</p>
              <p className="text-xl font-black">{row.percentile}</p>
            </div>
          </div>

          {/* SVG 차트 */}
          <div className="bg-zinc-50 rounded-2xl p-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2">표준점수 프로파일</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
              {[5,10,15,20].map(v => {
                const y = yScale(v)
                return <g key={v}>
                  <line x1={PAD_L} y1={y} x2={W-PAD_R} y2={y} stroke="#e4e4e7" strokeWidth="1"/>
                  <text x={PAD_L-3} y={y+3} textAnchor="end" fontSize="7" fill="#a1a1aa">{v}</text>
                </g>
              })}
              <polygon points={`${PAD_L},${PAD_T+innerH} ${polyline} ${PAD_L+(scales.length-1)*xStep},${PAD_T+innerH}`} fill="rgba(59,130,246,0.12)"/>
              <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"/>
              {points.map((p,i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke="#3b82f6" strokeWidth="2"/>
                  <text x={p.x} y={p.y-6} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1d4ed8">{p.v}</text>
                  <text x={p.x} y={H-4} textAnchor="middle" fontSize="7" fill="#71717a">{labels[i]}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* 상세 표 */}
          <table className="w-full text-sm ring-1 ring-zinc-200 rounded-xl overflow-hidden">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-black text-zinc-400">영역</th>
                <th className="px-3 py-2 text-center text-xs font-black text-zinc-400">원점수</th>
                <th className="px-3 py-2 text-center text-xs font-black text-zinc-400">표준점수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {SIS_SUB_SCALES.map(({ key, label }) => (
                <tr key={key}>
                  <td className="px-3 py-2 text-zinc-700"><span className="text-zinc-400 font-bold mr-1.5">{key}</span>{label}</td>
                  <td className="px-3 py-2 text-center text-zinc-600">{rawMap[key]}</td>
                  <td className="px-3 py-2 text-center font-black text-blue-700">{stdMap[key]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 삭제 */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-black text-sm hover:bg-red-100 transition-all disabled:opacity-50"
          >
            {deleting ? '삭제 중...' : '🗑️ 이 기록 삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SisASection({ participants, initialAssessments }: Props) {
  const [selectedParticipantId, setSelectedParticipantId] = useState(participants[0]?.id ?? '')
  const [assessments, setAssessments] = useState(initialAssessments)
  const [showForm, setShowForm] = useState(false)
  const [detailRow, setDetailRow] = useState<SisAssessmentRow | null>(null)

  const selectedParticipant = participants.find(p => p.id === selectedParticipantId)

  const myAssessments = assessments
    .filter(a => a.participant_id === selectedParticipantId)
    .sort((a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime())

  function handleSaved(row: SisAssessmentRow) {
    setAssessments(prev => [row, ...prev])
    setShowForm(false)
  }

  if (participants.length === 0) {
    return <div className="p-6 rounded-2xl bg-zinc-50 text-center text-sm text-zinc-400">담당 당사자가 없습니다.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 상세 모달 */}
      {detailRow && selectedParticipant && (
        <DetailModal
          row={detailRow}
          participantName={selectedParticipant.name ?? ''}
          onClose={() => setDetailRow(null)}
          onDelete={() => {
            setAssessments(prev => prev.filter(a => a.id !== detailRow.id))
            setDetailRow(null)
          }}
        />
      )}

      {/* 헤더 컨트롤 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedParticipantId}
          onChange={e => { setSelectedParticipantId(e.target.value); setShowForm(false) }}
          className="px-3 py-2 rounded-xl bg-white ring-1 ring-zinc-200 text-sm font-bold focus:ring-zinc-900 focus:outline-none"
        >
          {participants.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <button
          onClick={() => setShowForm(v => !v)}
          className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
            showForm ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-900 text-white hover:bg-zinc-700'
          }`}
        >
          {showForm ? '✕ 입력 취소' : '+ 새 평가 입력'}
        </button>
      </div>

      {/* 새 평가 입력 폼 */}
      {showForm && selectedParticipant && (
        <div className="p-5 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200">
          <SisAForm
            participantId={selectedParticipantId}
            participantName={selectedParticipant.name ?? ''}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* 기록 목록 */}
      {!showForm && (
        myAssessments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-50 text-center text-sm text-zinc-400">
            {selectedParticipant?.name} 님의 SIS-A 평가 기록이 없습니다.<br />
            <span className="text-xs">"새 평가 입력" 버튼을 눌러 첫 번째 평가를 기록하세요.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {myAssessments.map(row => (
              <button
                key={row.id}
                onClick={() => setDetailRow(row)}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all text-left w-full"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-zinc-900">
                    {new Date(row.assessed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    합계 {row.total_std} · 지수 {row.index_score} · 백분위 {row.percentile}%
                  </p>
                </div>
                <MiniBarChart row={row} />
                <span className="text-zinc-300 text-lg shrink-0">›</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
