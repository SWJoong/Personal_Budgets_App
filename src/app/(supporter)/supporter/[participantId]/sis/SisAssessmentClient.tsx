'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SIS_SUB_SCALES, calculateSisA, type SisSubScale } from '@/utils/sis-a'
import { saveSisAssessment } from '@/app/actions/sisAssessment'
import { formatDate } from '@/utils/formatDate'

/**
 * SIS-A 지원요구척도 기록 화면(실무자) — 관리자 QA #9 부활.
 * 설계출처: Plan&Source/goala_sis_a_revival_W.md · 계약: SisAssessmentClient.test.tsx.
 *
 * 6개 하위척도 원점수를 적으면 순수 계산(calculateSisA)이라 입력 즉시 표준점수·지원요구지수·
 * 백분위를 미리 보여주고, 저장 시 액션에 원점수(raw)를 넘긴다. 아래는 지난 기록 목록.
 */

interface SisRow {
  id: string
  assessed_at: string
  total_std: number
  index_score: string
  percentile: string
}

const EMPTY_RAW: Record<SisSubScale, string> = {
  '2A': '',
  '2B': '',
  '2C': '',
  '2D': '',
  '2E': '',
  '2F': '',
}

export default function SisAssessmentClient({
  participantId,
  assessments,
}: {
  participantId: string
  assessments: SisRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [rawInput, setRawInput] = useState<Record<SisSubScale, string>>(EMPTY_RAW)

  // 원점수 문자열 → 숫자(빈칸→0). 순수 계산이라 렌더마다 실시간으로 미리 계산한다.
  const raw: Record<SisSubScale, number> = {
    '2A': Number(rawInput['2A']) || 0,
    '2B': Number(rawInput['2B']) || 0,
    '2C': Number(rawInput['2C']) || 0,
    '2D': Number(rawInput['2D']) || 0,
    '2E': Number(rawInput['2E']) || 0,
    '2F': Number(rawInput['2F']) || 0,
  }
  const result = calculateSisA(raw)
  // 6개를 모두 적었을 때만 지수 미리보기 — 일부만 적은 지수는 오해를 부른다.
  const allEntered = SIS_SUB_SCALES.every((s) => rawInput[s.key].trim() !== '')

  function setScore(key: SisSubScale, value: string) {
    setRawInput((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    if (!allEntered) {
      setError('6개 영역 점수를 모두 적어 주세요.')
      return
    }
    setError('')
    startTransition(async () => {
      const res = await saveSisAssessment({ participantId, raw })
      if (res.error) {
        setError(res.error)
        return
      }
      setRawInput(EMPTY_RAW)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium leading-relaxed"
        >
          {error}
        </div>
      )}

      {/* 새 기록 — 원점수 입력 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-bold text-muted-foreground">원점수 적기</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          6개 영역의 원점수를 적으면 지원요구지수와 백분위를 바로 계산해서 보여줘요.
        </p>

        <div className="flex flex-col gap-3">
          {SIS_SUB_SCALES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden="true"
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-border text-muted-foreground shrink-0"
                >
                  {s.key}
                </span>
                {/* 접근명 = 하위척도 라벨 정확일치(계약). 미리보기·배지는 라벨 밖에 둔다. */}
                <label htmlFor={`sis-${s.key}`} className="text-base font-bold text-foreground leading-relaxed truncate">
                  {s.label}
                </label>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {rawInput[s.key].trim() !== '' && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">표준 {result.std[s.key]}</span>
                )}
                <input
                  id={`sis-${s.key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={rawInput[s.key]}
                  onChange={(e) => setScore(s.key, e.target.value)}
                  className="w-24 p-3 rounded-xl bg-muted ring-1 ring-border text-foreground text-right font-bold min-h-[44px]"
                />
              </div>
            </div>
          ))}
        </div>

        {/* 실시간 미리보기 — 값은 각각 제 요소에 담는다(계약: 지수·백분위 단일 텍스트). */}
        {allEntered && (
          <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card ring-1 ring-border">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">표준점수 합계</span>
              <span className="text-base font-bold text-foreground">{result.totalStd}</span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
              <span className="text-sm text-muted-foreground">지원요구지수</span>
              <span className="text-2xl font-bold text-foreground">{result.indexScore}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">백분위</span>
              <span className="text-base font-bold text-foreground">{result.percentile}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={pending || !allEntered}
          className="p-4 rounded-2xl bg-hero text-hero-foreground font-bold text-base hover:bg-hero-hover transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px]"
        >
          {pending ? '기록하고 있어요...' : 'SIS-A 기록 저장'}
        </button>
      </section>

      {/* 지난 기록 */}
      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold text-muted-foreground">지난 SIS-A 기록</h2>
        {assessments.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center leading-relaxed">
            아직 기록이 없어요.
            <br />
            위에서 원점수를 적고 저장해 주세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {assessments.map((a) => (
              <li key={a.id} className="p-4 rounded-2xl bg-muted ring-1 ring-border flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">{formatDate(a.assessed_at)}</span>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">지원요구지수</span>
                    <span className="text-lg font-bold text-foreground">{a.index_score}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end">
                    <span className="text-xs text-muted-foreground">백분위</span>
                    <span className="text-lg font-bold text-foreground">{a.percentile}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
