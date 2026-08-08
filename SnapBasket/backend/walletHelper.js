const { db } = require('./db');

// Promise Helpers for SQLite
const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

/**
 * Creates a notification in the system.
 */
async function sendNotification(message, isImportant = 0, targetRole = 'vendor', targetShopId = null) {
    try {
        await queryRun(
            "INSERT INTO notifications (message, is_important, target_role, target_shop_id) VALUES (?, ?, ?, ?)",
            [message, isImportant, targetRole, targetShopId]
        );
    } catch (e) {
        console.error("Failed to write notification:", e.message);
    }
}

/**
 * Releases funds for orders where the hold period has expired.
 * This is run dynamically on fetching wallet details or during auto-settlement.
 */
async function releasePendingBalances(shopId) {
    try {
        // Find all orders for this shop that are pending in the wallet, hold_until is in the past,
        // and COD collection is confirmed if COD.
        const nowStr = new Date().toISOString().replace('T', ' ').split('.')[0];
        const pendingOrders = await queryAll(
            `SELECT * FROM orders 
             WHERE shop_id = ? 
             AND wallet_status = 'pending' 
             AND hold_until IS NOT NULL 
             AND datetime(hold_until) <= datetime(?)
             AND (payment_method != 'Cash' OR cod_collected = 1)`,
            [shopId, nowStr]
        );

        const shop = await queryGet("SELECT * FROM shops WHERE id = ?", [shopId]);
        if (!shop) return;

        const commissionRate = shop.commission_rate !== undefined ? shop.commission_rate : 5;

        for (const order of pendingOrders) {
            const earnings = Math.round(order.total * (1 - commissionRate / 100));

            // Update order status in wallet to available
            await queryRun("UPDATE orders SET wallet_status = 'available' WHERE id = ?", [order.id]);

            // Update vendor wallet balances
            // Increase available_balance and total_balance, decrease pending_balance
            await queryRun(
                `UPDATE vendor_wallets 
                 SET available_balance = available_balance + ?, 
                     total_balance = total_balance + ?, 
                     pending_balance = CASE WHEN pending_balance >= ? THEN pending_balance - ? ELSE 0 END
                 WHERE shop_id = ?`,
                [earnings, earnings, earnings, earnings, shopId]
            );

            // Log transaction
            await queryRun(
                `INSERT INTO wallet_transactions (shop_id, order_id, type, amount, category, description) 
                 VALUES (?, ?, 'credit', ?, ?, ?)`,
                [shopId, order.id, earnings, 'order_sale', `Earnings from Order #${order.id} released from return hold.`]
            );

            // Send notification to vendor
            await sendNotification(
                `Earnings of ₹${earnings} from Order #${order.id} are now Available for payout.`,
                0,
                'vendor',
                shopId
            );
        }
    } catch (e) {
        console.error(`Error releasing pending balance for shop ${shopId}:`, e.message);
    }
}

/**
 * Triggers the 12:00 AM (midnight) Auto-Settlement Daemon for all eligible vendors.
 */
async function triggerAutoSettlement() {
    try {
        const wallets = await queryAll("SELECT * FROM vendor_wallets");
        const results = [];

        for (const wallet of wallets) {
            // Check if there are funds to release first
            await releasePendingBalances(wallet.shop_id);
            
            // Reload wallet balances
            const updatedWallet = await queryGet("SELECT * FROM vendor_wallets WHERE id = ?", [wallet.id]);
            if (!updatedWallet || updatedWallet.available_balance <= 0) continue;

            const isAuto = updatedWallet.withdrawal_mode === 'auto';
            if (!isAuto) continue; // Rolled to next cycle / manual mode

            const amount = updatedWallet.available_balance;
            const shopId = updatedWallet.shop_id;

            // Check if bank details or UPI ID are set
            const hasBank = updatedWallet.bank_account && updatedWallet.bank_ifsc;
            const hasUpi = updatedWallet.upi_id;

            if (!hasBank && !hasUpi) {
                // Failed due to missing details
                await queryRun(
                    `INSERT INTO settlement_logs (shop_id, amount, bank_utr, payment_mode, status, failure_reason) 
                     VALUES (?, ?, ?, 'auto', 'failed', ?)`,
                    [shopId, amount, 'N/A', 'Bank account and UPI details are missing. Please configure payout options.']
                );

                await sendNotification(
                    `🚨 Auto-settlement of ₹${amount} failed: Bank details not configured. Update bank info to retry.`,
                    1,
                    'vendor',
                    shopId
                );

                results.push({ shopId, amount, status: 'failed', reason: 'Missing bank details' });
                continue;
            }

            // Simulate bank payout processing
            // generate a random 12-digit UTR
            const utr = "UTR" + Math.floor(100000000000 + Math.random() * 900000000000);
            
            // Deduct available balance
            await queryRun(
                `UPDATE vendor_wallets SET available_balance = available_balance - ? WHERE id = ?`,
                [amount, wallet.id]
            );

            // Log settlement
            await queryRun(
                `INSERT INTO settlement_logs (shop_id, amount, bank_utr, payment_mode, status) 
                 VALUES (?, ?, ?, 'auto', 'success')`,
                [shopId, amount, utr]
            );

            // Update wallet status of settled orders
            await queryRun(
                `UPDATE orders SET wallet_status = 'settled' WHERE shop_id = ? AND wallet_status = 'available'`,
                [shopId]
            );

            await sendNotification(
                `🎉 Auto-settlement of ₹${amount} succeeded! Transferred to bank/UPI. UTR: ${utr}.`,
                1,
                'vendor',
                shopId
            );

            results.push({ shopId, amount, status: 'success', utr });
        }

        return results;
    } catch (e) {
        console.error("Auto-settlement daemon error:", e.message);
        throw e;
    }
}

/**
 * Processes wallet status when an order is marked delivered.
 */
async function handleOrderDelivery(orderId) {
    try {
        const order = await queryGet("SELECT * FROM orders WHERE id = ?", [orderId]);
        if (!order) return;

        // Get vendor's hold period settings
        const wallet = await queryGet("SELECT return_hold_hours FROM vendor_wallets WHERE shop_id = ?", [order.shop_id]);
        const holdHours = (wallet && wallet.return_hold_hours !== undefined) ? wallet.return_hold_hours : 24;

        if (order.payment_method === 'Cash' || order.payment_method === 'COD') {
            // COD order: requires COD collection confirmation first.
            // Start in 'pending_cod' state, cod_collected = 0, no hold_until set.
            await queryRun(
                `UPDATE orders 
                 SET wallet_status = 'pending_cod', 
                     cod_collected = 0, 
                     hold_until = NULL, 
                     delivered_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [orderId]
            );

            await sendNotification(
                `Order #${orderId} delivered (COD). Awaiting COD Collection confirmation.`,
                0,
                'vendor',
                order.shop_id
            );
        } else {
            // UPI / Online Payment: immediately enters return-hold
            const holdUntilDate = new Date(Date.now() + holdHours * 60 * 60 * 1000);
            const holdUntilStr = holdUntilDate.toISOString().replace('T', ' ').split('.')[0];

            await queryRun(
                `UPDATE orders 
                 SET wallet_status = 'pending', 
                     hold_until = ?, 
                     delivered_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [holdUntilStr, orderId]
            );

            await sendNotification(
                `Order #${orderId} delivered. Amount entered return-hold for ${holdHours} hours.`,
                0,
                'vendor',
                order.shop_id
            );
        }
    } catch (e) {
        console.error("Error in handleOrderDelivery:", e.message);
    }
}

/**
 * Confirms COD collection, starting the return-hold period.
 */
async function confirmCodCollection(orderId) {
    try {
        const order = await queryGet("SELECT * FROM orders WHERE id = ?", [orderId]);
        if (!order) throw new Error("Order not found");

        if (order.cod_collected === 1) return { success: true, message: "COD already marked collected." };

        const wallet = await queryGet("SELECT return_hold_hours FROM vendor_wallets WHERE shop_id = ?", [order.shop_id]);
        const holdHours = (wallet && wallet.return_hold_hours !== undefined) ? wallet.return_hold_hours : 24;

        const holdUntilDate = new Date(Date.now() + holdHours * 60 * 60 * 1000);
        const holdUntilStr = holdUntilDate.toISOString().replace('T', ' ').split('.')[0];

        await queryRun(
            `UPDATE orders 
             SET wallet_status = 'pending', 
                 cod_collected = 1, 
                 hold_until = ? 
             WHERE id = ?`,
            [holdUntilStr, orderId]
        );

        await sendNotification(
            `COD Collection confirmed for Order #${orderId}. Amount entered return-hold for ${holdHours} hours.`,
            0,
            'vendor',
            order.shop_id
        );

        return { success: true, message: "COD collection confirmed. Hold period started." };
    } catch (e) {
        console.error("Error in confirmCodCollection:", e.message);
        throw e;
    }
}

module.exports = {
    queryGet,
    queryAll,
    queryRun,
    sendNotification,
    releasePendingBalances,
    triggerAutoSettlement,
    handleOrderDelivery,
    confirmCodCollection
};
