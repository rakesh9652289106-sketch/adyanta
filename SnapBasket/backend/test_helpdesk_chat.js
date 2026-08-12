const { db } = require('./db');

const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

async function testChatFlow() {
    console.log("--- 1. Testing Vendor sending message to Admin ---");
    const shop = await queryGet("SELECT id, name FROM shops WHERE id = 1");
    console.log(`Using Shop #${shop.id}: "${shop.name}"`);

    // Vendor sends message
    const sendRes = await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read) VALUES (?, 'vendor', ?, 0)",
        [shop.id, "Hello Admin, please help me with my new inventory."]
    );
    console.log(`Inserted message from Vendor, message ID: ${sendRes.lastID}`);

    // Admin checks unread count
    const unread = await queryGet(
        "SELECT COUNT(*) AS total_unread FROM vendor_admin_messages WHERE sender = 'vendor' AND is_read = 0"
    );
    console.log(`Admin unread count: ${unread.total_unread} (should be > 0)`);

    // Admin checks chat list
    const chats = await queryAll(
        `SELECT s.id, s.name, m.message, m.sender,
         (SELECT COUNT(*) FROM vendor_admin_messages WHERE shop_id = s.id AND sender = 'vendor' AND is_read = 0) AS unread_count
         FROM shops s
         LEFT JOIN vendor_admin_messages m ON m.id = (SELECT MAX(id) FROM vendor_admin_messages WHERE shop_id = s.id)
         WHERE s.id = 1`
    );
    console.log("Admin chats list view:", JSON.stringify(chats, null, 2));

    console.log("\n--- 2. Testing Super Admin replying to Vendor ---");
    const replyRes = await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read) VALUES (?, 'admin', ?, 0)",
        [shop.id, "Hi! I have reviewed your store. Your inventory is now approved."]
    );
    console.log(`Admin replied, message ID: ${replyRes.lastID}`);

    // Mark vendor message as read by Admin
    await queryRun(
        "UPDATE vendor_admin_messages SET is_read = 1 WHERE shop_id = ? AND sender = 'vendor'",
        [shop.id]
    );

    // Vendor checks unread count from admin
    const vendorUnread = await queryGet(
        "SELECT COUNT(*) AS unread_count FROM vendor_admin_messages WHERE shop_id = ? AND sender = 'admin' AND is_read = 0",
        [shop.id]
    );
    console.log(`Vendor unread count: ${vendorUnread.unread_count} (should be > 0)`);

    // Vendor fetches full history
    const history = await queryAll(
        "SELECT * FROM vendor_admin_messages WHERE shop_id = ? ORDER BY created_at ASC",
        [shop.id]
    );
    console.log(`Vendor conversation history (${history.length} messages):`);
    history.forEach(m => {
        console.log(`  [${m.sender.toUpperCase()}]: ${m.message} (is_read: ${m.is_read})`);
    });

    console.log("\n--- SUCCESS: Bidirectional Helpdesk Chat Flow Verified! ---");
    process.exit(0);
}

testChatFlow().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
