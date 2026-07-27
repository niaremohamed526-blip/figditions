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
      abonnements: {
        Row: {
          created_at: string
          created_by: string | null
          date_debut: string | null
          date_fin: string | null
          entreprise_id: string
          id: string
          montant_fcfa: number
          paydunya_checkout_url: string | null
          paydunya_token: string | null
          periode: string
          plan: string
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          entreprise_id: string
          id?: string
          montant_fcfa: number
          paydunya_checkout_url?: string | null
          paydunya_token?: string | null
          periode: string
          plan: string
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          entreprise_id?: string
          id?: string
          montant_fcfa?: number
          paydunya_checkout_url?: string | null
          paydunya_token?: string | null
          periode?: string
          plan?: string
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      bordereaux: {
        Row: {
          annee: number
          created_at: string
          created_by: string | null
          entreprise_id: string
          id: string
          librairie_adresse: string | null
          librairie_nom: string
          lignes: Json
          notes: string | null
          numero: string
          periode_debut: string | null
          periode_fin: string | null
          total_exemplaires: number
          total_fcfa: number
          type: string
          updated_at: string
        }
        Insert: {
          annee: number
          created_at?: string
          created_by?: string | null
          entreprise_id: string
          id?: string
          librairie_adresse?: string | null
          librairie_nom: string
          lignes?: Json
          notes?: string | null
          numero: string
          periode_debut?: string | null
          periode_fin?: string | null
          total_exemplaires?: number
          total_fcfa?: number
          type: string
          updated_at?: string
        }
        Update: {
          annee?: number
          created_at?: string
          created_by?: string | null
          entreprise_id?: string
          id?: string
          librairie_adresse?: string | null
          librairie_nom?: string
          lignes?: Json
          notes?: string | null
          numero?: string
          periode_debut?: string | null
          periode_fin?: string | null
          total_exemplaires?: number
          total_fcfa?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bordereaux_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      contrats: {
        Row: {
          adresse_auteur: string | null
          auteur_id: string | null
          banque: string | null
          cachet_url: string | null
          collection: string | null
          compte_bancaire: string | null
          contribution_auteur: string | null
          created_at: string
          date_signature: string | null
          duree: string
          duree_annees: number
          entreprise_id: string
          exemplaires_auteur: number
          format: string | null
          frequence_paiement: string
          id: string
          lieu_signature: string
          livres: Json
          manuscrit_id: string
          nif_editeur: string | null
          nina_editeur: string | null
          nom_representant_editeur: string | null
          notes: string | null
          pourcentage_droits: number
          profession_auteur: string | null
          qualite_representant: string | null
          rccm_editeur: string | null
          reliure: string | null
          statut: Database["public"]["Enums"]["contrat_statut"]
          telephone_auteur: string | null
          territoire_ci: number
          territoire_france: number
          territoire_mali: number
          territoire_senegal: number
          tirage_minimum: number
          type_couverture: string | null
        }
        Insert: {
          adresse_auteur?: string | null
          auteur_id?: string | null
          banque?: string | null
          cachet_url?: string | null
          collection?: string | null
          compte_bancaire?: string | null
          contribution_auteur?: string | null
          created_at?: string
          date_signature?: string | null
          duree?: string
          duree_annees?: number
          entreprise_id: string
          exemplaires_auteur?: number
          format?: string | null
          frequence_paiement?: string
          id?: string
          lieu_signature?: string
          livres?: Json
          manuscrit_id: string
          nif_editeur?: string | null
          nina_editeur?: string | null
          nom_representant_editeur?: string | null
          notes?: string | null
          pourcentage_droits?: number
          profession_auteur?: string | null
          qualite_representant?: string | null
          rccm_editeur?: string | null
          reliure?: string | null
          statut?: Database["public"]["Enums"]["contrat_statut"]
          telephone_auteur?: string | null
          territoire_ci?: number
          territoire_france?: number
          territoire_mali?: number
          territoire_senegal?: number
          tirage_minimum?: number
          type_couverture?: string | null
        }
        Update: {
          adresse_auteur?: string | null
          auteur_id?: string | null
          banque?: string | null
          cachet_url?: string | null
          collection?: string | null
          compte_bancaire?: string | null
          contribution_auteur?: string | null
          created_at?: string
          date_signature?: string | null
          duree?: string
          duree_annees?: number
          entreprise_id?: string
          exemplaires_auteur?: number
          format?: string | null
          frequence_paiement?: string
          id?: string
          lieu_signature?: string
          livres?: Json
          manuscrit_id?: string
          nif_editeur?: string | null
          nina_editeur?: string | null
          nom_representant_editeur?: string | null
          notes?: string | null
          pourcentage_droits?: number
          profession_auteur?: string | null
          qualite_representant?: string | null
          rccm_editeur?: string | null
          reliure?: string | null
          statut?: Database["public"]["Enums"]["contrat_statut"]
          telephone_auteur?: string | null
          territoire_ci?: number
          territoire_france?: number
          territoire_mali?: number
          territoire_senegal?: number
          tirage_minimum?: number
          type_couverture?: string | null
        }
        Relationships: []
      }
      conversions: {
        Row: {
          annee_publication: number | null
          auteur: string
          cloudconvert_job_id: string | null
          completed_at: string | null
          couverture_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duree_conversion_secondes: number | null
          editeur: string | null
          entreprise_id: string
          epub_path: string | null
          erreur_message: string | null
          fichier_source_path: string | null
          format_source: string
          formats_cibles: string[]
          id: string
          isbn: string | null
          langue: string | null
          manuscrit_id: string | null
          mobi_path: string | null
          statut: string
          taille_epub_kb: number | null
          taille_mobi_kb: number | null
          taille_source_kb: number
          titre: string
          updated_at: string
        }
        Insert: {
          annee_publication?: number | null
          auteur: string
          cloudconvert_job_id?: string | null
          completed_at?: string | null
          couverture_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duree_conversion_secondes?: number | null
          editeur?: string | null
          entreprise_id: string
          epub_path?: string | null
          erreur_message?: string | null
          fichier_source_path?: string | null
          format_source: string
          formats_cibles?: string[]
          id?: string
          isbn?: string | null
          langue?: string | null
          manuscrit_id?: string | null
          mobi_path?: string | null
          statut?: string
          taille_epub_kb?: number | null
          taille_mobi_kb?: number | null
          taille_source_kb?: number
          titre: string
          updated_at?: string
        }
        Update: {
          annee_publication?: number | null
          auteur?: string
          cloudconvert_job_id?: string | null
          completed_at?: string | null
          couverture_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duree_conversion_secondes?: number | null
          editeur?: string | null
          entreprise_id?: string
          epub_path?: string | null
          erreur_message?: string | null
          fichier_source_path?: string | null
          format_source?: string
          formats_cibles?: string[]
          id?: string
          isbn?: string | null
          langue?: string | null
          manuscrit_id?: string | null
          mobi_path?: string | null
          statut?: string
          taille_epub_kb?: number | null
          taille_mobi_kb?: number | null
          taille_source_kb?: number
          titre?: string
          updated_at?: string
        }
        Relationships: []
      }
      entreprises: {
        Row: {
          abonnement_expire_le: string | null
          adresse: string | null
          banque: string | null
          cachet_url: string | null
          compte_bancaire: string | null
          created_at: string
          email: string | null
          email_contact: string | null
          id: string
          logo_url: string | null
          max_utilisateurs: number
          nif: string | null
          nina: string | null
          nom: string
          nom_representant: string | null
          owner_id: string
          plan: string
          qualite_representant: string | null
          rccm: string | null
          telephone: string | null
          ville: string
          website: string | null
        }
        Insert: {
          abonnement_expire_le?: string | null
          adresse?: string | null
          banque?: string | null
          cachet_url?: string | null
          compte_bancaire?: string | null
          created_at?: string
          email?: string | null
          email_contact?: string | null
          id?: string
          logo_url?: string | null
          max_utilisateurs?: number
          nif?: string | null
          nina?: string | null
          nom: string
          nom_representant?: string | null
          owner_id: string
          plan?: string
          qualite_representant?: string | null
          rccm?: string | null
          telephone?: string | null
          ville?: string
          website?: string | null
        }
        Update: {
          abonnement_expire_le?: string | null
          adresse?: string | null
          banque?: string | null
          cachet_url?: string | null
          compte_bancaire?: string | null
          created_at?: string
          email?: string | null
          email_contact?: string | null
          id?: string
          logo_url?: string | null
          max_utilisateurs?: number
          nif?: string | null
          nina?: string | null
          nom?: string
          nom_representant?: string | null
          owner_id?: string
          plan?: string
          qualite_representant?: string | null
          rccm?: string | null
          telephone?: string | null
          ville?: string
          website?: string | null
        }
        Relationships: []
      }
      estimations_cout: {
        Row: {
          cout_conception_couverture_fcfa: number | null
          cout_couverture_fcfa: number | null
          cout_decoupe_fcfa: number | null
          cout_emballage_fcfa: number | null
          cout_encre_fcfa: number | null
          cout_groupe_electrogene_fcfa: number | null
          cout_isbn_fcfa: number | null
          cout_livraison_fcfa: number | null
          cout_mise_en_page_fcfa: number | null
          cout_papier_fcfa: number | null
          cout_reliure_fcfa: number | null
          cout_setup_offset_fcfa: number | null
          cout_total_fcfa: number | null
          created_at: string
          depot_legal: boolean | null
          droits_auteur_fcfa: number | null
          entreprise_id: string
          finition_couverture: string | null
          format: string | null
          id: string
          interieur_couleur: boolean | null
          langue: string | null
          manuscrit_id: string | null
          marge_imprimeur_fcfa: number | null
          marge_librairie_fcfa: number | null
          methode_impression: string | null
          nom_estimation: string
          nombre_pages: number | null
          prix_vente_suggere_fcfa: number | null
          qualite_papier: string | null
          sous_total_postpress_fcfa: number | null
          sous_total_prepress_fcfa: number | null
          sous_total_production_fcfa: number | null
          supplement_langue_nationale_fcfa: number | null
          tirage: number | null
          type_livre: string | null
          type_reliure: string | null
        }
        Insert: {
          cout_conception_couverture_fcfa?: number | null
          cout_couverture_fcfa?: number | null
          cout_decoupe_fcfa?: number | null
          cout_emballage_fcfa?: number | null
          cout_encre_fcfa?: number | null
          cout_groupe_electrogene_fcfa?: number | null
          cout_isbn_fcfa?: number | null
          cout_livraison_fcfa?: number | null
          cout_mise_en_page_fcfa?: number | null
          cout_papier_fcfa?: number | null
          cout_reliure_fcfa?: number | null
          cout_setup_offset_fcfa?: number | null
          cout_total_fcfa?: number | null
          created_at?: string
          depot_legal?: boolean | null
          droits_auteur_fcfa?: number | null
          entreprise_id: string
          finition_couverture?: string | null
          format?: string | null
          id?: string
          interieur_couleur?: boolean | null
          langue?: string | null
          manuscrit_id?: string | null
          marge_imprimeur_fcfa?: number | null
          marge_librairie_fcfa?: number | null
          methode_impression?: string | null
          nom_estimation: string
          nombre_pages?: number | null
          prix_vente_suggere_fcfa?: number | null
          qualite_papier?: string | null
          sous_total_postpress_fcfa?: number | null
          sous_total_prepress_fcfa?: number | null
          sous_total_production_fcfa?: number | null
          supplement_langue_nationale_fcfa?: number | null
          tirage?: number | null
          type_livre?: string | null
          type_reliure?: string | null
        }
        Update: {
          cout_conception_couverture_fcfa?: number | null
          cout_couverture_fcfa?: number | null
          cout_decoupe_fcfa?: number | null
          cout_emballage_fcfa?: number | null
          cout_encre_fcfa?: number | null
          cout_groupe_electrogene_fcfa?: number | null
          cout_isbn_fcfa?: number | null
          cout_livraison_fcfa?: number | null
          cout_mise_en_page_fcfa?: number | null
          cout_papier_fcfa?: number | null
          cout_reliure_fcfa?: number | null
          cout_setup_offset_fcfa?: number | null
          cout_total_fcfa?: number | null
          created_at?: string
          depot_legal?: boolean | null
          droits_auteur_fcfa?: number | null
          entreprise_id?: string
          finition_couverture?: string | null
          format?: string | null
          id?: string
          interieur_couleur?: boolean | null
          langue?: string | null
          manuscrit_id?: string | null
          marge_imprimeur_fcfa?: number | null
          marge_librairie_fcfa?: number | null
          methode_impression?: string | null
          nom_estimation?: string
          nombre_pages?: number | null
          prix_vente_suggere_fcfa?: number | null
          qualite_papier?: string | null
          sous_total_postpress_fcfa?: number | null
          sous_total_prepress_fcfa?: number | null
          sous_total_production_fcfa?: number | null
          supplement_langue_nationale_fcfa?: number | null
          tirage?: number | null
          type_livre?: string | null
          type_reliure?: string | null
        }
        Relationships: []
      }
      imprimeries: {
        Row: {
          adresse: string | null
          created_at: string
          description: string | null
          email: string | null
          est_partenaire: boolean | null
          id: string
          nom: string
          site_web: string | null
          specialites: string[] | null
          telephone: string | null
          types_impression: string[] | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          est_partenaire?: boolean | null
          id?: string
          nom: string
          site_web?: string | null
          specialites?: string[] | null
          telephone?: string | null
          types_impression?: string[] | null
        }
        Update: {
          adresse?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          est_partenaire?: boolean | null
          id?: string
          nom?: string
          site_web?: string | null
          specialites?: string[] | null
          telephone?: string | null
          types_impression?: string[] | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          entreprise_id: string
          expires_at: string
          full_name: string | null
          id: string
          permissions: Json
          role: string
          role_label: string | null
          statut: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          entreprise_id: string
          expires_at?: string
          full_name?: string | null
          id?: string
          permissions?: Json
          role?: string
          role_label?: string | null
          statut?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          entreprise_id?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          permissions?: Json
          role?: string
          role_label?: string | null
          statut?: string
          token?: string
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
          pdf_path: string | null
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
          pdf_path?: string | null
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
          pdf_path?: string | null
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
      mouvements_stock: {
        Row: {
          created_at: string
          date_mouvement: string
          destination: string | null
          effectue_par: string | null
          entreprise_id: string
          id: string
          manuscrit_id: string
          notes: string | null
          quantite: number
          stock_interne_id: string | null
          type_mouvement: string
        }
        Insert: {
          created_at?: string
          date_mouvement?: string
          destination?: string | null
          effectue_par?: string | null
          entreprise_id: string
          id?: string
          manuscrit_id: string
          notes?: string | null
          quantite: number
          stock_interne_id?: string | null
          type_mouvement: string
        }
        Update: {
          created_at?: string
          date_mouvement?: string
          destination?: string | null
          effectue_par?: string | null
          entreprise_id?: string
          id?: string
          manuscrit_id?: string
          notes?: string | null
          quantite?: number
          stock_interne_id?: string | null
          type_mouvement?: string
        }
        Relationships: [
          {
            foreignKeyName: "mouvements_stock_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_stock_manuscrit_id_fkey"
            columns: ["manuscrit_id"]
            isOneToOne: false
            referencedRelation: "manuscrits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_stock_stock_interne_id_fkey"
            columns: ["stock_interne_id"]
            isOneToOne: false
            referencedRelation: "stock_interne"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entreprise_id: string
          id: string
          lien: string | null
          lu: boolean
          message: string
          metadata: Json | null
          titre: string
          type: string
        }
        Insert: {
          created_at?: string
          entreprise_id: string
          id?: string
          lien?: string | null
          lu?: boolean
          message: string
          metadata?: Json | null
          titre: string
          type: string
        }
        Update: {
          created_at?: string
          entreprise_id?: string
          id?: string
          lien?: string | null
          lu?: boolean
          message?: string
          metadata?: Json | null
          titre?: string
          type?: string
        }
        Relationships: []
      }
      paiements: {
        Row: {
          abonnement_id: string
          created_at: string
          entreprise_id: string
          id: string
          methode: string | null
          montant_fcfa: number
          paydunya_reference: string | null
          paydunya_token: string | null
          payload: Json | null
          statut: string
          updated_at: string
        }
        Insert: {
          abonnement_id: string
          created_at?: string
          entreprise_id: string
          id?: string
          methode?: string | null
          montant_fcfa: number
          paydunya_reference?: string | null
          paydunya_token?: string | null
          payload?: Json | null
          statut?: string
          updated_at?: string
        }
        Update: {
          abonnement_id?: string
          created_at?: string
          entreprise_id?: string
          id?: string
          methode?: string | null
          montant_fcfa?: number
          paydunya_reference?: string | null
          paydunya_token?: string | null
          payload?: Json | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_abonnement_id_fkey"
            columns: ["abonnement_id"]
            isOneToOne: false
            referencedRelation: "abonnements"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_partages: {
        Row: {
          created_at: string
          created_by: string | null
          email_lecteur: string | null
          entreprise_id: string
          entreprise_lecteur: string | null
          est_actif: boolean
          id: string
          last_viewed_at: string | null
          manuscrit_id: string
          nom_lecteur: string
          nombre_vues_actuel: number
          nombre_vues_max: number
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_lecteur?: string | null
          entreprise_id: string
          entreprise_lecteur?: string | null
          est_actif?: boolean
          id?: string
          last_viewed_at?: string | null
          manuscrit_id: string
          nom_lecteur: string
          nombre_vues_actuel?: number
          nombre_vues_max?: number
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_lecteur?: string | null
          entreprise_id?: string
          entreprise_lecteur?: string | null
          est_actif?: boolean
          id?: string
          last_viewed_at?: string | null
          manuscrit_id?: string
          nom_lecteur?: string
          nombre_vues_actuel?: number
          nombre_vues_max?: number
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_partages_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_partages_manuscrit_id_fkey"
            columns: ["manuscrit_id"]
            isOneToOne: false
            referencedRelation: "manuscrits"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_partages_acces_log: {
        Row: {
          created_at: string
          entreprise_id: string | null
          id: string
          ip_addr: string | null
          nom_saisi: string | null
          partage_id: string | null
          raison: string | null
          resultat: string
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          entreprise_id?: string | null
          id?: string
          ip_addr?: string | null
          nom_saisi?: string | null
          partage_id?: string | null
          raison?: string | null
          resultat: string
          token: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          entreprise_id?: string | null
          id?: string
          ip_addr?: string | null
          nom_saisi?: string | null
          partage_id?: string | null
          raison?: string | null
          resultat?: string
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_partages_acces_log_partage_id_fkey"
            columns: ["partage_id"]
            isOneToOne: false
            referencedRelation: "pdf_partages"
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
          permissions: Json
          role: string
          role_label: string | null
        }
        Insert: {
          created_at?: string
          entreprise_id?: string | null
          full_name: string
          id: string
          permissions?: Json
          role?: string
          role_label?: string | null
        }
        Update: {
          created_at?: string
          entreprise_id?: string | null
          full_name?: string
          id?: string
          permissions?: Json
          role?: string
          role_label?: string | null
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
      promo_code_redemptions: {
        Row: {
          created_at: string
          entreprise_id: string
          expire_le: string | null
          id: string
          periode_appliquee: string
          plan_applique: string
          promo_code_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entreprise_id: string
          expire_le?: string | null
          id?: string
          periode_appliquee: string
          plan_applique: string
          promo_code_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entreprise_id?: string
          expire_le?: string | null
          id?: string
          periode_appliquee?: string
          plan_applique?: string
          promo_code_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          description: string | null
          duree_jours: number | null
          expires_at: string | null
          id: string
          max_utilisations: number
          periode: string
          plan: string
          updated_at: string
          utilisations_actuelles: number
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          description?: string | null
          duree_jours?: number | null
          expires_at?: string | null
          id?: string
          max_utilisations?: number
          periode?: string
          plan: string
          updated_at?: string
          utilisations_actuelles?: number
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          description?: string | null
          duree_jours?: number | null
          expires_at?: string | null
          id?: string
          max_utilisations?: number
          periode?: string
          plan?: string
          updated_at?: string
          utilisations_actuelles?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          entreprise_id: string | null
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          entreprise_id?: string | null
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          entreprise_id?: string | null
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_interne: {
        Row: {
          cout_unitaire_impression_fcfa: number
          created_at: string
          date_impression: string | null
          derniere_mise_a_jour: string
          emplacement: string | null
          entreprise_id: string
          id: string
          manuscrit_id: string
          prix_vente_direct_fcfa: number
          quantite_disponible: number
          quantite_exposee_evenements: number
          quantite_imprimee: number
          quantite_reservee: number
          quantite_transferee_librairies: number
          quantite_vendue_directement: number
          seuil_alerte: number
        }
        Insert: {
          cout_unitaire_impression_fcfa?: number
          created_at?: string
          date_impression?: string | null
          derniere_mise_a_jour?: string
          emplacement?: string | null
          entreprise_id: string
          id?: string
          manuscrit_id: string
          prix_vente_direct_fcfa?: number
          quantite_disponible?: number
          quantite_exposee_evenements?: number
          quantite_imprimee?: number
          quantite_reservee?: number
          quantite_transferee_librairies?: number
          quantite_vendue_directement?: number
          seuil_alerte?: number
        }
        Update: {
          cout_unitaire_impression_fcfa?: number
          created_at?: string
          date_impression?: string | null
          derniere_mise_a_jour?: string
          emplacement?: string | null
          entreprise_id?: string
          id?: string
          manuscrit_id?: string
          prix_vente_direct_fcfa?: number
          quantite_disponible?: number
          quantite_exposee_evenements?: number
          quantite_imprimee?: number
          quantite_reservee?: number
          quantite_transferee_librairies?: number
          quantite_vendue_directement?: number
          seuil_alerte?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_interne_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_interne_manuscrit_id_fkey"
            columns: ["manuscrit_id"]
            isOneToOne: false
            referencedRelation: "manuscrits"
            referencedColumns: ["id"]
          },
        ]
      }
      stocks: {
        Row: {
          applique_droits_auteur: boolean
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
          prix_unitaire_fcfa: number
          taux_commission_pct: number
        }
        Insert: {
          applique_droits_auteur?: boolean
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
          prix_unitaire_fcfa?: number
          taux_commission_pct?: number
        }
        Update: {
          applique_droits_auteur?: boolean
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
          prix_unitaire_fcfa?: number
          taux_commission_pct?: number
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
          auteur_id: string | null
          canal_vente: string
          commission_librairie_fcfa: number
          created_at: string
          date_vente: string
          droits_auteur_fcfa: number
          entreprise_id: string
          id: string
          manuscrit_id: string
          montant: number
          montant_total_fcfa: number
          prix_unitaire_fcfa: number
          quantite_vendue: number
          statut_paiement: Database["public"]["Enums"]["paiement_statut"]
        }
        Insert: {
          auteur_id?: string | null
          canal_vente?: string
          commission_librairie_fcfa?: number
          created_at?: string
          date_vente?: string
          droits_auteur_fcfa?: number
          entreprise_id: string
          id?: string
          manuscrit_id: string
          montant?: number
          montant_total_fcfa?: number
          prix_unitaire_fcfa?: number
          quantite_vendue?: number
          statut_paiement?: Database["public"]["Enums"]["paiement_statut"]
        }
        Update: {
          auteur_id?: string | null
          canal_vente?: string
          commission_librairie_fcfa?: number
          created_at?: string
          date_vente?: string
          droits_auteur_fcfa?: number
          entreprise_id?: string
          id?: string
          manuscrit_id?: string
          montant?: number
          montant_total_fcfa?: number
          prix_unitaire_fcfa?: number
          quantite_vendue?: number
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
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      create_bordereau: {
        Args: {
          p_librairie_adresse: string
          p_librairie_nom: string
          p_lignes: Json
          p_notes: string
          p_periode_debut: string
          p_periode_fin: string
          p_total_exemplaires: number
          p_total_fcfa: number
          p_type: string
        }
        Returns: Json
      }
      fn_notify: {
        Args: {
          p_entreprise: string
          p_lien?: string
          p_message: string
          p_metadata?: Json
          p_titre: string
          p_type: string
        }
        Returns: undefined
      }
      get_invitation_public: { Args: { p_token: string }; Returns: Json }
      increment_pdf_view: { Args: { p_token: string }; Returns: Json }
      pourcentage_droits_pour: {
        Args: { p_auteur: string; p_manuscrit: string }
        Returns: number
      }
      redeem_promo_code: {
        Args: { p_code: string; p_entreprise_id: string }
        Returns: Json
      }
    }
    Enums: {
      contrat_statut:
        | "brouillon"
        | "signe"
        | "expire"
        | "resilie"
        | "en_attente_signature"
      couverture_type: "Souple" | "Rigide"
      manuscrit_statut:
        | "recu"
        | "relecture"
        | "epreuve_1"
        | "epreuve_2"
        | "epreuve_3"
        | "epreuve_4"
        | "maquette"
        | "echantillon"
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
      contrat_statut: [
        "brouillon",
        "signe",
        "expire",
        "resilie",
        "en_attente_signature",
      ],
      couverture_type: ["Souple", "Rigide"],
      manuscrit_statut: [
        "recu",
        "relecture",
        "epreuve_1",
        "epreuve_2",
        "epreuve_3",
        "epreuve_4",
        "maquette",
        "echantillon",
        "impression",
        "publie",
      ],
      mobile_money_operateur: ["Orange Money", "Moov Money"],
      paiement_statut: ["en_attente", "paye", "annule"],
    },
  },
} as const
