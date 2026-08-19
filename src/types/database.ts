export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      participants: {
        Row: {
          assigned_supporter_id: string | null
          auth_user_id: string | null
          birth_date: string | null
          created_at: string
          disability_type: string | null
          email: string | null
          id: string
          name: string
          support_grade: string | null
          ui_preferences: Json | null
          updated_at: string
        }
        Insert: {
          assigned_supporter_id?: string | null
          auth_user_id?: string | null
          birth_date?: string | null
          created_at?: string
          disability_type?: string | null
          email?: string | null
          id?: string
          name: string
          support_grade?: string | null
          ui_preferences?: Json | null
          updated_at?: string
        }
        Update: {
          assigned_supporter_id?: string | null
          auth_user_id?: string | null
          birth_date?: string | null
          created_at?: string
          disability_type?: string | null
          email?: string | null
          id?: string
          name?: string
          support_grade?: string | null
          ui_preferences?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_assigned_supporter_id_fkey"
            columns: ["assigned_supporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_super_admin: boolean
          name: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_super_admin?: boolean
          name?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
          name?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      seoul_administering_bodies: {
        Row: {
          body_role: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          body_role: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          body_role?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      seoul_appeals: {
        Row: {
          committee_id: string | null
          created_at: string
          decided_on: string | null
          due_on: string | null
          filed_by_self: boolean
          filed_on: string
          ground: string
          id: string
          notification_id: string
          outcome: string
          outcome_reason: string | null
          participant_id: string
        }
        Insert: {
          committee_id?: string | null
          created_at?: string
          decided_on?: string | null
          due_on?: string | null
          filed_by_self?: boolean
          filed_on?: string
          ground: string
          id?: string
          notification_id: string
          outcome?: string
          outcome_reason?: string | null
          participant_id: string
        }
        Update: {
          committee_id?: string | null
          created_at?: string
          decided_on?: string | null
          due_on?: string | null
          filed_by_self?: boolean
          filed_on?: string
          ground?: string
          id?: string
          notification_id?: string
          outcome?: string
          outcome_reason?: string | null
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_appeals_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "seoul_review_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_appeals_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "seoul_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_appeals_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_appealable_notifications"
            referencedColumns: ["notification_id"]
          },
          {
            foreignKeyName: "seoul_appeals_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_application_documents: {
        Row: {
          application_id: string
          created_at: string
          doc_type: string
          file_name: string
          id: string
          note: string | null
          participant_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          doc_type: string
          file_name: string
          id?: string
          note?: string | null
          participant_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          doc_type?: string
          file_name?: string
          id?: string
          note?: string | null
          participant_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seoul_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "seoul_application_documents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_application_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_applications: {
        Row: {
          applicant_signature: string | null
          application_date: string
          cohort_id: string
          created_at: string
          id: string
          participant_id: string
          proxy_id: string | null
          receipt_number: string | null
          received_by_id: string | null
          status: string
        }
        Insert: {
          applicant_signature?: string | null
          application_date?: string
          cohort_id: string
          created_at?: string
          id?: string
          participant_id: string
          proxy_id?: string | null
          receipt_number?: string | null
          received_by_id?: string | null
          status?: string
        }
        Update: {
          applicant_signature?: string | null
          application_date?: string
          cohort_id?: string
          created_at?: string
          id?: string
          participant_id?: string
          proxy_id?: string | null
          receipt_number?: string | null
          received_by_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_applications_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "seoul_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_applications_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_applications_proxy_id_fkey"
            columns: ["proxy_id"]
            isOneToOne: false
            referencedRelation: "seoul_proxies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_applications_received_by_id_fkey"
            columns: ["received_by_id"]
            isOneToOne: false
            referencedRelation: "seoul_executing_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_benefit_status: {
        Row: {
          id: string
          participant_id: string
          participates_in_mohw_pilot: boolean
          public_assistance: string | null
          recorded_at: string
          uses_activity_support: boolean
          uses_seoul_additional_support: boolean
        }
        Insert: {
          id?: string
          participant_id: string
          participates_in_mohw_pilot?: boolean
          public_assistance?: string | null
          recorded_at?: string
          uses_activity_support?: boolean
          uses_seoul_additional_support?: boolean
        }
        Update: {
          id?: string
          participant_id?: string
          participates_in_mohw_pilot?: boolean
          public_assistance?: string | null
          recorded_at?: string
          uses_activity_support?: boolean
          uses_seoul_additional_support?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "seoul_benefit_status_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_budget_allocations: {
        Row: {
          allocated_amount: number
          carry_over_allowed: boolean
          cohort_id: string
          copay_amount: number
          copay_status: string
          created_at: string
          domain_id: string | null
          ends_on: string
          funded_by_id: string | null
          id: string
          monthly_ceiling: number
          participant_id: string
          period_months: number
          plan_id: string
          review_id: string | null
          starts_on: string
          total_ceiling: number
        }
        Insert: {
          allocated_amount: number
          carry_over_allowed?: boolean
          cohort_id: string
          copay_amount?: number
          copay_status?: string
          created_at?: string
          domain_id?: string | null
          ends_on: string
          funded_by_id?: string | null
          id?: string
          monthly_ceiling: number
          participant_id: string
          period_months: number
          plan_id: string
          review_id?: string | null
          starts_on: string
          total_ceiling: number
        }
        Update: {
          allocated_amount?: number
          carry_over_allowed?: boolean
          cohort_id?: string
          copay_amount?: number
          copay_status?: string
          created_at?: string
          domain_id?: string | null
          ends_on?: string
          funded_by_id?: string | null
          id?: string
          monthly_ceiling?: number
          participant_id?: string
          period_months?: number
          plan_id?: string
          review_id?: string | null
          starts_on?: string
          total_ceiling?: number
        }
        Relationships: [
          {
            foreignKeyName: "seoul_budget_allocations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "seoul_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_budget_allocations_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_budget_allocations_funded_by_id_fkey"
            columns: ["funded_by_id"]
            isOneToOne: false
            referencedRelation: "seoul_administering_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_budget_allocations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_budget_allocations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "seoul_utilization_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_budget_allocations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "seoul_budget_allocations_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "seoul_plan_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_cohorts: {
        Row: {
          appeal_due_days: number | null
          carry_over_allowed: boolean
          code: string
          copay_max: number | null
          copay_rate: number
          created_at: string
          ends_on: string | null
          id: string
          is_active: boolean
          monthly_ceiling: number
          name: string
          period_months: number
          starts_on: string | null
          total_ceiling: number
        }
        Insert: {
          appeal_due_days?: number | null
          carry_over_allowed?: boolean
          code: string
          copay_max?: number | null
          copay_rate?: number
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          monthly_ceiling: number
          name: string
          period_months: number
          starts_on?: string | null
          total_ceiling: number
        }
        Update: {
          appeal_due_days?: number | null
          carry_over_allowed?: boolean
          code?: string
          copay_max?: number | null
          copay_rate?: number
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          monthly_ceiling?: number
          name?: string
          period_months?: number
          starts_on?: string | null
          total_ceiling?: number
        }
        Relationships: []
      }
      seoul_consent_records: {
        Row: {
          application_id: string
          consent_date: string
          consent_type: string
          created_at: string
          id: string
          is_agreed: boolean
          participant_id: string
          retention_period_note: string | null
          signed_by_proxy: boolean
          withdrawn_at: string | null
        }
        Insert: {
          application_id: string
          consent_date?: string
          consent_type: string
          created_at?: string
          id?: string
          is_agreed: boolean
          participant_id: string
          retention_period_note?: string | null
          signed_by_proxy?: boolean
          withdrawn_at?: string | null
        }
        Update: {
          application_id?: string
          consent_date?: string
          consent_type?: string
          created_at?: string
          id?: string
          is_agreed?: boolean
          participant_id?: string
          retention_period_note?: string | null
          signed_by_proxy?: boolean
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_consent_records_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seoul_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_consent_records_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "seoul_consent_records_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_disability_profiles: {
        Row: {
          acquired_disability_age: string | null
          disability_severity: string | null
          id: string
          participant_id: string
          primary_disability_type: string | null
          recorded_at: string
          secondary_disability_type: string | null
        }
        Insert: {
          acquired_disability_age?: string | null
          disability_severity?: string | null
          id?: string
          participant_id: string
          primary_disability_type?: string | null
          recorded_at?: string
          secondary_disability_type?: string | null
        }
        Update: {
          acquired_disability_age?: string | null
          disability_severity?: string | null
          id?: string
          participant_id?: string
          primary_disability_type?: string | null
          recorded_at?: string
          secondary_disability_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_disability_profiles_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_executing_agencies: {
        Row: {
          contact: string | null
          created_at: string
          designated_by_id: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          designated_by_id?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          designated_by_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_executing_agencies_designated_by_id_fkey"
            columns: ["designated_by_id"]
            isOneToOne: false
            referencedRelation: "seoul_administering_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_monitoring_records: {
        Row: {
          allocation_id: string | null
          caseworker_id: string | null
          created_at: string
          id: string
          method: string | null
          monitoring_date: string
          observed_change: string | null
          participant_id: string
          participant_voice: string | null
        }
        Insert: {
          allocation_id?: string | null
          caseworker_id?: string | null
          created_at?: string
          id?: string
          method?: string | null
          monitoring_date?: string
          observed_change?: string | null
          participant_id: string
          participant_voice?: string | null
        }
        Update: {
          allocation_id?: string | null
          caseworker_id?: string | null
          created_at?: string
          id?: string
          method?: string | null
          monitoring_date?: string
          observed_change?: string | null
          participant_id?: string
          participant_voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_monitoring_records_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "seoul_budget_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_monitoring_records_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_budget_balance"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_monitoring_records_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_monthly_usage"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_monitoring_records_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_monitoring_records_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_self_direction"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_monitoring_records_caseworker_id_fkey"
            columns: ["caseworker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_monitoring_records_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_monitoring_usages: {
        Row: {
          monitoring_id: string
          usage_id: string
        }
        Insert: {
          monitoring_id: string
          usage_id: string
        }
        Update: {
          monitoring_id?: string
          usage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_monitoring_usages_monitoring_id_fkey"
            columns: ["monitoring_id"]
            isOneToOne: false
            referencedRelation: "seoul_monitoring_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_monitoring_usages_usage_id_fkey"
            columns: ["usage_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_usages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_monitoring_usages_usage_id_fkey"
            columns: ["usage_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_unplanned_usages"
            referencedColumns: ["usage_id"]
          },
        ]
      }
      seoul_needs_assessment: {
        Row: {
          assessed_by: string | null
          created_at: string
          domain_id: string
          id: string
          limitation: string | null
          need_hope: string | null
          participant_id: string
          program: string
          subdomain_id: string | null
          support_example: string | null
        }
        Insert: {
          assessed_by?: string | null
          created_at?: string
          domain_id: string
          id?: string
          limitation?: string | null
          need_hope?: string | null
          participant_id: string
          program?: string
          subdomain_id?: string | null
          support_example?: string | null
        }
        Update: {
          assessed_by?: string | null
          created_at?: string
          domain_id?: string
          id?: string
          limitation?: string | null
          need_hope?: string | null
          participant_id?: string
          program?: string
          subdomain_id?: string | null
          support_example?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_needs_assessment_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_needs_assessment_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_needs_assessment_domain_program_fk"
            columns: ["domain_id", "program"]
            isOneToOne: false
            referencedRelation: "seoul_service_domains"
            referencedColumns: ["id", "program"]
          },
          {
            foreignKeyName: "seoul_needs_assessment_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_needs_assessment_subdomain_domain_fk"
            columns: ["subdomain_id", "domain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_subdomains"
            referencedColumns: ["id", "domain_id"]
          },
          {
            foreignKeyName: "seoul_needs_assessment_subdomain_id_fkey"
            columns: ["subdomain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_subdomains"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_notifications: {
        Row: {
          created_at: string
          id: string
          is_read_by_participant: boolean
          method: string | null
          notified_on: string
          participant_id: string
          read_at: string | null
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read_by_participant?: boolean
          method?: string | null
          notified_on?: string
          participant_id: string
          read_at?: string | null
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read_by_participant?: boolean
          method?: string | null
          notified_on?: string
          participant_id?: string
          read_at?: string | null
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_notifications_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_notifications_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "seoul_plan_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_plan_reviews: {
        Row: {
          committee_id: string | null
          created_at: string
          decision: string
          id: string
          plan_id: string
          reason: string | null
          review_date: string
        }
        Insert: {
          committee_id?: string | null
          created_at?: string
          decision: string
          id?: string
          plan_id: string
          reason?: string | null
          review_date?: string
        }
        Update: {
          committee_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          plan_id?: string
          reason?: string | null
          review_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_plan_reviews_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "seoul_review_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_plan_reviews_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "seoul_utilization_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_plan_reviews_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      seoul_proxies: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          participant_id: string
          proxy_name: string
          relation_to_participant: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          participant_id: string
          proxy_name: string
          relation_to_participant: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          proxy_name?: string
          relation_to_participant?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_proxies_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_receipts: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          issued_on: string | null
          provider_id: string | null
          storage_path: string
          usage_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          issued_on?: string | null
          provider_id?: string | null
          storage_path: string
          usage_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          issued_on?: string | null
          provider_id?: string | null
          storage_path?: string
          usage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_receipts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_receipts_usage_id_fkey"
            columns: ["usage_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_usages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_receipts_usage_id_fkey"
            columns: ["usage_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_unplanned_usages"
            referencedColumns: ["usage_id"]
          },
        ]
      }
      seoul_requested_services: {
        Row: {
          approved_for_service: boolean | null
          created_at: string
          domain_id: string | null
          estimated_cost: number | null
          id: string
          plan_id: string
          priority: number
          review_note: string | null
          service_name: string
        }
        Insert: {
          approved_for_service?: boolean | null
          created_at?: string
          domain_id?: string | null
          estimated_cost?: number | null
          id?: string
          plan_id: string
          priority: number
          review_note?: string | null
          service_name: string
        }
        Update: {
          approved_for_service?: boolean | null
          created_at?: string
          domain_id?: string | null
          estimated_cost?: number | null
          id?: string
          plan_id?: string
          priority?: number
          review_note?: string | null
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_requested_services_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_requested_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "seoul_utilization_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_requested_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      seoul_review_committees: {
        Row: {
          administering_body_id: string | null
          composition_note: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          administering_body_id?: string | null
          composition_note?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          administering_body_id?: string | null
          composition_note?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_review_committees_administering_body_id_fkey"
            columns: ["administering_body_id"]
            isOneToOne: false
            referencedRelation: "seoul_administering_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_rule_checks: {
        Row: {
          check_result: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          human_decision: string | null
          human_decision_reason: string | null
          id: string
          rule_id: string
          usage_id: string
        }
        Insert: {
          check_result: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          human_decision?: string | null
          human_decision_reason?: string | null
          id?: string
          rule_id: string
          usage_id: string
        }
        Update: {
          check_result?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          human_decision?: string | null
          human_decision_reason?: string | null
          id?: string
          rule_id?: string
          usage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_rule_checks_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_rule_checks_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "seoul_spending_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_rule_checks_usage_id_fkey"
            columns: ["usage_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_usages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_rule_checks_usage_id_fkey"
            columns: ["usage_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_unplanned_usages"
            referencedColumns: ["usage_id"]
          },
        ]
      }
      seoul_selection_decisions: {
        Row: {
          application_id: string
          created_at: string
          decided_by_id: string | null
          id: string
          is_selected: boolean
          selection_date: string
          selection_reason: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          decided_by_id?: string | null
          id?: string
          is_selected: boolean
          selection_date?: string
          selection_reason?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          decided_by_id?: string | null
          id?: string
          is_selected?: boolean
          selection_date?: string
          selection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_selection_decisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "seoul_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_selection_decisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "seoul_selection_decisions_decided_by_id_fkey"
            columns: ["decided_by_id"]
            isOneToOne: false
            referencedRelation: "seoul_administering_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_self_narratives: {
        Row: {
          desired_change: string | null
          desired_life: string | null
          goal_to_try: string | null
          id: string
          plan_id: string
          social_barriers: string | null
          strengths_talents: string | null
          updated_at: string
          written_in_first_person: boolean | null
        }
        Insert: {
          desired_change?: string | null
          desired_life?: string | null
          goal_to_try?: string | null
          id?: string
          plan_id: string
          social_barriers?: string | null
          strengths_talents?: string | null
          updated_at?: string
          written_in_first_person?: boolean | null
        }
        Update: {
          desired_change?: string | null
          desired_life?: string | null
          goal_to_try?: string | null
          id?: string
          plan_id?: string
          social_barriers?: string | null
          strengths_talents?: string | null
          updated_at?: string
          written_in_first_person?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_self_narratives_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "seoul_utilization_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_self_narratives_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      seoul_service_domains: {
        Row: {
          code: string
          description: string | null
          id: string
          label: string
          program: string
          sort_order: number
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          label: string
          program?: string
          sort_order?: number
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          label?: string
          program?: string
          sort_order?: number
        }
        Relationships: []
      }
      seoul_service_providers: {
        Row: {
          address: string | null
          business_number: string | null
          category: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
        }
        Insert: {
          address?: string | null
          business_number?: string | null
          category?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
        }
        Update: {
          address?: string | null
          business_number?: string | null
          category?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
        }
        Relationships: []
      }
      seoul_service_subdomains: {
        Row: {
          code: string
          domain_id: string
          examples: string[] | null
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          domain_id: string
          examples?: string[] | null
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          domain_id?: string
          examples?: string[] | null
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "seoul_service_subdomains_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_service_usages: {
        Row: {
          allocation_id: string
          amount: number
          created_at: string
          created_by: string | null
          decided_by: string
          description: string | null
          domain_id: string | null
          id: string
          participant_id: string
          provider_id: string | null
          requested_service_id: string | null
          settlement_status: string
          subdomain_id: string | null
          usage_date: string
        }
        Insert: {
          allocation_id: string
          amount: number
          created_at?: string
          created_by?: string | null
          decided_by?: string
          description?: string | null
          domain_id?: string | null
          id?: string
          participant_id: string
          provider_id?: string | null
          requested_service_id?: string | null
          settlement_status?: string
          subdomain_id?: string | null
          usage_date: string
        }
        Update: {
          allocation_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          decided_by?: string
          description?: string | null
          domain_id?: string | null
          id?: string
          participant_id?: string
          provider_id?: string | null
          requested_service_id?: string | null
          settlement_status?: string
          subdomain_id?: string | null
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_service_usages_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "seoul_budget_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_service_usages_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_budget_balance"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_service_usages_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_monthly_usage"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_service_usages_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_service_usages_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_self_direction"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_service_usages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_service_usages_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_service_usages_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_service_usages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_service_usages_requested_service_id_fkey"
            columns: ["requested_service_id"]
            isOneToOne: false
            referencedRelation: "seoul_requested_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_service_usages_subdomain_domain_fk"
            columns: ["subdomain_id", "domain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_subdomains"
            referencedColumns: ["id", "domain_id"]
          },
          {
            foreignKeyName: "seoul_service_usages_subdomain_id_fkey"
            columns: ["subdomain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_subdomains"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_settlements: {
        Row: {
          accepted_amount: number
          allocation_id: string
          created_at: string
          domain_id: string | null
          id: string
          note: string | null
          recovered_amount: number
          rejected_amount: number
          settled_on: string
          settled_period: string
          unused_amount: number
          verified_by_id: string | null
        }
        Insert: {
          accepted_amount?: number
          allocation_id: string
          created_at?: string
          domain_id?: string | null
          id?: string
          note?: string | null
          recovered_amount?: number
          rejected_amount?: number
          settled_on?: string
          settled_period: string
          unused_amount?: number
          verified_by_id?: string | null
        }
        Update: {
          accepted_amount?: number
          allocation_id?: string
          created_at?: string
          domain_id?: string | null
          id?: string
          note?: string | null
          recovered_amount?: number
          rejected_amount?: number
          settled_on?: string
          settled_period?: string
          unused_amount?: number
          verified_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_settlements_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "seoul_budget_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_settlements_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_budget_balance"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_settlements_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_monthly_usage"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_settlements_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_settlements_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_self_direction"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "seoul_settlements_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_settlements_verified_by_id_fkey"
            columns: ["verified_by_id"]
            isOneToOne: false
            referencedRelation: "seoul_executing_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_spending_rules: {
        Row: {
          code: string
          cohort_id: string | null
          created_at: string
          domain_id: string | null
          enforcement: string
          id: string
          is_active: boolean
          keywords: string[] | null
          kind: string
          label: string
          source_note: string | null
        }
        Insert: {
          code: string
          cohort_id?: string | null
          created_at?: string
          domain_id?: string | null
          enforcement: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          kind: string
          label: string
          source_note?: string | null
        }
        Update: {
          code?: string
          cohort_id?: string | null
          created_at?: string
          domain_id?: string | null
          enforcement?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          kind?: string
          label?: string
          source_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_spending_rules_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "seoul_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_spending_rules_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "seoul_service_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      seoul_utilization_plans: {
        Row: {
          application_id: string
          assisted_by_id: string | null
          authored_with_support: string
          cohort_id: string
          created_at: string
          id: string
          participant_id: string
          plan_period_end: string | null
          plan_period_start: string | null
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          assisted_by_id?: string | null
          authored_with_support?: string
          cohort_id: string
          created_at?: string
          id?: string
          participant_id: string
          plan_period_end?: string | null
          plan_period_start?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          assisted_by_id?: string | null
          authored_with_support?: string
          cohort_id?: string
          created_at?: string
          id?: string
          participant_id?: string
          plan_period_end?: string | null
          plan_period_start?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seoul_utilization_plans_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seoul_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_utilization_plans_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_seoul_pipeline"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "seoul_utilization_plans_assisted_by_id_fkey"
            columns: ["assisted_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_utilization_plans_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "seoul_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_utilization_plans_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          note: string | null
          role: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          note?: string | null
          role?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          note?: string | null
          role?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_seoul_appeal_status: {
        Row: {
          appeal_id: string | null
          days_left: number | null
          due_on: string | null
          filed_on: string | null
          is_overdue: boolean | null
          outcome: string | null
          participant_id: string | null
        }
        Insert: {
          appeal_id?: string | null
          days_left?: never
          due_on?: string | null
          filed_on?: string | null
          is_overdue?: never
          outcome?: string | null
          participant_id?: string | null
        }
        Update: {
          appeal_id?: string | null
          days_left?: never
          due_on?: string | null
          filed_on?: string | null
          is_overdue?: never
          outcome?: string | null
          participant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_appeals_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seoul_appealable_notifications: {
        Row: {
          appeal_deadline: string | null
          decision: string | null
          notification_id: string | null
          notified_on: string | null
          participant_id: string | null
          reason: string | null
          still_appealable: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_notifications_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seoul_budget_balance: {
        Row: {
          allocated_amount: number | null
          allocation_id: string | null
          carry_over_allowed: boolean | null
          cohort_id: string | null
          copay_amount: number | null
          copay_status: string | null
          ends_on: string | null
          monthly_ceiling: number | null
          participant_id: string | null
          remaining: number | null
          spent: number | null
          starts_on: string | null
          total_ceiling: number | null
          unplanned_count: number | null
          usage_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_budget_allocations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "seoul_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_budget_allocations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seoul_domain_flow: {
        Row: {
          participant_id: string | null
          건수: number | null
          계획외_건수: number | null
          계획외_금액: number | null
          금액: number | null
          영역: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_service_usages_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seoul_graph_edges: {
        Row: {
          o_id: string | null
          o_type: string | null
          predicate: string | null
          predicate_ko: string | null
          s_id: string | null
          s_type: string | null
        }
        Relationships: []
      }
      v_seoul_graph_edges_bidir: {
        Row: {
          is_inverse: boolean | null
          o_id: string | null
          o_type: string | null
          predicate: string | null
          predicate_ko: string | null
          s_id: string | null
          s_type: string | null
        }
        Relationships: []
      }
      v_seoul_graph_nodes: {
        Row: {
          id: string | null
          label: string | null
          node_type: string | null
        }
        Relationships: []
      }
      v_seoul_intent_to_spending: {
        Row: {
          participant_id: string | null
          상태: string | null
          순위: number | null
          시도하고_싶은_것: string | null
          실제_집행액: number | null
          영역: string | null
          예상비용: number | null
          요청한_서비스: string | null
          원하는_삶: string | null
          집행_건수: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_utilization_plans_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seoul_monthly_usage: {
        Row: {
          allocation_id: string | null
          exceeds_monthly_ceiling: boolean | null
          month: string | null
          month_spent: number | null
          monthly_ceiling: number | null
          participant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_budget_allocations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seoul_pipeline: {
        Row: {
          allocation_id: string | null
          application_id: string | null
          application_status: string | null
          cohort_id: string | null
          is_selected: boolean | null
          notified_on: string | null
          participant_id: string | null
          plan_id: string | null
          plan_status: string | null
          remaining: number | null
          review_decision: string | null
          spent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_applications_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "seoul_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seoul_applications_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seoul_self_direction: {
        Row: {
          allocation_id: string | null
          participant_id: string | null
          plan_authorship: string | null
          self_decided: number | null
          self_direction_pct: number | null
          self_with_support: number | null
          total_usages: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_budget_allocations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seoul_unplanned_usages: {
        Row: {
          amount: number | null
          description: string | null
          domain_label: string | null
          human_decision: string | null
          human_decision_reason: string | null
          participant_id: string | null
          usage_date: string | null
          usage_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seoul_service_usages_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_first_admin: { Args: { user_id: string }; Returns: boolean }
      dearmor: { Args: { "": string }; Returns: string }
      gen_random_uuid: { Args: never; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      link_participant_to_auth_user: {
        Args: { p_user_id: string }
        Returns: string
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      norm_email: { Args: { p_email: string }; Returns: string }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      seoul_can_access: { Args: { p_participant_id: string }; Returns: boolean }
      seoul_export_triples: {
        Args: { p_participant_id: string }
        Returns: {
          object: string
          predicate: string
          subject: string
        }[]
      }
      seoul_graph_walk: {
        Args: {
          p_bidirectional?: boolean
          p_max_depth?: number
          p_start_id: string
        }
        Returns: {
          depth: number
          o_id: string
          o_label: string
          o_type: string
          path_label: string
          predicate: string
          s_id: string
          s_label: string
          s_type: string
        }[]
      }
      seoul_is_admin: { Args: never; Returns: boolean }
      seoul_is_self: { Args: { p_participant_id: string }; Returns: boolean }
      seoul_is_staff_for: {
        Args: { p_participant_id: string }
        Returns: boolean
      }
      seoul_self_participant_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const


// ── 편의 별칭 (손유지 — 재생성 후에도 보존한다) ──
export type UserRole = 'admin' | 'supporter' | 'participant'
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Participant = Database['public']['Tables']['participants']['Row']
