export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'supporter' | 'participant'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          name: string | null
          avatar_url: string | null
          bio: string | null
          onboarding_completed: boolean
          created_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          name?: string | null
          avatar_url?: string | null
          bio?: string | null
          onboarding_completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          name?: string | null
          avatar_url?: string | null
          bio?: string | null
          onboarding_completed?: boolean
          created_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          monthly_budget_default: number
          yearly_budget_default: number
          budget_start_date: string | null
          budget_end_date: string | null
          funding_source_count: number
          alert_threshold: number
          assigned_supporter_id: string | null
          bank_book_copy_url: string | null
          bank_cover_url: string | null
          ui_preferences: Json | null
          created_at: string
        }
        Insert: {
          id: string
          monthly_budget_default?: number
          yearly_budget_default?: number
          budget_start_date?: string | null
          budget_end_date?: string | null
          funding_source_count?: number
          alert_threshold?: number
          assigned_supporter_id?: string | null
          bank_book_copy_url?: string | null
          bank_cover_url?: string | null
          ui_preferences?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          monthly_budget_default?: number
          yearly_budget_default?: number
          budget_start_date?: string | null
          budget_end_date?: string | null
          funding_source_count?: number
          alert_threshold?: number
          assigned_supporter_id?: string | null
          bank_book_copy_url?: string | null
          bank_cover_url?: string | null
          ui_preferences?: Json | null
          created_at?: string
        }
      }
      funding_sources: {
        Row: {
          id: string
          participant_id: string
          name: string
          monthly_budget: number
          yearly_budget: number
          current_month_balance: number
          current_year_balance: number
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          name: string
          monthly_budget: number
          yearly_budget: number
          current_month_balance: number
          current_year_balance: number
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          name?: string
          monthly_budget?: number
          yearly_budget?: number
          current_month_balance?: number
          current_year_balance?: number
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          participant_id: string
          funding_source_id: string
          date: string
          activity_name: string
          amount: number
          category: string | null
          memo: string | null
          payment_method: string | null
          receipt_image_url: string | null
          status: 'pending' | 'confirmed'
          creator_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          funding_source_id: string
          date?: string
          activity_name: string
          amount: number
          category?: string | null
          memo?: string | null
          payment_method?: string | null
          receipt_image_url?: string | null
          status?: 'pending' | 'confirmed'
          creator_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          funding_source_id?: string
          date?: string
          activity_name?: string
          amount?: number
          category?: string | null
          memo?: string | null
          payment_method?: string | null
          receipt_image_url?: string | null
          status?: 'pending' | 'confirmed'
          creator_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      file_links: {
        Row: {
          id: string
          participant_id: string
          title: string
          url: string
          file_type: '계획서' | '평가서' | '참고자료' | '증빙자료' | '기타'
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          title: string
          url: string
          file_type: '계획서' | '평가서' | '참고자료' | '증빙자료' | '기타'
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          title?: string
          url?: string
          file_type?: '계획서' | '평가서' | '참고자료' | '증빙자료' | '기타'
          created_at?: string
        }
      }
      care_plans: {
        Row: {
          id: string
          participant_id: string
          plan_type: string
          plan_year: number
          content: Json
          creator_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          plan_type: string
          plan_year: number
          content?: Json
          creator_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          plan_type?: string
          plan_year?: number
          content?: Json
          creator_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      plans: {
        Row: {
          id: string
          participant_id: string
          activity_name: string
          date: string
          options: Json
          selected_option_index: number | null
          creator_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          activity_name: string
          date?: string
          options: Json
          selected_option_index?: number | null
          creator_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          activity_name?: string
          date?: string
          options?: Json
          selected_option_index?: number | null
          creator_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      evaluations: {
        Row: {
          id: string
          participant_id: string
          month: string
          tried: string | null
          learned: string | null
          pleased: string | null
          concerned: string | null
          next_step: string | null
          ai_analysis: Json | null
          easy_summary: string | null
          creator_id: string | null
          created_at: string
          updated_at: string
          published_at: string | null
          evaluation_template: string | null
          template_data: Json | null
        }
        Insert: {
          id?: string
          participant_id: string
          month: string
          tried?: string | null
          learned?: string | null
          pleased?: string | null
          concerned?: string | null
          next_step?: string | null
          ai_analysis?: Json | null
          easy_summary?: string | null
          creator_id?: string | null
          created_at?: string
          updated_at?: string
          published_at?: string | null
          evaluation_template?: string | null
          template_data?: Json | null
        }
        Update: {
          id?: string
          participant_id?: string
          month?: string
          tried?: string | null
          learned?: string | null
          pleased?: string | null
          concerned?: string | null
          next_step?: string | null
          ai_analysis?: Json | null
          easy_summary?: string | null
          creator_id?: string | null
          created_at?: string
          updated_at?: string
          published_at?: string | null
          evaluation_template?: string | null
          template_data?: Json | null
        }
      }
      system_settings: {
        Row: { key: string; value: Json; updated_at: string }
        Insert: { key: string; value: Json; updated_at?: string }
        Update: { key?: string; value?: Json; updated_at?: string }
      }
    }
  }
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Participant = Database['public']['Tables']['participants']['Row']
export type FundingSource = Database['public']['Tables']['funding_sources']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type FileLink = Database['public']['Tables']['file_links']['Row']
export type Plan = Database['public']['Tables']['plans']['Row']
export type Evaluation = Database['public']['Tables']['evaluations']['Row']
