import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// POST: 재원 생성
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 사용자 역할 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { participant_id, name, monthly_budget, description } = body

    if (!participant_id || !name || monthly_budget === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: participant_id, name, monthly_budget' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('funding_sources')
      .insert({
        participant_id,
        name,
        monthly_budget,
        description,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating funding source:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
