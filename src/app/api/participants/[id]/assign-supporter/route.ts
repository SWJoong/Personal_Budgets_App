import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// PATCH: 지원자 배정
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { supporter_id } = body

    const { data, error } = await supabase
      .from('participants')
      .update({
        assigned_supporter_id: supporter_id,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error assigning supporter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
