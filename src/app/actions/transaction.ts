'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { revalidatePath } from 'next/cache'

export async function createTransaction(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
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
  const date = formData.get('date') as string
  const description = formData.get('description') as string
  const category = formData.get('category') as string
  const memo = formData.get('memo') as string
  const status = formData.get('status') as 'pending' | 'confirmed'
  const is_expense = formData.get('is_expense') === 'true'

  // If it's an income, save as negative amount so that calculation adds to balance
  const amount = is_expense ? rawAmount : -Math.abs(rawAmount)

  const { error } = await (supabase.from('transactions') as any)
    .insert({
      participant_id,
      creator_id: user.id, // Maps to supporter_id logic
      funding_source_id,
      amount,
      date,
      activity_name: description, // Mapping front-end's 'description' to DB's 'activity_name'
      category,
      memo: memo || null,
      status: status || 'pending'
      // No is_expense field in DB
    })

  if (error) {
    console.error('Insert Error:', error)
    throw new Error('Failed to create transaction')
  }

  // Refetch the data grid layout
  revalidatePath(`/supporter/${participant_id}/transactions`)
  return { success: true }
}

export async function updateTransactionStatus(transactionId: string, newStatus: 'pending' | 'confirmed') {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
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

  const { error } = await (supabase.from('transactions') as any)
    .update({ status: newStatus })
    .eq('id', transactionId)

  if (error) {
    console.error('Update Status Error:', error)
    throw new Error('Failed to update transaction status')
  }

  return { success: true }
}
