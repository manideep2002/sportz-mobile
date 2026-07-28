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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      account_recent_auth_grants: {
        Row: {
          expires_at: string
          method: string
          session_id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          expires_at: string
          method: string
          session_id: string
          user_id: string
          verified_at?: string
        }
        Update: {
          expires_at?: string
          method?: string
          session_id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      account_security_attempts: {
        Row: {
          action: string
          attempted_at: string
          id: number
          succeeded: boolean
          user_id: string
        }
        Insert: {
          action: string
          attempted_at?: string
          id?: never
          succeeded?: boolean
          user_id: string
        }
        Update: {
          action?: string
          attempted_at?: string
          id?: never
          succeeded?: boolean
          user_id?: string
        }
        Relationships: []
      }
      account_security_events: {
        Row: {
          actor_session_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          actor_session_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          actor_session_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      achievement_definitions: {
        Row: {
          achievement_key: string
          badge: string
          description: string
          id: string
          is_active: boolean
          metric: string
          sport: string
          stat_key: string
          threshold: number
          title: string
        }
        Insert: {
          achievement_key: string
          badge: string
          description: string
          id?: string
          is_active?: boolean
          metric: string
          sport: string
          stat_key: string
          threshold: number
          title: string
        }
        Update: {
          achievement_key?: string
          badge?: string
          description?: string
          id?: string
          is_active?: boolean
          metric?: string
          sport?: string
          stat_key?: string
          threshold?: number
          title?: string
        }
        Relationships: []
      }
      athlete_achievements: {
        Row: {
          athlete_id: string
          awarded_at: string
          definition_id: string
          id: string
          progress: number
          season_id: string
        }
        Insert: {
          athlete_id: string
          awarded_at?: string
          definition_id: string
          id?: string
          progress: number
          season_id: string
        }
        Update: {
          athlete_id?: string
          awarded_at?: string
          definition_id?: string
          id?: string
          progress?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_achievements_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_achievements_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_achievements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "athlete_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_match_stats: {
        Row: {
          created_at: string
          definition_id: string
          match_id: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          definition_id: string
          match_id: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          definition_id?: string
          match_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_match_stats_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "athlete_stat_aggregates"
            referencedColumns: ["definition_id"]
          },
          {
            foreignKeyName: "athlete_match_stats_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "sport_stat_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "athlete_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_matches: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          opponent_name: string
          opponent_score: number | null
          outcome: string
          played_on: string
          season_id: string
          sport: string
          team_name: string
          team_score: number | null
          updated_at: string
          verification_source: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          opponent_name: string
          opponent_score?: number | null
          outcome: string
          played_on: string
          season_id: string
          sport: string
          team_name: string
          team_score?: number | null
          updated_at?: string
          verification_source?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          opponent_name?: string
          opponent_score?: number | null
          outcome?: string
          played_on?: string
          season_id?: string
          sport?: string
          team_name?: string
          team_score?: number | null
          updated_at?: string
          verification_source?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_matches_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "athlete_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_matches_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_seasons: {
        Row: {
          athlete_id: string
          created_at: string
          ends_on: string
          id: string
          label: string
          sport: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          ends_on: string
          id?: string
          label: string
          sport: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          label?: string
          sport?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_seasons_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          media_duration_ms: number | null
          media_height: number | null
          media_mime_type: string | null
          media_path: string | null
          media_url: string | null
          media_width: number | null
          message_type: Database["public"]["Enums"]["chat_message_type"]
          metadata: Json
          room_id: string
          sender_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          media_duration_ms?: number | null
          media_height?: number | null
          media_mime_type?: string | null
          media_path?: string | null
          media_url?: string | null
          media_width?: number | null
          message_type?: Database["public"]["Enums"]["chat_message_type"]
          metadata?: Json
          room_id: string
          sender_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          media_duration_ms?: number | null
          media_height?: number | null
          media_mime_type?: string | null
          media_path?: string | null
          media_url?: string | null
          media_width?: number | null
          message_type?: Database["public"]["Enums"]["chat_message_type"]
          metadata?: Json
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          is_active: boolean
          is_pinned: boolean
          joined_at: string
          last_read_at: string | null
          left_at: string | null
          muted_until: string | null
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          is_active?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          is_active?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          last_message_id: string | null
          last_message_preview: string | null
          metadata: Json
          room_kind: Database["public"]["Enums"]["chat_room_kind"]
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          last_message_id?: string | null
          last_message_preview?: string | null
          metadata?: Json
          room_kind?: Database["public"]["Enums"]["chat_room_kind"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          last_message_id?: string | null
          last_message_preview?: string | null
          metadata?: Json
          room_kind?: Database["public"]["Enums"]["chat_room_kind"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_last_message_fk"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          avatar_path: string | null
          city: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_private: boolean
          is_verified: boolean
          join_approval_required: boolean
          name: string
          posting_permission: string
          rules: string
          slug: string
          sport: string
          type: Database["public"]["Enums"]["sportz_community_type"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          avatar_path?: string | null
          city?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          is_verified?: boolean
          join_approval_required?: boolean
          name: string
          posting_permission?: string
          rules?: string
          slug: string
          sport: string
          type: Database["public"]["Enums"]["sportz_community_type"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          avatar_path?: string | null
          city?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          is_verified?: boolean
          join_approval_required?: boolean
          name?: string
          posting_permission?: string
          rules?: string
          slug?: string
          sport?: string
          type?: Database["public"]["Enums"]["sportz_community_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          community_id: string | null
          community_name: string
          community_type: string
          created_at: string
          id: string
          metadata: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          community_id?: string | null
          community_name: string
          community_type: string
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          community_id?: string | null
          community_name?: string
          community_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_admin_audit_log_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_invites: {
        Row: {
          community_id: string
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_invites_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_join_requests: {
        Row: {
          community_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_join_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_join_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      court_bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          court_id: string
          created_at: string
          currency: string | null
          ends_at: string
          id: string
          price_cents: number | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          court_id: string
          created_at?: string
          currency?: string | null
          ends_at: string
          id?: string
          price_cents?: number | null
          starts_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          court_id?: string
          created_at?: string
          currency?: string | null
          ends_at?: string
          id?: string
          price_cents?: number | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      court_closures: {
        Row: {
          court_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          reason: string
          starts_at: string
        }
        Insert: {
          court_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          reason?: string
          starts_at: string
        }
        Update: {
          court_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          reason?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_closures_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_closures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      court_operating_hours: {
        Row: {
          closes_at: string | null
          court_id: string
          created_at: string
          is_closed: boolean
          opens_at: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at?: string | null
          court_id: string
          created_at?: string
          is_closed?: boolean
          opens_at?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string | null
          court_id?: string
          created_at?: string
          is_closed?: boolean
          opens_at?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "court_operating_hours_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          address: string | null
          availability_status: string
          booking_enabled: boolean
          booking_requires_approval: boolean
          booking_window_days: number
          cancellation_notice_hours: number
          city: string
          created_at: string
          currency: string
          geo: unknown
          hourly_price_cents: number | null
          id: string
          latitude: number
          longitude: number
          name: string
          payment_policy: string
          rating: number | null
          slot_duration_minutes: number
          sport: string
          surface: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          availability_status?: string
          booking_enabled?: boolean
          booking_requires_approval?: boolean
          booking_window_days?: number
          cancellation_notice_hours?: number
          city: string
          created_at?: string
          currency?: string
          geo?: unknown
          hourly_price_cents?: number | null
          id?: string
          latitude: number
          longitude: number
          name: string
          payment_policy?: string
          rating?: number | null
          slot_duration_minutes?: number
          sport: string
          surface?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          availability_status?: string
          booking_enabled?: boolean
          booking_requires_approval?: boolean
          booking_window_days?: number
          cancellation_notice_hours?: number
          city?: string
          created_at?: string
          currency?: string
          geo?: unknown
          hourly_price_cents?: number | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          payment_policy?: string
          rating?: number | null
          slot_duration_minutes?: number
          sport?: string
          surface?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: Database["public"]["Enums"]["sportz_rsvp_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: Database["public"]["Enums"]["sportz_rsvp_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: Database["public"]["Enums"]["sportz_rsvp_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_player_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitations: {
        Row: {
          created_at: string
          event_id: string
          expires_at: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["event_invitation_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          expires_at: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["event_invitation_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          expires_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["event_invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_player_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_messages: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_player_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waitlist: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_player_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_fanout_jobs: {
        Row: {
          attempts: number
          author_id: string
          created_at: string
          finished_at: string | null
          id: string
          last_error: string | null
          post_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          author_id: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          post_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          author_id?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          post_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_fanout_jobs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_fanout_jobs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_fanout_jobs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_items: {
        Row: {
          author_id: string
          inserted_at: string
          post_created_at: string
          post_id: string
          source: string
          user_id: string
        }
        Insert: {
          author_id: string
          inserted_at?: string
          post_created_at: string
          post_id: string
          source?: string
          user_id: string
        }
        Update: {
          author_id?: string
          inserted_at?: string
          post_created_at?: string
          post_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_items_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_items_archive: {
        Row: {
          archived_at: string
          author_id: string
          inserted_at: string
          post_created_at: string
          post_id: string
          source: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          author_id: string
          inserted_at: string
          post_created_at: string
          post_id: string
          source: string
          user_id: string
        }
        Update: {
          archived_at?: string
          author_id?: string
          inserted_at?: string
          post_created_at?: string
          post_id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_requests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_consents: {
        Row: {
          consent_source: string
          consented_at: string
          id: string
          privacy_version: string
          terms_version: string
          user_id: string
        }
        Insert: {
          consent_source: string
          consented_at?: string
          id?: string
          privacy_version: string
          terms_version: string
          user_id: string
        }
        Update: {
          consent_source?: string
          consented_at?: string
          id?: string
          privacy_version?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          comments: boolean
          events: boolean
          follows: boolean
          invites: boolean
          likes: boolean
          mentions: boolean
          messages: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          comments?: boolean
          events?: boolean
          follows?: boolean
          invites?: boolean
          likes?: boolean
          mentions?: boolean
          messages?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          comments?: boolean
          events?: boolean
          follows?: boolean
          invites?: boolean
          likes?: boolean
          mentions?: boolean
          messages?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_count: number
          actor_id: string | null
          actor_ids: string[]
          aggregate_key: string | null
          body: string
          created_at: string
          data: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          kind: Database["public"]["Enums"]["sportz_notification_kind"]
          last_event_at: string
          push_attempts: number
          push_error: string | null
          push_last_attempt_at: string | null
          push_sent_at: string | null
          push_ticket_ids: Json
          read_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actor_count?: number
          actor_id?: string | null
          actor_ids?: string[]
          aggregate_key?: string | null
          body: string
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          kind: Database["public"]["Enums"]["sportz_notification_kind"]
          last_event_at?: string
          push_attempts?: number
          push_error?: string | null
          push_last_attempt_at?: string | null
          push_sent_at?: string | null
          push_ticket_ids?: Json
          read_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actor_count?: number
          actor_id?: string | null
          actor_ids?: string[]
          aggregate_key?: string | null
          body?: string
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          kind?: Database["public"]["Enums"]["sportz_notification_kind"]
          last_event_at?: string
          push_attempts?: number
          push_error?: string | null
          push_last_attempt_at?: string | null
          push_sent_at?: string | null
          push_ticket_ids?: Json
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_same_post_fk"
            columns: ["parent_id", "post_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id", "post_id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media_assets: {
        Row: {
          bucket_id: string
          content_type: string | null
          created_at: string
          error: string | null
          finalized_at: string | null
          id: string
          media_height: number | null
          media_kind: string
          media_placeholder: string | null
          media_width: number | null
          object_name: string
          owner_id: string | null
          post_id: string | null
          public_url: string
          status: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          content_type?: string | null
          created_at?: string
          error?: string | null
          finalized_at?: string | null
          id?: string
          media_height?: number | null
          media_kind?: string
          media_placeholder?: string | null
          media_width?: number | null
          object_name: string
          owner_id?: string | null
          post_id?: string | null
          public_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          content_type?: string | null
          created_at?: string
          error?: string | null
          finalized_at?: string | null
          id?: string
          media_height?: number | null
          media_kind?: string
          media_placeholder?: string | null
          media_width?: number | null
          object_name?: string
          owner_id?: string | null
          post_id?: string | null
          public_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_assets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_assets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_mentions: {
        Row: {
          created_at: string
          mentioned_user_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          mentioned_user_id: string
          post_id: string
        }
        Update: {
          created_at?: string
          mentioned_user_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          comments_count: number
          community_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["sportz_post_kind"]
          likes_count: number
          location_label: string | null
          media_height: number | null
          media_kind: string | null
          media_placeholder: string | null
          media_processing_status: string
          media_storage_path: string | null
          media_url: string | null
          media_width: number | null
          sport: string | null
          stats_line: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["sportz_visibility"]
        }
        Insert: {
          author_id: string
          body: string
          comments_count?: number
          community_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["sportz_post_kind"]
          likes_count?: number
          location_label?: string | null
          media_height?: number | null
          media_kind?: string | null
          media_placeholder?: string | null
          media_processing_status?: string
          media_storage_path?: string | null
          media_url?: string | null
          media_width?: number | null
          sport?: string | null
          stats_line?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["sportz_visibility"]
        }
        Update: {
          author_id?: string
          body?: string
          comments_count?: number
          community_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["sportz_post_kind"]
          likes_count?: number
          location_label?: string | null
          media_height?: number | null
          media_kind?: string | null
          media_placeholder?: string | null
          media_processing_status?: string
          media_storage_path?: string | null
          media_url?: string | null
          media_width?: number | null
          sport?: string | null
          stats_line?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["sportz_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_community_fk"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          avg_rebounds: number | null
          best_points: number | null
          bio: string | null
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string
          feed_delivery_mode: string
          followers_count: number
          following_count: number
          games_played: number
          gender: string | null
          id: string
          is_admin: boolean
          is_hireable: boolean
          is_online: boolean
          is_private: boolean
          is_verified: boolean
          mobile_number: string | null
          position: string | null
          posts_count: number
          primary_sport: string | null
          skill_level: Database["public"]["Enums"]["sportz_skill_level"] | null
          sports: string[]
          updated_at: string
          username: string
          win_rate: number
        }
        Insert: {
          avatar_url?: string | null
          avg_rebounds?: number | null
          best_points?: number | null
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name: string
          feed_delivery_mode?: string
          followers_count?: number
          following_count?: number
          games_played?: number
          gender?: string | null
          id: string
          is_admin?: boolean
          is_hireable?: boolean
          is_online?: boolean
          is_private?: boolean
          is_verified?: boolean
          mobile_number?: string | null
          position?: string | null
          posts_count?: number
          primary_sport?: string | null
          skill_level?: Database["public"]["Enums"]["sportz_skill_level"] | null
          sports?: string[]
          updated_at?: string
          username: string
          win_rate?: number
        }
        Update: {
          avatar_url?: string | null
          avg_rebounds?: number | null
          best_points?: number | null
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          feed_delivery_mode?: string
          followers_count?: number
          following_count?: number
          games_played?: number
          gender?: string | null
          id?: string
          is_admin?: boolean
          is_hireable?: boolean
          is_online?: boolean
          is_private?: boolean
          is_verified?: boolean
          mobile_number?: string | null
          position?: string | null
          posts_count?: number
          primary_sport?: string | null
          skill_level?: Database["public"]["Enums"]["sportz_skill_level"] | null
          sports?: string[]
          updated_at?: string
          username?: string
          win_rate?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_notification_bundles: {
        Row: {
          actor_count: number
          actor_id: string | null
          actor_ids: string[]
          aggregate_key: string
          attempts: number
          body: string | null
          comment_id: string | null
          created_at: string
          data: Json
          delivered_notification_id: string | null
          entity_id: string
          entity_type: string
          event_count: number
          first_event_at: string
          id: string
          kind: Database["public"]["Enums"]["sportz_notification_kind"]
          last_error: string | null
          last_event_at: string
          next_flush_at: string
          parent_comment_id: string | null
          post_id: string | null
          processing_started_at: string | null
          recipient_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          actor_count?: number
          actor_id?: string | null
          actor_ids?: string[]
          aggregate_key: string
          attempts?: number
          body?: string | null
          comment_id?: string | null
          created_at?: string
          data?: Json
          delivered_notification_id?: string | null
          entity_id: string
          entity_type: string
          event_count?: number
          first_event_at?: string
          id?: string
          kind: Database["public"]["Enums"]["sportz_notification_kind"]
          last_error?: string | null
          last_event_at?: string
          next_flush_at?: string
          parent_comment_id?: string | null
          post_id?: string | null
          processing_started_at?: string | null
          recipient_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          actor_count?: number
          actor_id?: string | null
          actor_ids?: string[]
          aggregate_key?: string
          attempts?: number
          body?: string | null
          comment_id?: string | null
          created_at?: string
          data?: Json
          delivered_notification_id?: string | null
          entity_id?: string
          entity_type?: string
          event_count?: number
          first_event_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["sportz_notification_kind"]
          last_error?: string | null
          last_event_at?: string
          next_flush_at?: string
          parent_comment_id?: string | null
          post_id?: string | null
          processing_started_at?: string | null
          recipient_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_notification_bundles_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_notification_bundles_delivered_notification_id_fkey"
            columns: ["delivered_notification_id"]
            isOneToOne: false
            referencedRelation: "notification_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_notification_bundles_delivered_notification_id_fkey"
            columns: ["delivered_notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_notification_bundles_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_notification_bundles_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_notification_bundles_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      sport_events: {
        Row: {
          city: string | null
          community_id: string | null
          court_id: string | null
          cover_url: string | null
          created_at: string
          currency: string
          description: string | null
          ends_at: string
          entry_fee_cents: number
          event_type: string
          id: string
          latitude: number | null
          location_name: string
          longitude: number | null
          max_players: number
          organizer_id: string
          sport: string
          starts_at: string
          status: Database["public"]["Enums"]["sportz_event_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["sportz_visibility"]
        }
        Insert: {
          city?: string | null
          community_id?: string | null
          court_id?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          ends_at: string
          entry_fee_cents?: number
          event_type?: string
          id?: string
          latitude?: number | null
          location_name: string
          longitude?: number | null
          max_players?: number
          organizer_id: string
          sport: string
          starts_at: string
          status?: Database["public"]["Enums"]["sportz_event_status"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["sportz_visibility"]
        }
        Update: {
          city?: string | null
          community_id?: string | null
          court_id?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          ends_at?: string
          entry_fee_cents?: number
          event_type?: string
          id?: string
          latitude?: number | null
          location_name?: string
          longitude?: number | null
          max_players?: number
          organizer_id?: string
          sport?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["sportz_event_status"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["sportz_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "sport_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_events_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_stat_definitions: {
        Row: {
          aggregation: string
          display_order: number
          higher_is_better: boolean
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          maximum_value: number | null
          minimum_value: number | null
          sport: string
          stat_key: string
          unit: string | null
          value_type: string
        }
        Insert: {
          aggregation: string
          display_order?: number
          higher_is_better?: boolean
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          maximum_value?: number | null
          minimum_value?: number | null
          sport: string
          stat_key: string
          unit?: string | null
          value_type: string
        }
        Update: {
          aggregation?: string
          display_order?: number
          higher_is_better?: boolean
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          maximum_value?: number | null
          minimum_value?: number | null
          sport?: string
          stat_key?: string
          unit?: string | null
          value_type?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          expires_at: string
          id: string
          media_kind: string
          media_url: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_kind?: string
          media_url: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_kind?: string
          media_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          id: string
          reaction: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_replies_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_managers: {
        Row: {
          can_send_offers: boolean
          created_at: string
          role: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_send_offers?: boolean
          created_at?: string
          role: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_send_offers?: boolean
          created_at?: string
          role?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_managers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_offer_history: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          from_status: string | null
          id: string
          metadata: Json
          offer_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          from_status?: string | null
          id?: string
          metadata?: Json
          offer_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          offer_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_offer_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_offer_history_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "team_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      team_offers: {
        Row: {
          accepted_at: string | null
          compensation_amount: number | null
          compensation_currency: string | null
          compensation_period: string | null
          created_at: string
          declined_at: string | null
          end_date: string | null
          expired_at: string | null
          expires_at: string
          id: string
          position: string
          recipient_id: string
          sender_id: string
          sent_at: string | null
          sport: string
          start_date: string | null
          status: string
          team_id: string
          terms: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          compensation_amount?: number | null
          compensation_currency?: string | null
          compensation_period?: string | null
          created_at?: string
          declined_at?: string | null
          end_date?: string | null
          expired_at?: string | null
          expires_at: string
          id?: string
          position: string
          recipient_id: string
          sender_id: string
          sent_at?: string | null
          sport: string
          start_date?: string | null
          status?: string
          team_id: string
          terms: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          compensation_amount?: number | null
          compensation_currency?: string | null
          compensation_period?: string | null
          created_at?: string
          declined_at?: string | null
          end_date?: string | null
          expired_at?: string | null
          expires_at?: string
          id?: string
          position?: string
          recipient_id?: string
          sender_id?: string
          sent_at?: string | null
          sport?: string
          start_date?: string | null
          status?: string
          team_id?: string
          terms?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_offers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_offers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_offers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_roster: {
        Row: {
          athlete_id: string
          end_date: string | null
          joined_at: string
          position: string
          roster_role: string
          source_offer_id: string | null
          sport: string
          start_date: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          end_date?: string | null
          joined_at?: string
          position: string
          roster_role?: string
          source_offer_id?: string | null
          sport: string
          start_date?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          end_date?: string | null
          joined_at?: string
          position?: string
          roster_role?: string
          source_offer_id?: string | null
          sport?: string
          start_date?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_roster_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_roster_source_offer_id_fkey"
            columns: ["source_offer_id"]
            isOneToOne: true
            referencedRelation: "team_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_roster_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          city: string | null
          community_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          sport: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sport: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: true
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string | null
          device_name: string | null
          expo_push_token: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          expo_push_token: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          expo_push_token?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      athlete_stat_aggregates: {
        Row: {
          aggregation: string | null
          athlete_id: string | null
          average_value: number | null
          definition_id: string | null
          label: string | null
          match_count: number | null
          maximum_value: number | null
          minimum_value: number | null
          season_id: string | null
          sport: string | null
          stat_key: string | null
          total_value: number | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_matches_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "athlete_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      deployment_health_check: {
        Row: {
          check_ok: boolean | null
          check_type: string | null
          description: string | null
          name: string | null
          status: string | null
        }
        Relationships: []
      }
      event_player_counts: {
        Row: {
          city: string | null
          court_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          ends_at: string | null
          entry_fee_cents: number | null
          id: string | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          max_players: number | null
          organizer_id: string | null
          player_count: number | null
          sport: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["sportz_event_status"] | null
          title: string | null
          updated_at: string | null
          visibility: Database["public"]["Enums"]["sportz_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "sport_events_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string | null
          avatar_url: string | null
          body: string | null
          comments_count: number | null
          community_id: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          kind: Database["public"]["Enums"]["sportz_post_kind"] | null
          likes_count: number | null
          media_height: number | null
          media_kind: string | null
          media_placeholder: string | null
          media_processing_status: string | null
          media_storage_path: string | null
          media_url: string | null
          media_width: number | null
          shares_count: number | null
          sport: string | null
          stats_line: string | null
          updated_at: string | null
          username: string | null
          visibility: Database["public"]["Enums"]["sportz_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_community_fk"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      notification_feed: {
        Row: {
          actor_count: number | null
          actor_id: string | null
          actor_ids: string[] | null
          aggregate_key: string | null
          body: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          is_read: boolean | null
          kind: Database["public"]["Enums"]["sportz_notification_kind"] | null
          last_event_at: string | null
          other_actor_count: number | null
          primary_actor_avatar_url: string | null
          primary_actor_display_name: string | null
          primary_actor_username: string | null
          read_at: string | null
          route_data: Json | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      active_chat_room_admin: {
        Args: { check_room_id: string; check_user_id?: string }
        Returns: boolean
      }
      active_timeline_retention: { Args: never; Returns: string }
      add_chat_room_members: {
        Args: { member_ids: string[]; target_room_id: string }
        Returns: undefined
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      archive_social_events_queue: {
        Args: { message_ids: number[] }
        Returns: number
      }
      archive_stale_feed_items: {
        Args: { batch_size?: number; retention?: string }
        Returns: number
      }
      book_court_slot: {
        Args: {
          target_court_id: string
          target_ends_at: string
          target_starts_at: string
        }
        Returns: {
          booking_id: string
          booking_status: string
        }[]
      }
      can_access_sport_event: {
        Args: { target_event_id: string }
        Returns: boolean
      }
      can_discover_sport_event: {
        Args: {
          event_organizer_id: string
          event_visibility: Database["public"]["Enums"]["sportz_visibility"]
        }
        Returns: boolean
      }
      can_join_community_directly: {
        Args: { target_community_id: string }
        Returns: boolean
      }
      can_read_community_members: {
        Args: { target_community_id: string; target_user_id: string }
        Returns: boolean
      }
      can_view_profile_cover: { Args: { owner_id: string }; Returns: boolean }
      can_view_sport_event: {
        Args: { target_event_id: string }
        Returns: boolean
      }
      cancel_court_booking: {
        Args: { cancellation_reason?: string; target_booking_id: string }
        Returns: undefined
      }
      chat_message_preview: {
        Args: {
          check_body: string
          check_message_type: Database["public"]["Enums"]["chat_message_type"]
        }
        Returns: string
      }
      chat_room_id_from_realtime_topic: {
        Args: { topic: string }
        Returns: string
      }
      chat_room_id_from_storage_path: {
        Args: { object_name: string }
        Returns: string
      }
      chat_users_blocked_each_other: {
        Args: { left_user_id: string; right_user_id: string }
        Returns: boolean
      }
      claim_due_social_notification_bundles: {
        Args: { bundle_limit?: number }
        Returns: {
          actor_count: number
          aggregate_key: string
          event_count: number
          id: string
          kind: Database["public"]["Enums"]["sportz_notification_kind"]
          next_flush_at: string
          recipient_user_id: string
        }[]
      }
      claim_feed_fanout_jobs: {
        Args: { job_limit?: number }
        Returns: {
          author_id: string
          id: string
          post_created_at: string
          post_id: string
        }[]
      }
      complete_feed_fanout_job: {
        Args: { job_error?: string; job_id: string }
        Returns: undefined
      }
      complete_social_notification_bundle: {
        Args: { bundle_id: string }
        Returns: string
      }
      court_is_open_at: {
        Args: { target_court_id: string; target_time?: string }
        Returns: boolean
      }
      create_community: {
        Args: {
          community_city: string
          community_description: string
          community_is_private?: boolean
          community_name: string
          community_slug: string
          community_sport: string
          community_type: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          avatar_path: string | null
          city: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_private: boolean
          is_verified: boolean
          join_approval_required: boolean
          name: string
          posting_permission: string
          rules: string
          slug: string
          sport: string
          type: Database["public"]["Enums"]["sportz_community_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "communities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_direct_chat_room: {
        Args: { other_user_id: string }
        Returns: string
      }
      create_event_invitation: {
        Args: {
          target_event_id: string
          target_expires_at?: string
          target_invitee_id: string
        }
        Returns: string
      }
      create_group_chat_room: {
        Args: { group_title: string; member_ids: string[] }
        Returns: string
      }
      create_sport_event:
        | {
            Args: {
              target_city: string
              target_cover_url: string
              target_description: string
              target_ends_at: string
              target_entry_fee_cents?: number
              target_event_type: string
              target_latitude?: number
              target_location_name: string
              target_longitude?: number
              target_max_players?: number
              target_sport: string
              target_starts_at: string
              target_title: string
              target_visibility?: Database["public"]["Enums"]["sportz_visibility"]
            }
            Returns: string
          }
        | {
            Args: {
              target_city: string
              target_community_id?: string
              target_cover_url: string
              target_description: string
              target_ends_at: string
              target_entry_fee_cents?: number
              target_event_type: string
              target_latitude?: number
              target_location_name: string
              target_longitude?: number
              target_max_players?: number
              target_sport: string
              target_starts_at: string
              target_title: string
              target_visibility?: Database["public"]["Enums"]["sportz_visibility"]
            }
            Returns: string
          }
      create_team_offer: {
        Args: {
          send_now: boolean
          target_compensation_amount: number
          target_compensation_currency: string
          target_compensation_period: string
          target_end_date: string
          target_expires_at: string
          target_position: string
          target_recipient_id: string
          target_sport: string
          target_start_date: string
          target_team_id: string
          target_terms: string
        }
        Returns: {
          accepted_at: string | null
          compensation_amount: number | null
          compensation_currency: string | null
          compensation_period: string | null
          created_at: string
          declined_at: string | null
          end_date: string | null
          expired_at: string | null
          expires_at: string
          id: string
          position: string
          recipient_id: string
          sender_id: string
          sent_at: string | null
          sport: string
          start_date: string | null
          status: string
          team_id: string
          terms: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "team_offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      created_chat_room: {
        Args: { check_room_id: string; check_user_id?: string }
        Returns: boolean
      }
      current_auth_session_id: { Args: never; Returns: string }
      current_user_is_admin: { Args: never; Returns: boolean }
      delete_chat_message: {
        Args: { target_message_id: string }
        Returns: undefined
      }
      delete_community: {
        Args: { target_community_id: string }
        Returns: undefined
      }
      disablelongtransactions: { Args: never; Returns: string }
      discover_courts: {
        Args: {
          availability_end?: string
          availability_start?: string
          filter_city?: string
          filter_sport?: string
          filter_surface?: string
          max_distance_km?: number
          max_price_cents?: number
          origin_latitude?: number
          origin_longitude?: number
          require_future_availability?: boolean
          require_open_now?: boolean
          result_limit?: number
          target_court_id?: string
        }
        Returns: {
          address: string
          booking_requires_approval: boolean
          booking_window_days: number
          cancellation_notice_hours: number
          city: string
          currency: string
          distance_km: number
          hourly_price_cents: number
          id: string
          is_future_bookable: boolean
          is_open_now: boolean
          latitude: number
          longitude: number
          name: string
          payment_policy: string
          rating: number
          slot_duration_minutes: number
          sport: string
          surface: string
          timezone: string
        }[]
      }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      edit_chat_message: {
        Args: { message_body: string; target_message_id: string }
        Returns: {
          body: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          media_duration_ms: number | null
          media_height: number | null
          media_mime_type: string | null
          media_path: string | null
          media_url: string | null
          media_width: number | null
          message_type: Database["public"]["Enums"]["chat_message_type"]
          metadata: Json
          room_id: string
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_event_invitations: {
        Args: { target_event_id?: string }
        Returns: number
      }
      expire_team_offers: { Args: never; Returns: number }
      fail_social_notification_bundle: {
        Args: { bundle_error: string; bundle_id: string }
        Returns: undefined
      }
      feed_fanout_follower_threshold: { Args: never; Returns: number }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_court_availability: {
        Args: {
          range_end: string
          range_start: string
          target_court_id: string
        }
        Returns: {
          currency: string
          ends_at: string
          price_cents: number
          slot_duration_minutes: number
          starts_at: string
        }[]
      }
      get_edge_function_secret: {
        Args: { secret_name: string }
        Returns: string
      }
      get_event_participation_status: {
        Args: { target_event_id: string }
        Returns: string
      }
      get_event_participation_statuses: {
        Args: { target_event_ids: string[] }
        Returns: {
          event_id: string
          participation_status: string
        }[]
      }
      get_my_event_invitation: {
        Args: { target_event_id: string }
        Returns: {
          expires_at: string
          id: string
          status: Database["public"]["Enums"]["event_invitation_status"]
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_recent_account_auth: { Args: never; Returns: boolean }
      insert_notification_once: {
        Args: {
          actor_user_id: string
          notification_body: string
          notification_entity_id: string
          notification_entity_type: string
          notification_kind: Database["public"]["Enums"]["sportz_notification_kind"]
          notification_title: string
          target_user_id: string
        }
        Returns: undefined
      }
      invite_community_member: {
        Args: { target_community_id: string; target_user_id: string }
        Returns: undefined
      }
      is_active_chat_participant: {
        Args: { check_room_id: string; check_user_id?: string }
        Returns: boolean
      }
      is_community_admin: {
        Args: { target_community_id: string }
        Returns: boolean
      }
      is_community_creator: {
        Args: { target_community_id: string; target_user_id: string }
        Returns: boolean
      }
      is_community_member: {
        Args: { target_community_id: string; target_user_id: string }
        Returns: boolean
      }
      is_community_owner: {
        Args: { target_community_id: string; target_user_id?: string }
        Returns: boolean
      }
      is_team_manager: {
        Args: { target_team_id: string; target_user_id?: string }
        Returns: boolean
      }
      join_community: {
        Args: { requested_role?: string; target_community_id: string }
        Returns: string
      }
      join_sport_event: { Args: { target_event_id: string }; Returns: string }
      leave_community: {
        Args: { target_community_id: string }
        Returns: undefined
      }
      leave_event_waitlist: {
        Args: { target_event_id: string }
        Returns: undefined
      }
      leave_sport_event: {
        Args: { target_event_id: string }
        Returns: undefined
      }
      list_active_account_sessions: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_current: boolean
          updated_at: string
          user_agent: string
        }[]
      }
      list_community_sport_events: {
        Args: { target_community_id: string }
        Returns: {
          city: string | null
          community_id: string | null
          court_id: string | null
          cover_url: string | null
          created_at: string
          currency: string
          description: string | null
          ends_at: string
          entry_fee_cents: number
          event_type: string
          id: string
          latitude: number | null
          location_name: string
          longitude: number | null
          max_players: number
          organizer_id: string
          sport: string
          starts_at: string
          status: Database["public"]["Enums"]["sportz_event_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["sportz_visibility"]
        }[]
        SetofOptions: {
          from: "*"
          to: "sport_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_home_feed: {
        Args: { page_cursor?: string; page_limit?: number }
        Returns: {
          author_id: string
          avatar_url: string
          body: string
          comments_count: number
          created_at: string
          display_name: string
          id: string
          kind: Database["public"]["Enums"]["sportz_post_kind"]
          likes_count: number
          media_height: number
          media_kind: string
          media_placeholder: string
          media_url: string
          media_width: number
          shares_count: number
          sport: string
          stats_line: string
          username: string
          visibility: Database["public"]["Enums"]["sportz_visibility"]
        }[]
      }
      list_home_feed_v2: {
        Args: { page_cursor?: string; page_limit?: number }
        Returns: {
          author_id: string
          avatar_url: string
          body: string
          comments_count: number
          created_at: string
          display_name: string
          id: string
          kind: Database["public"]["Enums"]["sportz_post_kind"]
          likes_count: number
          media_height: number
          media_kind: string
          media_placeholder: string
          media_url: string
          media_width: number
          shares_count: number
          sport: string
          stats_line: string
          username: string
          visibility: Database["public"]["Enums"]["sportz_visibility"]
        }[]
      }
      log_community_admin_action: {
        Args: {
          action_metadata?: Json
          target_action: string
          target_community_id: string
          target_user_id?: string
        }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_chat_room_read: {
        Args: { read_at?: string; target_room_id: string }
        Returns: {
          is_active: boolean
          is_pinned: boolean
          joined_at: string
          last_read_at: string | null
          left_at: string | null
          muted_until: string | null
          role: string
          room_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_social_notification_flush_at: { Args: never; Returns: string }
      notification_bundle_title: {
        Args: {
          actor_display_name: string
          notification_actor_count: number
          notification_kind: Database["public"]["Enums"]["sportz_notification_kind"]
        }
        Returns: string
      }
      notification_route_payload: {
        Args: {
          notification_entity_id: string
          notification_entity_type: string
          notification_kind: Database["public"]["Enums"]["sportz_notification_kind"]
        }
        Returns: Json
      }
      notify_event_waitlist_promotion: {
        Args: { target_event_id: string; target_user_id: string }
        Returns: undefined
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      profile_uses_push_feed: { Args: { profile_id: string }; Returns: boolean }
      promote_event_waitlist_locked: {
        Args: {
          preferred_user_id?: string
          promotion_limit?: number
          target_event_id: string
        }
        Returns: number
      }
      promote_event_waitlist_user: {
        Args: { target_event_id: string; target_user_id: string }
        Returns: undefined
      }
      prune_account_security_records: { Args: never; Returns: undefined }
      read_social_events_queue: {
        Args: { batch_size?: number; visibility_timeout?: number }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          vt: string
        }[]
      }
      recompute_athlete_achievements: {
        Args: { target_athlete_id: string; target_season_id: string }
        Returns: number
      }
      record_athlete_match: {
        Args: {
          target_opponent_name: string
          target_opponent_score: number
          target_outcome: string
          target_played_on: string
          target_season_id: string
          target_stats: Json
          target_team_name: string
          target_team_score: number
        }
        Returns: {
          athlete_id: string
          created_at: string
          id: string
          opponent_name: string
          opponent_score: number | null
          outcome: string
          played_on: string
          season_id: string
          sport: string
          team_name: string
          team_score: number | null
          updated_at: string
          verification_source: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "athlete_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_social_event_failure: {
        Args: {
          failure_reason: string
          message_id: number
          message_payload: Json
        }
        Returns: undefined
      }
      record_social_notification_event: {
        Args: { event_payload: Json }
        Returns: string
      }
      record_social_notification_events: {
        Args: { event_payloads: Json }
        Returns: number
      }
      refresh_athlete_profile_summary: {
        Args: { target_athlete_id: string }
        Returns: undefined
      }
      remove_chat_room_member: {
        Args: { target_room_id: string; target_user_id: string }
        Returns: undefined
      }
      remove_community_member: {
        Args: { target_community_id: string; target_user_id: string }
        Returns: undefined
      }
      remove_community_post: {
        Args: {
          removal_reason?: string
          target_community_id: string
          target_post_id: string
        }
        Returns: undefined
      }
      remove_event_attendee: {
        Args: { target_event_id: string; target_user_id: string }
        Returns: undefined
      }
      remove_event_waitlist_user: {
        Args: { target_event_id: string; target_user_id: string }
        Returns: undefined
      }
      request_or_follow_profile: {
        Args: { target_user_id: string }
        Returns: string
      }
      reset_social_counters: { Args: never; Returns: undefined }
      respond_community_invite: {
        Args: { approve: boolean; invite_id: string }
        Returns: undefined
      }
      respond_community_join_request: {
        Args: { approve: boolean; request_id: string }
        Returns: undefined
      }
      respond_team_offer: {
        Args: { accept_offer: boolean; target_offer_id: string }
        Returns: {
          accepted_at: string | null
          compensation_amount: number | null
          compensation_currency: string | null
          compensation_period: string | null
          created_at: string
          declined_at: string | null
          end_date: string | null
          expired_at: string | null
          expires_at: string
          id: string
          position: string
          recipient_id: string
          sender_id: string
          sent_at: string | null
          sport: string
          start_date: string | null
          status: string
          team_id: string
          terms: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "team_offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_event_invitation: {
        Args: { accept_invitation: boolean; target_invitation_id: string }
        Returns: string
      }
      respond_to_follow_request: {
        Args: { approve: boolean; request_id: string }
        Returns: undefined
      }
      revoke_account_session: {
        Args: { target_session_id: string }
        Returns: boolean
      }
      revoke_event_invitation: {
        Args: { target_invitation_id: string }
        Returns: undefined
      }
      search_content: {
        Args: {
          filter_type?: string
          result_limit?: number
          result_offset?: number
          search_query: string
        }
        Returns: {
          id: string
          skill_level: string
          subtitle: string
          title: string
          type: string
        }[]
      }
      send_chat_message: {
        Args: {
          client_message_id: string
          message_body?: string
          target_media_height?: number
          target_media_mime_type?: string
          target_media_path?: string
          target_media_url?: string
          target_media_width?: number
          target_message_type: Database["public"]["Enums"]["chat_message_type"]
          target_room_id: string
        }
        Returns: {
          body: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          media_duration_ms: number | null
          media_height: number | null
          media_mime_type: string | null
          media_path: string | null
          media_url: string | null
          media_width: number | null
          message_type: Database["public"]["Enums"]["chat_message_type"]
          metadata: Json
          room_id: string
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_team_offer: {
        Args: { target_offer_id: string }
        Returns: {
          accepted_at: string | null
          compensation_amount: number | null
          compensation_currency: string | null
          compensation_period: string | null
          created_at: string
          declined_at: string | null
          end_date: string | null
          expired_at: string | null
          expires_at: string
          id: string
          position: string
          recipient_id: string
          sender_id: string
          sent_at: string | null
          sport: string
          start_date: string | null
          status: string
          team_id: string
          terms: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "team_offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_community_archived: {
        Args: { archive: boolean; target_community_id: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          avatar_path: string | null
          city: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_private: boolean
          is_verified: boolean
          join_approval_required: boolean
          name: string
          posting_permission: string
          rules: string
          slug: string
          sport: string
          type: Database["public"]["Enums"]["sportz_community_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "communities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_sport_event_capacity_status: {
        Args: { target_event_id: string }
        Returns: undefined
      }
      set_sport_event_rsvp: {
        Args: {
          target_event_id: string
          target_status: Database["public"]["Enums"]["sportz_rsvp_status"]
        }
        Returns: string
      }
      social_bundle_delay_seconds: {
        Args: {
          bundle_actor_count: number
          bundle_kind: Database["public"]["Enums"]["sportz_notification_kind"]
        }
        Returns: number
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      transfer_community_ownership: {
        Args: { target_community_id: string; target_user_id: string }
        Returns: undefined
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_community_branding: {
        Args: {
          storage_path: string
          target_community_id: string
          target_kind: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          avatar_path: string | null
          city: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_private: boolean
          is_verified: boolean
          join_approval_required: boolean
          name: string
          posting_permission: string
          rules: string
          slug: string
          sport: string
          type: Database["public"]["Enums"]["sportz_community_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "communities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_community_member_role: {
        Args: {
          target_community_id: string
          target_role: string
          target_user_id: string
        }
        Returns: undefined
      }
      update_community_settings: {
        Args: {
          community_city: string
          community_description: string
          community_is_private: boolean
          community_name: string
          community_posting_permission: string
          community_rules: string
          community_sport: string
          require_join_approval: boolean
          target_community_id: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          avatar_path: string | null
          city: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_private: boolean
          is_verified: boolean
          join_approval_required: boolean
          name: string
          posting_permission: string
          rules: string
          slug: string
          sport: string
          type: Database["public"]["Enums"]["sportz_community_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "communities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_court_booking_status: {
        Args: { target_booking_id: string; target_status: string }
        Returns: undefined
      }
      update_post_content: {
        Args: {
          target_body: string
          target_kind: Database["public"]["Enums"]["sportz_post_kind"]
          target_location_label: string
          target_media_height: number
          target_media_kind: string
          target_media_processing_status: string
          target_media_storage_path: string
          target_media_url: string
          target_media_width: number
          target_mentioned_user_ids: string[]
          target_post_id: string
          target_sport: string
          target_stats_line: string
          target_visibility: Database["public"]["Enums"]["sportz_visibility"]
        }
        Returns: {
          author_id: string
          body: string
          comments_count: number
          community_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["sportz_post_kind"]
          likes_count: number
          location_label: string | null
          media_height: number | null
          media_kind: string | null
          media_placeholder: string | null
          media_processing_status: string
          media_storage_path: string | null
          media_url: string | null
          media_width: number | null
          sport: string | null
          stats_line: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["sportz_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upsert_notification_bundle: {
        Args: {
          actor_user_id: string
          bundle_eligible?: boolean
          notification_aggregate_key?: string
          notification_body: string
          notification_data?: Json
          notification_entity_id: string
          notification_entity_type: string
          notification_kind: Database["public"]["Enums"]["sportz_notification_kind"]
          notification_title: string
          target_user_id: string
        }
        Returns: string
      }
      users_blocked_each_other: {
        Args: { left_user_id: string; right_user_id: string }
        Returns: boolean
      }
      uuid_generate_v7: { Args: never; Returns: string }
      verify_athlete_match: {
        Args: {
          target_match_id: string
          target_source: string
          target_status: string
        }
        Returns: {
          athlete_id: string
          created_at: string
          id: string
          opponent_name: string
          opponent_score: number | null
          outcome: string
          played_on: string
          season_id: string
          sport: string
          team_name: string
          team_score: number | null
          updated_at: string
          verification_source: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "athlete_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_team_offer: {
        Args: { target_offer_id: string }
        Returns: {
          accepted_at: string | null
          compensation_amount: number | null
          compensation_currency: string | null
          compensation_period: string | null
          created_at: string
          declined_at: string | null
          end_date: string | null
          expired_at: string | null
          expires_at: string
          id: string
          position: string
          recipient_id: string
          sender_id: string
          sent_at: string | null
          sport: string
          start_date: string | null
          status: string
          team_id: string
          terms: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "team_offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      chat_message_type: "text" | "image" | "video"
      chat_room_kind: "direct" | "group"
      event_invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "revoked"
        | "expired"
      sportz_community_type: "group" | "page"
      sportz_event_status: "open" | "full" | "live" | "cancelled" | "completed"
      sportz_notification_kind:
        | "like"
        | "comment"
        | "follow"
        | "event"
        | "message"
        | "invite"
        | "achievement"
        | "follow_request"
        | "mention"
        | "security"
      sportz_post_kind: "post" | "thread" | "stats" | "highlight"
      sportz_rsvp_status: "going" | "interested" | "declined"
      sportz_skill_level: "Beginner" | "Intermediate" | "Advanced" | "Pro"
      sportz_visibility: "public" | "followers" | "group" | "invite"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      chat_message_type: ["text", "image", "video"],
      chat_room_kind: ["direct", "group"],
      event_invitation_status: [
        "pending",
        "accepted",
        "declined",
        "revoked",
        "expired",
      ],
      sportz_community_type: ["group", "page"],
      sportz_event_status: ["open", "full", "live", "cancelled", "completed"],
      sportz_notification_kind: [
        "like",
        "comment",
        "follow",
        "event",
        "message",
        "invite",
        "achievement",
        "follow_request",
        "mention",
        "security",
      ],
      sportz_post_kind: ["post", "thread", "stats", "highlight"],
      sportz_rsvp_status: ["going", "interested", "declined"],
      sportz_skill_level: ["Beginner", "Intermediate", "Advanced", "Pro"],
      sportz_visibility: ["public", "followers", "group", "invite"],
    },
  },
} as const
