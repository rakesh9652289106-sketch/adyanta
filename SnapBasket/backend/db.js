const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);
const crypto = require('crypto');

// Password Hashing Helpers (Duplicate for DB init)
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function initDb() {
    db.serialize(() => {
        // Create Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            full_name TEXT,
            email TEXT,
            phone TEXT,
            profile_pic TEXT,
            language TEXT DEFAULT 'en',
            order_reminders INTEGER DEFAULT 1,
            sms_permissions INTEGER DEFAULT 0,
            flash_sale_alerts INTEGER DEFAULT 1,
            status TEXT DEFAULT 'active',
            role TEXT DEFAULT 'customer',
            security_q1 TEXT,
            security_a1 TEXT,
            security_q2 TEXT,
            security_a2 TEXT,
            gender TEXT,
            dob TEXT,
            alternate_phone TEXT,
            coins INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migration: Add new columns if they don't exist for existing users
        const userMigrations = [
            "ALTER TABLE users ADD COLUMN full_name TEXT",
            "ALTER TABLE users ADD COLUMN email TEXT",
            "ALTER TABLE users ADD COLUMN phone TEXT",
            "ALTER TABLE users ADD COLUMN profile_pic TEXT",
            "ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en'",
            "ALTER TABLE users ADD COLUMN order_reminders INTEGER DEFAULT 1",
            "ALTER TABLE users ADD COLUMN sms_permissions INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN flash_sale_alerts INTEGER DEFAULT 1",
            "ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'",
            "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'",
            "ALTER TABLE users ADD COLUMN security_q1 TEXT",
            "ALTER TABLE users ADD COLUMN security_a1 TEXT",
            "ALTER TABLE users ADD COLUMN security_q2 TEXT",
            "ALTER TABLE users ADD COLUMN security_a2 TEXT",
            "ALTER TABLE users ADD COLUMN gender TEXT",
            "ALTER TABLE users ADD COLUMN dob TEXT",
            "ALTER TABLE users ADD COLUMN alternate_phone TEXT",
            "ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN created_at DATETIME"
        ];
        userMigrations.forEach(query => db.run(query, (err) => { 
            if (!err && query.includes("created_at")) {
                db.run("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
            }
        }));

        // Create Admin Users Table
        db.run(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE,
            full_name TEXT,
            password TEXT,
            security_q1 TEXT,
            security_a1 TEXT,
            security_q2 TEXT,
            security_a2 TEXT,
            role TEXT DEFAULT 'super_admin'
        )`);

        db.run("ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'super_admin'", (err) => {
            // Column might already exist, ignore errors
        });

        // Create Failed Access Logs Table
        db.run(`CREATE TABLE IF NOT EXISTS failed_access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            attempted_role TEXT,
            actual_role TEXT,
            ip_address TEXT,
            user_agent TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Shops Table
        db.run(`CREATE TABLE IF NOT EXISTS shops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER,
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
            commission_rate INTEGER DEFAULT 5,
            subscription_expires DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            registered_shop TEXT,
            is_active_store INTEGER DEFAULT 1,
            show_special_offers INTEGER DEFAULT 1,
            latitude REAL,
            longitude REAL,
            delivery_radius_km REAL DEFAULT 5.0,
            delivery_charge_per_km REAL DEFAULT 10.0,
            base_delivery_charge REAL DEFAULT 20.0
        )`);

        db.run("ALTER TABLE shops ADD COLUMN latitude REAL", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN longitude REAL", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN delivery_radius_km REAL DEFAULT 5.0", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN delivery_charge_per_km REAL DEFAULT 10.0", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN base_delivery_charge REAL DEFAULT 20.0", (err) => {});

        // Create Vendor Wallets Table
        db.run(`CREATE TABLE IF NOT EXISTS vendor_wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER UNIQUE,
            balance INTEGER DEFAULT 0,
            revenue INTEGER DEFAULT 0,
            total_balance INTEGER DEFAULT 0,
            pending_balance INTEGER DEFAULT 0,
            available_balance INTEGER DEFAULT 0,
            withdrawal_mode TEXT DEFAULT 'auto',
            payout_threshold INTEGER DEFAULT 1000,
            return_hold_hours INTEGER DEFAULT 24,
            bank_name TEXT,
            bank_account TEXT,
            bank_ifsc TEXT,
            bank_holder_name TEXT,
            upi_id TEXT,
            upi_verified INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Feature Flags Table
        db.run(`CREATE TABLE IF NOT EXISTS feature_flags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            label TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            category TEXT DEFAULT 'general'
        )`);

        // Drop existing to re-seed cleanly
        db.run('DROP TABLE IF EXISTS categories');
        db.run('DROP TABLE IF EXISTS products');
        db.run('DROP TABLE IF EXISTS orders');
        db.run('DROP TABLE IF EXISTS banners');
        db.run('DROP TABLE IF EXISTS special_offers');
        db.run('DROP TABLE IF EXISTS brands');
        db.run('DROP TABLE IF EXISTS reviews');
        db.run('DROP TABLE IF EXISTS shops');
        db.run('DROP TABLE IF EXISTS vendor_wallets');
        db.run('DROP TABLE IF EXISTS feature_flags');
        db.run('DROP TABLE IF EXISTS promo_banners');
        db.run('DROP TABLE IF EXISTS vendor_admin_messages');

        // Re-create dropped tables
        db.run(`CREATE TABLE IF NOT EXISTS shops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER,
            name TEXT NOT NULL,
            logo TEXT,
            banner TEXT,
            description TEXT,
            timings TEXT DEFAULT '9:00 AM - 10:00 PM',
            category TEXT,
            contact_phone TEXT,
            rating NUMERIC DEFAULT 4.5,
            delivery_time TEXT DEFAULT '15-30 mins',
            status TEXT DEFAULT 'pending',
            kyc_document TEXT,
            commission_rate INTEGER DEFAULT 5,
            subscription_expires DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            registered_shop TEXT,
            is_active_store INTEGER DEFAULT 1,
            show_special_offers INTEGER DEFAULT 1,
            latitude REAL,
            longitude REAL,
            delivery_radius_km REAL DEFAULT 5.0,
            delivery_charge_per_km REAL DEFAULT 10.0,
            base_delivery_charge REAL DEFAULT 20.0
        )`);

        db.run("ALTER TABLE shops ADD COLUMN registered_shop TEXT", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN is_active_store INTEGER DEFAULT 1", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN show_special_offers INTEGER DEFAULT 1", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN latitude REAL", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN longitude REAL", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN delivery_radius_km REAL DEFAULT 5.0", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN delivery_charge_per_km REAL DEFAULT 10.0", (err) => {});
        db.run("ALTER TABLE shops ADD COLUMN base_delivery_charge REAL DEFAULT 20.0", (err) => {});

        db.run(`CREATE TABLE IF NOT EXISTS vendor_wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER UNIQUE,
            balance INTEGER DEFAULT 0,
            revenue INTEGER DEFAULT 0,
            total_balance INTEGER DEFAULT 0,
            pending_balance INTEGER DEFAULT 0,
            available_balance INTEGER DEFAULT 0,
            withdrawal_mode TEXT DEFAULT 'auto',
            payout_threshold INTEGER DEFAULT 1000,
            return_hold_hours INTEGER DEFAULT 24,
            bank_name TEXT,
            bank_account TEXT,
            bank_ifsc TEXT,
            bank_holder_name TEXT,
            upi_id TEXT,
            upi_verified INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS feature_flags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            label TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            category TEXT DEFAULT 'general'
        )`);

        // Settings Table (Standardized Flat Schema)
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_email TEXT,
            shop_phone TEXT,
            shop_address TEXT,
            shop_image TEXT,
            marquee_text TEXT,
            pay_card_active INTEGER DEFAULT 1,
            pay_cash_active INTEGER DEFAULT 1,
            pay_upi_active INTEGER DEFAULT 1,
            allowed_pincodes TEXT,
            pincode_restriction_active INTEGER DEFAULT 1,
            banner_speed INTEGER DEFAULT 3000,
            coins_system_active INTEGER DEFAULT 1,
            coin_reward_rate INTEGER DEFAULT 1000,
            coin_reward_amount INTEGER DEFAULT 30,
            coin_value_per_rupee INTEGER DEFAULT 10,
            vendor_fee_amount INTEGER DEFAULT 0,
            vendor_fee_coupon TEXT,
            vendor_fee_discount INTEGER DEFAULT 0,
            razorpay_key_id TEXT,
            razorpay_secret TEXT
        )`);

        // Migrations: Add marquee_text if it doesn't exist
        db.run("ALTER TABLE settings ADD COLUMN marquee_text TEXT", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN shop_image TEXT", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN allowed_pincodes TEXT", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN pincode_restriction_active INTEGER DEFAULT 1", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN banner_speed INTEGER DEFAULT 3000", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN coins_system_active INTEGER DEFAULT 1", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN coin_reward_rate INTEGER DEFAULT 1000", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN coin_reward_amount INTEGER DEFAULT 30", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN coin_value_per_rupee INTEGER DEFAULT 10", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN vendor_fee_amount INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN vendor_fee_coupon TEXT", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN vendor_fee_discount INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN razorpay_key_id TEXT", (err) => {});
        db.run("ALTER TABLE settings ADD COLUMN razorpay_secret TEXT", (err) => {});

        // Seed default setting if empty
        db.get("SELECT COUNT(*) as count FROM settings", (err, row) => {
            if (row && row.count === 0) {
                db.run("INSERT INTO settings (shop_email, shop_phone, shop_address, shop_image, marquee_text, allowed_pincodes, pincode_restriction_active, coins_system_active, coin_reward_rate, coin_reward_amount, coin_value_per_rupee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        'support@adyanta.com', 
                        '+91 98765 43210', 
                        '123 Grocery Avenue, Mumbai, MH',
                        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200',
                        '⚡ FREE Delivery on orders above ₹500 | 🍎 Fresh Groceries delivered in 15-45 minutes! | 🎁 Use code WELCOME10 for 10% OFF!',
                        '524004,524003,524002,524001',
                        1,
                        1,
                        1000,
                        30,
                        10
                    ]
                );
            }
        });

        // Seed Default User if empty (Role set to vendor to test shop features)
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (row && row.count === 0) {
                console.log("Seeding default user...");
                db.run("INSERT INTO users (username, password, full_name, email, phone, status, role, coins) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    ['rakesh', hashPassword('rakesh123'), 'Rakesh Kumar', 'rakesh@example.com', '9876543210', 'active', 'vendor', 150]
                );
            } else {
                // Ensure Rakesh has 'vendor' role for testing
                db.run("UPDATE users SET role = 'vendor' WHERE username = 'rakesh'");
            }
        });

        // Seed Default Admin if empty
        db.get("SELECT COUNT(*) as count FROM admin_users", (err, row) => {
            if (row && row.count === 0) {
                console.log("Seeding master admin SURESH...");
                db.run("INSERT INTO admin_users (phone, full_name, password, security_q1, security_a1, security_q2, security_a2) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    ['9490229108', 'SURESH', hashPassword('ADYANTA524004'), 'What is your birthplace?', 'amma', 'What was the name of your first school?', 'nanna']
                );
            }
        });

        // Seed default Feature Flags
        db.get("SELECT COUNT(*) as count FROM feature_flags", (err, row) => {
            if (row && row.count === 0) {
                const flags = [
                    { name: 'ai_chatbot', label: 'AI Chatbot Support Assistant', is_active: 1, category: 'customer' },
                    { name: 'reviews_ratings', label: 'Customer Reviews & Ratings', is_active: 1, category: 'customer' },
                    { name: 'cod_payment', label: 'Cash on Delivery (COD)', is_active: 1, category: 'payment' },
                    { name: 'wallet_system', label: 'Vendor Payout Wallet', is_active: 1, category: 'vendor' },
                    { name: 'vendor_onboarding', label: 'New Vendor Registration', is_active: 1, category: 'vendor' },
                    { name: 'card_payment', label: 'Credit/Debit Card Gateway', is_active: 1, category: 'payment' }
                ];
                const insertFlag = db.prepare("INSERT INTO feature_flags (name, label, is_active, category) VALUES (?, ?, ?, ?)");
                flags.forEach(f => insertFlag.run(f.name, f.label, f.is_active, f.category));
                insertFlag.finalize();
            }
        });

        // Seed default Shops for vendor Rakesh (id: 1)
        db.get("SELECT COUNT(*) as count FROM shops", (err, row) => {
            if (row && row.count === 0) {
                const defaultShops = [
                    {
                        id: 1,
                        name: 'Adyanta Organic Farm Store',
                        logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200',
                        description: 'Farm fresh organic vegetables, crispy greens, and seasonal delicious local fruits direct to your doorstep.',
                        timings: '8:00 AM - 9:00 PM',
                        category: 'Fresh Produce Shop',
                        contact_phone: '+91 98765 43210',
                        rating: 4.9,
                        delivery_time: '15-30 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'Fresh Produce Shop'
                    },
                    {
                        id: 2,
                        name: 'Adyanta Frozen Foods',
                        logo: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=1200',
                        description: 'Premium frozen meals, french fries, frozen vegetables, and high quality dairy ice creams.',
                        timings: '9:00 AM - 10:00 PM',
                        category: 'Frozen Shop',
                        contact_phone: '+91 98765 43210',
                        rating: 4.7,
                        delivery_time: '20-40 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'Frozen Shop'
                    },
                    {
                        id: 3,
                        name: 'Adyanta Juice & Nectars',
                        logo: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=1200',
                        description: 'Pure cold-pressed juices, tender coconut water, milkshakes, and organic fruit nectars.',
                        timings: '9:00 AM - 9:00 PM',
                        category: 'Juice Shop',
                        contact_phone: '+91 98765 43210',
                        rating: 4.8,
                        delivery_time: '10-25 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'Juice Shop'
                    },
                    {
                        id: 4,
                        name: 'Adyanta Gold Jewelers',
                        logo: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200',
                        description: 'Exquisite 22K gold chains, wedding rings, luxury bangles, and certified diamond studs.',
                        timings: '10:00 AM - 8:00 PM',
                        category: 'Gold Shop',
                        contact_phone: '+91 98765 43210',
                        rating: 4.9,
                        delivery_time: '30-60 mins',
                        status: 'active',
                        commission_rate: 3,
                        registered_shop: 'Gold Shop'
                    },
                    {
                        id: 5,
                        name: 'Adyanta Dressing & Apparel',
                        logo: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200',
                        description: 'Premium casual t-shirts, premium denim jeans, silk sarees, and high quality jackets.',
                        timings: '10:00 AM - 9:30 PM',
                        category: 'Dressing Shop',
                        contact_phone: '+91 98765 43210',
                        rating: 4.6,
                        delivery_time: '25-45 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'Dressing Shop'
                    },
                    {
                        id: 6,
                        name: 'Adyanta Daily Supermarket',
                        logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200',
                        description: 'Your daily go-to grocery store for premium dals, pulses, snacks, milk, and detergents.',
                        timings: '7:00 AM - 10:00 PM',
                        category: 'General Store',
                        contact_phone: '+91 98765 43210',
                        rating: 4.8,
                        delivery_time: '15-30 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'General Store'
                    },
                    {
                        id: 7,
                        name: 'Adyanta Pharmacy & Wellness',
                        logo: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1200',
                        description: 'Over-the-counter wellness tablets, vitamins, dettol antiseptics, and band-aids.',
                        timings: '8:00 AM - 11:00 PM',
                        category: 'Pharmacy / Health Shop',
                        contact_phone: '+91 98765 43210',
                        rating: 4.7,
                        delivery_time: '10-20 mins',
                        status: 'active',
                        commission_rate: 4,
                        registered_shop: 'Pharmacy / Health Shop'
                    },
                    {
                        id: 8,
                        name: 'Green Valley Fresh Market',
                        logo: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=1200',
                        description: 'Premium fresh fruits, exotic local greens, and organic garden produce.',
                        timings: '7:30 AM - 8:30 PM',
                        category: 'Fresh Produce Shop',
                        contact_phone: '+91 99999 88888',
                        rating: 4.8,
                        delivery_time: '10-25 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'Fresh Produce Shop'
                    },
                    {
                        id: 9,
                        name: 'Polar Ice Foods & Desserts',
                        logo: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1200',
                        description: 'Chilled delights, frozen pre-cut veggies, ice cream party tubs, and snack bites.',
                        timings: '10:00 AM - 11:00 PM',
                        category: 'Frozen Shop',
                        contact_phone: '+91 99999 88888',
                        rating: 4.6,
                        delivery_time: '15-35 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'Frozen Shop'
                    },
                    {
                        id: 10,
                        name: 'Citrus Squeeze Juice Bar',
                        logo: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=1200',
                        description: 'Freshly squeezed citrus mocktails, natural health shots, and cold pressed seasonal juices.',
                        timings: '8:00 AM - 9:00 PM',
                        category: 'Juice Shop',
                        contact_phone: '+91 99999 88888',
                        rating: 4.7,
                        delivery_time: '12-30 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'Juice Shop'
                    },
                    {
                        id: 11,
                        name: 'Golden Heritage Fine Jewelry',
                        logo: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1200',
                        description: 'Crafted heritage jewelry, royal designer gold necklaces, and certified solitaire diamond rings.',
                        timings: '11:00 AM - 8:30 PM',
                        category: 'Gold Shop',
                        contact_phone: '+91 99999 88888',
                        rating: 4.9,
                        delivery_time: '35-65 mins',
                        status: 'active',
                        commission_rate: 4,
                        registered_shop: 'Gold Shop'
                    },
                    {
                        id: 12,
                        name: 'Vogue Threads & Dressing Room',
                        logo: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=1200',
                        description: 'Chic designer t-shirts, modern denim jackets, and traditional wedding collection sarees.',
                        timings: '10:00 AM - 10:00 PM',
                        category: 'Dressing Shop',
                        contact_phone: '+91 99999 88888',
                        rating: 4.7,
                        delivery_time: '20-40 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'Dressing Shop'
                    },
                    {
                        id: 13,
                        name: 'QuickMart Express Grocery',
                        logo: 'https://images.unsplash.com/photo-1589131649983-4ec35f63d309?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1589131649983-4ec35f63d309?w=1200',
                        description: 'Instant delivery grocery store for pantry supplies, snacking packs, fresh milk, and daily essentials.',
                        timings: '6:00 AM - 11:00 PM',
                        category: 'General Store',
                        contact_phone: '+91 99999 88888',
                        rating: 4.8,
                        delivery_time: '10-20 mins',
                        status: 'active',
                        commission_rate: 5,
                        registered_shop: 'General Store'
                    },
                    {
                        id: 14,
                        name: 'Apex Healthcare & Pharmacy',
                        logo: 'https://images.unsplash.com/photo-1616679911721-eff6eec18fcd?w=150&h=150&fit=crop',
                        banner: 'https://images.unsplash.com/photo-1616679911721-eff6eec18fcd?w=1200',
                        description: 'Registered community drugstore offering prescription supplements, band-aids, antiseptics, and wellness needs.',
                        timings: '7:00 AM - 11:30 PM',
                        category: 'Pharmacy / Health Shop',
                        contact_phone: '+91 99999 88888',
                        rating: 4.8,
                        delivery_time: '10-15 mins',
                        status: 'active',
                        commission_rate: 4,
                        registered_shop: 'Pharmacy / Health Shop'
                    }
                ];

                const insertShop = db.prepare(`INSERT INTO shops (id, vendor_id, name, logo, banner, description, timings, category, contact_phone, rating, delivery_time, status, commission_rate, registered_shop)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                defaultShops.forEach(s => {
                    insertShop.run(s.id, 1, s.name, s.logo, s.banner, s.description, s.timings, s.category, s.contact_phone, s.rating, s.delivery_time, s.status, s.commission_rate, s.registered_shop);
                });
                insertShop.finalize();
            }
        });

        // Seed default wallets for Shops 1 to 14
        db.get("SELECT COUNT(*) as count FROM vendor_wallets", (err, row) => {
            if (row && row.count === 0) {
                for (let i = 1; i <= 14; i++) {
                    db.run("INSERT INTO vendor_wallets (shop_id, balance, revenue) VALUES (?, ?, ?)", [i, 1000 * i, 3000 * i]);
                }
            }
        });

        // 2. For Users password migration
        db.all("SELECT id, password FROM users", (err, rows) => {
            if (rows) {
                rows.forEach(user => {
                    if (user.password && !user.password.includes(':')) {
                        console.log(`Migrating user ${user.id} password to hashed...`);
                        db.run("UPDATE users SET password = ? WHERE id = ?", [hashPassword(user.password), user.id]);
                    }
                });
            }
        });


        // Create Categories Table
        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            iconUrl TEXT
        )`);

        // Create Products Table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            category TEXT,
            weight TEXT,
            price INTEGER,
            originalPrice INTEGER,
            rating TEXT,
            reviews TEXT,
            imgUrl TEXT,
            discount TEXT,
            stock_quantity INTEGER DEFAULT 0,
            is_available INTEGER DEFAULT 1,
            is_trending INTEGER DEFAULT 0,
            is_daily_essential INTEGER DEFAULT 1,
            description TEXT,
            shop_id INTEGER DEFAULT 1,
            variants TEXT
        )`);



        // Migration: Add necessary product status columns if they don't exist
        db.run("ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE products ADD COLUMN is_available INTEGER DEFAULT 1", (err) => {});
        db.run("ALTER TABLE products ADD COLUMN is_trending INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE products ADD COLUMN is_daily_essential INTEGER DEFAULT 1", (err) => {});
        db.run("ALTER TABLE products ADD COLUMN description TEXT", (err) => {});
        db.run("ALTER TABLE products ADD COLUMN shop_id INTEGER DEFAULT 1", (err) => {});
        db.run("ALTER TABLE products ADD COLUMN variants TEXT", (err) => {});


        // Create Notifications Table
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT,
            is_important INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Brands Table
        db.run(`CREATE TABLE IF NOT EXISTS brands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT
        )`);

        // Create Banners Table
        db.run(`CREATE TABLE IF NOT EXISTS banners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            badge TEXT,
            title TEXT,
            description TEXT,
            btnText TEXT,
            imgUrl TEXT,
            target_category TEXT
        )`);

        // Create Promo Banners Table (Simple sliding photos)
        db.run(`CREATE TABLE IF NOT EXISTS promo_banners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER,
            imageUrl TEXT,
            linkUrl TEXT DEFAULT '#',
            displayOrder INTEGER DEFAULT 0
        )`);

        db.run("ALTER TABLE promo_banners ADD COLUMN shop_id INTEGER", (err) => {});
        db.run("ALTER TABLE promo_banners ADD COLUMN imageUrl TEXT", (err) => {});
        db.run("ALTER TABLE promo_banners ADD COLUMN linkUrl TEXT", (err) => {});
        db.run("ALTER TABLE promo_banners ADD COLUMN displayOrder INTEGER DEFAULT 0", (err) => {});

        // Create Special Offers Table
        db.run(`CREATE TABLE IF NOT EXISTS special_offers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            colorClass TEXT,
            target_category TEXT
        )`);
        db.run("ALTER TABLE special_offers ADD COLUMN shop_id INTEGER DEFAULT NULL", (err) => {});

        // Create Orders Table
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            total INTEGER,
            items TEXT,
            payment_method TEXT,
            address TEXT,
            status TEXT DEFAULT 'pending',
            shop_id INTEGER,
            coupon_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            address_id INTEGER,
            delivery_lat REAL,
            delivery_lng REAL,
            delivery_partner_lat REAL,
            delivery_partner_lng REAL,
            eta_minutes INTEGER,
            traffic_condition TEXT,
            weather_condition TEXT,
            route_coordinates TEXT,
            wallet_status TEXT DEFAULT 'pending',
            hold_until DATETIME DEFAULT NULL,
            cod_collected INTEGER DEFAULT 0,
            returned_or_replaced TEXT DEFAULT NULL
        )`);

        // Migration: Add status and payment_status columns if they don't exist
        db.run("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN delivery_type TEXT DEFAULT 'Home Delivery'", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN shop_id INTEGER", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN coupon_id INTEGER", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN packing_photo TEXT", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN packing_checklist TEXT", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN is_tamper_sealed INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN packing_geo TEXT", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN packed_at DATETIME", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN address_id INTEGER", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN delivery_lat REAL", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN delivery_lng REAL", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN delivery_partner_lat REAL", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN delivery_partner_lng REAL", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN eta_minutes INTEGER", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN traffic_condition TEXT", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN weather_condition TEXT", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN route_coordinates TEXT", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN pickup_otp TEXT", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN delivery_otp TEXT", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN delivery_proof_photo TEXT", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN picked_up_at DATETIME", (err) => {});
        db.run("ALTER TABLE orders ADD COLUMN delivered_at DATETIME", (err) => {});

        db.run("ALTER TABLE users ADD COLUMN created_at DATETIME", (err) => {
            if (!err) db.run("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
        });

        // Create Order Disputes / Evidence Table
        db.run(`CREATE TABLE IF NOT EXISTS order_disputes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            shop_id INTEGER NOT NULL,
            reason_code TEXT NOT NULL,
            description TEXT,
            customer_unboxing_photo TEXT,
            status TEXT DEFAULT 'open',
            resolution_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME
        )`);

        // WALLET MIGRATIONS & NEW TABLES
        const walletAlters = [
            "ALTER TABLE vendor_wallets ADD COLUMN total_balance INTEGER DEFAULT 0",
            "ALTER TABLE vendor_wallets ADD COLUMN pending_balance INTEGER DEFAULT 0",
            "ALTER TABLE vendor_wallets ADD COLUMN available_balance INTEGER DEFAULT 0",
            "ALTER TABLE vendor_wallets ADD COLUMN withdrawal_mode TEXT DEFAULT 'auto'",
            "ALTER TABLE vendor_wallets ADD COLUMN payout_threshold INTEGER DEFAULT 1000",
            "ALTER TABLE vendor_wallets ADD COLUMN return_hold_hours INTEGER DEFAULT 24",
            "ALTER TABLE vendor_wallets ADD COLUMN bank_name TEXT",
            "ALTER TABLE vendor_wallets ADD COLUMN bank_account TEXT",
            "ALTER TABLE vendor_wallets ADD COLUMN bank_ifsc TEXT",
            "ALTER TABLE vendor_wallets ADD COLUMN bank_holder_name TEXT",
            "ALTER TABLE vendor_wallets ADD COLUMN upi_id TEXT",
            "ALTER TABLE vendor_wallets ADD COLUMN upi_verified INTEGER DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN wallet_status TEXT DEFAULT 'pending'",
            "ALTER TABLE orders ADD COLUMN hold_until DATETIME",
            "ALTER TABLE orders ADD COLUMN cod_collected INTEGER DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN returned_or_replaced TEXT",
            "ALTER TABLE notifications ADD COLUMN target_shop_id INTEGER"
        ];
        walletAlters.forEach(query => db.run(query, (err) => {}));

        db.run(`CREATE TABLE IF NOT EXISTS wallet_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER,
            order_id INTEGER,
            type TEXT,
            amount INTEGER,
            category TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS settlement_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER,
            amount INTEGER,
            bank_utr TEXT,
            payment_mode TEXT,
            status TEXT,
            failure_reason TEXT,
            admin_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS vendor_returns_replacements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER,
            order_id INTEGER,
            type TEXT,
            reason TEXT,
            amount INTEGER,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME
        )`);



        // Create Support Messages Table

        db.run(`CREATE TABLE IF NOT EXISTS support_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            subject TEXT,
            message TEXT,
            reply TEXT,
            replied_at DATETIME,
            status TEXT DEFAULT 'unread',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migration: Add user_id, reply and replied_at columns to support_messages
        db.run("ALTER TABLE support_messages ADD COLUMN user_id INTEGER", (err) => {});
        db.run("ALTER TABLE support_messages ADD COLUMN reply TEXT", (err) => {});
        db.run("ALTER TABLE support_messages ADD COLUMN replied_at DATETIME", (err) => {});
        db.run("ALTER TABLE support_messages ADD COLUMN shop_id INTEGER", (err) => {});

        db.run(`CREATE TABLE IF NOT EXISTS store_chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER NOT NULL,
            user_id INTEGER,
            session_id TEXT,
            user_name TEXT,
            sender TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_read INTEGER DEFAULT 0
        )`);

        // Create Vendor-Admin Direct Chat Messages Table
        db.run(`CREATE TABLE IF NOT EXISTS vendor_admin_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER NOT NULL,
            sender TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_read INTEGER DEFAULT 0
        )`);

        // Create Reviews Table
        db.run(`CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            username TEXT,
            rating INTEGER,
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`);

        // Create Addresses Table
        db.run(`CREATE TABLE IF NOT EXISTS addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            label TEXT,
            address_line TEXT,
            city TEXT,
            pincode TEXT,
            is_default INTEGER DEFAULT 0,
            landmark TEXT,
            floor_number TEXT,
            apartment_name TEXT,
            delivery_instructions TEXT,
            contact_person TEXT,
            phone_number TEXT,
            latitude REAL,
            longitude REAL,
            entrance_latitude REAL,
            entrance_longitude REAL,
            entrance_type TEXT,
            photo_url TEXT,
            is_favorite INTEGER DEFAULT 0,
            is_shared INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        db.run("ALTER TABLE addresses ADD COLUMN landmark TEXT", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN floor_number TEXT", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN apartment_name TEXT", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN delivery_instructions TEXT", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN contact_person TEXT", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN phone_number TEXT", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN latitude REAL", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN longitude REAL", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN entrance_latitude REAL", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN entrance_longitude REAL", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN entrance_type TEXT", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN photo_url TEXT", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN is_favorite INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN is_shared INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE addresses ADD COLUMN sort_order INTEGER DEFAULT 0", (err) => {});

        // Create Coupons Table
        db.run(`CREATE TABLE IF NOT EXISTS coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            discount_value INTEGER,
            discount_type TEXT,
            min_amount INTEGER DEFAULT 0,
            expiry_date DATETIME,
            shop_id INTEGER
        )`);

        // Migration: Add min_amount and is_one_time to coupons if they don't exist
        db.run("ALTER TABLE coupons ADD COLUMN min_amount INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE coupons ADD COLUMN is_one_time INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE coupons ADD COLUMN shop_id INTEGER", (err) => {});

        // Create Coupon Usage Table
        db.run(`CREATE TABLE IF NOT EXISTS coupon_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            coupon_id INTEGER,
            used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (coupon_id) REFERENCES coupons(id)
        )`);


        // Create Wishlist Items Table
        db.run(`CREATE TABLE IF NOT EXISTS wishlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, product_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`);

        // Force seed data by skipping the IF check for products and categories since we drop them
        console.log("Seeding Database...");

        const banner_url = 'file:///C:/Users/RAKESH%20KUMAR/.gemini/antigravity/brain/92924b03-a69a-4135-88ca-1fc6a0c096e1/promo_banner_1775136840249.png';

        const categories = [
            { name: "Dals & Pulses", iconUrl: "ph-bowl-food" },
            { name: "Snacks", iconUrl: "ph-cookie" },
            { name: "Dairy & Bakery", iconUrl: "ph-drop" },
            { name: "Fresh Fruits", iconUrl: "ph-apple-logo" },
            { name: "Dry Fruits", iconUrl: "ph-plant" },
            { name: "Household", iconUrl: "ph-house-line" },
            { name: "Drinks", iconUrl: "ph-brandy" },
            { name: "Vegetables", iconUrl: "ph-leaf" },
            { name: "Frozen Foods", iconUrl: "ph-snowflake" },
            { name: "Desserts", iconUrl: "ph-cookie" },
            { name: "Gold Jewelry", iconUrl: "ph-crown" },
            { name: "Diamond Jewelry", iconUrl: "ph-crown" },
            { name: "Mens Wear", iconUrl: "ph-t-shirt" },
            { name: "Womens Wear", iconUrl: "ph-t-shirt" },
            { name: "Healthcare", iconUrl: "ph-first-aid" }
        ];

        const products = [
            // Shop 1: Fresh Produce Shop
            { name: "Fresh Red Apples", category: "Fresh Fruits", weight: "1 kg", price: 155, originalPrice: 180, rating: "4.9", reviews: "340", imgUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=300&h=300&fit=crop", discount: "14% OFF", is_trending: 1, shop_id: 1 },
            { name: "Fresh Onions", category: "Vegetables", weight: "1 kg", price: 38, originalPrice: 55, rating: "4.1", reviews: "300", imgUrl: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=300&h=300&fit=crop", discount: "30% OFF", shop_id: 1 },
            { name: "Fresh Red Tomato", category: "Vegetables", weight: "1 kg", price: 48, originalPrice: 70, rating: "4.9", reviews: "850", imgUrl: "https://images.unsplash.com/photo-1590665416245-129683944414?w=300&h=300&fit=crop", discount: "31% OFF", is_trending: 1, shop_id: 1 },
            { name: "Green Chillies", category: "Vegetables", weight: "250 g", price: 18, originalPrice: 28, rating: "4.6", reviews: "120", imgUrl: "https://images.unsplash.com/photo-1588252210219-c9c31b21bc56?w=300&h=300&fit=crop", discount: "35% OFF", shop_id: 1 },
            { name: "Ginger (Adrak)", category: "Vegetables", weight: "250 g", price: 42, originalPrice: 60, rating: "4.8", reviews: "95", imgUrl: "https://images.unsplash.com/photo-1599940824399-b87987cb96a5?w=300&h=300&fit=crop", discount: "30% OFF", shop_id: 1 },
            { name: "Garlic (Lehsun)", category: "Vegetables", weight: "250 g", price: 65, originalPrice: 85, rating: "4.7", reviews: "110", imgUrl: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop", discount: "23% OFF", shop_id: 1 },
            { name: "Fresh Cauliflower", category: "Vegetables", weight: "1 pc", price: 35, originalPrice: 50, rating: "4.5", reviews: "200", imgUrl: "https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=300&h=300&fit=crop", discount: "30% OFF", shop_id: 1 },

            // Shop 2: Frozen Shop
            { name: "McCain French Fries", category: "Frozen Foods", weight: "750 g", price: 125, originalPrice: 145, rating: "4.5", reviews: "180", imgUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&h=300&fit=crop", discount: "13% OFF", is_trending: 1, shop_id: 2 },
            { name: "Frozen Sweet Corn", category: "Frozen Foods", weight: "500 g", price: 89, originalPrice: 105, rating: "4.6", reviews: "120", imgUrl: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 2 },
            { name: "Frozen Green Peas", category: "Frozen Foods", weight: "1 kg", price: 165, originalPrice: 195, rating: "4.7", reviews: "230", imgUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 2 },
            { name: "Vadilal Vanilla Ice Cream", category: "Desserts", weight: "1 L", price: 175, originalPrice: 199, rating: "4.8", reviews: "500", imgUrl: "https://images.unsplash.com/photo-1567206563064-6f6093f2d457?w=300&h=300&fit=crop", discount: "12% OFF", shop_id: 2 },

            // Shop 3: Juice Shop
            { name: "Real Fruit Power Orange", category: "Drinks", weight: "1 L", price: 115, originalPrice: 130, rating: "4.4", reviews: "900", imgUrl: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=300&h=300&fit=crop", discount: "11% OFF", is_trending: 1, shop_id: 3 },
            { name: "Fresh Mango Shake", category: "Drinks", weight: "300 ml", price: 65, originalPrice: 80, rating: "4.8", reviews: "340", imgUrl: "https://images.unsplash.com/photo-1546173159-315724a31696?w=300&h=300&fit=crop", discount: "18% OFF", shop_id: 3 },
            { name: "Tender Coconut Water", category: "Drinks", weight: "1 pc", price: 45, originalPrice: 55, rating: "4.9", reviews: "1200", imgUrl: "https://images.unsplash.com/photo-1525385133336-254847240f92?w=300&h=300&fit=crop", discount: "18% OFF", shop_id: 3 },
            { name: "Pomegranate (Anar) Juice", category: "Drinks", weight: "250 ml", price: 85, originalPrice: 100, rating: "4.6", reviews: "150", imgUrl: "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 3 },

            // Shop 4: Gold Shop
            { name: "22K Gold Chain", category: "Gold Jewelry", weight: "8 g", price: 54500, originalPrice: 59500, rating: "4.9", reviews: "45", imgUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300&h=300&fit=crop", discount: "8% OFF", is_trending: 1, shop_id: 4 },
            { name: "18K Diamond Engagement Ring", category: "Diamond Jewelry", weight: "4 g", price: 42500, originalPrice: 48500, rating: "4.8", reviews: "20", imgUrl: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=300&h=300&fit=crop", discount: "12% OFF", shop_id: 4 },
            { name: "Gold Floral Bangles", category: "Gold Jewelry", weight: "16 g", price: 109000, originalPrice: 116000, rating: "4.7", reviews: "12", imgUrl: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=300&h=300&fit=crop", discount: "6% OFF", shop_id: 4 },
            { name: "Diamond Stud Earrings", category: "Diamond Jewelry", weight: "2 g", price: 29500, originalPrice: 32500, rating: "4.9", reviews: "38", imgUrl: "https://images.unsplash.com/photo-1635767790028-3e9a53664081?w=300&h=300&fit=crop", discount: "9% OFF", shop_id: 4 },

            // Shop 5: Dressing Shop
            { name: "Casual Cotton T-Shirt", category: "Mens Wear", weight: "1 pc", price: 450, originalPrice: 699, rating: "4.5", reviews: "290", imgUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&h=300&fit=crop", discount: "35% OFF", is_trending: 1, shop_id: 5 },
            { name: "Classic Slim-Fit Jeans", category: "Mens Wear", weight: "1 pc", price: 1199, originalPrice: 1799, rating: "4.6", reviews: "520", imgUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=300&h=300&fit=crop", discount: "33% OFF", shop_id: 5 },
            { name: "Pure Silk Banarasi Saree", category: "Womens Wear", weight: "1 pc", price: 3550, originalPrice: 4999, rating: "4.9", reviews: "115", imgUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&h=300&fit=crop", discount: "29% OFF", is_trending: 1, shop_id: 5 },
            { name: "Stylish Denim Jacket", category: "Womens Wear", weight: "1 pc", price: 1690, originalPrice: 2399, rating: "4.7", reviews: "88", imgUrl: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=300&h=300&fit=crop", discount: "29% OFF", shop_id: 5 },

            // Shop 6: General Store
            { name: "Aashirvaad Atta", category: "Dals & Pulses", weight: "5 kg", price: 215, originalPrice: 245, rating: "4.7", reviews: "890", imgUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop", discount: "12% OFF", shop_id: 6 },
            { name: "Premium Toor Dal", category: "Dals & Pulses", weight: "1 kg", price: 185, originalPrice: 225, rating: "4.8", reviews: "120", imgUrl: "https://images.unsplash.com/photo-1589131649983-4ec35f63d309?w=300&h=300&fit=crop", discount: "17% OFF", is_trending: 1, shop_id: 6 },
            { name: "Cashews (Kaju)", category: "Dry Fruits", weight: "250 g", price: 295, originalPrice: 355, rating: "4.6", reviews: "156", imgUrl: "https://images.unsplash.com/photo-1599587428807-6ad0c7ec44da?w=300&h=300&fit=crop", discount: "16% OFF", is_trending: 1, shop_id: 6 },
            { name: "Surf Excel Detergent", category: "Household", weight: "1 kg", price: 129, originalPrice: 145, rating: "4.8", reviews: "450", imgUrl: "https://images.unsplash.com/photo-1584820927498-cafe2c174360?w=300&h=300&fit=crop", discount: "11% OFF", is_trending: 1, shop_id: 6 },
            { name: "Haldiram's Bhujia", category: "Snacks", weight: "400 g", price: 98, originalPrice: 110, rating: "4.8", reviews: "750", imgUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&h=300&fit=crop", discount: "10% OFF", is_trending: 1, shop_id: 6 },
            { name: "Amul Taaza Milk", category: "Dairy & Bakery", weight: "1 L", price: 69, originalPrice: 72, rating: "4.9", reviews: "1200", imgUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop", discount: "4% OFF", shop_id: 6 },

            // Shop 7: Pharmacy / Health Shop
            { name: "Dolo 650 Tablets", category: "Healthcare", weight: "15 tabs", price: 29, originalPrice: 35, rating: "4.8", reviews: "2050", imgUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop", discount: "17% OFF", is_trending: 1, shop_id: 7 },
            { name: "Vitamin C Chewable", category: "Healthcare", weight: "30 tabs", price: 119, originalPrice: 149, rating: "4.9", reviews: "890", imgUrl: "https://images.unsplash.com/photo-1616679911721-eff6eec18fcd?w=300&h=300&fit=crop", discount: "20% OFF", shop_id: 7 },
            { name: "Dettol Liquid Antiseptic", category: "Healthcare", weight: "250 ml", price: 92, originalPrice: 99, rating: "4.7", reviews: "1500", imgUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=300&h=300&fit=crop", discount: "7% OFF", shop_id: 7 },
            { name: "Hansaplast Band-Aid Pack", category: "Healthcare", weight: "20 pcs", price: 42, originalPrice: 48, rating: "4.6", reviews: "600", imgUrl: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=300&h=300&fit=crop", discount: "12% OFF", shop_id: 7 },

            // Shop 8: Green Valley Fresh Market (Fresh Produce Shop)
            { name: "Premium Fuji Apples", category: "Fresh Fruits", weight: "1 kg", price: 175, originalPrice: 200, rating: "4.8", reviews: "220", imgUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=300&h=300&fit=crop", discount: "12% OFF", is_trending: 1, shop_id: 8 },
            { name: "Organic Sweet Onions", category: "Vegetables", weight: "1 kg", price: 45, originalPrice: 60, rating: "4.5", reviews: "180", imgUrl: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=300&h=300&fit=crop", discount: "25% OFF", shop_id: 8 },
            { name: "Roma Tomatoes", category: "Vegetables", weight: "1 kg", price: 55, originalPrice: 75, rating: "4.7", reviews: "450", imgUrl: "https://images.unsplash.com/photo-1590665416245-129683944414?w=300&h=300&fit=crop", discount: "26% OFF", is_trending: 1, shop_id: 8 },
            { name: "Spicy Green Chillies", category: "Vegetables", weight: "250 g", price: 22, originalPrice: 30, rating: "4.6", reviews: "90", imgUrl: "https://images.unsplash.com/photo-1588252210219-c9c31b21bc56?w=300&h=300&fit=crop", discount: "26% OFF", shop_id: 8 },

            // Shop 9: Polar Ice Foods & Desserts (Frozen Shop)
            { name: "Polar Crispy French Fries", category: "Frozen Foods", weight: "750 g", price: 135, originalPrice: 160, rating: "4.6", reviews: "140", imgUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&h=300&fit=crop", discount: "15% OFF", is_trending: 1, shop_id: 9 },
            { name: "Polar Sweet Kernel Corn", category: "Frozen Foods", weight: "500 g", price: 95, originalPrice: 115, rating: "4.7", reviews: "110", imgUrl: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=300&h=300&fit=crop", discount: "17% OFF", shop_id: 9 },
            { name: "Polar Frozen Green Peas", category: "Frozen Foods", weight: "1 kg", price: 155, originalPrice: 185, rating: "4.5", reviews: "190", imgUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=300&h=300&fit=crop", discount: "16% OFF", shop_id: 9 },
            { name: "Polar Premium Vanilla Tub", category: "Desserts", weight: "1 L", price: 185, originalPrice: 210, rating: "4.8", reviews: "410", imgUrl: "https://images.unsplash.com/photo-1567206563064-6f6093f2d457?w=300&h=300&fit=crop", discount: "11% OFF", shop_id: 9 },

            // Shop 10: Citrus Squeeze Juice Bar (Juice Shop)
            { name: "Citrus Orange Fruit Drink", category: "Drinks", weight: "1 L", price: 120, originalPrice: 140, rating: "4.5", reviews: "810", imgUrl: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=300&h=300&fit=crop", discount: "14% OFF", is_trending: 1, shop_id: 10 },
            { name: "Citrus Mango Alphonso Nectar", category: "Drinks", weight: "300 ml", price: 70, originalPrice: 85, rating: "4.7", reviews: "300", imgUrl: "https://images.unsplash.com/photo-1546173159-315724a31696?w=300&h=300&fit=crop", discount: "17% OFF", shop_id: 10 },
            { name: "Fresh Tender Coconut Pack", category: "Drinks", weight: "1 pc", price: 50, originalPrice: 60, rating: "4.8", reviews: "1050", imgUrl: "https://images.unsplash.com/photo-1525385133336-254847240f92?w=300&h=300&fit=crop", discount: "16% OFF", shop_id: 10 },
            { name: "Cold Pressed Anar Juice", category: "Drinks", weight: "250 ml", price: 95, originalPrice: 110, rating: "4.6", reviews: "130", imgUrl: "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=300&h=300&fit=crop", discount: "13% OFF", shop_id: 10 },

            // Shop 11: Golden Heritage Fine Jewelry (Gold Shop)
            { name: "Heritage 22K Gold Chain", category: "Gold Jewelry", weight: "8 g", price: 53800, originalPrice: 58500, rating: "4.9", reviews: "35", imgUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300&h=300&fit=crop", discount: "8% OFF", is_trending: 1, shop_id: 11 },
            { name: "Heritage Diamond Solitaire Ring", category: "Diamond Jewelry", weight: "4 g", price: 44000, originalPrice: 49500, rating: "4.8", reviews: "18", imgUrl: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=300&h=300&fit=crop", discount: "11% OFF", shop_id: 11 },
            { name: "Heritage Royal Gold Bangles", category: "Gold Jewelry", weight: "16 g", price: 107500, originalPrice: 115000, rating: "4.7", reviews: "10", imgUrl: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=300&h=300&fit=crop", discount: "6% OFF", shop_id: 11 },
            { name: "Heritage Diamond Studs", category: "Diamond Jewelry", weight: "2 g", price: 28800, originalPrice: 31800, rating: "4.9", reviews: "32", imgUrl: "https://images.unsplash.com/photo-1635767790028-3e9a53664081?w=300&h=300&fit=crop", discount: "9% OFF", shop_id: 11 },

            // Shop 12: Vogue Threads & Dressing Room (Dressing Shop)
            { name: "Vogue Premium Crewneck Tee", category: "Mens Wear", weight: "1 pc", price: 499, originalPrice: 799, rating: "4.6", reviews: "250", imgUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&h=300&fit=crop", discount: "37% OFF", is_trending: 1, shop_id: 12 },
            { name: "Vogue Regular Fit Denim Jeans", category: "Mens Wear", weight: "1 pc", price: 1299, originalPrice: 1999, rating: "4.5", reviews: "480", imgUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=300&h=300&fit=crop", discount: "35% OFF", shop_id: 12 },
            { name: "Vogue Banarasi Georgette Saree", category: "Womens Wear", weight: "1 pc", price: 3750, originalPrice: 5499, rating: "4.9", reviews: "95", imgUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&h=300&fit=crop", discount: "31% OFF", is_trending: 1, shop_id: 12 },
            { name: "Vogue Classic Biker Jacket", category: "Womens Wear", weight: "1 pc", price: 1790, originalPrice: 2499, rating: "4.7", reviews: "75", imgUrl: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=300&h=300&fit=crop", discount: "28% OFF", shop_id: 12 },

            // Shop 13: QuickMart Express Grocery (General Store)
            { name: "QuickMart Premium Atta", category: "Dals & Pulses", weight: "5 kg", price: 225, originalPrice: 260, rating: "4.7", reviews: "780", imgUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop", discount: "13% OFF", shop_id: 13 },
            { name: "QuickMart Toor Dal Superior", category: "Dals & Pulses", weight: "1 kg", price: 195, originalPrice: 235, rating: "4.8", reviews: "105", imgUrl: "https://images.unsplash.com/photo-1589131649983-4ec35f63d309?w=300&h=300&fit=crop", discount: "17% OFF", is_trending: 1, shop_id: 13 },
            { name: "QuickMart Salted Cashews", category: "Dry Fruits", weight: "250 g", price: 310, originalPrice: 375, rating: "4.6", reviews: "125", imgUrl: "https://images.unsplash.com/photo-1599587428807-6ad0c7ec44da?w=300&h=300&fit=crop", discount: "17% OFF", is_trending: 1, shop_id: 13 },
            { name: "QuickMart Detergent Powder", category: "Household", weight: "1 kg", price: 135, originalPrice: 155, rating: "4.8", reviews: "390", imgUrl: "https://images.unsplash.com/photo-1584820927498-cafe2c174360?w=300&h=300&fit=crop", discount: "12% OFF", is_trending: 1, shop_id: 13 },
            { name: "QuickMart Crispy Aloo Bhujia", category: "Snacks", weight: "400 g", price: 105, originalPrice: 120, rating: "4.7", reviews: "650", imgUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300&h=300&fit=crop", discount: "12% OFF", is_trending: 1, shop_id: 13 },
            { name: "QuickMart Fresh Pasteurised Milk", category: "Dairy & Bakery", weight: "1 L", price: 71, originalPrice: 75, rating: "4.9", reviews: "1100", imgUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop", discount: "5% OFF", shop_id: 13 },

            // Shop 14: Apex Healthcare & Pharmacy (Pharmacy / Health Shop)
            { name: "Apex Paracetamol Tablets", category: "Healthcare", weight: "15 tabs", price: 32, originalPrice: 40, rating: "4.7", reviews: "1850", imgUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop", discount: "20% OFF", is_trending: 1, shop_id: 14 },
            { name: "Apex Vitamin C Chewables", category: "Healthcare", weight: "30 tabs", price: 125, originalPrice: 155, rating: "4.8", reviews: "790", imgUrl: "https://images.unsplash.com/photo-1616679911721-eff6eec18fcd?w=300&h=300&fit=crop", discount: "19% OFF", shop_id: 14 },
            { name: "Apex Antiseptic Disinfectant Liquid", category: "Healthcare", weight: "250 ml", price: 95, originalPrice: 105, rating: "4.6", reviews: "1350", imgUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=300&h=300&fit=crop", discount: "9% OFF", shop_id: 14 },
            { name: "Apex Waterproof Band-Aid Pack", category: "Healthcare", weight: "20 pcs", price: 45, originalPrice: 50, rating: "4.7", reviews: "520", imgUrl: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=300&h=300&fit=crop", discount: "10% OFF", shop_id: 14 }
        ];

        const brands = ["Amul Food", "Tata Sampann", "Nestle", "Britannia", "Aashirvaad", "Maggi"];

        const insertCat = db.prepare('INSERT INTO categories (name, iconUrl) VALUES (?, ?)');
        categories.forEach(c => insertCat.run(c.name, c.iconUrl));
        insertCat.finalize();

        const insertProd = db.prepare('INSERT INTO products (name, category, weight, price, originalPrice, rating, reviews, imgUrl, discount, is_available, is_trending, is_daily_essential, description, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        products.forEach(p => insertProd.run(p.name, p.category, p.weight, p.price, p.originalPrice, p.rating, p.reviews, p.imgUrl, p.discount, 1, p.is_trending || 0, p.is_daily_essential ?? 1, p.description || `High quality ${p.name} for your daily needs.`, p.shop_id));
        insertProd.finalize();


        // Seed product reviews
        db.run("INSERT INTO reviews (product_id, username, rating, comment) VALUES (?, ?, ?, ?)",
            [2, 'Rakesh Kumar', 5, 'Absolutely fresh! The best apples I have had in a long time.']
        );
        db.run("INSERT INTO reviews (product_id, username, rating, comment) VALUES (?, ?, ?, ?)",
            [9, 'Suman Sharma', 4, 'Very creamy and fresh milk. Delivery was super fast!']
        );

        const insertBrand = db.prepare('INSERT INTO brands (name) VALUES (?)');
        brands.forEach(b => insertBrand.run(b));
        insertBrand.finalize();

        // Seed Banner
        db.run("INSERT INTO banners (badge, title, description, btnText, imgUrl, target_category) VALUES (?, ?, ?, ?, ?, ?)",
            ["Super Deal!", "Fresh Organic Veggies", "Get up to 40% OFF on farm-fresh vegetables and fruits today.", "Shop Now", "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200", "Vegetables"]
        );

        // Seed Special Offers
        const insertOffer = db.prepare('INSERT INTO special_offers (title, description, colorClass, target_category) VALUES (?, ?, ?, ?)');
        [
            { title: "Festive Dhamaka", description: "Buy 1 Get 1 Free on Sweets", colorClass: "bg-orange", target_category: "Dairy & Bakery" },
            { title: "Health is Wealth", description: "Flat 20% Off on Dry Fruits", colorClass: "bg-purple", target_category: "Snacks" }
        ].forEach(o => insertOffer.run(o.title, o.description, o.colorClass, o.target_category));
        insertOffer.finalize();

        // Seed Default Coupons
        db.run("INSERT OR IGNORE INTO coupons (code, discount_value, discount_type, expiry_date, shop_id) VALUES (?, ?, ?, ?, 1)",
            ['WELCOME10', 10, 'percent', '2026-12-31']
        );
        db.run("INSERT OR IGNORE INTO coupons (code, discount_value, discount_type, expiry_date, shop_id) VALUES (?, ?, ?, ?, 1)",
            ['FIRSTSAVE100', 100, 'fixed', '2026-12-31']
        );
        db.run("INSERT OR IGNORE INTO coupons (code, discount_value, discount_type, expiry_date, shop_id) VALUES (?, ?, ?, ?, 1)",
            ['ADYANTA10', 10, 'percent', '2026-12-31']
        );

        // Seed Promo Banners
        const defaultPromo = [
            { img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200', link: '#' },
            { img: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=1200', link: '#' },
            { img: 'https://images.unsplash.com/photo-1586816001966-79b736744398?w=1200', link: '#' }
        ];
        const insertPromo = db.prepare('INSERT INTO promo_banners (imageUrl, linkUrl, displayOrder) VALUES (?, ?, ?)');
        defaultPromo.forEach((p, index) => insertPromo.run(p.img, p.link, index + 1));
        insertPromo.finalize();

        // Update all shops with mock coordinates and delivery values
        db.serialize(() => {
            const coords = [
                { id: 1, lat: 14.4455, lng: 79.9822 }, // ~0.6km
                { id: 2, lat: 14.4501, lng: 79.9890 }, // ~1.1km
                { id: 3, lat: 14.4390, lng: 79.9790 }, // ~1.0km
                { id: 4, lat: 14.4320, lng: 79.9920 }, // ~1.5km
                { id: 5, lat: 14.4480, lng: 79.9980 }, // ~1.8km
                { id: 6, lat: 14.4580, lng: 79.9800 }, // ~2.2km
                { id: 7, lat: 14.4280, lng: 79.9720 }, // ~2.5km
                { id: 8, lat: 14.4350, lng: 80.0050 }, // ~2.4km
                { id: 9, lat: 14.4650, lng: 79.9950 }, // ~3.0km
                { id: 10, lat: 14.4200, lng: 79.9850 }, // ~2.5km
                { id: 11, lat: 14.4150, lng: 79.9980 }, // ~3.3km
                { id: 12, lat: 14.4750, lng: 79.9750 }, // ~3.8km
                { id: 13, lat: 14.4520, lng: 79.9620 }, // ~3.0km
                { id: 14, lat: 14.4850, lng: 80.0100 }, // ~5.4km
                { id: 15, lat: 14.4410, lng: 79.9830 }, // ~0.4km
                { id: 16, lat: 14.4495, lng: 79.9860 }, // ~0.8km
                { id: 17, lat: 14.4365, lng: 79.9805 }, // ~0.9km
                { id: 18, lat: 14.4335, lng: 79.9930 }, // ~1.6km
                { id: 19, lat: 14.4475, lng: 79.9965 }, // ~1.7km
                { id: 20, lat: 14.4590, lng: 79.9810 }, // ~2.3km
                { id: 21, lat: 14.4270, lng: 79.9710 }  // ~2.6km
            ];
            const stmt = db.prepare("UPDATE shops SET latitude = ?, longitude = ?, delivery_radius_km = ?, delivery_charge_per_km = ?, base_delivery_charge = ? WHERE id = ?");
            coords.forEach(c => {
                const radius = c.id % 2 === 0 ? 4.0 : 6.0;
                stmt.run(c.lat, c.lng, radius, 10.0, 20.0, c.id);
            });
            stmt.finalize();
        });

        // Seed rich data for Admin Panel Preview
        const now = new Date().toISOString().replace('T', ' ').split('.')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().replace('T', ' ').split('.')[0];

        db.run("INSERT INTO orders (user_id, total, items, payment_method, address, status, shop_id, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
            [1, 450, '[{"id":1,"name":"Premium Toor Dal","price":180,"quantity":2},{"id":6,"name":"Coca Cola Family Pack","price":90,"quantity":1}]', 'Cash', '123 Grocery Avenue, Mumbai', 'pending', now]
        );
        db.run("INSERT INTO orders (user_id, total, items, payment_method, address, status, shop_id, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
            [1, 150, '[{"id":2,"name":"Fresh Red Apples","price":150,"quantity":1}]', 'Card', '456 Fruit Lane, Mumbai', 'delivered', yesterday]
        );
        db.run("INSERT INTO support_messages (name, email, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [ 'Rakesh Kumar', 'rakesh@example.com', 'Delivery Delay', 'My order #1 is taking longer than expected.', 'unread', now]
        );
        db.run("INSERT INTO notifications (message, is_important, created_at) VALUES (?, ?, ?)",
            ['Welcome to ADYANTA Storefront! Fresh groceries delivered in minutes.', 1, now]
        );
        db.run("INSERT INTO notifications (message, is_important, created_at) VALUES (?, ?, ?)",
            ['🚨 Delivery Delay: Due to heavy rain, delivery times in Nellore may be extended by 15-20 minutes. We appreciate your patience!', 1, now]
        );
        db.run("INSERT INTO notifications (message, is_important, created_at) VALUES (?, ?, ?)",
            ['⚡ Lightning Sale Live! Get flat 20% OFF on all fresh fruits using code FRUIT20.', 0, new Date(Date.now() - 10 * 60 * 1000).toISOString()]
        );
        db.run("INSERT INTO notifications (message, is_important, created_at) VALUES (?, ?, ?)",
            ['🎁 Wallet Bonus Activated: Check your account to redeem 50 free ADYANTA coins on your next purchase!', 0, new Date(Date.now() - 60 * 60 * 1000).toISOString()]
        );
        db.run("INSERT INTO notifications (message, is_important, created_at) VALUES (?, ?, ?)",
            ['📢 New Store Launched: "Sri Balaji Organic Mart" is now live on ADYANTA! Order organic vegetables directly.', 0, new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()]
        );
    });
}

module.exports = { db, initDb };
