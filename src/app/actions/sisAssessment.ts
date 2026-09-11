'use server'

import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'
import { calculateSisA, type SisSubScale } from '@/utils/sis-a'

/**
 * SIS-A 지원요구척도 기록 (관리자 QA #9 부활).
 *
 * 설계출처: Plan&Source/goala_sis_a_revival_W.md.
 * 채점 로직 src/utils/sis-a.ts(calculateSisA)는 서울 리빌드에서 생존했으나 저장 테이블·
 * 기록 UI 는 유실됐다 — 이 액션이 저장/조회 배선을 되살린다.
 *
 * 사정성 정보라 실무자·관리자만 기록한다(assertStaff 로 먼저 걸러 당사자에겐 쉬운 말 에러를 준다).
 * created_by 는 서울 규약대로 profiles(id) 를 참조하는 현재 로그인 담당자로 기록한다.
 * DB 슬라이스: supabase/seoul/18_sis_assessments.sql (병렬 워커, Manual-Ops).
 * ★ supabase 클라이언트는 untyped 라 .from('sis_assessments') 가 타입 재생성 없이 통과한다.
 */

// 목록 행 — 손으로 적은 인터페이스(untyped 클라이언트 반환을 좁힌다).
// ('use server' 파일이라 값 export 는 전부 async 여야 한다 → 이 타입은 export 하지 않는다.)
interface SisAssessmentRow {
  id: string
  assessed_at: string
  total_std: number
  index_score: string
  percentile: string
}

/**
 * SIS-A 기록 저장 — 담당자 전용.
 * 6개 하위척도 원점수(raw)를 받아 calculateSisA 로 표준점수·합계·지수·백분위를 산출해 함께 저장한다.
 */
export async function saveSisAssessment(input: {
  participantId: string
  raw: Record<SisSubScale, number>
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const { supabase, user } = await assertStaff()

    const r = calculateSisA(input.raw)

    const { error } = await supabase.from('sis_assessments').insert({
      participant_id: input.participantId,
      raw_2a: input.raw['2A'],
      raw_2b: input.raw['2B'],
      raw_2c: input.raw['2C'],
      raw_2d: input.raw['2D'],
      raw_2e: input.raw['2E'],
      raw_2f: input.raw['2F'],
      std_2a: r.std['2A'],
      std_2b: r.std['2B'],
      std_2c: r.std['2C'],
      std_2d: r.std['2D'],
      std_2e: r.std['2E'],
      std_2f: r.std['2F'],
      total_std: r.totalStd,
      index_score: r.indexScore,
      percentile: r.percentile,
      created_by: user.id,
    })

    if (error) return { error: `SIS-A 기록 저장 실패: ${friendlyDbError(error)}` }

    revalidatePath(`/supporter/${input.participantId}/sis`)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/**
 * 참여자별 SIS-A 기록 목록(최신순). 담당·관리자·본인 열람(RLS seoul_can_access), 기록은 담당만.
 */
export async function getSisAssessments(
  participantId: string
): Promise<{ assessments: SisAssessmentRow[]; error?: string }> {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('sis_assessments')
      .select('id, assessed_at, total_std, index_score, percentile')
      .eq('participant_id', participantId)
      .order('assessed_at', { ascending: false })

    if (error) return { error: error.message, assessments: [] as SisAssessmentRow[] }
    return { assessments: (data ?? []) as SisAssessmentRow[] }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : '오류가 발생했습니다.',
      assessments: [] as SisAssessmentRow[],
    }
  }
}
