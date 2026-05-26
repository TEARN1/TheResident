-- =========================================================================
-- THE RESIDENT APP: EXTENDED SUPABASE SQL SCHEMA
-- =========================================================================
-- This script configures all tables for The Resident. Run this in your 
-- Supabase SQL Editor. It hooks into the shared 'public.profiles' table
-- created by The Gruvs to share user credentials and identities.

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 2. TABLES
-- =========================================================================

-- RESIDENT USER METADATA (Links to profiles table shared with The Gruvs)
CREATE TABLE IF NOT EXISTS public.resident_profiles (
    id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('tenant', 'landlord', 'visitor')),
    balance NUMERIC DEFAULT 2500.00,
    bio TEXT,
    gender TEXT CHECK (gender IN ('men', 'women', 'any')),
    children_count INTEGER DEFAULT 0,
    employment_status TEXT,
    has_pets BOOLEAN DEFAULT FALSE,
    verification_doc_url TEXT,
    -- Landlord specific preferences
    landlord_gender_pref TEXT CHECK (landlord_gender_pref IN ('men', 'women', 'couple', 'any')),
    landlord_children_allowed BOOLEAN DEFAULT TRUE,
    landlord_max_children INTEGER DEFAULT 0,
    landlord_smoking_allowed BOOLEAN DEFAULT FALSE,
    landlord_pets_allowed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PROPERTY LISTINGS
CREATE TABLE IF NOT EXISTS public.listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'ZAR',
    location TEXT NOT NULL,
    suburb TEXT,
    safety_rating TEXT CHECK (safety_rating IN ('high', 'medium', 'low')) DEFAULT 'medium',
    safety_notes TEXT,
    landlord_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    landlord_name TEXT,
    landlord_lives_here BOOLEAN DEFAULT FALSE,
    images TEXT[] DEFAULT '{}',
    -- Amenities
    wifi BOOLEAN DEFAULT FALSE,
    parking BOOLEAN DEFAULT FALSE,
    bathroom TEXT CHECK (bathroom IN ('shared', 'private', 'ensuite')) DEFAULT 'shared',
    -- Matching Criteria
    req_gender_pref TEXT CHECK (req_gender_pref IN ('men', 'women', 'couple', 'any')) DEFAULT 'any',
    req_children_allowed BOOLEAN DEFAULT TRUE,
    req_max_children INTEGER DEFAULT 0,
    req_smoking_allowed BOOLEAN DEFAULT FALSE,
    req_pets_allowed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ROOM APPLICATIONS / REQUESTS
CREATE TABLE IF NOT EXISTS public.room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    tenant_name TEXT,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    listing_title TEXT,
    landlord_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LIFT CLUBS
CREATE TABLE IF NOT EXISTS public.lift_clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    driver_name TEXT,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_time TEXT,
    days TEXT,
    price_per_seat NUMERIC NOT NULL,
    currency TEXT DEFAULT 'ZAR',
    available_seats INTEGER NOT NULL,
    total_seats INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HANDYMAN BUSINESS SERVICES
CREATE TABLE IF NOT EXISTS public.handyman_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    business_name TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    suburb TEXT,
    rating NUMERIC DEFAULT 5.0,
    contact_number TEXT NOT NULL,
    website_url TEXT,
    price_estimate TEXT,
    description TEXT,
    image TEXT,
    reviews_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MAINTENANCE DISPATCH ORDERS
CREATE TABLE IF NOT EXISTS public.service_dispatches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES public.handyman_services(id) ON DELETE CASCADE NOT NULL,
    service_name TEXT,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    sender_name TEXT,
    sender_role TEXT,
    message TEXT,
    status TEXT CHECK (status IN ('pending', 'accepted', 'completed')) DEFAULT 'pending',
    proof_file_name TEXT,
    proof_file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PREPAID UTILITY VOUCHERS
CREATE TABLE IF NOT EXISTS public.utility_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    landlord_name TEXT,
    meter_number TEXT NOT NULL,
    price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'ZAR',
    token_code TEXT NOT NULL,
    status TEXT CHECK (status IN ('available', 'sold')) DEFAULT 'available',
    purchased_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    purchased_at TIMESTAMP WITH TIME ZONE
);

-- P2P TOOL SHARING
CREATE TABLE IF NOT EXISTS public.tool_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    owner_name TEXT,
    title TEXT NOT NULL,
    description TEXT,
    price_per_day NUMERIC NOT NULL,
    currency TEXT DEFAULT 'ZAR',
    deposit NUMERIC DEFAULT 0,
    location TEXT,
    status TEXT CHECK (status IN ('available', 'rented')) DEFAULT 'available',
    rented_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rented_by_name TEXT,
    rented_until TEXT
);

-- CO-LIVING CHORE SCHEDULER
CREATE TABLE IF NOT EXISTS public.chore_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roommate_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    roommate_name TEXT,
    task_name TEXT NOT NULL,
    day_of_week TEXT,
    status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE
);

-- MEDIATION & DISPUTES
CREATE TABLE IF NOT EXISTS public.community_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('Noise', 'Messiness', 'Utility overuse', 'Chore avoidance', 'Security breach', 'Other')) DEFAULT 'Other',
    reported_by TEXT,
    reported_by_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    against_user TEXT,
    against_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    mediator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    mediator_name TEXT,
    status TEXT CHECK (status IN ('pending', 'mediating', 'resolved')) DEFAULT 'pending',
    resolution_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ROOMMATE SEEKERS
CREATE TABLE IF NOT EXISTS public.roommate_seekers (
    id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    gender TEXT CHECK (gender IN ('men', 'women')),
    children_count INTEGER DEFAULT 0,
    budget NUMERIC,
    currency TEXT DEFAULT 'ZAR',
    location TEXT,
    suburb TEXT,
    bio TEXT
);

-- NOTICE BULLETINS & SCHEDULED EVENTS
CREATE TABLE IF NOT EXISTS public.notice_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('notice', 'event')),
    posted_by TEXT,
    posted_by_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    event_date TEXT,
    rsvps UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.resident_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lift_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handyman_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roommate_seekers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_events ENABLE ROW LEVEL SECURITY;

-- 4. SIMPLE POLICIES (Allow public read, owner write/modify)
CREATE POLICY "View resident profiles" ON public.resident_profiles FOR SELECT USING (true);
CREATE POLICY "Manage resident profiles" ON public.resident_profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "View listings" ON public.listings FOR SELECT USING (true);
CREATE POLICY "Manage listings" ON public.listings FOR ALL USING (auth.uid() = landlord_id);

CREATE POLICY "View requests" ON public.room_requests FOR SELECT USING (true);
CREATE POLICY "Manage requests" ON public.room_requests FOR ALL USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);

CREATE POLICY "View lift clubs" ON public.lift_clubs FOR SELECT USING (true);
CREATE POLICY "Manage lift clubs" ON public.lift_clubs FOR ALL USING (auth.uid() = driver_id);

CREATE POLICY "View services" ON public.handyman_services FOR SELECT USING (true);
CREATE POLICY "Manage services" ON public.handyman_services FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "View dispatches" ON public.service_dispatches FOR SELECT USING (true);
CREATE POLICY "Manage dispatches" ON public.service_dispatches FOR ALL USING (auth.uid() = sender_id);

CREATE POLICY "View tokens" ON public.utility_tokens FOR SELECT USING (true);
CREATE POLICY "Manage tokens" ON public.utility_tokens FOR ALL USING (auth.uid() = landlord_id OR auth.uid() = purchased_by);

CREATE POLICY "View tools" ON public.tool_library FOR SELECT USING (true);
CREATE POLICY "Manage tools" ON public.tool_library FOR ALL USING (auth.uid() = owner_id OR auth.uid() = rented_by);

CREATE POLICY "View chores" ON public.chore_schedule FOR SELECT USING (true);
CREATE POLICY "Manage chores" ON public.chore_schedule FOR ALL USING (true);

CREATE POLICY "View disputes" ON public.community_disputes FOR SELECT USING (true);
CREATE POLICY "Manage disputes" ON public.community_disputes FOR ALL USING (auth.uid() = reported_by_id OR auth.uid() = mediator_id);

CREATE POLICY "View seekers" ON public.roommate_seekers FOR SELECT USING (true);
CREATE POLICY "Manage seekers" ON public.roommate_seekers FOR ALL USING (auth.uid() = id);

CREATE POLICY "View notice events" ON public.notice_events FOR SELECT USING (true);
CREATE POLICY "Manage notice events" ON public.notice_events FOR ALL USING (auth.uid() = posted_by_id);
