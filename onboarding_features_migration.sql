-- Add shop_id relationship to promo_banners
ALTER TABLE public.promo_banners ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES public.shops(id) ON DELETE CASCADE;

-- Add shop_id relationship to special_offers
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES public.shops(id) ON DELETE CASCADE;
