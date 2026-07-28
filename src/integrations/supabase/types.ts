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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _passenger_apply_action: {
        Args: { p_action: string; p_token: string }
        Returns: boolean
      }
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
