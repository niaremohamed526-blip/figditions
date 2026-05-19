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
      auteurs: {
        Row: {
          created_at: string
          email: string | null
          entreprise_id: string
          id: string
          nom_complet: string
          numero_mobile_money: string | null
          operateur:
            | Database["public"]["Enums"]["mobile_money_operateur"]
            | null
          telephone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          entreprise_id: string
          id?: string
          nom_complet: string
          numero_mobile_money?: string | null
          operateur?:
            | Database["public"]["Enums"]["mobile_money_operateur"]
            | null
          telephone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          entreprise_id?: string
          id?: string
          nom_complet?: string
          numero_mobile_money?: string | null
          operateur?:
            | Database["public"]["Enums"]["mobile_money_operateur"]
            | null
          telephone?: string | null
        }
        Relationships: []
      }
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
      estimations_cout: {
        Row: {
          cout_couverture: number
          cout_papier: number
          cout_total: number
          created_at: string
          droits_auteur: number
          entreprise_id: string
          id: string
          inclure_delestage: boolean
          manuscrit_id: string | null
          manuscrit_titre: string
          marge_librairie: number
          nombre_exemplaires: number
          nombre_pages: number
          prix_vente_suggere: number
          surcout_delestage: number
          type_couverture: Database["public"]["Enums"]["couverture_type"]
        }
        Insert: {
          cout_couverture: number
          cout_papier: number
          cout_total: number
          created_at?: string
          droits_auteur: number
          entreprise_id: string
          id?: string
          inclure_delestage?: boolean
          manuscrit_id?: string | null
          manuscrit_titre: string
          marge_librairie: number
          nombre_exemplaires: number
          nombre_pages: number
          prix_vente_suggere: number
          surcout_delestage: number
          type_couverture: Database["public"]["Enums"]["couverture_type"]
        }
        Update: {
          cout_couverture?: number
          cout_papier?: number
          cout_total?: number
          created_at?: string
          droits_auteur?: number
          entreprise_id?: string
          id?: string
          inclure_delestage?: boolean
          manuscrit_id?: string | null
          manuscrit_titre?: string
          marge_librairie?: number
          nombre_exemplaires?: number
          nombre_pages?: number
          prix_vente_suggere?: number
          surcout_delestage?: number
          type_couverture?: Database["public"]["Enums"]["couverture_type"]
        }
        Relationships: []
      }
      manuscrits: {
        Row: {
          auteur: string
          auteur_id: string | null
          created_at: string
          entreprise_id: string
          genre: string | null
          id: string
          langue: string | null
          nombre_pages: number | null
          statut: Database["public"]["Enums"]["manuscrit_statut"]
          titre: string
        }
        Insert: {
          auteur: string
          auteur_id?: string | null
          created_at?: string
          entreprise_id: string
          genre?: string | null
          id?: string
          langue?: string | null
          nombre_pages?: number | null
          statut?: Database["public"]["Enums"]["manuscrit_statut"]
          titre: string
        }
        Update: {
          auteur?: string
          auteur_id?: string | null
          created_at?: string
          entreprise_id?: string
          genre?: string | null
          id?: string
          langue?: string | null
          nombre_pages?: number | null
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
          derniere_visite: string | null
          entreprise_id: string
          exemplaires_deposes: number
          exemplaires_restants: number
          exemplaires_total: number
          exemplaires_vendus: number
          id: string
          librairie_adresse: string | null
          librairie_nom: string | null
          manuscrit_id: string
        }
        Insert: {
          created_at?: string
          derniere_visite?: string | null
          entreprise_id: string
          exemplaires_deposes?: number
          exemplaires_restants?: number
          exemplaires_total?: number
          exemplaires_vendus?: number
          id?: string
          librairie_adresse?: string | null
          librairie_nom?: string | null
          manuscrit_id: string
        }
        Update: {
          created_at?: string
          derniere_visite?: string | null
          entreprise_id?: string
          exemplaires_deposes?: number
          exemplaires_restants?: number
          exemplaires_total?: number
          exemplaires_vendus?: number
          id?: string
          librairie_adresse?: string | null
          librairie_nom?: string | null
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
          droits_auteur_fcfa: number
          entreprise_id: string
          id: string
          manuscrit_id: string
          montant: number
          statut_paiement: Database["public"]["Enums"]["paiement_statut"]
        }
        Insert: {
          created_at?: string
          droits_auteur_fcfa?: number
          entreprise_id: string
          id?: string
          manuscrit_id: string
          montant?: number
          statut_paiement?: Database["public"]["Enums"]["paiement_statut"]
        }
        Update: {
          created_at?: string
          droits_auteur_fcfa?: number
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
      couverture_type: "Souple" | "Rigide"
      manuscrit_statut:
        | "recu"
        | "lecture"
        | "correction"
        | "maquette"
        | "impression"
        | "publie"
      mobile_money_operateur: "Orange Money" | "Moov Money"
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
      couverture_type: ["Souple", "Rigide"],
      manuscrit_statut: [
        "recu",
        "lecture",
        "correction",
        "maquette",
        "impression",
        "publie",
      ],
      mobile_money_operateur: ["Orange Money", "Moov Money"],
      paiement_statut: ["en_attente", "paye", "annule"],
    },
  },
} as const
