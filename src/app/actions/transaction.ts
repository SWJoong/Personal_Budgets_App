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

  // If it's an income, save as negative amount so that calculation adds to balance
  const amount = is_expense ? rawAmount : -Math.abs(rawAmount)

  let receipt_image_url = null

  // Handle receipt image upload
  if (receiptFile && receiptFile.size > 0) {
    const fileExt = receiptFile.name.split('.').pop()
    const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, receiptFile)

    if (uploadError) {
      console.error('Upload Error:', uploadError)
      // Non-critical: continue without image if upload fails? 
      // Or fail the whole thing? Let's fail for now to be safe.
      throw new Error('Failed to upload receipt image')
    }

    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(filePath)
    
    receipt_image_url = publicUrl
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
    receipt_image_url
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
