const { db } = require('./db');

const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

async function seedDemoConversation() {
    await queryRun("DELETE FROM vendor_admin_messages");

    // Conversation with Shop 1: Adyanta Organic Farm Store
    await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read, created_at) VALUES (1, 'vendor', 'Hello Admin Suresh, we would like to add a new batch of organic dragonfruits to our catalogue. Could you please review and approve the category listing?', 1, datetime('now', '-30 minutes'))"
    );
    await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read, created_at) VALUES (1, 'admin', 'Hello Organic Farm Team! I have checked your request and approved the Exotic Fruits category for your store. You can now add your dragonfruit products.', 1, datetime('now', '-20 minutes'))"
    );
    await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read, created_at) VALUES (1, 'vendor', 'Thank you so much Admin! The products are now live and selling.', 0, datetime('now', '-5 minutes'))"
    );

    // Conversation with Shop 2: Adyanta Frozen Foods
    await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read, created_at) VALUES (2, 'admin', 'Hi Frozen Foods Team, please ensure all cold chain packaging standards are maintained for ice cream deliveries this summer.', 1, datetime('now', '-1 hour'))"
    );
    await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read, created_at) VALUES (2, 'vendor', 'Understood Admin Suresh! All items are packed with dry ice insulated boxes. Thank you for the reminder.', 1, datetime('now', '-45 minutes'))"
    );

    console.log("✔ Seeded realistic demo conversations between Vendor and Super Admin successfully!");
    process.exit(0);
}

seedDemoConversation().catch(err => {
    console.error("Failed to seed demo conversation:", err);
    process.exit(1);
});
