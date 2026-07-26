const express = require('express');
const router = express.Router();
const { db } = require('../db');

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

router.get('/coupons', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const rows = await queryAll("SELECT * FROM coupons WHERE expiry_date >= ?", [today]);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/coupons/validate', async (req, res) => {
    const { code, subtotal } = req.body;
    const userId = req.cookies.user_id;

    try {
        if (!code) return res.status(400).json({ error: "Coupon code required" });

        const coupon = await queryGet("SELECT * FROM coupons WHERE code LIKE ? LIMIT 1", [code]);
        if (!coupon) {
            return res.status(404).json({ error: "Invalid coupon code." });
        }

        const now = new Date();
        if (new Date(coupon.expiry_date) < now) {
            return res.status(400).json({ error: "This coupon has expired." });
        }

        if (subtotal < coupon.min_amount) {
            return res.status(400).json({ error: `Minimum purchase of ₹${coupon.min_amount} required.` });
        }

        if (coupon.is_one_time && userId) {
            const usage = await queryGet("SELECT id FROM coupon_usage WHERE user_id = ? AND coupon_id = ? LIMIT 1", [userId, coupon.id]);
            if (usage) {
                return res.status(400).json({ error: "Already used." });
            }
        }

        let discount_value = coupon.discount_value;
        if (coupon.discount_type === 'percent') {
            discount_value = Math.round((subtotal * coupon.discount_value) / 100);
        }
        
        res.json({
            id: coupon.id,
            code: coupon.code,
            discount_value: Math.min(discount_value, subtotal),
            discount_type: coupon.discount_type,
            original_value: coupon.discount_value
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/categories', async (req, res) => {
    try {
        const rows = await queryAll("SELECT * FROM categories ORDER BY name ASC");
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/brands', async (req, res) => {
    try {
        const rows = await queryAll("SELECT * FROM brands ORDER BY name ASC");
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/banners', async (req, res) => {
    try {
        const rows = await queryAll("SELECT * FROM banners");
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/promo-banners', async (req, res) => {
    try {
        const rows = await queryAll("SELECT * FROM promo_banners ORDER BY displayOrder ASC LIMIT 6");
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/special-offers', async (req, res) => {
    try {
        const { shop_id } = req.query;
        let rows;
        if (shop_id) {
            rows = await queryAll("SELECT * FROM special_offers WHERE shop_id = ? ORDER BY id ASC", [shop_id]);
            if (rows.length === 0) {
                // Auto-seed default offers for this vendor shop so they are always visible
                await queryRun(
                    "INSERT INTO special_offers (title, description, colorClass, target_category, shop_id) VALUES (?, ?, ?, ?, ?)",
                    ['Special Promo', 'Great deals on selected items', 'bg-orange', 'All', shop_id]
                );
                await queryRun(
                    "INSERT INTO special_offers (title, description, colorClass, target_category, shop_id) VALUES (?, ?, ?, ?, ?)",
                    ['Exclusive Offer', 'Limited time discount', 'bg-purple', 'All', shop_id]
                );
                rows = await queryAll("SELECT * FROM special_offers WHERE shop_id = ? ORDER BY id ASC", [shop_id]);
            }
        } else {
            rows = await queryAll("SELECT * FROM special_offers WHERE shop_id IS NULL OR shop_id = 0 ORDER BY id ASC");
        }
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/admin/special-offers/:id', async (req, res) => {
    const { title, description, target_category } = req.body;
    try {
        await queryRun(
            "UPDATE special_offers SET title = ?, description = ?, target_category = ? WHERE id = ?",
            [title, description, target_category, req.params.id]
        );
        res.json({ message: "Offer updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/settings', async (req, res) => {
    try {
        const row = await queryGet("SELECT * FROM settings LIMIT 1");
        res.json(row || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/support/messages', async (req, res) => {
    const userId = req.cookies.user_id || null;
    const { name, email, subject, message, shop_id } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: "Missing fields" });

    try {
        const result = await queryRun(
            "INSERT INTO support_messages (name, email, subject, message, status, user_id, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [name, email, subject || 'No Subject', message, 'unread', userId, shop_id || null]
        );
        res.status(201).json({ message: "Message sent!", messageId: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reviews', async (req, res) => {
    const username = req.cookies.username;
    if (!username) return res.status(401).json({ error: "Login required" });

    const { product_id, rating, comment } = req.body;
    try {
        const result = await queryRun(
            "INSERT INTO reviews (product_id, username, rating, comment) VALUES (?, ?, ?, ?)",
            [product_id, username, rating, comment]
        );
        res.status(201).json({ message: "Review submitted!", reviewId: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/user-info', async (req, res) => {
    const userId = req.cookies.user_id;
    if (!userId) return res.status(401).json({ error: "Not logged in" });
    try {
        const row = await queryGet("SELECT id, full_name FROM users WHERE id = ?", [userId]);
        if (!row) return res.status(404).json({ error: "User not found" });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/orders', async (req, res) => {
    const userId = req.cookies.user_id || null;
    let { items, paymentMethod, address, couponId, deliveryType, useCoins } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart is empty." });
    }

    const parsePrice = (p) => typeof p === 'number' ? p : parseFloat(p.toString().replace(/[^0-9.]/g, '')) || 0;

    try {
        // Ensure every item has a shop_id (query DB if missing)
        const enrichedItems = await Promise.all(items.map(async (item) => {
            let shopId = item.shop_id || item.shopId;
            if (!shopId && item.id) {
                const prod = await queryGet("SELECT shop_id FROM products WHERE id = ?", [item.id]);
                if (prod && prod.shop_id) shopId = prod.shop_id;
            }
            return {
                ...item,
                shop_id: Number(shopId || 1)
            };
        }));

        // Calculate overall subtotal
        const overallSubtotal = enrichedItems.reduce((sum, item) => sum + (parsePrice(item.price) * (item.quantity || 1)), 0) || 0;
        let totalCouponDiscount = 0;

        if (couponId) {
            const coupon = await queryGet("SELECT * FROM coupons WHERE id = ?", [couponId]);
            if (coupon) {
                totalCouponDiscount = coupon.discount_type === 'percent' 
                    ? Math.round((overallSubtotal * coupon.discount_value) / 100)
                    : coupon.discount_value;
                totalCouponDiscount = Math.min(totalCouponDiscount, overallSubtotal);
            }
        }

        let totalCoinsUsed = 0;
        let totalCoinsEarned = 0;
        let totalCoinDiscount = 0;
        let rewardRate = 1000;
        let rewardAmount = 30;

        const settings = await queryGet("SELECT * FROM settings LIMIT 1");
        if (settings && settings.coins_system_active === 1) {
            rewardRate = settings.coin_reward_rate || 1000;
            rewardAmount = settings.coin_reward_amount || 30;

            if (useCoins && userId) {
                const user = await queryGet("SELECT coins FROM users WHERE id = ?", [userId]);
                if (user && user.coins > 0) {
                    const coinValue = settings.coin_value_per_rupee || 10;
                    totalCoinsUsed = user.coins;
                    totalCoinDiscount = Math.floor(totalCoinsUsed / coinValue);
                    
                    const subtotalAfterCoupon = overallSubtotal - totalCouponDiscount;
                    if (totalCoinDiscount > subtotalAfterCoupon) {
                        totalCoinDiscount = subtotalAfterCoupon;
                        totalCoinsUsed = totalCoinDiscount * coinValue;
                    }
                }
            }
        }

        // Group enriched items by shop_id
        const itemsByShop = {};
        enrichedItems.forEach(item => {
            const sId = item.shop_id;
            if (!itemsByShop[sId]) itemsByShop[sId] = [];
            itemsByShop[sId].push(item);
        });

        const shopIds = Object.keys(itemsByShop);
        const subOrderIds = [];
        let createdOrdersCount = 0;

        for (const sId of shopIds) {
            const shopItems = itemsByShop[sId];
            const shopSubtotal = shopItems.reduce((sum, item) => sum + (parsePrice(item.price) * (item.quantity || 1)), 0);
            
            const propFactor = overallSubtotal > 0 ? (shopSubtotal / overallSubtotal) : (1 / shopIds.length);
            const shopCouponDiscount = Math.round(totalCouponDiscount * propFactor);
            const shopCoinDiscount = Math.round(totalCoinDiscount * propFactor);
            const shopCoinsUsed = Math.round(totalCoinsUsed * propFactor);
            const shopFinalTotal = Math.max(0, shopSubtotal - shopCouponDiscount - shopCoinDiscount);
            const shopCoinsEarned = Math.floor(shopFinalTotal / rewardRate) * rewardAmount;
            
            totalCoinsEarned += shopCoinsEarned;

            const itemsJsonStr = JSON.stringify(shopItems);
            const result = await queryRun(
                `INSERT INTO orders (user_id, total, items, payment_method, address, status, discount_amount, coupon_id, delivery_type, coins_used, coins_earned, shop_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, 
                    Math.round(shopFinalTotal), 
                    itemsJsonStr, 
                    paymentMethod, 
                    address, 
                    'pending', 
                    Math.round(shopSubtotal - shopFinalTotal), 
                    couponId, 
                    deliveryType || 'Home Delivery', 
                    shopCoinsUsed, 
                    shopCoinsEarned,
                    Number(sId)
                ]
            );

            subOrderIds.push(result.lastID);
            createdOrdersCount++;
        }

        if (couponId && userId) {
            await queryRun("INSERT INTO coupon_usage (user_id, coupon_id) VALUES (?, ?)", [userId, couponId]);
        }

        // Update user's coin balance
        if (userId && (totalCoinsUsed > 0 || totalCoinsEarned > 0)) {
            const user = await queryGet("SELECT coins FROM users WHERE id = ?", [userId]);
            const currentCoins = user?.coins || 0;
            const newCoins = Math.max(0, currentCoins - totalCoinsUsed + totalCoinsEarned);
            await queryRun("UPDATE users SET coins = ? WHERE id = ?", [newCoins, userId]);
        }

        const primaryOrderId = subOrderIds[0];
        const displayOrderId = subOrderIds.map(id => `#${id}`).join(', ');

        res.status(201).json({ 
            message: createdOrdersCount > 1 ? `Placed ${createdOrdersCount} vendor sub-orders successfully!` : "Order placed!", 
            orderId: primaryOrderId,
            subOrderIds: subOrderIds,
            displayOrderId: displayOrderId,
            coinsUsed: totalCoinsUsed,
            coinsEarned: totalCoinsEarned,
            coinDiscount: totalCoinDiscount,
            shopCount: createdOrdersCount
        });

    } catch (err) {
        console.error("Error creating multi-shop orders:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/orders/cancel', async (req, res) => {
    const { orderId } = req.body;
    try {
        await queryRun("UPDATE orders SET status = 'cancelled', payment_status = 'cancelled' WHERE id = ?", [orderId]);
        res.json({ message: "Order cancelled" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/reviews/recent', async (req, res) => {
    try {
        const sql = `
            SELECT r.*, p.name as product_name 
            FROM reviews r 
            LEFT JOIN products p ON r.product_id = p.id 
            ORDER BY r.created_at DESC 
            LIMIT 6
        `;
        const rows = await queryAll(sql);
        const formatted = rows.map(r => ({
            ...r,
            products: { name: r.product_name }
        }));
        res.json(formatted || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/notifications/history', async (req, res) => {
    try {
        const rows = await queryAll("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20");
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Browse active marketplace shops
router.get('/shops', async (req, res) => {
    const { search, category } = req.query;
    try {
        let sql = "SELECT * FROM shops WHERE status = 'active' AND (is_active_store IS NULL OR is_active_store != 0)";
        let params = [];

        if (category && category !== 'All') {
            sql += " AND category LIKE ?";
            params.push(`%${category}%`);
        }

        sql += " ORDER BY rating DESC";
        const shops = await queryAll(sql, params);

        let filtered = shops || [];
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(sh => 
                (sh.name || '').toLowerCase().includes(s) || 
                (sh.description || '').toLowerCase().includes(s)
            );
        }

        res.json(filtered);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Fetch specific shop details and its specific products
router.get('/shops/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const shop = await queryGet("SELECT * FROM shops WHERE id = ?", [id]);
        if (!shop) return res.status(404).json({ error: "Shop not found." });

        const products = await queryAll("SELECT * FROM products WHERE shop_id = ? AND is_available = 1", [id]);
        res.json({ shop, products: products || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Fetch active platform feature flags
router.get('/features', async (req, res) => {
    try {
        const flags = await queryAll("SELECT name, is_active FROM feature_flags");
        const flagsMap = {};
        (flags || []).forEach(f => {
            flagsMap[f.name] = f.is_active === 1;
        });
        res.json(flagsMap);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Store Chat Support Endpoints (Customer)
router.post('/support/store-chat/send', async (req, res) => {
    try {
        const { shop_id, message, session_id, user_name } = req.body;
        if (!shop_id || !message) {
            return res.status(400).json({ error: "Missing shop_id or message." });
        }

        const userId = req.cookies.user_id ? parseInt(req.cookies.user_id, 10) : null;
        
        let finalUserName = user_name || 'Guest User';
        if (userId) {
            const user = await queryGet("SELECT full_name FROM users WHERE id = ?", [userId]);
            if (user) finalUserName = user.full_name;
        }

        const result = await queryRun(
            `INSERT INTO store_chat_messages (shop_id, user_id, session_id, user_name, sender, message) 
             VALUES (?, ?, ?, ?, 'user', ?)`,
            [shop_id, userId, session_id || null, finalUserName, message]
        );

        res.status(201).json({ id: result.lastID, success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/support/store-chat/history', async (req, res) => {
    try {
        const { shop_id, session_id } = req.query;
        if (!shop_id) {
            return res.status(400).json({ error: "Missing shop_id." });
        }

        const userId = req.cookies.user_id ? parseInt(req.cookies.user_id, 10) : null;

        let messages;
        if (userId) {
            messages = await queryAll(
                `SELECT * FROM store_chat_messages 
                 WHERE shop_id = ? AND (user_id = ? OR (user_id IS NULL AND session_id = ?))
                 ORDER BY created_at ASC`,
                [shop_id, userId, session_id || '']
            );
        } else {
            messages = await queryAll(
                `SELECT * FROM store_chat_messages 
                 WHERE shop_id = ? AND session_id = ? AND user_id IS NULL
                 ORDER BY created_at ASC`,
                [shop_id, session_id || '']
            );
        }

        res.json(messages || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
