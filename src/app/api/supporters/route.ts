import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// GET: 지원자 목록 조회
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 관리자 또는 지원자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 지원자 및 관리자 목록 조회
    const { data: supporters, error } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .in('role', ['admin', 'supporter'])
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(supporters || [])
  } catch (error) {
    console.error('Error fetching supporters:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
