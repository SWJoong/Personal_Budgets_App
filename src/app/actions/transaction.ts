'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { revalidatePath } from 'next/cache'

export async function createTransaction(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  // Get current user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const participant_id = formData.get('participant_id') as string
  const funding_source_id = formData.get('funding_source_id') as string
  const rawAmount = Number(formData.get('amount'))
  const date = (formData.get('date') as string) || new Date().toISOString().split('T')[0]
  const description = formData.get('description') as string
  const category = (formData.get('category') as string) || '기타'
  const memo = formData.get('memo') as string
  const status = (formData.get('status') as 'pending' | 'confirmed') || 'pending'
  const is_expense = formData.get('is_expense') !== 'false' // Default to true
  const receiptFile = formData.get('receipt') as File | null
  const activityFile = formData.get('activity_image') as File | null

  // If it's an income, save as negative amount so that calculation adds to balance
  const amount = is_expense ? rawAmount : -Math.abs(rawAmount)

  let receipt_image_url = null
  let activity_image_url = null

  // Handle receipt image upload (optional)
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

    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName)

    receipt_image_url = publicUrl
  }

  // Handle activity image upload (optional, max 1 photo)
  if (activityFile && activityFile.size > 0) {
    const fileExt = activityFile.name.split('.').pop()
    const fileName = `activity-${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, activityFile)

    if (uploadError) {
      console.error('Activity Image Upload Error:', uploadError)
      throw new Error('Failed to upload activity image')
    }

    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName)

    activity_image_url = publicUrl
  }

  const { error } = await supabase.from('transactions').insert({
    participant_id,
    creator_id: user.id,
    funding_source_id,
    amount,
    date,
    activity_name: description,
    category,
    memo: memo || null,
    status: status,
    receipt_image_url,
    activity_image_url,
  })

  if (error) {
    console.error('Insert Error:', error)
    throw new Error('Failed to create transaction')
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath(`/supporter/${participant_id}/transactions`)
  return { success: true }
}

export async function updateTransactionStatus(transactionId: string, newStatus: 'pending' | 'confirmed') {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { error } = await supabase.from('transactions').update({ status: newStatus }).eq('id', transactionId)

  if (error) {
    console.error('Update Status Error:', error)
    throw new Error('Failed to update transaction status')
  }

  return { success: true }
}

export async function deleteTransaction(transactionId: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
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
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
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
