export type User = {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  region: string | null
  travel_style: string | null
  typical_budget: string | null
  has_contributed: boolean
  access_expires_at: string | null
  total_vouches: number
  created_at: string
  
  // Trust metrics
  is_wallet_verified?: boolean
  wallet_phone_masked?: string | null
  vouch_count?: number
  is_verified_organizer?: boolean
  hosting_credits?: number
  completed_profile_credit_awarded?: boolean
  bio?: string | null
  social_link?: string | null
}

export type ProfileVerification = {
  id: string
  user_id: string
  facebook_link: string
  gcash_reference: string
  gcash_account_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
}

export type Route = {
  id: string
  user_id: string
  origin: string
  destination: string
  origin_lat: number | null
  origin_lng: number | null
  destination_lat: number | null
  destination_lng: number | null
  travel_date_month: number | null
  travel_date_year: number | null
  estimated_duration: string | null
  total_fare: number
  community_notes: string | null
  destination_tip: string | null
  last_verified_at: string
  confidence_score: number
  created_at: string
  /** Present only when returned by browse_routes_filtered RPC */
  total_count?: number
  users?: {
    display_name: string | null
    avatar_url: string | null
  }
}

export type RouteSegment = {
  id: string
  route_id: string
  transport_type: string
  signboard: string | null
  fare: number
  boarding_name: string | null
  boarding_lat: number | null
  boarding_lng: number | null
  drop_off_name: string | null
  drop_off_lat: number | null
  drop_off_lng: number | null
  boarding_tip: string | null
  drop_off_tip: string | null
  estimated_duration: string | null
  photo_url: string | null
  display_order: number
  created_at: string
}

export type RouteVerification = {
  id: string
  route_id: string
  user_id: string | null
  verification_type: 'accurate' | 'fare_changed' | 'boarding_point_changed' | 'unavailable'
  new_fare: number | null
  notes: string | null
  created_at: string
  users?: {
    display_name: string | null
    avatar_url: string | null
  }
}

export type Business = {
  id: string
  business_name: string
  destination: string
  business_type: string
  price_range: string | null
  contact: string | null
  description: string | null
  photo_url: string | null
  is_featured: boolean
  feature_start: string | null
  feature_end: string | null
}

export type Notification = {
  id: string
  user_id: string
  actor_id: string | null
  type: string
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
  actor?: {
    display_name: string | null
    avatar_url: string | null
  }
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Partial<User>
        Update: Partial<User>
        Relationships: []
      }
      routes: {
        Row: Route
        Insert: Partial<Route>
        Update: Partial<Route>
        Relationships: []
      }
      route_segments: {
        Row: RouteSegment
        Insert: Partial<RouteSegment>
        Update: Partial<RouteSegment>
        Relationships: []
      }
      route_verifications: {
        Row: RouteVerification
        Insert: Partial<RouteVerification>
        Update: Partial<RouteVerification>
        Relationships: []
      }
      businesses: {
        Row: Business
        Insert: Partial<Business>
        Update: Partial<Business>
        Relationships: []
      }
      profile_verifications: {
        Row: ProfileVerification
        Insert: Partial<ProfileVerification>
        Update: Partial<ProfileVerification>
        Relationships: []
      }
      notifications: {
        Row: Notification
        Insert: Partial<Notification>
        Update: Partial<Notification>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_vouch_count: {
        Args: {
          target_user_id: string
        }
        Returns: undefined
      }
      browse_routes_filtered: {
        Args: {
          transport_types?: string[] | null
          min_confidence?:  number   | null
          search_text?:     string
          page_offset?:     number
          page_limit?:      number
        }
        Returns: (Route & { total_count: number })[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
