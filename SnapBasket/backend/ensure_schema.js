const { supabase } = require('./supabaseClient');

async function ensureSchema() {
    console.log("🚀 Syncing Database Schema...");

    // 1. Add variants column to products if missing
    // Since Supabase RPC or SQL injection via API is restricted, 
    // we use a trick: checking if we can select it, if not, we warn.
    // However, as an AI, I should recommend the user to run the SQL or I can try to use a migration script if available.
    
    // Check products columns
    const { data, error } = await supabase.from('products').select('*').limit(1);
    
    if (error) {
        console.error("❌ Error fetching products:", error.message);
        return;
    }

    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    console.log("Current columns in 'products':", columns);

    if (!columns.includes('variants')) {
        console.log("⚠️ Column 'variants' is missing in 'products' table.");
        console.log("👉 Please run the following SQL in Supabase SQL Editor:");
        console.log("ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants JSONB;");
    }

    if (!columns.includes('shop_id')) {
        console.log("⚠️ Column 'shop_id' is missing in 'products' table.");
        console.log("👉 Please run 'marketplace_migration.sql' in Supabase SQL Editor.");
    }

    if (!columns.includes('imgUrl') && columns.includes('imgurl')) {
        console.log("⚠️ Case sensitivity issue: 'imgurl' found instead of 'imgUrl'.");
        console.log("👉 Please run:");
        console.log("ALTER TABLE public.products RENAME COLUMN imgurl TO \"imgUrl\";");
    }

    // 2. Check orders columns
    const { data: orderData, error: orderError } = await supabase.from('orders').select('*').limit(1);
    const orderColumns = orderData && orderData.length > 0 ? Object.keys(orderData[0]) : [];
    console.log("Current columns in 'orders':", orderColumns);

    if (!orderColumns.includes('delivery_type')) {
        console.log("❌ Column 'delivery_type' is missing in 'orders' table!");
        console.log("👉 PLEASE RUN THIS SQL IN YOUR SUPABASE SQL EDITOR:");
        console.log("ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'Home Delivery';");
    }

    if (!orderColumns.includes('shop_id')) {
        console.log("⚠️ Column 'shop_id' is missing in 'orders' table.");
    }

    if (!orderColumns.includes('discount_amount')) {
        console.log("⚠️ Column 'discount_amount' is missing in 'orders' table.");
        console.log("👉 PLEASE RUN THIS SQL:");
        console.log("ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;");
    }

    if (!orderColumns.includes('daily_seq')) {
        console.log("⚠️ Column 'daily_seq' is missing in 'orders' table.");
        console.log("👉 PLEASE RUN THIS SQL:");
        console.log("ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS daily_seq INTEGER DEFAULT 1;");
    }

    if (!orderColumns.includes('coupon_id')) {
        console.log("❌ Column 'coupon_id' is missing in 'orders' table!");
        console.log("👉 PLEASE RUN THIS SQL IN YOUR SUPABASE SQL EDITOR:");
        console.log("ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES public.coupons(id);");
    }

    // 3. Check Multi-vendor tables
    try {
        const { error: shopErr, data: shopData } = await supabase.from('shops').select('*').limit(1);
        if (shopErr) {
            console.log("❌ Table 'shops' does not exist in your database!");
            console.log("👉 PLEASE RUN THE ENTIRE 'marketplace_migration.sql' SCRIPT IN YOUR SUPABASE SQL EDITOR!");
        } else {
            console.log("✅ Table 'shops' verified successfully.");
            if (shopData && shopData.length > 0) {
                const shopCols = Object.keys(shopData[0]);
                const requiredShopCols = ['is_paid', 'registration_fee', 'discount_applied', 'razorpay_order_id', 'razorpay_payment_id'];
                requiredShopCols.forEach(col => {
                    if (!shopCols.includes(col)) {
                        console.log(`⚠️ Column '${col}' is missing in 'shops' table.`);
                        console.log(`👉 Run: ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS ${col} ${col === 'is_paid' ? 'BOOLEAN DEFAULT false' : (col.endsWith('_id') ? 'TEXT' : 'INTEGER DEFAULT 0')};`);
                    }
                });
            }
        }
        
        const { error: walletErr } = await supabase.from('vendor_wallets').select('*').limit(1);
        if (walletErr) console.log("⚠️ Table 'vendor_wallets' does not exist.");
        
        const { error: flagsErr } = await supabase.from('feature_flags').select('*').limit(1);
        if (flagsErr) console.log("⚠️ Table 'feature_flags' does not exist.");
    } catch(e) {
        console.log("Error checking multi-vendor tables:", e.message);
    }

    // 4. Check loyalty columns
    try {
        console.log("🚀 Checking loyalty schema columns...");
        const { data: userData, error: userErr } = await supabase.from('users').select('*').limit(1);
        if (!userErr && userData && userData.length > 0) {
            const userCols = Object.keys(userData[0]);
            if (!userCols.includes('coins')) {
                console.log("⚠️ Column 'coins' is missing in 'users' table.");
                console.log("👉 Run: ALTER TABLE public.users ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0;");
            }
            if (!userCols.includes('role')) {
                console.log("⚠️ Column 'role' is missing in 'users' table.");
                console.log("👉 Run: ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';");
            }
        }

        const { data: orderData2, error: orderErr2 } = await supabase.from('orders').select('*').limit(1);
        if (!orderErr2 && orderData2 && orderData2.length > 0) {
            const ordCols = Object.keys(orderData2[0]);
            if (!ordCols.includes('coins_earned')) {
                console.log("⚠️ Column 'coins_earned' is missing in 'orders' table.");
                console.log("👉 Run: ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coins_earned INTEGER DEFAULT 0;");
            }
            if (!ordCols.includes('coins_used')) {
                console.log("⚠️ Column 'coins_used' is missing in 'orders' table.");
                console.log("👉 Run: ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coins_used INTEGER DEFAULT 0;");
            }
        }

        const { data: settingsData, error: settingsErr } = await supabase.from('settings').select('*').limit(1);
        if (!settingsErr && settingsData && settingsData.length > 0) {
            const setCols = Object.keys(settingsData[0]);
            const requiredSettings = [
                'coins_system_active', 'coin_reward_rate', 'coin_reward_amount', 'coin_value_per_rupee',
                'vendor_fee_amount', 'vendor_fee_discount', 'vendor_fee_coupon'
            ];
            requiredSettings.forEach(col => {
                if (!setCols.includes(col)) {
                    console.log(`⚠️ Column '${col}' is missing in 'settings' table.`);
                    let defVal = 0;
                    let type = 'INTEGER DEFAULT 0';
                    if (col === 'coins_system_active') { defVal = 1; type = 'INTEGER DEFAULT 1'; }
                    else if (col === 'coin_reward_rate') { defVal = 1000; type = 'INTEGER DEFAULT 1000'; }
                    else if (col === 'coin_reward_amount') { defVal = 30; type = 'INTEGER DEFAULT 30'; }
                    else if (col === 'coin_value_per_rupee') { defVal = 10; type = 'INTEGER DEFAULT 10'; }
                    else if (col === 'vendor_fee_coupon') { type = "TEXT DEFAULT ''"; }
                    console.log(`👉 Run: ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ${col} ${type};`);
                }
            });
        }
    } catch(e) {
        console.log("Error checking loyalty columns:", e.message);
    }

    // 5. Check promotions columns (shop_id)
    try {
        console.log("🚀 Checking promotions schema columns...");
        const { data: promoData, error: promoErr } = await supabase.from('promo_banners').select('*').limit(1);
        if (!promoErr && promoData && promoData.length > 0) {
            const promoCols = Object.keys(promoData[0]);
            if (!promoCols.includes('shop_id')) {
                console.log("⚠️ Column 'shop_id' is missing in 'promo_banners' table.");
                console.log("👉 Run: ALTER TABLE public.promo_banners ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES public.shops(id) ON DELETE CASCADE;");
            }
        }
        
        const { data: offerData, error: offerErr } = await supabase.from('special_offers').select('*').limit(1);
        if (!offerErr && offerData && offerData.length > 0) {
            const offerCols = Object.keys(offerData[0]);
            if (!offerCols.includes('shop_id')) {
                console.log("⚠️ Column 'shop_id' is missing in 'special_offers' table.");
                console.log("👉 Run: ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES public.shops(id) ON DELETE CASCADE;");
            }
        }
    } catch(e) {
        console.log("Error checking promotions columns:", e.message);
    }

    // Check sessions/auth setup
    const { count: adminCount } = await supabase.from('admin_users').select('*', { count: 'exact', head: true });
    console.log("Total Admin Users:", adminCount);
    
    console.log("✅ Schema check complete. Please ensure you have run the suggested SQL commands if warnings appeared.");
}

ensureSchema();
