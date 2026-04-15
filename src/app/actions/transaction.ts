'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ParticipantWithFundingSources {
  id: string
  name: string
  funding_sources: { id: string; name: string }[]
}

export async function getParticipantsWithFundingSources(): Promise<ParticipantWithFundingSources[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let query = supabase
    .from('participants')
    .select('id, name, funding_sources ( id, name )')

  if (profile?.role === 'supporter') {
    query = query.eq('assigned_supporter_id', user.id)
  }

  const { data } = await query
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name || p.id.slice(0, 8),
    funding_sources: p.funding_sources || [],
  }))
}

export async function createTransaction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 당사자는 profiles 테이블에 행이 없으므로 creator_id FK 위반 방지
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()
  const creator_id = profile ? user.id : null

  const participant_id = formData.get('participant_id') as string
  const funding_source_id = formData.get('funding_source_id') as string
  const rawAmount = Number(formData.get('amount'))
  const date = (formData.get('date') as string) || new Date().toISOString().split('T')[0]
  const description = formData.get('description') as string
  const category = (formData.get('category') as string) || '기타'
  const memo = formData.get('memo') as string
  const status = (formData.get('status') as 'pending' | 'confirmed') || 'pending'
  const is_expense = formData.get('is_expense') !== 'false'
  const payment_method = (formData.get('payment_method') as string) || '체크카드'
  const receiptFile = formData.get('receipt') as File | null
  const activityFile = formData.get('activity_image') as File | null
  const place_name = (formData.get('place_name') as string) || null
  const place_lat = formData.get('place_lat') ? Number(formData.get('place_lat')) : null
  const place_lng = formData.get('place_lng') ? Number(formData.get('place_lng')) : null

  const amount = is_expense ? rawAmount : -Math.abs(rawAmount)

  let receipt_image_url = null
  let activity_image_url = null

  // 영수증 사진 업로드 (실패해도 거래 저장은 진행)
  if (receiptFile && receiptFile.size > 0) {
    const fileExt = (receiptFile.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, receiptFile)
    if (uploadError) {
      console.error('Receipt Upload Error:', uploadError)
    } else {
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
      receipt_image_url = publicUrl
    }
  }

  // 활동 사진 업로드
  if (activityFile && activityFile.size > 0) {
    const fileExt = activityFile.name.split('.').pop()
    const fileName = `${participant_id}/${Date.now()}-activity.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('activity-photos')
      .upload(fileName, activityFile)

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('activity-photos')
        .getPublicUrl(fileName)
      activity_image_url = publicUrl
    } else {
      console.error('Activity photo upload error:', uploadError)
      // 활동사진 실패해도 거래 자체는 저장 진행
    }
  }

  const { error } = await supabase.from('transactions').insert({
    participant_id,
    creator_id,
    funding_source_id,
    amount,
    date,
    activity_name: description,
    category,
    memo: memo || null,
    status,
    receipt_image_url,
    activity_image_url,
    payment_method,
    place_name,
    place_lat,
    place_lng,
  })

  if (error) {
    console.error('Insert Error:', error)
    throw new Error('Failed to create transaction')
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/receipt')
  revalidatePath('/plan')
  revalidatePath(`/supporter/${participant_id}/transactions`)
  revalidatePath('/supporter/transactions')
  revalidatePath(`/admin/participants/${participant_id}`)
  revalidatePath(`/admin/participants/${participant_id}/preview`)
  return { success: true }
}

export async function updateTransactionStatus(transactionId: string, newStatus: 'pending' | 'confirmed') {
  const supabase = await createClient()

  const { error } = await supabase
    .from('transactions')
    .update({ status: newStatus })
    .eq('id', transactionId)

  if (error) {
    console.error('Update Status Error:', error)
    throw new Error('Failed to update transaction status')
  }

  return { success: true }
}

export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)

  if (error) {
    console.error('Delete Error:', error)
    throw new Error('Failed to delete transaction')
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true }
}

export async function updateTransactionDetail(
  transactionId: string,
  updates: {
    activity_name: string
    amount: number
    date: string
    category: string | null
    memo: string | null
    payment_method: string | null
    status: 'pending' | 'confirmed'
    place_name?: string | null
    place_lat?: number | null
    place_lng?: number | null
  },
  oldStatus: 'pending' | 'confirmed',
  oldAmount: number,
  fundingSourceId: string | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', transactionId)
  if (error) throw new Error('Failed to update transaction')

  if (fundingSourceId) {
    const { data: fs } = await supabase
      .from('funding_sources')
      .select('current_month_balance, current_year_balance')
      .eq('id', fundingSourceId)
      .single()

    if (fs) {
      let monthAdj = 0
      let yearAdj = 0
      if (oldStatus === 'confirmed' && updates.status === 'confirmed') {
        monthAdj = oldAmount - updates.amount
        yearAdj = oldAmount - updates.amount
      } else if (oldStatus === 'pending' && updates.status === 'confirmed') {
        monthAdj = -updates.amount
        yearAdj = -updates.amount
      } else if (oldStatus === 'confirmed' && updates.status === 'pending') {
        monthAdj = oldAmount
        yearAdj = oldAmount
      }
      if (monthAdj !== 0 || yearAdj !== 0) {
        await supabase
          .from('funding_sources')
          .update({
            current_month_balance: Number(fs.current_month_balance) + monthAdj,
            current_year_balance: Number(fs.current_year_balance) + yearAdj,
          })
          .eq('id', fundingSourceId)
      }
    }
  }

  revalidatePath('/supporter/transactions')
  revalidatePath('/')
  return { success: true }
}

export async function deleteTransactionWithBalance(transactionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: tx } = await supabase
    .from('transactions')
    .select('status, amount, funding_source_id')
    .eq('id', transactionId)
    .single()

  if (tx?.status === 'confirmed' && tx.funding_source_id) {
    const { data: fs } = await supabase
      .from('funding_sources')
      .select('current_month_balance, current_year_balance')
      .eq('id', tx.funding_source_id)
      .single()
    if (fs) {
      await supabase
        .from('funding_sources')
        .update({
          current_month_balance: Number(fs.current_month_balance) + Number(tx.amount),
          current_year_balance: Number(fs.current_year_balance) + Number(tx.amount),
        })
        .eq('id', tx.funding_source_id)
    }
  }

  const { error } = await supabase.from('transactions').delete().eq('id', transactionId)
  if (error) throw new Error('Failed to delete transaction')

  revalidatePath('/supporter/transactions')
  revalidatePath('/')
  return { success: true }
}

export async function updateTransaction(
  transactionId: string,
  updates: {
    amount?: number
    date?: string
    activity_name?: string
    category?: string
    memo?: string | null
    status?: 'pending' | 'confirmed'
    funding_source_id?: string
    place_name?: string | null
    place_lat?: number | null
    place_lng?: number | null
  }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', transactionId)

  if (error) {
    console.error('Update Error:', error)
    throw new Error('Failed to update transaction')
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true }
}

/**
 * 거래에 영수증/활동사진 업로드 및 URL 저장
 */
export async function updateTransactionImages(
  transactionId: string,
  participantId: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string; receipt_image_url?: string; activity_image_url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const receiptFile = formData.get('receipt') as File | null
  const activityFile = formData.get('activity_image') as File | null

  const imageUpdates: { receipt_image_url?: string; activity_image_url?: string } = {}

  if (receiptFile && receiptFile.size > 0) {
    const fileExt = (receiptFile.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, receiptFile)
    if (uploadError) {
      return { error: `영수증 업로드 실패: ${uploadError.message}` }
    }
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
    imageUpdates.receipt_image_url = publicUrl
  }

  if (activityFile && activityFile.size > 0) {
    const fileExt = (activityFile.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${participantId}/${Date.now()}-activity.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('activity-photos')
      .upload(fileName, activityFile)
    if (uploadError) {
      return { error: `활동사진 업로드 실패: ${uploadError.message}` }
    }
    const { data: { publicUrl } } = supabase.storage
      .from('activity-photos')
      .getPublicUrl(fileName)
    imageUpdates.activity_image_url = publicUrl
  }

  if (Object.keys(imageUpdates).length === 0) {
    return { error: '업로드할 파일이 없습니다.' }
  }

  const { error } = await supabase
    .from('transactions')
    .update(imageUpdates)
    .eq('id', transactionId)

  if (error) return { error: `저장 실패: ${error.message}` }

  revalidatePath(`/supporter/transactions/${transactionId}`)
  revalidatePath('/supporter/transactions')
  return { success: true, ...imageUpdates }
}
