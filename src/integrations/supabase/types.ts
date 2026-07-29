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
      agent_positions: {
        Row: {
          accuracy: number | null
          agent_id: string
          lat: number
          lng: number
          reported_at: string
          updated_at: string
          version: number
        }
        Insert: {
          accuracy?: number | null
          agent_id: string
          lat: number
          lng: number
          reported_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          accuracy?: number | null
          agent_id?: string
          lat?: number
          lng?: number
          reported_at?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_positions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_route_stops: {
        Row: {
          delivery_id: string
          id: string
          label: string
          lat: number | null
          leg_km: number
          lng: number | null
          route_id: string
          seq: number
        }
        Insert: {
          delivery_id: string
          id?: string
          label?: string
          lat?: number | null
          leg_km?: number
          lng?: number | null
          route_id: string
          seq: number
        }
        Update: {
          delivery_id?: string
          id?: string
          label?: string
          lat?: number | null
          leg_km?: number
          lng?: number | null
          route_id?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_route_stops_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "agent_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_routes: {
        Row: {
          agent_id: string
          computed_at: string
          id: string
          origin_label: string
          origin_lat: number
          origin_lng: number
          total_km: number
          updated_at: string
          version: number
        }
        Insert: {
          agent_id: string
          computed_at?: string
          id?: string
          origin_label?: string
          origin_lat: number
          origin_lng: number
          total_km?: number
          updated_at?: string
          version?: number
        }
        Update: {
          agent_id?: string
          computed_at?: string
          id?: string
          origin_label?: string
          origin_lat?: number
          origin_lng?: number
          total_km?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_routes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
          pir_number: string | null
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
          pir_number?: string | null
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
          pir_number?: string | null
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
      notification_attempts: {
        Row: {
          attempt_no: number
          attempted_at: string
          error: string
          id: number
          notification_id: string
          provider: string
          provider_message_id: string | null
          succeeded: boolean
        }
        Insert: {
          attempt_no: number
          attempted_at?: string
          error?: string
          id?: never
          notification_id: string
          provider?: string
          provider_message_id?: string | null
          succeeded?: boolean
        }
        Update: {
          attempt_no?: number
          attempted_at?: string
          error?: string
          id?: never
          notification_id?: string
          provider?: string
          provider_message_id?: string | null
          succeeded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_attempts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          attempt_count: number
          body: string
          case_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivery_id: string | null
          failure_reason: string
          id: string
          last_attempt_at: string | null
          locale: string
          next_attempt_at: string
          provider: string | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          state: Database["public"]["Enums"]["notification_state"]
          subject: string
          trigger_status: Database["public"]["Enums"]["workflow_status"]
          updated_at: string
          version: number
        }
        Insert: {
          attempt_count?: number
          body?: string
          case_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivery_id?: string | null
          failure_reason?: string
          id?: string
          last_attempt_at?: string | null
          locale?: string
          next_attempt_at?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notification_state"]
          subject?: string
          trigger_status: Database["public"]["Enums"]["workflow_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          attempt_count?: number
          body?: string
          case_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivery_id?: string | null
          failure_reason?: string
          id?: string
          last_attempt_at?: string | null
          locale?: string
          next_attempt_at?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notification_state"]
          subject?: string
          trigger_status?: Database["public"]["Enums"]["workflow_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_challenges: {
        Row: {
          attempts: number
          code: string
          created_at: string
          delivery_id: string
          expires_at: string
          id: string
          issued_at: string
          issued_by: string | null
          locked_at: string | null
          max_attempts: number
          state: Database["public"]["Enums"]["otp_state"]
          updated_at: string
          verified_at: string | null
          version: number
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          delivery_id: string
          expires_at: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          locked_at?: string | null
          max_attempts?: number
          state?: Database["public"]["Enums"]["otp_state"]
          updated_at?: string
          verified_at?: string | null
          version?: number
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          delivery_id?: string
          expires_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          locked_at?: string | null
          max_attempts?: number
          state?: Database["public"]["Enums"]["otp_state"]
          updated_at?: string
          verified_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "otp_challenges_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_feedback: {
        Row: {
          case_id: string
          comments: string
          delivery_id: string
          id: string
          link_id: string | null
          rating: number
          resolved: boolean
          submitted_at: string
        }
        Insert: {
          case_id: string
          comments?: string
          delivery_id: string
          id?: string
          link_id?: string | null
          rating: number
          resolved?: boolean
          submitted_at?: string
        }
        Update: {
          case_id?: string
          comments?: string
          delivery_id?: string
          id?: string
          link_id?: string | null
          rating?: number
          resolved?: boolean
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passenger_feedback_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_feedback_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_feedback_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "passenger_links"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_links: {
        Row: {
          case_id: string
          channel: string
          created_at: string
          delivery_id: string
          expires_at: string | null
          id: string
          issued_at: string
          last_viewed_at: string | null
          revoked_at: string | null
          token: string
          updated_at: string
          version: number
          view_count: number
        }
        Insert: {
          case_id: string
          channel?: string
          created_at?: string
          delivery_id: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          last_viewed_at?: string | null
          revoked_at?: string | null
          token: string
          updated_at?: string
          version?: number
          view_count?: number
        }
        Update: {
          case_id?: string
          channel?: string
          created_at?: string
          delivery_id?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          last_viewed_at?: string | null
          revoked_at?: string | null
          token?: string
          updated_at?: string
          version?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "passenger_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_links_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_view: {
        Row: {
          airline: string | null
          bag_tag: string | null
          case_id: string
          delivered_at: string | null
          delivery_id: string
          flight_date: string | null
          flight_no: string | null
          otp_code: string | null
          otp_state: Database["public"]["Enums"]["otp_state"] | null
          passenger_name: string
          pir_number: string
          stage: Database["public"]["Enums"]["delivery_stage"]
          updated_at: string
          workflow_status: Database["public"]["Enums"]["workflow_status"]
        }
        Insert: {
          airline?: string | null
          bag_tag?: string | null
          case_id: string
          delivered_at?: string | null
          delivery_id: string
          flight_date?: string | null
          flight_no?: string | null
          otp_code?: string | null
          otp_state?: Database["public"]["Enums"]["otp_state"] | null
          passenger_name?: string
          pir_number?: string
          stage: Database["public"]["Enums"]["delivery_stage"]
          updated_at?: string
          workflow_status: Database["public"]["Enums"]["workflow_status"]
        }
        Update: {
          airline?: string | null
          bag_tag?: string | null
          case_id?: string
          delivered_at?: string | null
          delivery_id?: string
          flight_date?: string | null
          flight_no?: string | null
          otp_code?: string | null
          otp_state?: Database["public"]["Enums"]["otp_state"] | null
          passenger_name?: string
          pir_number?: string
          stage?: Database["public"]["Enums"]["delivery_stage"]
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "passenger_view_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_view_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_incidents: {
        Row: {
          case_id: string | null
          category: string
          created_at: string
          delivery_id: string | null
          description: string
          id: string
          reported_by: string
          resolution_note: string
          resolved_at: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          state: Database["public"]["Enums"]["incident_state"]
          updated_at: string
          version: number
        }
        Insert: {
          case_id?: string | null
          category: string
          created_at?: string
          delivery_id?: string | null
          description?: string
          id?: string
          reported_by?: string
          resolution_note?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          state?: Database["public"]["Enums"]["incident_state"]
          updated_at?: string
          version?: number
        }
        Update: {
          case_id?: string | null
          category?: string
          created_at?: string
          delivery_id?: string | null
          description?: string
          id?: string
          reported_by?: string
          resolution_note?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          state?: Database["public"]["Enums"]["incident_state"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_incidents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_incidents_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
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
      agent_advance: {
        Args: {
          p_delivery: string
          p_expected_version?: number
          p_to: Database["public"]["Enums"]["delivery_stage"]
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_complete_delivery: {
        Args: { p_code: string; p_delivery: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_owns: { Args: { p_delivery: string }; Returns: boolean }
      agent_report_position: {
        Args: { p_accuracy?: number; p_lat: number; p_lng: number }
        Returns: undefined
      }
      current_app_user_id: { Args: never; Returns: string }
      current_user_permissions: {
        Args: never
        Returns: {
          action: string
          module: string
        }[]
      }
      dm_add_note: {
        Args: { p_body: string; p_delivery: string }
        Returns: string
      }
      dm_assign_agent: {
        Args: {
          p_agent: string
          p_delivery: string
          p_expected_version?: number
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dm_close: {
        Args: { p_delivery: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dm_mark_failed: {
        Args: {
          p_delivery: string
          p_expected_version?: number
          p_note?: string
          p_reason_code: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dm_mark_returned: {
        Args: { p_delivery: string; p_expected_version?: number }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dm_resend_otp: { Args: { p_delivery: string }; Returns: boolean }
      dm_schedule: {
        Args: {
          p_delivery: string
          p_expected_version?: number
          p_scheduled_for: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      lf_bulk_set_status: {
        Args: {
          p_cases: string[]
          p_status: Database["public"]["Enums"]["lf_status"]
        }
        Returns: number
      }
      lf_create_case: { Args: { p_payload: Json }; Returns: string }
      lf_set_status: {
        Args: {
          p_case: string
          p_expected_version?: number
          p_status: Database["public"]["Enums"]["lf_status"]
        }
        Returns: {
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
          pir_number: string | null
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
        SetofOptions: {
          from: "*"
          to: "baggage_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lf_update_case: {
        Args: { p_case: string; p_expected_version?: number; p_payload: Json }
        Returns: {
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
          pir_number: string | null
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
        SetofOptions: {
          from: "*"
          to: "baggage_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_delivery_agents: {
        Args: never
        Returns: {
          employee_id: string
          full_name: string
          id: string
          station: string
        }[]
      }
      list_staff_officers: {
        Args: never
        Returns: {
          department: string
          employee_id: string
          full_name: string
          id: string
        }[]
      }
      login_identity_for_username: {
        Args: { _username: string }
        Returns: string
      }
      next_case_no: { Args: never; Returns: string }
      next_delivery_no: { Args: never; Returns: string }
      notif_claim_batch: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          body: string
          case_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivery_id: string | null
          failure_reason: string
          id: string
          last_attempt_at: string | null
          locale: string
          next_attempt_at: string
          provider: string | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          state: Database["public"]["Enums"]["notification_state"]
          subject: string
          trigger_status: Database["public"]["Enums"]["workflow_status"]
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      notif_record_result: {
        Args: {
          p_error?: string
          p_id: string
          p_provider: string
          p_provider_message_id?: string
          p_success: boolean
        }
        Returns: undefined
      }
      passenger_get_view: { Args: { p_token: string }; Returns: Json }
      passenger_report_misconduct: {
        Args: { p_details?: string; p_token: string }
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
      wf_actor: {
        Args: never
        Returns: {
          app_user_id: string
          display_name: string
          role_key: string
        }[]
      }
      wf_assert_version: {
        Args: { p_delivery: string; p_expected_version: number }
        Returns: undefined
      }
      wf_ensure_passenger_link: {
        Args: { p_delivery: string }
        Returns: string
      }
      wf_journal: {
        Args: {
          p_action: string
          p_case: string
          p_delivery: string
          p_detail: string
          p_from: Database["public"]["Enums"]["workflow_status"]
          p_from_stage: Database["public"]["Enums"]["delivery_stage"]
          p_metadata?: Json
          p_module: Database["public"]["Enums"]["timeline_module"]
          p_reason?: string
          p_title: string
          p_to: Database["public"]["Enums"]["workflow_status"]
          p_to_stage: Database["public"]["Enums"]["delivery_stage"]
        }
        Returns: undefined
      }
      wf_journal_event: {
        Args: {
          p_action?: string
          p_case?: string
          p_delivery?: string
          p_detail?: string
          p_metadata?: Json
          p_module: Database["public"]["Enums"]["timeline_module"]
          p_title: string
        }
        Returns: undefined
      }
      wf_lf_workflow: {
        Args: { p: Database["public"]["Enums"]["lf_status"] }
        Returns: Database["public"]["Enums"]["workflow_status"]
      }
      wf_open_delivery: {
        Args: { p_case: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wf_queue_notification: {
        Args: {
          p_delivery: string
          p_trigger: Database["public"]["Enums"]["workflow_status"]
        }
        Returns: undefined
      }
      wf_recompute_route: { Args: { p_agent: string }; Returns: undefined }
      wf_refresh_passenger_view: {
        Args: { p_delivery: string }
        Returns: undefined
      }
      wf_require: { Args: { p_roles: string[] }; Returns: undefined }
      wf_stage_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["delivery_stage"]
          p_to: Database["public"]["Enums"]["delivery_stage"]
        }
        Returns: boolean
      }
      wf_stage_lf: {
        Args: { p: Database["public"]["Enums"]["delivery_stage"] }
        Returns: Database["public"]["Enums"]["lf_status"]
      }
      wf_stage_workflow: {
        Args: { p: Database["public"]["Enums"]["delivery_stage"] }
        Returns: Database["public"]["Enums"]["workflow_status"]
      }
      wf_transition: {
        Args: {
          p_delivery: string
          p_expected_version?: number
          p_metadata?: Json
          p_reason?: string
          p_to: Database["public"]["Enums"]["delivery_stage"]
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
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
