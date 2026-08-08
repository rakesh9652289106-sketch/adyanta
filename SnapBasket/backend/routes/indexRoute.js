const express = require('express');
const router = express.Router();
const { db } = require('../db');

function getDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

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
    const rawUserId = req.body.user_id || (req.cookies && req.cookies.user_id) || null;
    const userId = rawUserId ? parseInt(rawUserId, 10) : null;
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
    let { items, paymentMethod, address, couponId, deliveryType, useCoins, address_id, delivery_lat, delivery_lng, traffic_condition, weather_condition } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart is empty." });
    }

    const parsePrice = (p) => typeof p === 'number' ? p : parseFloat(p.toString().replace(/[^0-9.]/g, '')) || 0;

    try {
        // Ensure every item has a shop_id and shop_name (query DB if missing)
        const enrichedItems = await Promise.all(items.map(async (item) => {
            let shopId = item.shop_id || item.shopId;
            let shopName = item.shop_name || item.shopName || item.store_name;

            if ((!shopId || !shopName) && item.id) {
                const prod = await queryGet("SELECT p.shop_id, s.name as shop_name FROM products p LEFT JOIN shops s ON p.shop_id = s.id WHERE p.id = ?", [item.id]);
                if (prod) {
                    if (!shopId && prod.shop_id) shopId = prod.shop_id;
                    if (!shopName && prod.shop_name) shopName = prod.shop_name;
                }
            }

            if (!shopName && shopId) {
                const shopObj = await queryGet("SELECT name FROM shops WHERE id = ?", [shopId]);
                if (shopObj && shopObj.name) shopName = shopObj.name;
            }

            return {
                ...item,
                shop_id: Number(shopId || 1),
                shop_name: shopName || `Store #${shopId || 1}`
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

            // Get shop coordinates to set initial partner position and calculate ETA
            const shopObj = await queryGet("SELECT latitude, longitude FROM shops WHERE id = ?", [sId]);
            const shopLat = (shopObj && shopObj.latitude) || 14.4426;
            const shopLng = (shopObj && shopObj.longitude) || 79.9865;

            const clientLat = parseFloat(delivery_lat) || 14.4455;
            const clientLng = parseFloat(delivery_lng) || 79.9822;

            const dist = getDistance(shopLat, shopLng, clientLat, clientLng) || 1.5;
            const eta = Math.round(dist * 5) + 5; // ~5 mins per km + 5 mins prep time

            const trafficOptions = ["clear", "moderate", "heavy"];
            const weatherOptions = ["sunny", "rainy", "stormy"];
            const traffic = traffic_condition || trafficOptions[Math.floor(Math.random() * trafficOptions.length)];
            const weather = weather_condition || weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

            // Create initial winding route coordinates JSON
            const routePoints = [
                { lat: shopLat, lng: shopLng },
                { lat: shopLat + (clientLat - shopLat) * 0.25 + 0.0012, lng: shopLng + (clientLng - shopLng) * 0.18 },
                { lat: shopLat + (clientLat - shopLat) * 0.5 - 0.0008, lng: shopLng + (clientLng - shopLng) * 0.55 },
                { lat: shopLat + (clientLat - shopLat) * 0.75 + 0.0006, lng: shopLng + (clientLng - shopLng) * 0.82 },
                { lat: clientLat, lng: clientLng }
            ];

            const itemsJsonStr = JSON.stringify(shopItems);
            const result = await queryRun(
                `INSERT INTO orders (
                    user_id, total, items, payment_method, address, status, discount_amount, coupon_id,
                    delivery_type, coins_used, coins_earned, shop_id, address_id, delivery_lat, delivery_lng,
                    delivery_partner_lat, delivery_partner_lng, eta_minutes, traffic_condition, weather_condition, route_coordinates
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    Number(sId),
                    address_id || null,
                    clientLat,
                    clientLng,
                    shopLat,
                    shopLng,
                    eta,
                    traffic,
                    weather,
                    JSON.stringify(routePoints)
                ]
            );

            const insertedOrderId = result.lastID;

            // Increment vendor pending balance on order placement
            try {
                const rateRow = await queryGet("SELECT commission_rate FROM shops WHERE id = ?", [sId]);
                const commissionRate = (rateRow && rateRow.commission_rate !== undefined) ? rateRow.commission_rate : 5;
                const vendorEarnings = Math.round(shopFinalTotal * (1 - commissionRate / 100));

                // Ensure wallet exists
                let wallet = await queryGet("SELECT id FROM vendor_wallets WHERE shop_id = ?", [sId]);
                if (!wallet) {
                    await queryRun("INSERT INTO vendor_wallets (shop_id, balance, revenue, pending_balance, total_balance, available_balance) VALUES (?, 0, 0, 0, 0, 0)", [sId]);
                }

                // Update pending balance and revenue (accumulated store gross sales)
                await queryRun(
                    "UPDATE vendor_wallets SET pending_balance = pending_balance + ?, revenue = revenue + ? WHERE shop_id = ?",
                    [vendorEarnings, Math.round(shopFinalTotal), sId]
                );

                // Create wallet transaction log
                await queryRun(
                    `INSERT INTO wallet_transactions (shop_id, order_id, type, amount, category, description) 
                     VALUES (?, ?, 'credit', ?, 'order_sale', ?)`,
                    [sId, insertedOrderId, vendorEarnings, 'order_sale', `Order #${insertedOrderId} placed (${paymentMethod}). Earnings added to pending.`]
                );
            } catch (walletErr) {
                console.error("Failed to update vendor wallet on order placement:", walletErr.message);
            }

            subOrderIds.push(insertedOrderId);
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
    const { search, category, lat, lng } = req.query;
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

        const clientLat = parseFloat(lat);
        const clientLng = parseFloat(lng);
        filtered = filtered.map(sh => {
            let dist = null;
            if (!isNaN(clientLat) && !isNaN(clientLng) && sh.latitude && sh.longitude) {
                dist = getDistance(clientLat, clientLng, sh.latitude, sh.longitude);
            }
            return {
                ...sh,
                distance_km: dist !== null ? parseFloat(dist.toFixed(2)) : null
            };
        });

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

        let products = await queryAll("SELECT p.*, s.name as shop_name FROM products p LEFT JOIN shops s ON p.shop_id = s.id WHERE p.shop_id = ? AND p.is_available = 1", [id]);
        if (products) {
            products = products.map(p => {
                let parsedVariants = [];
                if (p.variants) {
                    try {
                        parsedVariants = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants;
                    } catch(e) {
                        parsedVariants = [];
                    }
                }
                return { 
                    ...p, 
                    shop_name: p.shop_name || (shop ? shop.name : ''),
                    variants: Array.isArray(parsedVariants) ? parsedVariants : [] 
                };
            });
        }
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
        if (shop_id === undefined || shop_id === null || shop_id === '' || !message) {
            return res.status(400).json({ error: "Missing shop_id or message." });
        }

        const rawUserId = req.body.user_id || (req.cookies && req.cookies.user_id) || null;
        const userId = rawUserId ? parseInt(rawUserId, 10) : null;
        
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
        const { shop_id, session_id, user_id } = req.query;
        if (shop_id === undefined || shop_id === null || shop_id === '') {
            return res.status(400).json({ error: "Missing shop_id." });
        }

        const rawUserId = user_id || (req.cookies && req.cookies.user_id) || null;
        const userId = rawUserId ? parseInt(rawUserId, 10) : null;

        let messages;
        if (userId && session_id) {
            messages = await queryAll(
                `SELECT * FROM store_chat_messages 
                 WHERE shop_id = ? AND (user_id = ? OR session_id = ?)
                 ORDER BY created_at ASC`,
                [shop_id, userId, session_id]
            );
        } else if (userId) {
            messages = await queryAll(
                `SELECT * FROM store_chat_messages 
                 WHERE shop_id = ? AND user_id = ?
                 ORDER BY created_at ASC`,
                [shop_id, userId]
            );
        } else {
            messages = await queryAll(
                `SELECT * FROM store_chat_messages 
                 WHERE shop_id = ? AND session_id = ?
                 ORDER BY created_at ASC`,
                [shop_id, session_id || '']
            );
        }

        res.json(messages || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/orders/:id/tracking', async (req, res) => {
    try {
        const order = await queryGet("SELECT * FROM orders WHERE id = ?", [req.params.id]);
        if (!order) return res.status(404).json({ error: "Order not found." });

        const shop = await queryGet("SELECT name, logo, latitude, longitude FROM shops WHERE id = ?", [order.shop_id]);
        if (!shop) return res.status(404).json({ error: "Shop not found." });

        // Calculate progress based on order creation time
        const createdAt = new Date(order.created_at + ' UTC').getTime(); 
        const elapsedSecs = (Date.now() - createdAt) / 1000;

        let status = order.status;
        let lat = order.delivery_partner_lat;
        let lng = order.delivery_partner_lng;
        let eta = order.eta_minutes;

        const routePoints = order.route_coordinates ? JSON.parse(order.route_coordinates) : [];

        // Live order tracking simulation
        if (status !== 'delivered' && status !== 'cancelled') {
            if (elapsedSecs < 10) {
                status = 'pending';
                if (routePoints.length > 0) {
                    lat = routePoints[0].lat;
                    lng = routePoints[0].lng;
                }
            } else if (elapsedSecs < 20) {
                status = 'packed';
                if (routePoints.length > 0) {
                    lat = routePoints[0].lat;
                    lng = routePoints[0].lng;
                }
            } else if (elapsedSecs < 60) {
                status = 'out_for_delivery';
                const transitSecs = elapsedSecs - 20; 
                const progress = Math.min(transitSecs / 40, 0.98); 

                if (routePoints.length > 1) {
                    const totalSegments = routePoints.length - 1;
                    const segmentIdx = Math.floor(progress * totalSegments);
                    const segmentProgress = (progress * totalSegments) - segmentIdx;
                    const p1 = routePoints[segmentIdx];
                    const p2 = routePoints[segmentIdx + 1];

                    lat = p1.lat + (p2.lat - p1.lat) * segmentProgress;
                    lng = p1.lng + (p2.lng - p1.lng) * segmentProgress;
                }
                eta = Math.max(1, Math.round(order.eta_minutes * (1 - progress)));
            } else {
                status = 'delivered';
                if (routePoints.length > 0) {
                    lat = routePoints[routePoints.length - 1].lat;
                    lng = routePoints[routePoints.length - 1].lng;
                }
                eta = 0;
                await queryRun("UPDATE orders SET status = 'delivered', delivery_partner_lat = ?, delivery_partner_lng = ?, eta_minutes = 0 WHERE id = ?", [lat, lng, order.id]);
            }
        } else {
            eta = 0;
            if (routePoints.length > 0) {
                lat = routePoints[routePoints.length - 1].lat;
                lng = routePoints[routePoints.length - 1].lng;
            }
        }

        res.json({
            id: order.id,
            status: status,
            total: order.total,
            delivery_type: order.delivery_type,
            address: order.address,
            eta_minutes: eta,
            traffic_condition: order.traffic_condition || 'clear',
            weather_condition: order.weather_condition || 'sunny',
            delivery_lat: order.delivery_lat,
            delivery_lng: order.delivery_lng,
            delivery_partner_lat: lat,
            delivery_partner_lng: lng,
            route_coordinates: routePoints,
            shop_name: shop.name,
            shop_logo: shop.logo,
            shop_latitude: shop.latitude,
            shop_longitude: shop.longitude,
            entrance_pin: order.entrance_pin || null,
            packing_photo: order.packing_photo || null,
            is_tamper_sealed: order.is_tamper_sealed || 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
