-- Add vendor fee columns to settings table
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS vendor_fee_amount INTEGER DEFAULT 0;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS vendor_fee_discount INTEGER DEFAULT 0;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS vendor_fee_coupon TEXT DEFAULT '';

-- Add registration payment columns to shops table
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS registration_fee INTEGER DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS discount_applied INTEGER DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
