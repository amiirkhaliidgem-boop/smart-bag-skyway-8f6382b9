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
      admin_audit_log: {
        Row: {
          action: string
          actor_name: string
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          details: string
          id: string
          target: string
        }
        Insert: {
          action: string
          actor_name?: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: string
          id?: string
          target?: string
        }
        Update: {
          action?: string
          actor_name?: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: string
          id?: string
          target?: string
        }
        Relationships: []
      }
      app_roles: {
        Row: {
          created_at: string
          description: string
          id: string
          is_system: boolean
          key: string
          legacy_role: Database["public"]["Enums"]["app_role"] | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          key: string
          legacy_role?: Database["public"]["Enums"]["app_role"] | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          key?: string
          legacy_role?: Database["public"]["Enums"]["app_role"] | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_state: {
        Row: {
          id: string
          payload: Json
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          id?: string
          payload?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          id?: string
          payload?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      app_state_history: {
        Row: {
          app_state_id: string
          archived_at: string
          archived_by: string | null
          id: number
          payload: Json
          version: number
        }
        Insert: {
          app_state_id: string
          archived_at?: string
          archived_by?: string | null
          id?: never
          payload: Json
          version: number
        }
        Update: {
          app_state_id?: string
          archived_at?: string
          archived_by?: string | null
          id?: never
          payload?: Json
          version?: number
        }
        Relationships: []
      }
      app_users: {
        Row: {
          created_at: string
          department: string
          driver_pin_hash: string | null
          driver_pin_salt: string | null
          email: string | null
          employee_id: string
          full_name: string
          id: string
          last_login_at: string | null
          mobile: string | null
          position: string
          station: string
          status: string
          team: string
          updated_at: string
          user_id: string | null
          user_type: string
          username: string
        }
        Insert: {
          created_at?: string
          department?: string
          driver_pin_hash?: string | null
          driver_pin_salt?: string | null
          email?: string | null
          employee_id: string
          full_name: string
          id?: string
          last_login_at?: string | null
          mobile?: string | null
          position?: string
          station?: string
          status?: string
          team?: string
          updated_at?: string
          user_id?: string | null
          user_type?: string
          username: string
        }
        Update: {
          created_at?: string
          department?: string
          driver_pin_hash?: string | null
          driver_pin_salt?: string | null
          email?: string | null
          employee_id?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          mobile?: string | null
          position?: string
          station?: string
          status?: string
          team?: string
          updated_at?: string
          user_id?: string | null
          user_type?: string
          username?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_name: string
          actor_role: string | null
          actor_user_id: string | null
          case_id: string | null
          delivery_id: string | null
          entity_id: string
          entity_type: string
          id: number
          metadata: Json
          note: string
          occurred_at: string
        }
        Insert: {
          action: string
          actor_name?: string
          actor_role?: string | null
          actor_user_id?: string | null
          case_id?: string | null
          delivery_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: never
          metadata?: Json
          note?: string
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_name?: string
          actor_role?: string | null
          actor_user_id?: string | null
          case_id?: string | null
          delivery_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: never
          metadata?: Json
          note?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      baggage_cases: {
        Row: {
          airline: string
          arrival_belt: string | null
          arrival_date: string | null
          arrival_time: string | null
          assigned_officer_id: string | null
          bag_brand: string | null
          bag_color: string | null
          bag_size: string | null
          bag_type: string | null
          case_no: string
          closed_at: string | null
          contact_mobile: string
          contact_mobile_alt: string | null
          created_at: string
          created_by: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          department: string
          description: string
          dest_lat: number | null
          dest_lng: number | null
          destination_airport: string | null
          distinctive_marks: string | null
          email: string | null
          flight_number: string
          fragile: boolean
          full_address: string
          google_maps_link: string | null
          id: string
          incomplete: boolean
          internal_notes: string
          lf_status: Database["public"]["Enums"]["lf_status"]
          missing_fields: string[]
          nationality: string | null
          number_of_bags: number
          origin_airport: string | null
          passenger_first_name: string | null
          passenger_last_name: string | null
          passenger_middle_name: string | null
          passenger_name: string
          passport_number: string | null
          pir_number: string
          pnr: string | null
          preferred_delivery_time: string | null
          priority: Database["public"]["Enums"]["case_priority"]
          resolved_at: string | null
          rush_delivery: boolean
          station_id: string
          storage_position: string | null
          storage_shelf: string | null
          storage_zone: string | null
          terminal: string | null
          ticket_number: string | null
          updated_at: string
          version: number
          weight_kg: number | null
          workflow_status: Database["public"]["Enums"]["workflow_status"]
        }
        Insert: {
          airline: string
          arrival_belt?: string | null
          arrival_date?: string | null
          arrival_time?: string | null
          assigned_officer_id?: string | null
          bag_brand?: string | null
          bag_color?: string | null
          bag_size?: string | null
          bag_type?: string | null
          case_no: string
          closed_at?: string | null
          contact_mobile?: string
          contact_mobile_alt?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          department?: string
          description?: string
          dest_lat?: number | null
          dest_lng?: number | null
          destination_airport?: string | null
          distinctive_marks?: string | null
          email?: string | null
          flight_number: string
          fragile?: boolean
          full_address?: string
          google_maps_link?: string | null
          id?: string
          incomplete?: boolean
          internal_notes?: string
          lf_status?: Database["public"]["Enums"]["lf_status"]
          missing_fields?: string[]
          nationality?: string | null
          number_of_bags?: number
          origin_airport?: string | null
          passenger_first_name?: string | null
          passenger_last_name?: string | null
          passenger_middle_name?: string | null
          passenger_name: string
          passport_number?: string | null
          pir_number: string
          pnr?: string | null
          preferred_delivery_time?: string | null
          priority?: Database["public"]["Enums"]["case_priority"]
          resolved_at?: string | null
          rush_delivery?: boolean
          station_id: string
          storage_position?: string | null
          storage_shelf?: string | null
          storage_zone?: string | null
          terminal?: string | null
          ticket_number?: string | null
          updated_at?: string
          version?: number
          weight_kg?: number | null
          workflow_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Update: {
          airline?: string
          arrival_belt?: string | null
          arrival_date?: string | null
          arrival_time?: string | null
          assigned_officer_id?: string | null
          bag_brand?: string | null
          bag_color?: string | null
          bag_size?: string | null
          bag_type?: string | null
          case_no?: string
          closed_at?: string | null
          contact_mobile?: string
          contact_mobile_alt?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          department?: string
          description?: string
          dest_lat?: number | null
          dest_lng?: number | null
          destination_airport?: string | null
          distinctive_marks?: string | null
          email?: string | null
          flight_number?: string
          fragile?: boolean
          full_address?: string
          google_maps_link?: string | null
          id?: string
          incomplete?: boolean
          internal_notes?: string
          lf_status?: Database["public"]["Enums"]["lf_status"]
          missing_fields?: string[]
          nationality?: string | null
          number_of_bags?: number
          origin_airport?: string | null
          passenger_first_name?: string | null
          passenger_last_name?: string | null
          passenger_middle_name?: string | null
          passenger_name?: string
          passport_number?: string | null
          pir_number?: string
          pnr?: string | null
          preferred_delivery_time?: string | null
          priority?: Database["public"]["Enums"]["case_priority"]
          resolved_at?: string | null
          rush_delivery?: boolean
          station_id?: string
          storage_position?: string | null
          storage_shelf?: string | null
          storage_zone?: string | null
          terminal?: string | null
          ticket_number?: string | null
          updated_at?: string
          version?: number
          weight_kg?: number | null
          workflow_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "baggage_cases_assigned_officer_id_fkey"
            columns: ["assigned_officer_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baggage_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baggage_cases_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_bags: {
        Row: {
          bag_tag: string
          case_id: string
          created_at: string
          id: string
          notes: string
          seq: number
          updated_at: string
          version: number
          weight_kg: number | null
        }
        Insert: {
          bag_tag: string
          case_id: string
          created_at?: string
          id?: string
          notes?: string
          seq?: number
          updated_at?: string
          version?: number
          weight_kg?: number | null
        }
        Update: {
          bag_tag?: string
          case_id?: string
          created_at?: string
          id?: string
          notes?: string
          seq?: number
          updated_at?: string
          version?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_bags_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          address: string
          assigned_agent_id: string | null
          assigned_at: string | null
          attempt_no: number
          case_id: string
          closed_at: string | null
          collected_at: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_no: string
          delivery_type: Database["public"]["Enums"]["delivery_method"]
          dest_lat: number | null
          dest_lng: number | null
          failed_at: string | null
          failure_note: string
          failure_reason_id: string | null
          id: string
          mobile: string
          passenger_name: string
          priority: Database["public"]["Enums"]["case_priority"]
          returned_at: string | null
          scheduled_for: string | null
          stage: Database["public"]["Enums"]["delivery_stage"]
          started_at: string | null
          station_id: string
          updated_at: string
          version: number
          workflow_status: Database["public"]["Enums"]["workflow_status"]
        }
        Insert: {
          accepted_at?: string | null
          address?: string
          assigned_agent_id?: string | null
          assigned_at?: string | null
          attempt_no?: number
          case_id: string
          closed_at?: string | null
          collected_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_no: string
          delivery_type?: Database["public"]["Enums"]["delivery_method"]
          dest_lat?: number | null
          dest_lng?: number | null
          failed_at?: string | null
          failure_note?: string
          failure_reason_id?: string | null
          id?: string
          mobile?: string
          passenger_name: string
          priority?: Database["public"]["Enums"]["case_priority"]
          returned_at?: string | null
          scheduled_for?: string | null
          stage?: Database["public"]["Enums"]["delivery_stage"]
          started_at?: string | null
          station_id: string
          updated_at?: string
          version?: number
          workflow_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Update: {
          accepted_at?: string | null
          address?: string
          assigned_agent_id?: string | null
          assigned_at?: string | null
          attempt_no?: number
          case_id?: string
          closed_at?: string | null
          collected_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_no?: string
          delivery_type?: Database["public"]["Enums"]["delivery_method"]
          dest_lat?: number | null
          dest_lng?: number | null
          failed_at?: string | null
          failure_note?: string
          failure_reason_id?: string | null
          id?: string
          mobile?: string
          passenger_name?: string
          priority?: Database["public"]["Enums"]["case_priority"]
          returned_at?: string | null
          scheduled_for?: string | null
          stage?: Database["public"]["Enums"]["delivery_stage"]
          started_at?: string | null
          station_id?: string
          updated_at?: string
          version?: number
          workflow_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_failure_reason_id_fkey"
            columns: ["failure_reason_id"]
            isOneToOne: false
            referencedRelation: "failure_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          author_name: string
          author_user_id: string | null
          body: string
          created_at: string
          delivery_id: string
          id: string
        }
        Insert: {
          author_name?: string
          author_user_id?: string | null
          body: string
          created_at?: string
          delivery_id: string
          id?: string
        }
        Update: {
          author_name?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          delivery_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_public_view: {
        Row: {
          airline: string | null
          bag_id: string | null
          bag_tag: string | null
          delivery_id: string
          flight_date: string | null
          flight_no: string | null
          otp_code: string | null
          passenger_name: string | null
          pir_number: string | null
          stage: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          airline?: string | null
          bag_id?: string | null
          bag_tag?: string | null
          delivery_id: string
          flight_date?: string | null
          flight_no?: string | null
          otp_code?: string | null
          passenger_name?: string | null
          pir_number?: string | null
          stage?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          airline?: string | null
          bag_id?: string | null
          bag_tag?: string | null
          delivery_id?: string
          flight_date?: string | null
          flight_no?: string | null
          otp_code?: string | null
          passenger_name?: string | null
          pir_number?: string | null
          stage?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      failure_reasons: {
        Row: {
          active: boolean
          allows_retry: boolean
          code: string
          created_at: string
          id: string
          label_ar: string
          label_en: string
          sort_order: number
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          allows_retry?: boolean
          code: string
          created_at?: string
          id?: string
          label_ar?: string
          label_en: string
          sort_order?: number
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          allows_retry?: boolean
          code?: string
          created_at?: string
          id?: string
          label_ar?: string
          label_en?: string
          sort_order?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      passenger_feedback: {
        Row: {
          comments: string
          created_at: string
          delivery_id: string
          id: string
          rating: number
          resolved: boolean
          token: string
        }
        Insert: {
          comments?: string
          created_at?: string
          delivery_id: string
          id?: string
          rating: number
          resolved?: boolean
          token: string
        }
        Update: {
          comments?: string
          created_at?: string
          delivery_id?: string
          id?: string
          rating?: number
          resolved?: boolean
          token?: string
        }
        Relationships: []
      }
      passenger_links: {
        Row: {
          channel: string
          delivery_id: string
          expires_at: string | null
          issued_at: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          channel?: string
          delivery_id: string
          expires_at?: string | null
          issued_at?: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          channel?: string
          delivery_id?: string
          expires_at?: string | null
          issued_at?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          action: string
          allowed: boolean
          id: string
          module: string
          role_id: string
          updated_at: string
        }
        Insert: {
          action: string
          allowed?: boolean
          id?: string
          module: string
          role_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          allowed?: boolean
          id?: string
          module?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          active: boolean
          created_at: string
          id: string
          stage: Database["public"]["Enums"]["delivery_stage"]
          target_minutes: number
          updated_at: string
          version: number
          warn_at_pct: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          stage: Database["public"]["Enums"]["delivery_stage"]
          target_minutes: number
          updated_at?: string
          version?: number
          warn_at_pct?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          stage?: Database["public"]["Enums"]["delivery_stage"]
          target_minutes?: number
          updated_at?: string
          version?: number
          warn_at_pct?: number
        }
        Relationships: []
      }
      stations: {
        Row: {
          code: string
          created_at: string
          id: string
          is_default: boolean
          lat: number
          lng: number
          name: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          lat: number
          lng: number
          name: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          lat?: number
          lng?: number
          name?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          actor_name: string
          actor_user_id: string | null
          case_id: string | null
          delivery_id: string | null
          detail: string
          id: number
          metadata: Json
          module: Database["public"]["Enums"]["timeline_module"]
          occurred_at: string
          reference: string
          status: string
          title: string
        }
        Insert: {
          actor_name?: string
          actor_user_id?: string | null
          case_id?: string | null
          delivery_id?: string | null
          detail?: string
          id?: never
          metadata?: Json
          module: Database["public"]["Enums"]["timeline_module"]
          occurred_at?: string
          reference?: string
          status?: string
          title: string
        }
        Update: {
          actor_name?: string
          actor_user_id?: string | null
          case_id?: string | null
          delivery_id?: string | null
          detail?: string
          id?: never
          metadata?: Json
          module?: Database["public"]["Enums"]["timeline_module"]
          occurred_at?: string
          reference?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          app_user_id: string
          assigned_at: string
          id: string
          role_id: string
        }
        Insert: {
          app_user_id: string
          assigned_at?: string
          id?: string
          role_id: string
        }
        Update: {
          app_user_id?: string
          assigned_at?: string
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_events: {
        Row: {
          actor_name: string
          actor_role: string | null
          actor_user_id: string | null
          case_id: string | null
          delivery_id: string | null
          from_stage: Database["public"]["Enums"]["delivery_stage"] | null
          from_status: Database["public"]["Enums"]["workflow_status"] | null
          id: number
          metadata: Json
          occurred_at: string
          reason: string
          to_stage: Database["public"]["Enums"]["delivery_stage"] | null
          to_status: Database["public"]["Enums"]["workflow_status"]
        }
        Insert: {
          actor_name?: string
          actor_role?: string | null
          actor_user_id?: string | null
          case_id?: string | null
          delivery_id?: string | null
          from_stage?: Database["public"]["Enums"]["delivery_stage"] | null
          from_status?: Database["public"]["Enums"]["workflow_status"] | null
          id?: never
          metadata?: Json
          occurred_at?: string
          reason?: string
          to_stage?: Database["public"]["Enums"]["delivery_stage"] | null
          to_status: Database["public"]["Enums"]["workflow_status"]
        }
        Update: {
          actor_name?: string
          actor_role?: string | null
          actor_user_id?: string | null
          case_id?: string | null
          delivery_id?: string | null
          from_stage?: Database["public"]["Enums"]["delivery_stage"] | null
          from_status?: Database["public"]["Enums"]["workflow_status"] | null
          id?: never
          metadata?: Json
          occurred_at?: string
          reason?: string
          to_stage?: Database["public"]["Enums"]["delivery_stage"] | null
          to_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _passenger_apply_action: {
        Args: { p_action: string; p_token: string }
        Returns: boolean
      }
      current_app_user_id: { Args: never; Returns: string }
      current_user_permissions: {
        Args: never
        Returns: {
          action: string
          module: string
        }[]
      }
      get_passenger_view: { Args: { p_token: string }; Returns: Json }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ops_staff: { Args: { _user_id: string }; Returns: boolean }
      list_delivery_agents: {
        Args: never
        Returns: {
          employee_id: string
          full_name: string
          id: string
          station: string
        }[]
      }
      login_identity_for_username: {
        Args: { _username: string }
        Returns: string
      }
      next_case_no: { Args: never; Returns: string }
      next_delivery_no: { Args: never; Returns: string }
      passenger_confirm_delivery: {
        Args: { p_token: string }
        Returns: boolean
      }
      passenger_report_misconduct: {
        Args: { p_token: string }
        Returns: boolean
      }
      passenger_submit_feedback: {
        Args: {
          p_comments: string
          p_rating: number
          p_resolved: boolean
          p_token: string
        }
        Returns: boolean
      }
      save_app_state: {
        Args: { p_expected_version: number; p_payload: Json }
        Returns: {
          current_payload: Json
          current_version: number
          saved: boolean
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "dispatcher"
        | "coordinator"
        | "agent"
        | "driver"
        | "viewer"
      case_priority: "Normal" | "VIP"
      delivery_method: "Home Delivery" | "Airport Pickup"
      delivery_stage:
        | "Ready for Delivery"
        | "Scheduled"
        | "Assigned"
        | "Driver Accepted"
        | "Collected Bag"
        | "Out for Delivery"
        | "Delivered"
        | "Delivery Failed"
        | "Returned to Airport"
      incident_severity: "High" | "Medium" | "Low"
      incident_state: "Open" | "Under Review" | "Resolved"
      lf_status:
        | "Open"
        | "Tracing"
        | "Located"
        | "Arrived at Airport"
        | "Waiting Customs Clearance"
        | "Ready for Delivery"
        | "Assigned Driver"
        | "Out for Delivery"
        | "Delivered"
        | "Closed"
      notification_channel: "sms" | "whatsapp" | "email" | "push"
      notification_state: "queued" | "sending" | "sent" | "failed" | "cancelled"
      otp_state: "Pending" | "Sent" | "Verified" | "Failed" | "Expired"
      timeline_module:
        | "lost_found"
        | "delivery"
        | "agent_portal"
        | "passenger_portal"
        | "workflow"
        | "notification"
        | "otp"
        | "feedback"
        | "quality"
        | "admin"
        | "system"
      workflow_status:
        | "PIR_CREATED"
        | "HOME_DELIVERY_REQUESTED"
        | "DELIVERY_APPROVED"
        | "DRIVER_ASSIGNED"
        | "READY_FOR_COLLECTION"
        | "CLAIMED_ON_HAND"
        | "OUT_FOR_DELIVERY"
        | "DRIVER_ARRIVED"
        | "OTP_VERIFIED"
        | "DELIVERED"
        | "FEEDBACK_SUBMITTED"
        | "CLOSED"
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
    Enums: {
      app_role: [
        "admin",
        "dispatcher",
        "coordinator",
        "agent",
        "driver",
        "viewer",
      ],
      case_priority: ["Normal", "VIP"],
      delivery_method: ["Home Delivery", "Airport Pickup"],
      delivery_stage: [
        "Ready for Delivery",
        "Scheduled",
        "Assigned",
        "Driver Accepted",
        "Collected Bag",
        "Out for Delivery",
        "Delivered",
        "Delivery Failed",
        "Returned to Airport",
      ],
      incident_severity: ["High", "Medium", "Low"],
      incident_state: ["Open", "Under Review", "Resolved"],
      lf_status: [
        "Open",
        "Tracing",
        "Located",
        "Arrived at Airport",
        "Waiting Customs Clearance",
        "Ready for Delivery",
        "Assigned Driver",
        "Out for Delivery",
        "Delivered",
        "Closed",
      ],
      notification_channel: ["sms", "whatsapp", "email", "push"],
      notification_state: ["queued", "sending", "sent", "failed", "cancelled"],
      otp_state: ["Pending", "Sent", "Verified", "Failed", "Expired"],
      timeline_module: [
        "lost_found",
        "delivery",
        "agent_portal",
        "passenger_portal",
        "workflow",
        "notification",
        "otp",
        "feedback",
        "quality",
        "admin",
        "system",
      ],
      workflow_status: [
        "PIR_CREATED",
        "HOME_DELIVERY_REQUESTED",
        "DELIVERY_APPROVED",
        "DRIVER_ASSIGNED",
        "READY_FOR_COLLECTION",
        "CLAIMED_ON_HAND",
        "OUT_FOR_DELIVERY",
        "DRIVER_ARRIVED",
        "OTP_VERIFIED",
        "DELIVERED",
        "FEEDBACK_SUBMITTED",
        "CLOSED",
      ],
    },
  },
} as const
