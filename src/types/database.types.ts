export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          cover_url: string | null;
          bio: string | null;
          city: string | null;
          country: string | null;
          primary_sport: string | null;
          sports: string[];
          position: string | null;
          skill_level: string | null;
          is_hireable: boolean;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; username: string; display_name: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          kind: string;
          sport: string | null;
          body: string;
          media_url: string | null;
          media_kind: string | null;
          stats_line: string | null;
          visibility: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['posts']['Row']> & { author_id: string; body: string };
        Update: Partial<Database['public']['Tables']['posts']['Row']>;
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['comments']['Row']> & { post_id: string; author_id: string; body: string };
        Update: Partial<Database['public']['Tables']['comments']['Row']>;
      };
      likes: {
        Row: {
          id: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['likes']['Row']> & { user_id: string; entity_type: string; entity_id: string };
        Update: Partial<Database['public']['Tables']['likes']['Row']>;
      };
      sport_events: {
        Row: {
          id: string;
          organizer_id: string;
          title: string;
          sport: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          location_name: string;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          max_players: number;
          entry_fee_cents: number;
          currency: string;
          visibility: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sport_events']['Row']> & { organizer_id: string; title: string; sport: string; starts_at: string; ends_at: string; location_name: string };
        Update: Partial<Database['public']['Tables']['sport_events']['Row']>;
      };
      courts: {
        Row: {
          id: string;
          name: string;
          sport: string;
          city: string;
          latitude: number;
          longitude: number;
          surface: string | null;
          rating: number | null;
          hourly_price_cents: number | null;
          currency: string;
          availability_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['courts']['Row']> & { name: string; sport: string; city: string; latitude: number; longitude: number };
        Update: Partial<Database['public']['Tables']['courts']['Row']>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          created_at: string;
          edited_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['messages']['Row']> & { conversation_id: string; sender_id: string; body: string };
        Update: Partial<Database['public']['Tables']['messages']['Row']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string | null;
          kind: string;
          title: string;
          body: string;
          entity_type: string | null;
          entity_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & { user_id: string; kind: string; title: string; body: string };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['follows']['Row']> & { follower_id: string; following_id: string };
        Update: Partial<Database['public']['Tables']['follows']['Row']>;
      };
      event_attendees: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['event_attendees']['Row']> & { event_id: string; user_id: string; status: string };
        Update: Partial<Database['public']['Tables']['event_attendees']['Row']>;
      };
      conversations: {
        Row: {
          id: string;
          title: string | null;
          is_group: boolean;
          created_by: string | null;
          last_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['conversations']['Row']>;
        Update: Partial<Database['public']['Tables']['conversations']['Row']>;
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: string;
          last_read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['conversation_members']['Row']> & { conversation_id: string; user_id: string };
        Update: Partial<Database['public']['Tables']['conversation_members']['Row']>;
      };
      communities: {
        Row: {
          id: string;
          type: string;
          name: string;
          slug: string;
          description: string | null;
          sport: string;
          city: string | null;
          is_verified: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['communities']['Row']> & { type: string; name: string; slug: string; sport: string };
        Update: Partial<Database['public']['Tables']['communities']['Row']>;
      };
      community_members: {
        Row: {
          community_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['community_members']['Row']> & { community_id: string; user_id: string };
        Update: Partial<Database['public']['Tables']['community_members']['Row']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
