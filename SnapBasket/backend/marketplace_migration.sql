-- Multi-Vendor Marketplace Ecosystem SQL Migration
-- Run this script in your Supabase SQL Editor to upgrade your ADYANTA database instantly!

--------------------------------------------------------------------------------
-- 1. Base Column Adaptations
--------------------------------------------------------------------------------

-- Add role column to users (customer, vendor, super_admin)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- Upgrade SURESH to super_admin (master admin user)
UPDATE public.users SET role = 'super_admin' WHERE username = 'suresh' OR phone = '9490229108';

--------------------------------------------------------------------------------
-- 2. New Ecosystem Tables
--------------------------------------------------------------------------------

-- Shops / Stores Table
CREATE TABLE IF NOT EXISTS public.shops (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES public.users(id),
    name TEXT NOT NULL,
    logo TEXT,
    banner TEXT,
    description TEXT,
    timings TEXT DEFAULT '9:00 AM - 10:00 PM',
    category TEXT,
    contact_phone TEXT,
    rating NUMERIC DEFAULT 4.5,
    delivery_time TEXT DEFAULT '15-30 mins',
    status TEXT DEFAULT 'pending', -- pending, active, suspended
    kyc_document TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Associate Products with a specific Shop
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES public.shops(id) NULL;

-- Associate Coupons with a specific Shop
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES public.shops(id) NULL;

-- Associate Orders with a specific Shop (allows per-shop order tracking)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES public.shops(id) NULL;

-- Vendor Payout & Wallet Table
CREATE TABLE IF NOT EXISTS public.vendor_wallets (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES public.shops(id) UNIQUE,
    balance INTEGER DEFAULT 0,
    revenue INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Platform Feature Flags Table (Master Switchboard)
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    category TEXT DEFAULT 'general'
);

--------------------------------------------------------------------------------
-- 3. Initial Ecosystem Seeding
--------------------------------------------------------------------------------

-- Seed default Feature Flags
INSERT INTO public.feature_flags (name, label, is_active, category) VALUES
('ai_chatbot', 'AI Chatbot Support Assistant', true, 'customer'),
('reviews_ratings', 'Customer Reviews & Ratings', true, 'customer'),
('cod_payment', 'Cash on Delivery (COD)', true, 'payment'),
('wallet_system', 'Vendor Payout Wallet', true, 'vendor'),
('vendor_onboarding', 'New Vendor Registration', true, 'vendor'),
('card_payment', 'Credit/Debit Card Gateway', true, 'payment')
ON CONFLICT (name) DO NOTHING;

-- Seed default user sutharsan as a Vendor (Phone: 9876543210)
UPDATE public.users SET role = 'vendor' WHERE username = 'rakesh' OR phone = '9876543210';

-- Create a Default Shop for the vendor Rakesh Kumar (id: 1)
INSERT INTO public.shops (id, vendor_id, name, logo, banner, description, timings, category, contact_phone, rating, delivery_time, status)
VALUES (
    1, 
    1, 
    'Adyanta Organic Farm Store', 
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&h=150&fit=crop',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200',
    'Farm fresh organic vegetables, crispy greens, and seasonal delicious local fruits direct to your doorstep.',
    '8:00 AM - 9:00 PM',
    'Fresh Vegetables & Fruits',
    '+91 98765 43210',
    4.9,
    '15-30 mins',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Associate existing seed products (Dals, Apples, etc.) to this default Shop 1
UPDATE public.products SET shop_id = 1 WHERE shop_id IS NULL;

-- Create default wallet for Shop 1
INSERT INTO public.vendor_wallets (shop_id, balance, revenue)
VALUES (1, 12000, 34500)
ON CONFLICT (shop_id) DO NOTHING;
