'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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

  const amount = is_expense ? rawAmount : -Math.abs(rawAmount)

  let receipt_image_url = null
  let activity_image_url = null

  // 영수증 사진 업로드
  if (receiptFile && receiptFile.size > 0) {
    const fileExt = receiptFile.name.split('.').pop()
    const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, receiptFile)

    if (uploadError) {
      console.error('Receipt Upload Error:', uploadError)
      throw new Error('Failed to upload receipt image')
    }

    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
    receipt_image_url = publicUrl
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
