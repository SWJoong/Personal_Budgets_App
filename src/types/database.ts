export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'supporter' | 'participant'

// supabase/seoul/01_core.sql 과 대응. 서울형 26개 테이블은 규모가 커서
// 여기 손으로 옮기지 않는다 — 실제 Supabase 프로젝트가 생기면
// `npm run generate-types` 로 다시 생성한다.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          is_super_admin: boolean
          name: string | null
          full_name: string | null
          email: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          is_super_admin?: boolean
          name?: string | null
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          is_super_admin?: boolean
          name?: string | null
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          name: string
          email: string | null
          auth_user_id: string | null
          birth_date: string | null
          disability_type: string | null
          support_grade: string | null
          assigned_supporter_id: string | null
          ui_preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          auth_user_id?: string | null
          birth_date?: string | null
          disability_type?: string | null
          support_grade?: string | null
          assigned_supporter_id?: string | null
          ui_preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          auth_user_id?: string | null
          birth_date?: string | null
          disability_type?: string | null
          support_grade?: string | null
          assigned_supporter_id?: string | null
          ui_preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Participant = Database['public']['Tables']['participants']['Row']
