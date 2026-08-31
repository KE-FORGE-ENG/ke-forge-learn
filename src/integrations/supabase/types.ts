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
      bookmarks: {
        Row: {
          color: string
          created_at: string
          document_id: string | null
          id: string
          note: string | null
          page: number
          plan_id: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          document_id?: string | null
          id?: string
          note?: string | null
          page: number
          plan_id?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          document_id?: string | null
          id?: string
          note?: string | null
          page?: number
          plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          day: number | null
          id: string
          plan_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          day?: number | null
          id?: string
          plan_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          day?: number | null
          id?: string
          plan_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_sessions: {
        Row: {
          completed: boolean
          content: Json | null
          created_at: string
          day: number
          id: string
          plan_id: string
          simplified: Json | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          content?: Json | null
          created_at?: string
          day: number
          id?: string
          plan_id: string
          simplified?: Json | null
          user_id: string
        }
        Update: {
          completed?: boolean
          content?: Json | null
          created_at?: string
          day?: number
          id?: string
          plan_id?: string
          simplified?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_progress: {
        Row: {
          created_at: string
          id: string
          mode: string
          notes_text: string | null
          plan_id: string | null
          position: number
          topic: string | null
          updated_at: string
          user_id: string
          web_search: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          notes_text?: string | null
          plan_id?: string | null
          position?: number
          topic?: string | null
          updated_at?: string
          user_id: string
          web_search?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          notes_text?: string | null
          plan_id?: string | null
          position?: number
          topic?: string | null
          updated_at?: string
          user_id?: string
          web_search?: boolean
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          id: string
          page_count: number
          pages: Json
          source_type: string
          storage_path: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_count?: number
          pages?: Json
          source_type: string
          storage_path?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_count?: number
          pages?: Json
          source_type?: string
          storage_path?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          day: number | null
          due_at: string
          ease: number
          front: string
          id: string
          interval_days: number
          last_reviewed_at: string | null
          plan_id: string | null
          reps: number
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          day?: number | null
          due_at?: string
          ease?: number
          front: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          plan_id?: string | null
          reps?: number
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          day?: number | null
          due_at?: string
          ease?: number
          front?: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          plan_id?: string | null
          reps?: number
          user_id?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          points: number
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          points?: number
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_plans: {
        Row: {
          created_at: string
          current_day: number
          days: number
          document_id: string
          id: string
          is_public: boolean
          page_chunks: Json
          share_token: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_day?: number
          days: number
          document_id: string
          id?: string
          is_public?: boolean
          page_chunks?: Json
          share_token?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_day?: number
          days?: number
          document_id?: string
          id?: string
          is_public?: boolean
          page_chunks?: Json
          share_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_plans_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_profiles: {
        Row: {
          created_at: string
          id: string
          profile: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mindmaps: {
        Row: {
          created_at: string
          data: Json
          id: string
          plan_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          plan_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          answers: Json | null
          created_at: string
          day: number | null
          id: string
          plan_id: string
          questions: Json
          score: number | null
          user_id: string
          weak_areas: Json | null
        }
        Insert: {
          answers?: Json | null
          created_at?: string
          day?: number | null
          id?: string
          plan_id: string
          questions: Json
          score?: number | null
          user_id: string
          weak_areas?: Json | null
        }
        Update: {
          answers?: Json | null
          created_at?: string
          day?: number | null
          id?: string
          plan_id?: string
          questions?: Json
          score?: number | null
          user_id?: string
          weak_areas?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_settings: {
        Row: {
          created_at: string
          enabled: boolean
          last_notified_at: string | null
          time_of_day: string
          timezone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          last_notified_at?: string | null
          time_of_day?: string
          timezone?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          last_notified_at?: string | null
          time_of_day?: string
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      study_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          join_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          join_code?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          join_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      user_interactions: {
        Row: {
          created_at: string
          day: number | null
          id: string
          kind: string
          payload: Json | null
          plan_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: number | null
          id?: string
          kind: string
          payload?: Json | null
          plan_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day?: number | null
          id?: string
          kind?: string
          payload?: Json | null
          plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
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
