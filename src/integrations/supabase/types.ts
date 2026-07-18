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
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          metadata: Json
          role: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          role?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          role?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      baggage_cases: {
        Row: {
          airline: string | null
          bag_description: string | null
          bag_id: string
          bag_tags: string[]
          created_at: string
          delivery_address: string | null
          delivery_method: string | null
          delivery_notes: string | null
          destination: string | null
          flight_date: string | null
          flight_number: string | null
          handover_delivery_id: string | null
          id: string
          incomplete: boolean
          lf_status: string
          number_of_bags: number
          origin: string | null
          passenger_email: string | null
          passenger_first_name: string | null
          passenger_last_name: string | null
          passenger_mobile: string | null
          pir_number: string
          preferred_language: string | null
          priority: string
          updated_at: string
        }
        Insert: {
          airline?: string | null
          bag_description?: string | null
          bag_id: string
          bag_tags?: string[]
          created_at?: string
          delivery_address?: string | null
          delivery_method?: string | null
          delivery_notes?: string | null
          destination?: string | null
          flight_date?: string | null
          flight_number?: string | null
          handover_delivery_id?: string | null
          id?: string
          incomplete?: boolean
          lf_status?: string
          number_of_bags?: number
          origin?: string | null
          passenger_email?: string | null
          passenger_first_name?: string | null
          passenger_last_name?: string | null
          passenger_mobile?: string | null
          pir_number: string
          preferred_language?: string | null
          priority?: string
          updated_at?: string
        }
        Update: {
          airline?: string | null
          bag_description?: string | null
          bag_id?: string
          bag_tags?: string[]
          created_at?: string
          delivery_address?: string | null
          delivery_method?: string | null
          delivery_notes?: string | null
          destination?: string | null
          flight_date?: string | null
          flight_number?: string | null
          handover_delivery_id?: string | null
          id?: string
          incomplete?: boolean
          lf_status?: string
          number_of_bags?: number
          origin?: string | null
          passenger_email?: string | null
          passenger_first_name?: string | null
          passenger_last_name?: string | null
          passenger_mobile?: string | null
          pir_number?: string
          preferred_language?: string | null
          priority?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "baggage_cases_handover_fk"
            columns: ["handover_delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          address: string
          airline: string | null
          bag_tag: string | null
          case_id: string
          created_at: string
          delivered_at: string | null
          delivery_id: string
          driver: string | null
          driver_accepted_at: string | null
          driver_assigned_at: string | null
          fail_reason: string | null
          flight_number: string | null
          id: string
          method: string
          mobile: string
          notes: string | null
          otp_code: string | null
          otp_issued_at: string | null
          otp_verified: boolean
          passenger_name: string
          pir_number: string
          priority: string
          stage: string
          tracking_token: string
          trip_started_at: string | null
          updated_at: string
        }
        Insert: {
          address: string
          airline?: string | null
          bag_tag?: string | null
          case_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_id: string
          driver?: string | null
          driver_accepted_at?: string | null
          driver_assigned_at?: string | null
          fail_reason?: string | null
          flight_number?: string | null
          id?: string
          method?: string
          mobile: string
          notes?: string | null
          otp_code?: string | null
          otp_issued_at?: string | null
          otp_verified?: boolean
          passenger_name: string
          pir_number: string
          priority?: string
          stage?: string
          tracking_token: string
          trip_started_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          airline?: string | null
          bag_tag?: string | null
          case_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_id?: string
          driver?: string | null
          driver_accepted_at?: string | null
          driver_assigned_at?: string | null
          fail_reason?: string | null
          flight_number?: string | null
          id?: string
          method?: string
          mobile?: string
          notes?: string | null
          otp_code?: string | null
          otp_issued_at?: string | null
          otp_verified?: boolean
          passenger_name?: string
          pir_number?: string
          priority?: string
          stage?: string
          tracking_token?: string
          trip_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_assignments_history: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          delivery_id: string
          driver: string
          id: string
          reason: string | null
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          delivery_id: string
          driver: string
          id?: string
          reason?: string | null
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          delivery_id?: string
          driver?: string
          id?: string
          reason?: string | null
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_assignments_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          case_id: string | null
          channel: string
          created_at: string
          delivery_id: string | null
          error: string | null
          id: string
          locale: string
          sent_at: string | null
          status: string
          subject: string | null
          template_key: string | null
        }
        Insert: {
          body: string
          case_id?: string | null
          channel: string
          created_at?: string
          delivery_id?: string | null
          error?: string | null
          id?: string
          locale?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
        }
        Update: {
          body?: string
          case_id?: string | null
          channel?: string
          created_at?: string
          delivery_id?: string | null
          error?: string | null
          id?: string
          locale?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_entries: {
        Row: {
          actor: string | null
          case_id: string | null
          created_at: string
          delivery_id: string | null
          id: string
          kind: string
          message: string
          role: string | null
        }
        Insert: {
          actor?: string | null
          case_id?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          kind: string
          message: string
          role?: string | null
        }
        Update: {
          actor?: string | null
          case_id?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          kind?: string
          message?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "baggage_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_entries_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
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
          actor: string | null
          case_id: string | null
          created_at: string
          delivery_id: string | null
          from_status: string | null
          id: string
          reason: string | null
          role: string | null
          to_status: string
        }
        Insert: {
          actor?: string | null
          case_id?: string | null
          created_at?: string
          delivery_id?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          role?: string | null
          to_status: string
        }
        Update: {
          actor?: string | null
          case_id?: string | null
          created_at?: string
          delivery_id?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          role?: string | null
          to_status?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
    },
  },
} as const
