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
      entreprises: {
        Row: {
          created_at: string
          id: string
          nom: string
          owner_id: string
          ville: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          owner_id: string
          ville?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          owner_id?: string
          ville?: string
        }
        Relationships: []
      }
      manuscrits: {
        Row: {
          auteur: string
          created_at: string
          entreprise_id: string
          genre: string | null
          id: string
          langue: string | null
          statut: Database["public"]["Enums"]["manuscrit_statut"]
          titre: string
        }
        Insert: {
          auteur: string
          created_at?: string
          entreprise_id: string
          genre?: string | null
          id?: string
          langue?: string | null
          statut?: Database["public"]["Enums"]["manuscrit_statut"]
          titre: string
        }
        Update: {
          auteur?: string
          created_at?: string
          entreprise_id?: string
          genre?: string | null
          id?: string
          langue?: string | null
          statut?: Database["public"]["Enums"]["manuscrit_statut"]
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "manuscrits_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          entreprise_id: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          entreprise_id?: string | null
          full_name: string
          id: string
        }
        Update: {
          created_at?: string
          entreprise_id?: string | null
          full_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      stocks: {
        Row: {
          created_at: string
          entreprise_id: string
          exemplaires_restants: number
          exemplaires_total: number
          id: string
          manuscrit_id: string
        }
        Insert: {
          created_at?: string
          entreprise_id: string
          exemplaires_restants?: number
          exemplaires_total?: number
          id?: string
          manuscrit_id: string
        }
        Update: {
          created_at?: string
          entreprise_id?: string
          exemplaires_restants?: number
          exemplaires_total?: number
          id?: string
          manuscrit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocks_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocks_manuscrit_id_fkey"
            columns: ["manuscrit_id"]
            isOneToOne: false
            referencedRelation: "manuscrits"
            referencedColumns: ["id"]
          },
        ]
      }
      ventes: {
        Row: {
          created_at: string
          entreprise_id: string
          id: string
          manuscrit_id: string
          montant: number
          statut_paiement: Database["public"]["Enums"]["paiement_statut"]
        }
        Insert: {
          created_at?: string
          entreprise_id: string
          id?: string
          manuscrit_id: string
          montant?: number
          statut_paiement?: Database["public"]["Enums"]["paiement_statut"]
        }
        Update: {
          created_at?: string
          entreprise_id?: string
          id?: string
          manuscrit_id?: string
          montant?: number
          statut_paiement?: Database["public"]["Enums"]["paiement_statut"]
        }
        Relationships: [
          {
            foreignKeyName: "ventes_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_manuscrit_id_fkey"
            columns: ["manuscrit_id"]
            isOneToOne: false
            referencedRelation: "manuscrits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_entreprise_id: { Args: never; Returns: string }
    }
    Enums: {
      manuscrit_statut:
        | "recu"
        | "lecture"
        | "correction"
        | "maquette"
        | "impression"
        | "publie"
      paiement_statut: "en_attente" | "paye" | "annule"
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
      manuscrit_statut: [
        "recu",
        "lecture",
        "correction",
        "maquette",
        "impression",
        "publie",
      ],
      paiement_statut: ["en_attente", "paye", "annule"],
    },
  },
} as const
