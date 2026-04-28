'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculateSisA } from '@/utils/sis-a'
import type { SisSubScale } from '@/utils/sis-a'

export interface SisAssessmentRow {
  id: string
  participant_id: string
  assessed_at: string
  raw_2a: number; raw_2b: number; raw_2c: number
  raw_2d: number; raw_2e: number; raw_2f: number
  std_2a: number; std_2b: number; std_2c: number
  std_2d: number; std_2e: number; std_2f: number
  total_std: number
  index_score: string
  percentile: string
  creator_id: string | null
  created_at: string
}

/** 평가 저장 — 원점수만 받아서 서버에서 계산 후 저장 */
export async function saveSisAssessment(
  participantId: string,
  rawScores: Record<SisSubScale, number>,
  assessedAt?: string
): Promise<{ success: boolean; data?: SisAssessmentRow; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { success: false, error: '권한이 없습니다.' }
  }

  const { std, totalStd, indexScore, percentile } = calculateSisA(rawScores)

  const { data, error } = await supabase
    .from('sis_assessments')
    .insert({
      participant_id: participantId,
      assessed_at: assessedAt ?? new Date().toISOString(),
      raw_2a: rawScores['2A'], raw_2b: rawScores['2B'], raw_2c: rawScores['2C'],
      raw_2d: rawScores['2D'], raw_2e: rawScores['2E'], raw_2f: rawScores['2F'],
      std_2a: std['2A'], std_2b: std['2B'], std_2c: std['2C'],
      std_2d: std['2D'], std_2e: std['2E'], std_2f: std['2F'],
      total_std: totalStd,
      index_score: indexScore,
      percentile,
      creator_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('saveSisAssessment error:', error)
    return { success: false, error: '저장에 실패했습니다.' }
  }

  revalidatePath('/supporter/documents')
  return { success: true, data: data as SisAssessmentRow }
}

/** 당사자별 SIS-A 평가 목록 */
export async function getSisAssessments(participantId: string): Promise<SisAssessmentRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sis_assessments')
    .select('*')
    .eq('participant_id', participantId)
    .order('assessed_at', { ascending: false })

  if (error) {
    console.warn('getSisAssessments error:', error.message)
    return []
  }
  return (data || []) as SisAssessmentRow[]
}

/** 전체 당사자 SIS-A 평가 목록 (서류 보관함 목록용) */
export async function getAllSisAssessments(): Promise<SisAssessmentRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sis_assessments')
    .select('*')
    .order('assessed_at', { ascending: false })

  if (error) {
    console.warn('getAllSisAssessments — 조회 실패 (migration 전일 수 있음):', error.message)
    return []
  }
  return (data || []) as SisAssessmentRow[]
}

/** 평가 삭제 */
export async function deleteSisAssessment(id: string): Promise<{ success: boolean; error?: string }> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return { success: false, error: '데모 모드에서는 삭제할 수 없습니다.' }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { success: false, error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('sis_assessments')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: '삭제에 실패했습니다.' }

  revalidatePath('/supporter/documents')
  return { success: true }
}
