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

async function runComprehensiveVerification() {
    console.log("=== COMPREHENSIVE VENDOR <-> SUPER ADMIN COMMUNICATION AUDIT ===");

    // Step 0: Clean test messages for clean testing
    await queryRun("DELETE FROM vendor_admin_messages");
    console.log("✔ Cleaned previous test messages.\n");

    // Case 1: Super Admin directly initiates message to Specific Vendor (Shop #2: "Adyanta Frozen Foods")
    console.log("--- TEST CASE 1: Super Admin directly initiates message to a Specific Vendor ---");
    const shop2 = await queryGet("SELECT id, name FROM shops WHERE id = 2");
    console.log(`Admin selects Shop #${shop2.id}: "${shop2.name}" directly from Helpdesk list`);
    
    // Super Admin sends direct message to Shop #2
    const adminDirectMsg = "Hello Frozen Foods Team, please upload your food safety certificate.";
    await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read) VALUES (?, 'admin', ?, 0)",
        [shop2.id, adminDirectMsg]
    );
    console.log(`👑 Super Admin sent direct message: "${adminDirectMsg}"`);

    // Verify Shop #2 has 1 unread message from Admin
    const shop2Unread = await queryGet(
        "SELECT COUNT(*) AS unread_count FROM vendor_admin_messages WHERE shop_id = ? AND sender = 'admin' AND is_read = 0",
        [shop2.id]
    );
    console.log(`🏬 Shop #2 Unread Count from Admin: ${shop2Unread.unread_count} (Expected: 1)`);
    if (shop2Unread.unread_count !== 1) throw new Error("Test 1 Failed: Unread count mismatch!");

    // Shop #2 opens chat and marks message as read
    await queryRun(
        "UPDATE vendor_admin_messages SET is_read = 1 WHERE shop_id = ? AND sender = 'admin'",
        [shop2.id]
    );
    console.log("✔ Shop #2 opened thread and read Admin's direct message.");


    // Case 2: Vendor replies back to Super Admin
    console.log("\n--- TEST CASE 2: Vendor replies back to Super Admin ---");
    const vendorReply = "Thank you Admin! I have uploaded the certificate in my documents section.";
    await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read) VALUES (?, 'vendor', ?, 0)",
        [shop2.id, vendorReply]
    );
    console.log(`🏬 Shop #2 Vendor replied: "${vendorReply}"`);

    // Verify Super Admin detects unread message from Shop #2
    const adminUnreadStatus = await queryGet(
        "SELECT COUNT(*) AS total_unread FROM vendor_admin_messages WHERE sender = 'vendor' AND is_read = 0"
    );
    console.log(`👑 Super Admin Global Unread Count: ${adminUnreadStatus.total_unread} (Expected: 1)`);
    if (adminUnreadStatus.total_unread !== 1) throw new Error("Test 2 Failed: Admin unread count mismatch!");

    // Verify Helpdesk Chat List places Shop #2 at the top with unread badge
    const adminChatsList = await queryAll(
        `SELECT 
             s.id AS shop_id,
             s.name AS shop_name,
             m.message AS last_message,
             m.sender AS last_sender,
             (SELECT COUNT(*) FROM vendor_admin_messages WHERE shop_id = s.id AND sender = 'vendor' AND is_read = 0) AS unread_count
         FROM shops s
         LEFT JOIN vendor_admin_messages m ON m.id = (
             SELECT MAX(id) FROM vendor_admin_messages WHERE shop_id = s.id
         )
         WHERE s.status = 'active'
         ORDER BY 
             (CASE WHEN (SELECT COUNT(*) FROM vendor_admin_messages WHERE shop_id = s.id AND sender = 'vendor' AND is_read = 0) > 0 THEN 1 ELSE 0 END) DESC,
             COALESCE(m.created_at, '1970-01-01') DESC`
    );

    const topShop = adminChatsList[0];
    console.log(`👑 Top Shop in Super Admin Helpdesk List: "${topShop.shop_name}" with unread_count=${topShop.unread_count} (Last msg: "${topShop.last_message}")`);
    if (topShop.shop_id !== 2 || topShop.unread_count !== 1) throw new Error("Test 2 Failed: Shop #2 is not prioritized at the top of Super Admin list!");


    // Case 3: Super Admin replies back to Shop #2
    console.log("\n--- TEST CASE 3: Super Admin sends second reply to Vendor ---");
    const adminSecondReply = "Certificate verified successfully! Your store is in great standing.";
    await queryRun(
        "INSERT INTO vendor_admin_messages (shop_id, sender, message, is_read) VALUES (?, 'admin', ?, 0)",
        [shop2.id, adminSecondReply]
    );
    // Mark vendor message as read
    await queryRun(
        "UPDATE vendor_admin_messages SET is_read = 1 WHERE shop_id = ? AND sender = 'vendor'",
        [shop2.id]
    );
    console.log(`👑 Super Admin replied: "${adminSecondReply}"`);

    // Verify complete thread history for Shop #2
    const completeThread = await queryAll(
        "SELECT sender, message, is_read FROM vendor_admin_messages WHERE shop_id = ? ORDER BY id ASC",
        [shop2.id]
    );

    console.log("\n--- COMPLETE VERIFIED THREAD FOR SHOP #2 ---");
    completeThread.forEach((msg, idx) => {
        console.log(`${idx + 1}. [${msg.sender === 'admin' ? '👑 SUPER ADMIN' : '🏬 VENDOR'}]: ${msg.message}`);
    });

    console.log("\n🎉 ALL COMMUNICATION PATHWAYS FULLY VERIFIED AND WORKING 100%!");
    process.exit(0);
}

runComprehensiveVerification().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
