-- SQL Migration for Marketplace Enhancements (Supabase / PostgreSQL)

-- 1. Add custom commission rate per vendor store
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS commission_rate INTEGER DEFAULT 5;

-- 2. Add custom commission rate per product category
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS commission_rate INTEGER DEFAULT 5;

-- 3. Add subscription expiry date for vendors
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMP WITH TIME ZONE;

-- 4. Set Suresh (Master Admin) role to super_admin if not already
UPDATE public.users SET role = 'super_admin' WHERE username = 'suresh' OR phone = '9490229108';
