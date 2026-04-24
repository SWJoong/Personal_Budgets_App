'use client'

import { useState, useRef } from 'react'
import { parseAndMatchFile, importSelectedRows } from '@/app/actions/importTransactions'
import type { ParseAndMatchResult } from '@/app/actions/importTransactions'

interface Participant {
  id: string
  name: string
}

interface FundingSource {
  id: string
  name: string
}

interface Props {
  participants: Participant[]
  participantFundingSources: Record<string, FundingSource[]>
  onClose: () => void
  onImported: () => void
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.abs(n))
}

export default function ImportResultModal({ participants, participantFundingSources, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'select' | 'parsing' | 'result' | 'importing' | 'done'>('select')
  const [selectedParticipant, setSelectedParticipant] = useState(participants.length === 1 ? participants[0].id : '')
  const [selectedFs, setSelectedFs] = useState('')
  const [result, setResult] = useState<ParseAndMatchResult | null>(null)
  const [checkedUnmatched, setCheckedUnmatched] = useState<Set<number>>(new Set())
  const [importCount, setImportCount] = useState(0)
  const [error, setError] = useState('')
  const [xlsxWarning, setXlsxWarning] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const fundingSources = selectedParticipant ? (participantFundingSources[selectedParticipant] || []) : []

  async function processFile(file: File) {
    setError('')
    setStep('parsing')

    try {
      // 파일을 ArrayBuffer → number[] 로 직렬화해서 서버 액션에 전달
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Array.from(new Uint8Array(arrayBuffer))

      const res = await parseAndMatchFile({ buffer, name: file.name }, selectedParticipant)
      setResult(res)
      // 기본값: 출금(지출) 항목만 자동 선택
      setCheckedUnmatched(new Set(
        res.unmatched
          .map((item, i) => item.csvRow.amount > 0 ? i : -1)
          .filter(i => i >= 0)
      ))
      setStep('result')
    } catch (err: any) {
      setError(err.message || '파일 분석 중 오류가 발생했습니다.')
      setStep('select')
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedParticipant) return

    e.target.value = ''

    // .xlsx 파일이면 암호 경고 확인 후 진행
    if (file.name.toLowerCase().endsWith('.xlsx')) {
      setPendingFile(file)
      setXlsxWarning(true)
      return
    }

    await processFile(file)
  }

  async function confirmXlsxWarning() {
    setXlsxWarning(false)
    if (pendingFile) {
      await processFile(pendingFile)
      setPendingFile(null)
    }
  }

  function cancelXlsxWarning() {
    setXlsxWarning(false)
    setPendingFile(null)
  }

  function toggleUnmatched(idx: number) {
    setCheckedUnmatched(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  async function handleImport() {
    if (!result || !selectedParticipant || !selectedFs) return
    const toImport = result.unmatched
      .filter((_, i) => checkedUnmatched.has(i))
      .map(r => r.csvRow)

    if (toImport.length === 0) {
      onClose()
      return
    }

    setStep('importing')
    const res = await importSelectedRows(toImport, selectedParticipant, selectedFs)
    if (res.error) {
      setError(res.error)
      setStep('result')
    } else {
      setImportCount(res.imported)
      setStep('done')
      onImported()
    }
  }

  return (
    <>
    {/* 엑셀 암호 경고 다이얼로그 */}
    {xlsxWarning && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">⚠️</span>
            <div>
              <h3 className="font-bold text-zinc-900 mb-1">엑셀 파일 암호 확인</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                카카오뱅크 엑셀 파일에 <strong>암호가 설정된 경우</strong> 파일을 열 수 없습니다.
              </p>
              <p className="text-sm text-zinc-600 leading-relaxed mt-1">
                암호가 없는 파일이라면 계속 진행하세요. 암호가 있다면 취소 후 엑셀에서 암호를 제거하고 다시 업로드해 주세요.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={cancelXlsxWarning}
              className="flex-1 py-2.5 rounded-xl bg-zinc-100 text-zinc-700 font-bold text-sm hover:bg-zinc-200 transition-colors"
            >
              취소
            </button>
            <button
              onClick={confirmXlsxWarning}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              계속 진행
            </button>
          </div>
        </div>
      </div>
    )}
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-lg font-black text-zinc-900">카카오뱅크 거래내역 가져오기</h2>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">
              카카오뱅크 앱 → 입출금 통장 → 우상단 설정 버튼 → 거래내역 다운로드 → 이메일 전송
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-base font-black transition-colors">✕</button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">

          {/* Step 1: 당사자 + 파일 선택 */}
          {(step === 'select' || step === 'parsing') && (
            <div className="p-6 flex flex-col gap-5">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">{error}</div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">당사자 선택</label>
                <select
                  value={selectedParticipant}
                  onChange={e => { setSelectedParticipant(e.target.value); setSelectedFs('') }}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:outline-none focus:ring-zinc-400"
                >
                  <option value="">당사자를 선택하세요</option>
                  {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className={`flex flex-col gap-2 transition-opacity ${!selectedParticipant ? 'opacity-30 pointer-events-none' : ''}`}>
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">재원 (임포트 시 적용)</label>
                <select
                  value={selectedFs}
                  onChange={e => setSelectedFs(e.target.value)}
                  disabled={!selectedParticipant}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:outline-none focus:ring-zinc-400"
                >
                  <option value="">재원을 선택하세요</option>
                  {fundingSources.map(fs => <option key={fs.id} value={fs.id}>{fs.name}</option>)}
                </select>
              </div>

              <div className={`flex flex-col gap-2 transition-opacity ${!selectedParticipant || !selectedFs ? 'opacity-30 pointer-events-none' : ''}`}>
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">파일 선택 (.xlsx / .csv)</label>
                <label className={`flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                  selectedParticipant && selectedFs
                    ? 'border-blue-300 hover:border-blue-500 bg-blue-50/30'
                    : 'border-zinc-200 bg-zinc-50'
                }`}>
                  {step === 'parsing' ? (
                    <>
                      <div className="w-8 h-8 border-[3px] border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-sm font-bold text-blue-600">파일 분석 중...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl">📂</span>
                      <span className="text-sm font-bold text-zinc-600">클릭하여 파일 선택</span>
                      <span className="text-xs text-zinc-400 text-center">카카오뱅크 거래내역 .xlsx 또는 .csv</span>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFile}
                    disabled={!selectedParticipant || !selectedFs || step === 'parsing'}
                    className="hidden"
                  />
                </label>
              </div>

              {/* 파일 형식 안내 */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 font-medium leading-relaxed">
                <p className="font-bold text-zinc-700 mb-1">카카오뱅크 거래내역 내보내기 방법</p>
                <p>카카오뱅크 앱 → 입출금 통장 → <strong>우상단 설정 버튼(⚙)</strong> → 거래내역 다운로드 → 이메일 전송</p>
                <div className="mt-2 bg-white rounded-lg px-3 py-2 font-mono text-[10px] text-zinc-400">
                  거래일시 | 구분 | 거래금액 | 거래 후 잔액 | 거래구분 | 내용 | 메모<br/>
                  2026.03.05 10:53 | 출금 | -20000 | 440000 | 체크카드결제 | 볼링클럽 | 볼링 활동비
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 결과 */}
          {step === 'result' && result && (
            <div className="p-6 flex flex-col gap-5">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">{error}</div>
              )}

              {/* 요약 배지 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-green-50 border border-green-200 text-center">
                  <p className="text-2xl font-black text-green-700">{result.matched.length}</p>
                  <p className="text-[10px] font-bold text-green-600 mt-0.5">기존 거래 매칭</p>
                </div>
                <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-center">
                  <p className="text-2xl font-black text-orange-700">{result.unmatched.length}</p>
                  <p className="text-[10px] font-bold text-orange-600 mt-0.5">신규 임포트 후보</p>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-center">
                  <p className="text-2xl font-black text-zinc-500">{result.duplicate.length}</p>
                  <p className="text-[10px] font-bold text-zinc-400 mt-0.5">중복 건너뜀</p>
                </div>
              </div>

              {result.parseErrors.length > 0 && (
                <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-xs text-yellow-700">
                  <p className="font-bold mb-1">⚠️ 파싱 오류 ({result.parseErrors.length}건)</p>
                  {result.parseErrors.slice(0, 3).map((e, i) => <p key={i}>{e}</p>)}
                  {result.parseErrors.length > 3 && <p className="text-yellow-500 mt-1">외 {result.parseErrors.length - 3}건...</p>}
                </div>
              )}

              {/* 신규 임포트 후보 */}
              {result.unmatched.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-zinc-700">⚠️ 신규 임포트 후보</h3>
                    <button
                      onClick={() => setCheckedUnmatched(
                        checkedUnmatched.size === result.unmatched.length
                          ? new Set()
                          : new Set(result.unmatched.map((_, i) => i))
                      )}
                      className="text-xs font-bold text-blue-500 hover:text-blue-700"
                    >
                      {checkedUnmatched.size === result.unmatched.length ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 mb-2">체크한 항목만 장부에 등록됩니다 (기본: 지출 항목 자동 선택)</p>
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                    {result.unmatched.map((item, i) => (
                      <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checkedUnmatched.has(i)
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-zinc-50 border-zinc-100 opacity-50'
                      }`}>
                        <input
                          type="checkbox"
                          checked={checkedUnmatched.has(i)}
                          onChange={() => toggleUnmatched(i)}
                          className="w-4 h-4 accent-orange-500 shrink-0"
                        />
                        <span className="text-xs text-zinc-400 font-medium w-[72px] shrink-0">{item.csvRow.date}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-800 truncate">{item.csvRow.description}</p>
                          {item.csvRow.memo && (
                            <p className="text-[10px] text-zinc-400 truncate">{item.csvRow.memo}</p>
                          )}
                        </div>
                        <span className={`text-sm font-black shrink-0 ml-2 ${item.csvRow.amount > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {item.csvRow.amount > 0 ? '−' : '+'}{formatAmount(item.csvRow.amount)}원
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {/* 기존 매칭 */}
              {result.matched.length > 0 && (
                <section>
                  <h3 className="text-sm font-black text-zinc-700 mb-2">✅ 기존 거래 매칭 (참고용)</h3>
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                    {result.matched.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
                        <span className="text-xs text-zinc-400 w-[72px] shrink-0">{item.csvRow.date}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-500 truncate">{item.csvRow.description}</p>
                          <p className="text-[10px] text-green-600 font-bold truncate">→ {item.matchedTxName}</p>
                        </div>
                        <span className="text-sm font-black text-zinc-600 shrink-0 ml-2">{formatAmount(item.csvRow.amount)}원</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 중복 */}
              {result.duplicate.length > 0 && (
                <section>
                  <h3 className="text-sm font-black text-zinc-400 mb-2">🔁 중복 건너뜀</h3>
                  <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1">
                    {result.duplicate.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 opacity-60">
                        <span className="text-xs text-zinc-400 w-[72px] shrink-0">{item.csvRow.date}</span>
                        <span className="flex-1 text-xs text-zinc-500 truncate">{item.csvRow.description}</span>
                        <span className="text-xs font-bold text-zinc-400 ml-2 shrink-0">{formatAmount(item.csvRow.amount)}원</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {result.unmatched.length === 0 && result.matched.length === 0 && result.duplicate.length === 0 && (
                <div className="py-8 text-center text-zinc-400">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-sm font-bold">임포트할 항목이 없습니다.</p>
                  <p className="text-xs mt-1">파일 형식을 확인하거나 다른 파일을 시도하세요.</p>
                </div>
              )}
            </div>
          )}

          {/* 완료 */}
          {step === 'done' && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <span className="text-6xl">✅</span>
              <h3 className="text-xl font-black text-zinc-900">{importCount}건 등록 완료</h3>
              <p className="text-sm text-zinc-400 font-medium">
                거래 내역이 장부에 등록되었습니다.<br/>
                <strong>임시 대기</strong> 상태로 등록되었으니 확인 후 승인해주세요.
              </p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-zinc-100 flex gap-3 shrink-0">
          {step === 'done' ? (
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-bold">
              닫기
            </button>
          ) : step === 'result' ? (
            <>
              <button
                onClick={() => { setResult(null); setStep('select') }}
                className="px-5 py-3 rounded-xl bg-zinc-100 text-zinc-600 font-bold hover:bg-zinc-200 transition-colors"
              >
                ← 다시 선택
              </button>
              <button
                onClick={handleImport}
                disabled={checkedUnmatched.size === 0}
                className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors"
              >
                {checkedUnmatched.size === 0
                  ? '선택한 항목 없음'
                  : `선택한 ${checkedUnmatched.size}건 등록하기`}
              </button>
            </>
          ) : step === 'importing' ? (
            <button disabled className="flex-1 py-3 rounded-xl bg-zinc-200 text-zinc-400 font-bold flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
              등록 중...
            </button>
          ) : (
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-zinc-100 text-zinc-600 font-bold hover:bg-zinc-200">
              취소
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
