export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 0 | 1 | 2
          name: string | null
          created_at: string
        }
        Insert: {
          id: string
          role?: 0 | 1 | 2
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          role?: 0 | 1 | 2
          name?: string | null
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
          url: string
          file_type: '계획서' | '평가서' | '참고자료' | '증빙자료' | '기타'
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          url: string
          file_type: '계획서' | '평가서' | '참고자료' | '증빙자료' | '기타'
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          url?: string
          file_type?: '계획서' | '평가서' | '참고자료' | '증빙자료' | '기타'
          created_at?: string
        }
      }
    }
  }
}
