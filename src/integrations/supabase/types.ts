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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      clinical_daily_usage: {
        Row: {
          day: string
          kind: string
          used: number
          user_id: string
        }
        Insert: {
          day: string
          kind: string
          used?: number
          user_id: string
        }
        Update: {
          day?: string
          kind?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      clinician_profiles: {
        Row: {
          ai_instructions: string
          language: string
          name: string
          recording_preferences: Json
          specialty: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_instructions?: string
          language?: string
          name?: string
          recording_preferences?: Json
          specialty?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_instructions?: string
          language?: string
          name?: string
          recording_preferences?: Json
          specialty?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consultations: {
        Row: {
          clinician_id: string
          consent_at: string | null
          consent_notice_version: string | null
          created_at: string
          duration_seconds: number
          id: string
          mode: string
          patient_age: number | null
          patient_identifier: string
          patient_instructions: string
          patient_name: string
          patient_sex: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clinician_id: string
          consent_at?: string | null
          consent_notice_version?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          mode: string
          patient_age?: number | null
          patient_identifier?: string
          patient_instructions?: string
          patient_name?: string
          patient_sex?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinician_id?: string
          consent_at?: string | null
          consent_notice_version?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          mode?: string
          patient_age?: number | null
          patient_identifier?: string
          patient_instructions?: string
          patient_name?: string
          patient_sex?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      demo_quota_counters: {
        Row: {
          bucket: string
          used: number
          window_start: string
        }
        Insert: {
          bucket: string
          used?: number
          window_start?: string
        }
        Update: {
          bucket?: string
          used?: number
          window_start?: string
        }
        Relationships: []
      }
      report_section_audit: {
        Row: {
          action: string
          actor: string | null
          at: string
          clinician_id: string
          consultation_id: string
          content_length: number
          content_sha256: string
          id: number
          section: string
          verified: boolean
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string
          clinician_id: string
          consultation_id: string
          content_length: number
          content_sha256: string
          id?: number
          section: string
          verified: boolean
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          clinician_id?: string
          consultation_id?: string
          content_length?: number
          content_sha256?: string
          id?: number
          section?: string
          verified?: boolean
        }
        Relationships: []
      }
      report_sections: {
        Row: {
          clinician_id: string
          consultation_id: string
          content: string
          section: string
          verified_at: string | null
        }
        Insert: {
          clinician_id: string
          consultation_id: string
          content?: string
          section: string
          verified_at?: string | null
        }
        Update: {
          clinician_id?: string
          consultation_id?: string
          content?: string
          section?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_sections_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      request_limits: {
        Row: {
          request_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          request_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          request_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      service_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      session_chat_messages: {
        Row: {
          clinician_id: string
          consultation_id: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          clinician_id: string
          consultation_id: string
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          clinician_id?: string
          consultation_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_chat_messages_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      specialty_templates: {
        Row: {
          id: string
          instructions: string
          specialty: string
          updated_at: string
        }
        Insert: {
          id?: string
          instructions?: string
          specialty: string
          updated_at?: string
        }
        Update: {
          id?: string
          instructions?: string
          specialty?: string
          updated_at?: string
        }
        Relationships: []
      }
      transcript_segments: {
        Row: {
          client_seq: number | null
          clinician_id: string
          consultation_id: string
          created_at: string
          id: string
          seconds: number
          speaker: string
          speaker_id: string | null
          text: string
        }
        Insert: {
          client_seq?: number | null
          clinician_id: string
          consultation_id: string
          created_at?: string
          id?: string
          seconds?: number
          speaker: string
          speaker_id?: string | null
          text: string
        }
        Update: {
          client_seq?: number | null
          clinician_id?: string
          consultation_id?: string
          created_at?: string
          id?: string
          seconds?: number
          speaker?: string
          speaker_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_phrases: {
        Row: {
          clinician_id: string
          id: string
          replacement: string
          source: string
        }
        Insert: {
          clinician_id: string
          id?: string
          replacement: string
          source: string
        }
        Update: {
          clinician_id?: string
          id?: string
          replacement?: string
          source?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      current_user_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      demo_consume: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: number
      }
      demo_quota_cleanup: { Args: never; Returns: number }
      demo_reserve: {
        Args: { _buckets: string[]; _limits: number[]; _windows: number[] }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_clinical_user: { Args: never; Returns: boolean }
      reserve_clinical_budget: { Args: { _kind: string }; Returns: number }
      reserve_clinical_request: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "clinician"
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
    Enums: {
      app_role: ["admin", "clinician"],
    },
  },
} as const
