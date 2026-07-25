const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log("Running local SQLite migrations for marketplace enhancements...");

db.serialize(() => {
    // 1. Create shops table
    db.run(`CREATE TABLE IF NOT EXISTS shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id TEXT,
        name TEXT NOT NULL,
        logo TEXT,
        banner TEXT,
        description TEXT,
        timings TEXT DEFAULT '9:00 AM - 10:00 PM',
        category TEXT,
        contact_phone TEXT,
        rating REAL DEFAULT 4.5,
        delivery_time TEXT DEFAULT '15-30 mins',
        status TEXT DEFAULT 'pending',
        kyc_document TEXT,
        is_paid INTEGER DEFAULT 0,
        registration_fee INTEGER DEFAULT 0,
        discount_applied INTEGER DEFAULT 0,
        razorpay_order_id TEXT,
        razorpay_payment_id TEXT,
        commission_rate INTEGER DEFAULT 5,
        subscription_expires TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error("Failed to create shops table:", err.message);
        else console.log("Verified/Created shops table.");
    });

    // 2. Create vendor_wallets table
    db.run(`CREATE TABLE IF NOT EXISTS vendor_wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER UNIQUE,
        balance INTEGER DEFAULT 0,
        revenue INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shops(id)
    )`, (err) => {
        if (err) console.error("Failed to create vendor_wallets table:", err.message);
        else console.log("Verified/Created vendor_wallets table.");
    });

    // 3. Add commission_rate to categories table
    db.run("ALTER TABLE categories ADD COLUMN commission_rate INTEGER DEFAULT 5", (err) => {
        if (err) console.log("Note: commission_rate already exists in categories or failed:", err.message);
        else console.log("Added commission_rate to categories table.");
    });

    // 4. Add target_role to notifications table
    db.run("ALTER TABLE notifications ADD COLUMN target_role TEXT DEFAULT 'all'", (err) => {
        if (err) console.log("Note: target_role already exists in notifications or failed:", err.message);
        else console.log("Added target_role to notifications table.");
    });
});

setTimeout(() => {
    db.close();
    console.log("SQLite migrations complete.");
    process.exit(0);
}, 2000);
