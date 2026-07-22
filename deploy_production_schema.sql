-- ══════════════════════════════════════════════════════════════════════════════
-- THE RESIDENT — COMPLETE PRODUCTION SUPABASE DATABASE SCHEMA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════
-- Instructions: Run this script inside your Supabase Project SQL Editor
-- (https://supabase.com/dashboard/project/_/sql).

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES & USER REPUTATION TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    suburb TEXT DEFAULT 'Ivory Park Zone 5',
    reputation_score INT DEFAULT 100,
    reputation_tier TEXT DEFAULT 'Apprentice',
    xp_points INT DEFAULT 0,
    surveyor_level INT DEFAULT 1,
    connection_count INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ROOM LISTINGS TABLE
CREATE TABLE IF NOT EXISTS public.res_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ZAR',
    suburb TEXT NOT NULL,
    location TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    safety_rating VARCHAR(20) DEFAULT 'medium',
    safety_notes TEXT,
    landlord_lives_here BOOLEAN DEFAULT FALSE,
    images TEXT[],
    amenities JSONB DEFAULT '{}'::jsonb,
    requirements JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. UTILITY VOUCHERS TABLE
CREATE TABLE IF NOT EXISTS public.res_utility_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    meter_number TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ZAR',
    signature_hash TEXT NOT NULL,
    token_code TEXT,
    status VARCHAR(20) DEFAULT 'available',
    purchased_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    purchased_at TIMESTAMP WITH TIME ZONE
);

-- 4. P2P COMMUNITY DISPUTES & JURY TRIBUNAL
CREATE TABLE IF NOT EXISTS public.res_community_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claimant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    respondent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'noise',
    evidence_hash TEXT,
    status VARCHAR(20) DEFAULT 'open',
    votes_for_claimant INT DEFAULT 0,
    votes_for_respondent INT DEFAULT 0,
    jury_status VARCHAR(30) DEFAULT 'voting_open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TRAFFIC REPORTS & HAZARD DELAYS
CREATE TABLE IF NOT EXISTS public.res_traffic_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    suburb TEXT,
    city TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. COMMUNAL BOREHOLE & STANDPIPE RESOURCES
CREATE TABLE IF NOT EXISTS public.res_shared_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'borehole',
    status TEXT DEFAULT 'pressure:high|buckets:0|wait:0',
    description TEXT,
    location TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    verified_count INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SECURITY & THREAT AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.res_security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY (RLS) POLICIES ────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.res_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.res_utility_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.res_community_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.res_traffic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.res_shared_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.res_security_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active listings and resources
CREATE POLICY "Public Read Listings" ON public.res_listings FOR SELECT USING (status = 'available');
CREATE POLICY "Public Read Resources" ON public.res_shared_resources FOR SELECT USING (true);
CREATE POLICY "Public Read Traffic Reports" ON public.res_traffic_reports FOR SELECT USING (true);
CREATE POLICY "Public Read Disputes" ON public.res_community_disputes FOR SELECT USING (true);
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (true);

-- ── WRITE POLICIES (scoped to authenticated owner) ───────────────────────────

-- Profiles: users can only update their own row
CREATE POLICY "Users Update Own Profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Listings: landlords can INSERT/UPDATE/DELETE only their own listings
CREATE POLICY "Landlords Insert Listings" ON public.res_listings
  FOR INSERT WITH CHECK (auth.uid() = landlord_id);
CREATE POLICY "Landlords Update Own Listings" ON public.res_listings
  FOR UPDATE USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);
CREATE POLICY "Landlords Delete Own Listings" ON public.res_listings
  FOR DELETE USING (auth.uid() = landlord_id);

-- Utility Tokens: landlords manage their own tokens
CREATE POLICY "Landlords Insert Tokens" ON public.res_utility_tokens
  FOR INSERT WITH CHECK (auth.uid() = landlord_id);
CREATE POLICY "Landlords Update Own Tokens" ON public.res_utility_tokens
  FOR UPDATE USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);
CREATE POLICY "Read Own Tokens" ON public.res_utility_tokens
  FOR SELECT USING (auth.uid() = landlord_id OR auth.uid() = purchased_by);

-- Traffic Reports: any authenticated user can report, but only delete their own
CREATE POLICY "Auth Users Insert Traffic Reports" ON public.res_traffic_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users Delete Own Traffic Reports" ON public.res_traffic_reports
  FOR DELETE USING (auth.uid() = reporter_id);

-- Disputes: claimants can file, both parties can read their disputes
CREATE POLICY "Auth Users File Disputes" ON public.res_community_disputes
  FOR INSERT WITH CHECK (auth.uid() = claimant_id);
CREATE POLICY "Parties Read Own Disputes" ON public.res_community_disputes
  FOR SELECT USING (auth.uid() = claimant_id OR auth.uid() = respondent_id);

-- Shared Resources: any authenticated user can contribute
CREATE POLICY "Auth Users Insert Resources" ON public.res_shared_resources
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Security Logs: insert-only, no user reads (admin-only via service role)
CREATE POLICY "System Insert Security Logs" ON public.res_security_logs
  FOR INSERT WITH CHECK (true);

-- Indexes for spatial and suburb search performance
CREATE INDEX IF NOT EXISTS idx_listings_suburb ON public.res_listings(suburb);
CREATE INDEX IF NOT EXISTS idx_listings_lat_lon ON public.res_listings(lat, lon);
CREATE INDEX IF NOT EXISTS idx_traffic_lat_lon ON public.res_traffic_reports(lat, lon);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.res_community_disputes(status);
