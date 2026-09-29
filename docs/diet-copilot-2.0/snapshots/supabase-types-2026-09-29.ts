// Diet Copilot P0 schema freeze
// Captured: 2026-09-29
// Supabase project: WORDSTRIKE Leaderboard (hycegznamzjhwinegaai)
// This is a generated schema/type snapshot; it contains no table row data.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_app_manifests: {
        Row: {
          app_slug: string
          capabilities: Json
          created_at: string
          data_scope: string
          export_scope: string
          identity_scope: string
          manifest_version: number
          updated_at: string
        }
        Insert: {
          app_slug: string
          capabilities?: Json
          created_at?: string
          data_scope?: string
          export_scope?: string
          identity_scope?: string
          manifest_version?: number
          updated_at?: string
        }
        Update: {
          app_slug?: string
          capabilities?: Json
          created_at?: string
          data_scope?: string
          export_scope?: string
          identity_scope?: string
          manifest_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_app_manifests_app_slug_fkey"
            columns: ["app_slug"]
            isOneToOne: true
            referencedRelation: "account_apps"
            referencedColumns: ["slug"]
          },
        ]
      }
      account_apps: {
        Row: {
          active: boolean
          created_at: string
          description: string
          name: string
          path: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          name: string
          path: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          name?: string
          path?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      account_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          preferred_language: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          preferred_language?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          preferred_language?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      account_user_apps: {
        Row: {
          app_slug: string
          first_used_at: string
          last_used_at: string
          source: string
          user_id: string
        }
        Insert: {
          app_slug: string
          first_used_at?: string
          last_used_at?: string
          source?: string
          user_id: string
        }
        Update: {
          app_slug?: string
          first_used_at?: string
          last_used_at?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_user_apps_app_slug_fkey"
            columns: ["app_slug"]
            isOneToOne: false
            referencedRelation: "account_apps"
            referencedColumns: ["slug"]
          },
        ]
      }
      activity_daily: {
        Row: {
          active_calories: number | null
          activity_date: string
          created_at: string
          distance_km: number | null
          exercise_minutes: number | null
          provider_payload: Json | null
          resting_heart_rate: number | null
          source: string
          steps: number | null
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_calories?: number | null
          activity_date: string
          created_at?: string
          distance_km?: number | null
          exercise_minutes?: number | null
          provider_payload?: Json | null
          resting_heart_rate?: number | null
          source?: string
          steps?: number | null
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_calories?: number | null
          activity_date?: string
          created_at?: string
          distance_km?: number | null
          exercise_minutes?: number | null
          provider_payload?: Json | null
          resting_heart_rate?: number | null
          source?: string
          steps?: number | null
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_actions: {
        Row: {
          action_type: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          request_id: string
          undone_at: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          request_id: string
          undone_at?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          request_id?: string
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      canvas_ci_elements: {
        Row: {
          element: Json
          id: string
          is_deleted: boolean
          revision: number
          updated_at: string
          updated_by: string
          version: number
          version_nonce: number
        }
        Insert: {
          element: Json
          id: string
          is_deleted?: boolean
          revision: number
          updated_at?: string
          updated_by?: string
          version: number
          version_nonce?: number
        }
        Update: {
          element?: Json
          id?: string
          is_deleted?: boolean
          revision?: number
          updated_at?: string
          updated_by?: string
          version?: number
          version_nonce?: number
        }
        Relationships: []
      }
      canvas_elements: {
        Row: {
          element: Json
          id: string
          is_deleted: boolean
          revision: number
          updated_at: string
          updated_by: string
          version: number
          version_nonce: number
        }
        Insert: {
          element: Json
          id: string
          is_deleted?: boolean
          revision: number
          updated_at?: string
          updated_by?: string
          version: number
          version_nonce?: number
        }
        Update: {
          element?: Json
          id?: string
          is_deleted?: boolean
          revision?: number
          updated_at?: string
          updated_by?: string
          version?: number
          version_nonce?: number
        }
        Relationships: []
      }
      change_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          calorie_target: number
          created_at: string
          id: string
          log_date: string
          notes: string | null
          protein_target: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calorie_target?: number
          created_at?: string
          id?: string
          log_date: string
          notes?: string | null
          protein_target?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calorie_target?: number
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          protein_target?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diet_native_devices: {
        Row: {
          app_version: string | null
          created_at: string
          credential_digest: string | null
          device_id: string
          label: string | null
          last_seen_at: string | null
          last_sync_at: string | null
          platform: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          credential_digest?: string | null
          device_id: string
          label?: string | null
          last_seen_at?: string | null
          last_sync_at?: string | null
          platform?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          credential_digest?: string | null
          device_id?: string
          label?: string | null
          last_seen_at?: string | null
          last_sync_at?: string | null
          platform?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goal_phases: {
        Row: {
          active: boolean
          calorie_target: number
          created_at: string
          desired_weekly_weight_change: number | null
          end_date: string | null
          fiber_target: number
          goal_weight: number | null
          id: string
          name: string
          notes: string | null
          phase_type: string
          protein_target: number
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          calorie_target: number
          created_at?: string
          desired_weekly_weight_change?: number | null
          end_date?: string | null
          fiber_target?: number
          goal_weight?: number | null
          id?: string
          name: string
          notes?: string | null
          phase_type?: string
          protein_target: number
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          calorie_target?: number
          created_at?: string
          desired_weekly_weight_change?: number | null
          end_date?: string | null
          fiber_target?: number
          goal_weight?: number | null
          id?: string
          name?: string
          notes?: string | null
          phase_type?: string
          protein_target?: number
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gomoku_rooms: {
        Row: {
          created_at: string
          expires_at: string
          guest_token_hash: string | null
          host_token_hash: string
          id: string
          password_hash: string | null
          password_salt: string | null
          revision: number
          state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          guest_token_hash?: string | null
          host_token_hash: string
          id: string
          password_hash?: string | null
          password_salt?: string | null
          revision?: number
          state?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          guest_token_hash?: string | null
          host_token_hash?: string
          id?: string
          password_hash?: string | null
          password_salt?: string | null
          revision?: number
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      leaderboard_boards: {
        Row: {
          board_key: string
          created_at: string
          display_name: string
          is_active: boolean
          is_visible: boolean
          mode: string
          ranking_strategy: string
          rules_version: number
        }
        Insert: {
          board_key: string
          created_at?: string
          display_name: string
          is_active?: boolean
          is_visible?: boolean
          mode: string
          ranking_strategy: string
          rules_version: number
        }
        Update: {
          board_key?: string
          created_at?: string
          display_name?: string
          is_active?: boolean
          is_visible?: boolean
          mode?: string
          ranking_strategy?: string
          rules_version?: number
        }
        Relationships: []
      }
      leaderboard_profiles: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
          username: string
          username_changed_at: string | null
          username_normalized: string | null
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
          username: string
          username_changed_at?: string | null
          username_normalized?: string | null
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
          username?: string
          username_changed_at?: string | null
          username_normalized?: string | null
        }
        Relationships: []
      }
      leaderboard_submissions: {
        Row: {
          accuracy: number | null
          board_key: string
          challenge_date: string | null
          challenge_version: number | null
          client_version: string
          completed: boolean | null
          duration_ms: number | null
          grade: string | null
          id: string
          integrity_remaining: number | null
          level: number | null
          metrics: Json
          moderation_status: string
          raw_wpm: number | null
          rules_version: number
          score: number | null
          session_id: string
          stage: number | null
          submitted_at: string
          user_id: string
          words_completed: number | null
          wpm: number | null
        }
        Insert: {
          accuracy?: number | null
          board_key: string
          challenge_date?: string | null
          challenge_version?: number | null
          client_version: string
          completed?: boolean | null
          duration_ms?: number | null
          grade?: string | null
          id?: string
          integrity_remaining?: number | null
          level?: number | null
          metrics?: Json
          moderation_status?: string
          raw_wpm?: number | null
          rules_version: number
          score?: number | null
          session_id: string
          stage?: number | null
          submitted_at?: string
          user_id: string
          words_completed?: number | null
          wpm?: number | null
        }
        Update: {
          accuracy?: number | null
          board_key?: string
          challenge_date?: string | null
          challenge_version?: number | null
          client_version?: string
          completed?: boolean | null
          duration_ms?: number | null
          grade?: string | null
          id?: string
          integrity_remaining?: number | null
          level?: number | null
          metrics?: Json
          moderation_status?: string
          raw_wpm?: number | null
          rules_version?: number
          score?: number | null
          session_id?: string
          stage?: number | null
          submitted_at?: string
          user_id?: string
          words_completed?: number | null
          wpm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_submissions_board_key_fkey"
            columns: ["board_key"]
            isOneToOne: false
            referencedRelation: "leaderboard_boards"
            referencedColumns: ["board_key"]
          },
        ]
      }
      meal_items: {
        Row: {
          calories: number
          calories_high: number | null
          calories_low: number | null
          carbs: number | null
          confidence: string
          created_at: string
          fat: number | null
          fiber: number | null
          id: string
          meal_id: string
          name: string
          protein: number
          quantity_text: string | null
          saved_food_id: string | null
          sort_order: number
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calories?: number
          calories_high?: number | null
          calories_low?: number | null
          carbs?: number | null
          confidence?: string
          created_at?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          meal_id: string
          name: string
          protein?: number
          quantity_text?: string | null
          saved_food_id?: string | null
          sort_order?: number
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          calories_high?: number | null
          calories_low?: number | null
          carbs?: number | null
          confidence?: string
          created_at?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          meal_id?: string
          name?: string
          protein?: number
          quantity_text?: string | null
          saved_food_id?: string | null
          sort_order?: number
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_saved_food_id_fkey"
            columns: ["saved_food_id"]
            isOneToOne: false
            referencedRelation: "saved_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          calories: number
          calories_high: number | null
          calories_low: number | null
          carbs: number | null
          confidence: string
          created_at: string
          daily_log_id: string
          eaten_at: string
          fat: number | null
          fiber: number | null
          id: string
          meal_type: string
          notes: string | null
          original_input: string | null
          photo_alt: string | null
          photo_url: string | null
          protein: number
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calories?: number
          calories_high?: number | null
          calories_low?: number | null
          carbs?: number | null
          confidence?: string
          created_at?: string
          daily_log_id: string
          eaten_at?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          meal_type?: string
          notes?: string | null
          original_input?: string | null
          photo_alt?: string | null
          photo_url?: string | null
          protein?: number
          source?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          calories_high?: number | null
          calories_low?: number | null
          carbs?: number | null
          confidence?: string
          created_at?: string
          daily_log_id?: string
          eaten_at?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          meal_type?: string
          notes?: string | null
          original_input?: string | null
          photo_alt?: string | null
          photo_url?: string | null
          protein?: number
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_arcade_best_scores: {
        Row: {
          achieved_at: number
          game_id: string
          mode_id: string
          player_id: string
          raw_score: number
          score: number
          source_version: number
          submissions: number
        }
        Insert: {
          achieved_at: number
          game_id: string
          mode_id?: string
          player_id: string
          raw_score: number
          score: number
          source_version?: number
          submissions?: number
        }
        Update: {
          achieved_at?: number
          game_id?: string
          mode_id?: string
          player_id?: string
          raw_score?: number
          score?: number
          source_version?: number
          submissions?: number
        }
        Relationships: [
          {
            foreignKeyName: "micro_arcade_best_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "micro_arcade_players"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_arcade_lb_policy: {
        Row: {
          payload: Json
          version: number
        }
        Insert: {
          payload: Json
          version: number
        }
        Update: {
          payload?: Json
          version?: number
        }
        Relationships: []
      }
      micro_arcade_lb_reviews: {
        Row: {
          id: number
          new_status: string
          previous_status: string
          reason: string
          reviewed_at: number
          run_id: string
        }
        Insert: {
          id?: never
          new_status: string
          previous_status: string
          reason: string
          reviewed_at?: number
          run_id: string
        }
        Update: {
          id?: never
          new_status?: string
          previous_status?: string
          reason?: string
          reviewed_at?: number
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_arcade_lb_reviews_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "micro_arcade_lb_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_arcade_lb_runs: {
        Row: {
          active_ms: number
          ap_micros: number
          code: string
          completed_at: number
          contribution_micros: number
          created_at: number
          duration_ms: number
          game_id: string
          id: string
          mode_id: string
          player_id: string
          policy_id: string
          provenance: string
          raw_score: number
          session_id: string
          source_version: number
          status: string
        }
        Insert: {
          active_ms: number
          ap_micros: number
          code: string
          completed_at: number
          contribution_micros: number
          created_at: number
          duration_ms: number
          game_id: string
          id?: string
          mode_id: string
          player_id: string
          policy_id: string
          provenance: string
          raw_score: number
          session_id: string
          source_version: number
          status: string
        }
        Update: {
          active_ms?: number
          ap_micros?: number
          code?: string
          completed_at?: number
          contribution_micros?: number
          created_at?: number
          duration_ms?: number
          game_id?: string
          id?: string
          mode_id?: string
          player_id?: string
          policy_id?: string
          provenance?: string
          raw_score?: number
          session_id?: string
          source_version?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_arcade_lb_runs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "micro_arcade_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "micro_arcade_lb_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "micro_arcade_lb_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_arcade_lb_sessions: {
        Row: {
          expires_at: number
          game_id: string
          id: string
          issued_at: number
          mode_id: string
          player_id: string
          policy_id: string
          request_id: string
          used_at: number | null
        }
        Insert: {
          expires_at: number
          game_id: string
          id?: string
          issued_at: number
          mode_id: string
          player_id: string
          policy_id: string
          request_id: string
          used_at?: number | null
        }
        Update: {
          expires_at?: number
          game_id?: string
          id?: string
          issued_at?: number
          mode_id?: string
          player_id?: string
          policy_id?: string
          request_id?: string
          used_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "micro_arcade_lb_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "micro_arcade_players"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_arcade_play_sessions: {
        Row: {
          expires_at: number
          game_id: string
          id: string
          issued_at: number
          mode_id: string
          player_id: string
          score_version: number
          used_at: number | null
        }
        Insert: {
          expires_at: number
          game_id: string
          id: string
          issued_at: number
          mode_id?: string
          player_id: string
          score_version?: number
          used_at?: number | null
        }
        Update: {
          expires_at?: number
          game_id?: string
          id?: string
          issued_at?: number
          mode_id?: string
          player_id?: string
          score_version?: number
          used_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "micro_arcade_play_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "micro_arcade_players"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_arcade_players: {
        Row: {
          country_code: string
          created_at: number
          credential_hash: string
          credential_version: number
          display_name: string
          id: string
          last_seen_at: number
        }
        Insert: {
          country_code?: string
          created_at: number
          credential_hash: string
          credential_version?: number
          display_name: string
          id: string
          last_seen_at: number
        }
        Update: {
          country_code?: string
          created_at?: number
          credential_hash?: string
          credential_version?: number
          display_name?: string
          id?: string
          last_seen_at?: number
        }
        Relationships: []
      }
      micro_arcade_rate_limits: {
        Row: {
          bucket_key: string
          bucket_start: number
          request_count: number
          scope: string
        }
        Insert: {
          bucket_key: string
          bucket_start: number
          request_count?: number
          scope: string
        }
        Update: {
          bucket_key?: string
          bucket_start?: number
          request_count?: number
          scope?: string
        }
        Relationships: []
      }
      micro_arcade_score_submissions: {
        Row: {
          created_at: number
          duration_ms: number
          game_id: string
          id: string
          mode_id: string
          player_id: string
          raw_score: number
          score: number
          session_id: string
          source_version: number
        }
        Insert: {
          created_at: number
          duration_ms: number
          game_id: string
          id: string
          mode_id?: string
          player_id: string
          raw_score: number
          score: number
          session_id: string
          source_version?: number
        }
        Update: {
          created_at?: number
          duration_ms?: number
          game_id?: string
          id?: string
          mode_id?: string
          player_id?: string
          raw_score?: number
          score?: number
          session_id?: string
          source_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "micro_arcade_score_submissions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "micro_arcade_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "micro_arcade_score_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "micro_arcade_play_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_arcade_scoring_profiles: {
        Row: {
          game_id: string
          profile: Json
        }
        Insert: {
          game_id: string
          profile: Json
        }
        Update: {
          game_id?: string
          profile?: Json
        }
        Relationships: []
      }
      notes_sync_records: {
        Row: {
          client_updated_at: number
          deleted_at: number | null
          entity_id: string
          entity_type: string
          payload: Json | null
          payload_hash: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          client_updated_at: number
          deleted_at?: number | null
          entity_id: string
          entity_type: string
          payload?: Json | null
          payload_hash?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          client_updated_at?: number
          deleted_at?: number | null
          entity_id?: string
          entity_type?: string
          payload?: Json | null
          payload_hash?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          adaptive_min_complete_days: number
          adaptive_target_enabled: boolean
          calorie_target: number
          created_at: string
          day_close_reminder_enabled: boolean
          day_close_reminder_time: string | null
          desired_weekly_weight_change: number | null
          fiber_target: number
          goal_weight: number | null
          protein_target: number
          reminder_timezone: string | null
          show_meal_photos: boolean
          show_optional_macros: boolean
          updated_at: string
          user_id: string
          weekly_review_day: number | null
          weekly_review_reminder_enabled: boolean
          weekly_review_time: string | null
          weigh_in_reminder_enabled: boolean
          weigh_in_reminder_time: string | null
        }
        Insert: {
          adaptive_min_complete_days?: number
          adaptive_target_enabled?: boolean
          calorie_target?: number
          created_at?: string
          day_close_reminder_enabled?: boolean
          day_close_reminder_time?: string | null
          desired_weekly_weight_change?: number | null
          fiber_target?: number
          goal_weight?: number | null
          protein_target?: number
          reminder_timezone?: string | null
          show_meal_photos?: boolean
          show_optional_macros?: boolean
          updated_at?: string
          user_id: string
          weekly_review_day?: number | null
          weekly_review_reminder_enabled?: boolean
          weekly_review_time?: string | null
          weigh_in_reminder_enabled?: boolean
          weigh_in_reminder_time?: string | null
        }
        Update: {
          adaptive_min_complete_days?: number
          adaptive_target_enabled?: boolean
          calorie_target?: number
          created_at?: string
          day_close_reminder_enabled?: boolean
          day_close_reminder_time?: string | null
          desired_weekly_weight_change?: number | null
          fiber_target?: number
          goal_weight?: number | null
          protein_target?: number
          reminder_timezone?: string | null
          show_meal_photos?: boolean
          show_optional_macros?: boolean
          updated_at?: string
          user_id?: string
          weekly_review_day?: number | null
          weekly_review_reminder_enabled?: boolean
          weekly_review_time?: string | null
          weigh_in_reminder_enabled?: boolean
          weigh_in_reminder_time?: string | null
        }
        Relationships: []
      }
      saved_food_portions: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          multiplier: number
          quantity_text: string | null
          saved_food_id: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          multiplier: number
          quantity_text?: string | null
          saved_food_id: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          multiplier?: number
          quantity_text?: string | null
          saved_food_id?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_food_portions_saved_food_id_fkey"
            columns: ["saved_food_id"]
            isOneToOne: false
            referencedRelation: "saved_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_foods: {
        Row: {
          aliases: string[]
          barcode: string | null
          brand: string | null
          calories: number
          carbs: number | null
          confidence: string
          created_at: string
          fat: number | null
          favorite: boolean
          fiber: number | null
          id: string
          last_used_at: string | null
          name: string
          normalized_name: string
          photo_url: string | null
          protein: number
          quantity_text: string | null
          source: string
          updated_at: string
          use_count: number
          user_id: string
          verified_at: string | null
        }
        Insert: {
          aliases?: string[]
          barcode?: string | null
          brand?: string | null
          calories?: number
          carbs?: number | null
          confidence?: string
          created_at?: string
          fat?: number | null
          favorite?: boolean
          fiber?: number | null
          id?: string
          last_used_at?: string | null
          name: string
          normalized_name: string
          photo_url?: string | null
          protein?: number
          quantity_text?: string | null
          source?: string
          updated_at?: string
          use_count?: number
          user_id: string
          verified_at?: string | null
        }
        Update: {
          aliases?: string[]
          barcode?: string | null
          brand?: string | null
          calories?: number
          carbs?: number | null
          confidence?: string
          created_at?: string
          fat?: number | null
          favorite?: boolean
          fiber?: number | null
          id?: string
          last_used_at?: string | null
          name?: string
          normalized_name?: string
          photo_url?: string | null
          protein?: number
          quantity_text?: string | null
          source?: string
          updated_at?: string
          use_count?: number
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      saved_meal_items: {
        Row: {
          calories: number
          calories_high: number | null
          calories_low: number | null
          carbs: number | null
          confidence: string
          created_at: string
          fat: number | null
          fiber: number | null
          id: string
          name: string
          protein: number
          quantity_text: string | null
          saved_food_id: string | null
          saved_meal_id: string
          sort_order: number
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calories?: number
          calories_high?: number | null
          calories_low?: number | null
          carbs?: number | null
          confidence?: string
          created_at?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          name: string
          protein?: number
          quantity_text?: string | null
          saved_food_id?: string | null
          saved_meal_id: string
          sort_order?: number
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          calories_high?: number | null
          calories_low?: number | null
          carbs?: number | null
          confidence?: string
          created_at?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          name?: string
          protein?: number
          quantity_text?: string | null
          saved_food_id?: string | null
          saved_meal_id?: string
          sort_order?: number
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_meal_items_saved_food_id_fkey"
            columns: ["saved_food_id"]
            isOneToOne: false
            referencedRelation: "saved_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_meal_items_saved_meal_id_fkey"
            columns: ["saved_meal_id"]
            isOneToOne: false
            referencedRelation: "saved_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_meals: {
        Row: {
          aliases: string[]
          calories: number | null
          carbs: number | null
          created_at: string
          fat: number | null
          favorite: boolean
          fiber: number | null
          id: string
          is_recipe: boolean
          last_used_at: string | null
          meal_type: string
          name: string
          normalized_name: string
          photo_url: string | null
          protein: number | null
          recipe_notes: string | null
          serving_text: string | null
          servings: number | null
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          aliases?: string[]
          calories?: number | null
          carbs?: number | null
          created_at?: string
          fat?: number | null
          favorite?: boolean
          fiber?: number | null
          id?: string
          is_recipe?: boolean
          last_used_at?: string | null
          meal_type?: string
          name: string
          normalized_name: string
          photo_url?: string | null
          protein?: number | null
          recipe_notes?: string | null
          serving_text?: string | null
          servings?: number | null
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          aliases?: string[]
          calories?: number | null
          carbs?: number | null
          created_at?: string
          fat?: number | null
          favorite?: boolean
          fiber?: number | null
          id?: string
          is_recipe?: boolean
          last_used_at?: string | null
          meal_type?: string
          name?: string
          normalized_name?: string
          photo_url?: string | null
          protein?: number | null
          recipe_notes?: string | null
          serving_text?: string | null
          servings?: number | null
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      target_recommendations: {
        Row: {
          avg_calories: number | null
          complete_days: number
          created_at: string
          current_target: number
          decision_payload: Json
          desired_weekly_weight_change: number | null
          estimated_maintenance: number | null
          generated_on: string
          id: string
          logged_days: number
          lookback_days: number
          rationale: string
          raw_recommended_target: number | null
          recommended_target: number | null
          resolved_at: string | null
          status: string
          user_id: string
          weekly_weight_change: number | null
          weigh_in_count: number
        }
        Insert: {
          avg_calories?: number | null
          complete_days: number
          created_at?: string
          current_target: number
          decision_payload?: Json
          desired_weekly_weight_change?: number | null
          estimated_maintenance?: number | null
          generated_on?: string
          id?: string
          logged_days?: number
          lookback_days: number
          rationale: string
          raw_recommended_target?: number | null
          recommended_target?: number | null
          resolved_at?: string | null
          status?: string
          user_id: string
          weekly_weight_change?: number | null
          weigh_in_count: number
        }
        Update: {
          avg_calories?: number | null
          complete_days?: number
          created_at?: string
          current_target?: number
          decision_payload?: Json
          desired_weekly_weight_change?: number | null
          estimated_maintenance?: number | null
          generated_on?: string
          id?: string
          logged_days?: number
          lookback_days?: number
          rationale?: string
          raw_recommended_target?: number | null
          recommended_target?: number | null
          resolved_at?: string | null
          status?: string
          user_id?: string
          weekly_weight_change?: number | null
          weigh_in_count?: number
        }
        Relationships: []
      }
      tms60_backups: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          source_revision: number
          state: Json
          state_schema: number
          translation_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          source_revision?: number
          state: Json
          state_schema: number
          translation_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          source_revision?: number
          state?: Json
          state_schema?: number
          translation_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tms60_sync_state: {
        Row: {
          client_updated_at: number
          created_at: string
          device_id: string | null
          revision: number
          state: Json
          state_hash: string | null
          state_schema: number
          translation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_updated_at: number
          created_at?: string
          device_id?: string | null
          revision?: number
          state: Json
          state_hash?: string | null
          state_schema: number
          translation_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_updated_at?: number
          created_at?: string
          device_id?: string | null
          revision?: number
          state?: Json
          state_hash?: string | null
          state_schema?: number
          translation_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          created_at: string
          id: string
          payload: Json
          user_id: string
          week_end: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          user_id: string
          week_end: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          user_id?: string
          week_end?: string
        }
        Relationships: []
      }
      weight_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      wordstrike_player_profiles: {
        Row: {
          data: Json
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      canvas_apply_own_undo: {
        Args: { p_changes: Json; p_updated_by: string }
        Returns: {
          element: Json
          id: string
          is_deleted: boolean
          revision: number
          updated_at: string
          updated_by: string
          version: number
          version_nonce: number
        }[]
        SetofOptions: {
          from: "*"
          to: "canvas_elements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      canvas_ci_apply_own_undo: {
        Args: { p_changes: Json; p_updated_by: string }
        Returns: {
          element: Json
          id: string
          is_deleted: boolean
          revision: number
          updated_at: string
          updated_by: string
          version: number
          version_nonce: number
        }[]
        SetofOptions: {
          from: "*"
          to: "canvas_ci_elements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      change_leaderboard_username: {
        Args: { p_user_id: string; p_username: string }
        Returns: Json
      }
      claim_leaderboard_profile: {
        Args: { p_user_id: string; p_username: string }
        Returns: Json
      }
      claim_notes_sync_access: { Args: { p_code: string }; Returns: boolean }
      delete_meal_from_ai: {
        Args: {
          p_expected_updated_at: string
          p_meal_id: string
          p_request_id: string
        }
        Returns: Json
      }
      delete_notes_auth_identity: { Args: never; Returns: Json }
      delete_thiepn_account: { Args: { p_confirmation: string }; Returns: Json }
      delete_tms60_cloud_data: {
        Args: { p_expected_user_id: string }
        Returns: Json
      }
      diet_copilot_healthcheck: { Args: never; Returns: Json }
      disable_notes_sync_access: { Args: never; Returns: boolean }
      export_thiepn_platform_snapshot: { Args: never; Returns: Json }
      get_diet_context: {
        Args: { p_days?: number; p_end_date?: string }
        Returns: Json
      }
      get_public_leaderboard: {
        Args: {
          p_board_key: string
          p_challenge_date?: string
          p_viewer_user_id?: string
        }
        Returns: Json
      }
      get_thiepn_ecosystem: {
        Args: never
        Returns: {
          app_slug: string
          capabilities: Json
          connected: boolean
          data_scope: string
          description: string
          export_scope: string
          first_used_at: string
          identity_scope: string
          last_used_at: string
          manifest_version: number
          name: string
          path: string
          sort_order: number
        }[]
      }
      has_notes_sync_access: { Args: never; Returns: boolean }
      list_notes_auth_sessions: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_current: boolean
          not_after: string
          refreshed_at: string
          updated_at: string
          user_agent: string
        }[]
      }
      list_thiepn_account_sessions: {
        Args: never
        Returns: {
          aal: string
          created_at: string
          is_current: boolean
          not_after: string
          refreshed_at: string
          session_id: string
          updated_at: string
          user_agent: string
        }[]
      }
      log_meal_from_ai: {
        Args: {
          p_confidence: string
          p_items: Json
          p_log_date: string
          p_meal_type: string
          p_notes: string
          p_original_input: string
          p_request_id: string
          p_source: string
          p_title: string
        }
        Returns: Json
      }
      log_weight_from_ai: {
        Args: {
          p_entry_date: string
          p_notes: string
          p_request_id: string
          p_weight: number
        }
        Returns: Json
      }
      micro_arcade_consume_score: {
        Args: {
          p_duration_ms: number
          p_now: number
          p_player_id: string
          p_score: number
          p_session_id: string
        }
        Returns: Json
      }
      micro_arcade_consume_score_v2: {
        Args: {
          p_duration_ms: number
          p_mode_id: string
          p_now: number
          p_player_id: string
          p_score: number
          p_session_id: string
          p_source_version: number
        }
        Returns: Json
      }
      micro_arcade_game_leaderboard: {
        Args: { p_game_id: string; p_limit?: number; p_player_id: string }
        Returns: Json
      }
      micro_arcade_lb_activity: { Args: { p_player: string }; Returns: Json }
      micro_arcade_lb_auth: {
        Args: { p_hash: string; p_id: string; p_legacy_hash: string }
        Returns: Json
      }
      micro_arcade_lb_bests: {
        Args: { p_asof: number; p_end: number; p_start: number }
        Returns: {
          active_ms: number
          ap_micros: number
          code: string
          completed_at: number
          contribution_micros: number
          created_at: number
          duration_ms: number
          game_id: string
          id: string
          mode_id: string
          player_id: string
          policy_id: string
          provenance: string
          raw_score: number
          session_id: string
          source_version: number
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "micro_arcade_lb_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      micro_arcade_lb_board: {
        Args: {
          p_asof?: number
          p_game: string
          p_limit?: number
          p_mode: string
          p_offset?: number
          p_player: string
          p_scope: string
        }
        Returns: Json
      }
      micro_arcade_lb_cleanup: { Args: never; Returns: number }
      micro_arcade_lb_finish: {
        Args: {
          p_active: number
          p_duration: number
          p_mode: string
          p_player: string
          p_policy: string
          p_raw: number
          p_session: string
          p_source: number
        }
        Returns: Json
      }
      micro_arcade_lb_guest: {
        Args: { p_country: string; p_hash: string; p_id: string }
        Returns: Json
      }
      micro_arcade_lb_history: {
        Args: { p_limit?: number; p_offset?: number; p_player: string }
        Returns: Json
      }
      micro_arcade_lb_receipt: {
        Args: { r: Database["public"]["Tables"]["micro_arcade_lb_runs"]["Row"] }
        Returns: Json
      }
      micro_arcade_lb_rename: {
        Args: { p_name: string; p_player: string }
        Returns: Json
      }
      micro_arcade_lb_result: {
        Args: { p_player: string; p_session: string }
        Returns: Json
      }
      micro_arcade_lb_review: {
        Args: { p_reason: string; p_run: string; p_status: string }
        Returns: boolean
      }
      micro_arcade_lb_screen: {
        Args: {
          p_active: number
          p_game: string
          p_mode: string
          p_raw: number
        }
        Returns: Json
      }
      micro_arcade_lb_start: {
        Args: {
          p_game: string
          p_mode: string
          p_player: string
          p_policy: string
          p_request: string
        }
        Returns: Json
      }
      micro_arcade_lb_values: {
        Args: { p_game: string; p_mode: string; p_raw: number }
        Returns: Json
      }
      micro_arcade_overall_leaderboard: {
        Args: { p_limit?: number; p_player_id: string }
        Returns: Json
      }
      micro_arcade_points: {
        Args: {
          p_game_id: string
          p_mode_id?: string
          p_raw: number
          p_source_version?: number
        }
        Returns: number
      }
      micro_arcade_profile_activity: {
        Args: { p_player_id: string }
        Returns: Json
      }
      micro_arcade_rate_limit: {
        Args: { p_key: string; p_limit: number; p_now: number; p_scope: string }
        Returns: boolean
      }
      micro_arcade_weekly_leaderboard: {
        Args: {
          p_limit: number
          p_player_id: string
          p_week_end: number
          p_week_start: number
        }
        Returns: Json
      }
      notes_auth_identity_delete_status: { Args: never; Returns: string }
      search_diet_history: {
        Args: { p_days?: number; p_limit?: number; p_query: string }
        Returns: Json
      }
      submit_leaderboard_result: {
        Args: {
          p_accuracy: number
          p_board_key: string
          p_challenge_date: string
          p_challenge_version: number
          p_client_version: string
          p_completed: boolean
          p_duration_ms: number
          p_grade: string
          p_integrity_remaining: number
          p_level: number
          p_metrics: Json
          p_raw_wpm: number
          p_score: number
          p_session_id: string
          p_stage: number
          p_user_id: string
          p_words_completed: number
          p_wpm: number
        }
        Returns: Json
      }
      undo_ai_action: { Args: { p_action_id: string }; Returns: Json }
      update_meal_from_ai: {
        Args: {
          p_expected_updated_at: string
          p_items: Json
          p_meal_id: string
          p_patch: Json
          p_request_id: string
        }
        Returns: Json
      }
      wttn_delete_save: {
        Args: { p_request_id: string; p_revision: number }
        Returns: Json
      }
      wttn_read_save: { Args: never; Returns: Json }
      wttn_save_history: { Args: never; Returns: Json }
      wttn_write_save: {
        Args: {
          p_checkpoint?: boolean
          p_request_id: string
          p_restore?: boolean
          p_revision: number
          p_snapshot: string
        }
        Returns: Json
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
