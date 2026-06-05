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

export type TripHosting = {
  id: string
  trip_id: string
  host_user_id: string
  target_date: string
  slots_needed: number
  contact_link: string
  host_note: string | null
  status: 'open' | 'full' | 'archived' | 'expired' | 'canceled'
  hosting_tier: 'standard' | 'pro'
  is_boosted: boolean
  boost_reference: string | null
  boost_status: 'none' | 'pending' | 'approved' | 'rejected'
  listing_reference: string | null
  listing_status: 'free' | 'pending' | 'approved' | 'rejected'
  cancellation_reason?: string | null
  boosted_at?: string | null
  created_at: string
  
  users?: {
    display_name: string | null
    avatar_url: string | null
    is_verified_organizer: boolean
  }
}

export type TripHostingMember = {
  id: string
  hosting_id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  users?: {
    display_name: string | null
    avatar_url: string | null
    vouch_count: number | null
    is_verified_organizer: boolean
  }
}

export type TripHostingMessage = {
    id: string
    hosting_id: string
    user_id: string
    content: string
    is_pinned: boolean
    reply_to_id: string | null
    created_at: string
    users?: {
      display_name: string | null
      avatar_url: string | null
      is_verified_organizer: boolean
    }
    parent?: {
      content: string
      user_id?: string | null
      users?: {
        display_name: string | null
      }
    } | null
  }

export type TripPriceSuggestion = {
  id: string
  trip_id: string
  suggested_by_user_id: string
  category: 'Transport' | 'Food' | 'Activities' | 'Accommodation'
  suggested_amount: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  users?: {
    display_name: string | null
    avatar_url: string | null
  }
}

export type Trip = {
  id: string
  user_id: string
  destination: string
  trip_name?: string | null
  destination_region: string
  origin_region: string
  destination_place_id: string | null
  destination_lat: number | null
  destination_lng: number | null
  destination_city: string | null
  destination_province: string | null
  destination_country: string | null
  origin_place_id: string | null
  origin_lat: number | null
  origin_lng: number | null
  origin_city: string | null
  origin_province: string | null
  origin_country: string | null
  origin_area: string | null
  end_area: string | null
  route_context: string | null
  travel_date: string
  group_size: number
  group_type: string
  trip_type: string
  duration_days: number
  trip_duration_label?: string | null
  cost_per_person: number
  cost_scope?: 'individual' | 'group_total' | null
  transport_cost: number | null
  transport_cost_scope?: string | null
  food_cost: number | null
  activities_cost: number | null
  accommodation_cost: number | null
  detailed_costs: { id: string; category: string; label: string; amount: string }[] | null
  tip: string | null
  honest_warning: string | null
  would_return: boolean
  travel_style: string
  submission_tier: string
  view_count: number
  save_count: number
  helpful_count: number
  trip_summary: string | null
  is_approved: boolean
  review_status?: string | null
  is_public: boolean
  is_curated?: boolean
  attribution_source?: string | null
  claimed_by?: string | null
  claim_request_by?: string | null
  claim_proof?: string | null
  created_at: string
  trip_stops?: TripStop[]
  trip_days?: TripDay[]
  users?: {
    display_name: string | null
    avatar_url: string | null
  }
}

export type TripDay = {
  id: string
  trip_id: string
  day_number: number
  time_of_day: string
  activity: string
  cost: number | null
  display_order: number
}

export type TripStop = {
  id: string
  trip_id: string
  stop_name: string
  stop_note: string | null
  display_order: number
  created_at: string
}

export type TripPhoto = {
  id: string
  trip_id: string
  photo_url: string
  caption: string | null
  is_hero: boolean
  display_order: number
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

export type SavedTrip = {
  id: string
  user_id: string
  trip_id: string
  saved_at: string
}

export type TripHelpfulVote = {
  trip_id: string
  user_id: string
  created_at: string
}

export type TripComment = {
    id: string
    trip_id: string
    user_id: string
    content: string
    reply_to_id: string | null
    created_at: string
    users?: {
      display_name: string | null
      avatar_url: string | null
    }
    parent?: {
      content: string
      users?: {
        display_name: string | null
      }
    } | null
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
      trips: {
        Row: Trip
        Insert: Partial<Trip>
        Update: Partial<Trip>
        Relationships: []
      }
      trip_days: {
        Row: TripDay
        Insert: Partial<TripDay>
        Update: Partial<TripDay>
        Relationships: []
      }
      trip_photos: {
        Row: TripPhoto
        Insert: Partial<TripPhoto>
        Update: Partial<TripPhoto>
        Relationships: []
      }
      trip_stops: {
        Row: TripStop
        Insert: Partial<TripStop>
        Update: Partial<TripStop>
        Relationships: []
      }
      businesses: {
        Row: Business
        Insert: Partial<Business>
        Update: Partial<Business>
        Relationships: []
      }
      saved_trips: {
        Row: SavedTrip
        Insert: Partial<SavedTrip>
        Update: Partial<SavedTrip>
        Relationships: []
      }
      trip_helpful_votes: {
        Row: TripHelpfulVote
        Insert: Partial<TripHelpfulVote>
        Update: Partial<TripHelpfulVote>
        Relationships: []
      }
      trip_comments: {
        Row: TripComment
        Insert: Partial<TripComment>
        Update: Partial<TripComment>
        Relationships: []
      }
      profile_verifications: {
        Row: ProfileVerification
        Insert: Partial<ProfileVerification>
        Update: Partial<ProfileVerification>
        Relationships: []
      }
      trip_hosting: {
        Row: TripHosting
        Insert: Partial<TripHosting>
        Update: Partial<TripHosting>
        Relationships: []
      }
      trip_hosting_members: {
        Row: TripHostingMember
        Insert: Partial<TripHostingMember>
        Update: Partial<TripHostingMember>
        Relationships: []
      }
      trip_hosting_messages: {
        Row: TripHostingMessage
        Insert: Partial<TripHostingMessage>
        Update: Partial<TripHostingMessage>
        Relationships: []
      }
      trip_price_suggestions: {
        Row: TripPriceSuggestion
        Insert: Partial<TripPriceSuggestion>
        Update: Partial<TripPriceSuggestion>
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
    }
    Enums: {
      [_ in never]: never
    }
  }
}
