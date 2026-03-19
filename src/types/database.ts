/**
 * 데이터베이스 타입 정의
 * Supabase schema.sql 기반
 */

// ============================================================
// 역할 타입
// ============================================================
export type UserRole = 'admin' | 'supporter' | 'participant';

// ============================================================
// Profiles 테이블
// ============================================================
export interface Profile {
  id: string;
  role: UserRole;
  name: string | null;
  created_at: string;
}

// ============================================================
// Participants 테이블
// ============================================================
export interface Participant {
  id: string;
  monthly_budget_default: number;
  yearly_budget_default: number;
  budget_start_date: string;
  budget_end_date: string;
  funding_source_count: number;
  alert_threshold: number;
  assigned_supporter_id: string | null;
  created_at: string;
}

// Participant with joined data
export interface ParticipantWithProfile extends Participant {
  profile: Profile;
  funding_sources: FundingSource[];
  supporter_profile?: Profile | null;
}

// ============================================================
// Funding Sources 테이블
// ============================================================
export interface FundingSource {
  id: string;
  participant_id: string;
  name: string;
  monthly_budget: number;
  yearly_budget: number;
  current_month_balance: number;
  current_year_balance: number;
  created_at: string;
}

// ============================================================
// Transactions 테이블
// ============================================================
export type TransactionStatus = 'pending' | 'confirmed';

export interface Transaction {
  id: string;
  participant_id: string;
  funding_source_id: string | null;
  date: string;
  activity_name: string;
  amount: number;
  category: string | null;
  memo: string | null;
  payment_method: string | null;
  receipt_image_url: string | null;
  status: TransactionStatus;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Form types (입력 폼용)
// ============================================================
export interface ParticipantFormData {
  profile_id: string;
  name: string;
  monthly_budget_default: number;
  yearly_budget_default: number;
  budget_start_date: string;
  budget_end_date: string;
  funding_source_count: number;
  alert_threshold: number;
  assigned_supporter_id: string | null;
  funding_sources: FundingSourceFormData[];
}

export interface FundingSourceFormData {
  name: string;
  monthly_budget: number;
  yearly_budget: number;
}
