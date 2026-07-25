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

// Helper to verify Vendor authorization
async function requireVendor(req, res, next) {
    const userId = req.cookies.user_id;
    if (!userId) return res.status(401).json({ error: "Access Denied: Please log in." });

    const vendorId = parseInt(userId, 10);
    try {
        const user = await queryGet("SELECT role FROM users WHERE id = ?", [vendorId]);
        if (!user || user.role !== 'vendor') {
            return res.status(403).json({ error: "Access Denied: Vendor privileges required." });
        }
        req.vendorId = vendorId;
        next();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

// A. Create Razorpay order for vendor onboarding fee
router.post('/create-registration-order', requireVendor, async (req, res) => {
    try {
        const { couponCode } = req.body;

        // Fetch settings config
        const settings = await queryGet("SELECT * FROM settings LIMIT 1");
        if (!settings) {
            return res.status(500).json({ error: "Failed to fetch setup configurations." });
        }

        const baseFee = settings.vendor_fee_amount || 0;
        let finalAmount = baseFee;

        // Apply discount coupon if matched
        let discount = 0;
        if (couponCode && settings.vendor_fee_coupon && couponCode.trim().toLowerCase() === settings.vendor_fee_coupon.trim().toLowerCase()) {
            discount = settings.vendor_fee_discount || 0;
            finalAmount = Math.max(0, baseFee - discount);
        }

        if (finalAmount > 0) {
            if (!settings.razorpay_key_id || !settings.razorpay_secret) {
                return res.status(400).json({ error: "Razorpay payment credentials are not configured in system settings." });
            }

            const Razorpay = require('razorpay');
            const rzp = new Razorpay({
                key_id: settings.razorpay_key_id,
                key_secret: settings.razorpay_secret
            });

            const rzpOrder = await rzp.orders.create({
                amount: finalAmount * 100, // amount in paise
                currency: "INR",
                receipt: `vendor_reg_${req.vendorId}_${Date.now()}`
            });

            return res.json({
                success: true,
                orderId: rzpOrder.id,
                amount: finalAmount,
                discount,
                keyId: settings.razorpay_key_id,
                currency: "INR"
            });
        } else {
            // Free onboarding
            return res.json({
                success: true,
                amount: 0,
                discount,
                freeRegistration: true
            });
        }
    } catch (err) {
        console.error("Error creating vendor payment order:", err);
        res.status(500).json({ error: err.message });
    }
});

// 1. Shop Onboarding / Application
router.post('/register', requireVendor, async (req, res) => {
    const { 
        name, logo, banner, description, timings, category, contact_phone, kyc_document,
        razorpay_payment_id, razorpay_order_id, razorpay_signature, couponCode, registered_shop
    } = req.body;

    if (!name || !contact_phone || !kyc_document) {
        return res.status(400).json({ error: "Shop Name, Contact Phone, and KYC verification document are required." });
    }

    try {
        // Fetch settings config to verify fee
        const settings = await queryGet("SELECT * FROM settings LIMIT 1");
        if (!settings) {
            return res.status(500).json({ error: "Failed to fetch platform setup configurations." });
        }

        const baseFee = settings.vendor_fee_amount || 0;
        let discount = 0;
        let finalAmount = baseFee;

        if (couponCode && settings.vendor_fee_coupon && couponCode.trim().toLowerCase() === settings.vendor_fee_coupon.trim().toLowerCase()) {
            discount = settings.vendor_fee_discount || 0;
            finalAmount = Math.max(0, baseFee - discount);
        }

        let isPaidVal = 0;
        let regFeeVal = 0;
        let discAppliedVal = 0;
        let rzpOrderVal = null;
        let rzpPaymentVal = null;

        if (baseFee > 0) {
            if (finalAmount > 0) {
                // Payment was required
                if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                    return res.status(400).json({ error: "Razorpay transaction parameters are required for onboarding." });
                }

                // Verify signature
                const crypto = require('crypto');
                const shasum = crypto.createHmac('sha256', settings.razorpay_secret);
                shasum.update(razorpay_order_id + '|' + razorpay_payment_id);
                const digest = shasum.digest('hex');
                if (digest !== razorpay_signature) {
                    return res.status(400).json({ error: "Transaction verification signature mismatch. Payment was not successfully validated." });
                }

                isPaidVal = 1;
                regFeeVal = baseFee;
                discAppliedVal = discount;
                rzpOrderVal = razorpay_order_id;
                rzpPaymentVal = razorpay_payment_id;
            } else {
                // Registration discounted to 0
                isPaidVal = 1;
                regFeeVal = baseFee;
                discAppliedVal = discount; // 100% off
            }
        } else {
            // No payment required by platform globally
            isPaidVal = 1;
        }

        // Insert new shop
        const result = await queryRun(
            `INSERT INTO shops (vendor_id, name, logo, banner, description, timings, category, contact_phone, kyc_document, status, is_paid, registration_fee, discount_applied, razorpay_order_id, razorpay_payment_id, registered_shop)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.vendorId,
                name,
                logo || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&h=150',
                banner || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200',
                description || 'Fresh multi-vendor market shop.',
                timings || '9:00 AM - 10:00 PM',
                category || 'General',
                contact_phone,
                kyc_document,
                'pending', // Super admin needs to approve
                isPaidVal,
                regFeeVal,
                discAppliedVal,
                rzpOrderVal,
                rzpPaymentVal,
                registered_shop
            ]
        );

        const newShopId = result.lastID;
        const shop = await queryGet("SELECT * FROM shops WHERE id = ?", [newShopId]);

        // Initialize wallet for this shop
        await queryRun("INSERT INTO vendor_wallets (shop_id, balance, revenue) VALUES (?, ?, ?)", [newShopId, 0, 0]);

        res.status(201).json({ message: "Shop registration and setup fee payment completed! Pending Super Admin approval.", shop });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to get current vendor's shop
async function getVendorShop(vendorId) {
    return await queryGet("SELECT * FROM shops WHERE vendor_id = ?", [vendorId]);
}

// 2. Fetch Vendor Shop profile
router.get('/shop', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found. Please onboard first.", onboardPending: true });
        res.json(shop);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Customize storefront details
router.patch('/shop', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const { name, logo, banner, description, timings, category, contact_phone, registered_shop, is_active_store, show_special_offers } = req.body;
        
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (logo !== undefined) updateData.logo = logo;
        if (banner !== undefined) updateData.banner = banner;
        if (description !== undefined) updateData.description = description;
        if (timings !== undefined) updateData.timings = timings;
        if (category !== undefined) updateData.category = category;
        if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
        if (registered_shop !== undefined) updateData.registered_shop = registered_shop;
        if (is_active_store !== undefined) updateData.is_active_store = is_active_store ? 1 : 0;
        if (show_special_offers !== undefined) updateData.show_special_offers = show_special_offers ? 1 : 0;

        const keys = Object.keys(updateData);
        if (keys.length > 0) {
            const setClause = keys.map(k => `${k} = ?`).join(", ");
            const values = Object.values(updateData);
            values.push(shop.id);
            await queryRun(`UPDATE shops SET ${setClause} WHERE id = ?`, values);
        }

        const updatedShop = await queryGet("SELECT * FROM shops WHERE id = ?", [shop.id]);
        res.json({ message: "Storefront updated successfully!", shop: updatedShop });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get products belonging to the shop
router.get('/products', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const products = await queryAll("SELECT * FROM products WHERE shop_id = ? ORDER BY id DESC", [shop.id]);
        
        const processed = products.map(p => {
            let parsedVariants = [];
            if (p.variants) {
                try {
                    parsedVariants = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants;
                } catch (e) {
                    parsedVariants = [];
                }
            }
            return {
                ...p,
                originalprice: p.originalPrice !== undefined ? p.originalPrice : p.price,
                imgurl: p.imgUrl,
                variants: parsedVariants
            };
        });

        res.json(processed || []);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Add product to vendor's shop catalog
router.post('/products', requireVendor, async (req, res) => {
    const { name, category, weight, price, originalprice, imgurl, discount, stock_quantity, is_available, is_trending, is_daily_essential, description, variants } = req.body;
    if (!name || !category || !price) {
        return res.status(400).json({ error: "Product Name, Category, and Price are required." });
    }

    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const variantsStr = variants ? JSON.stringify(variants) : JSON.stringify([]);

        const result = await queryRun(
            `INSERT INTO products (shop_id, name, category, weight, price, originalPrice, imgUrl, discount, stock_quantity, is_available, is_trending, is_daily_essential, description, variants)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shop.id,
                name,
                category,
                weight || '1 unit',
                parseInt(price) || 0,
                parseInt(originalprice) || parseInt(price),
                imgurl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300',
                discount || '0% OFF',
                parseInt(stock_quantity) || 100,
                is_available !== undefined ? (is_available ? 1 : 0) : 1,
                is_trending !== undefined ? (is_trending ? 1 : 0) : 0,
                is_daily_essential !== undefined ? (is_daily_essential ? 1 : 0) : 1,
                description || 'Fresh catalog item.',
                variantsStr
            ]
        );

        const newProductId = result.lastID;
        const product = await queryGet("SELECT * FROM products WHERE id = ?", [newProductId]);
        if (product && product.variants) {
            try {
                product.variants = JSON.parse(product.variants);
            } catch (e) {
                product.variants = [];
            }
        }
        if (product) {
            product.originalprice = product.originalPrice;
            product.imgurl = product.imgUrl;
        }

        res.status(201).json({ message: "Product added to store catalog!", product });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Edit product in shop catalog
router.patch('/products/:id', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        // Ensure product belongs to this shop
        const productCheck = await queryGet("SELECT shop_id FROM products WHERE id = ?", [req.params.id]);
        if (!productCheck || productCheck.shop_id !== shop.id) {
            return res.status(403).json({ error: "Permission Denied: Product belongs to another shop." });
        }

        const { name, category, weight, price, originalprice, imgurl, discount, stock_quantity, is_available, is_trending, is_daily_essential, description, variants } = req.body;
        
        const updateFields = {};
        if (name !== undefined) updateFields.name = name;
        if (category !== undefined) updateFields.category = category;
        if (weight !== undefined) updateFields.weight = weight;
        if (price !== undefined) updateFields.price = parseInt(price) || 0;
        if (originalprice !== undefined) updateFields.originalPrice = parseInt(originalprice) || 0;
        if (imgurl !== undefined) updateFields.imgUrl = imgurl;
        if (discount !== undefined) updateFields.discount = discount;
        if (stock_quantity !== undefined) updateFields.stock_quantity = parseInt(stock_quantity) || 0;
        if (is_available !== undefined) updateFields.is_available = is_available ? 1 : 0;
        if (is_trending !== undefined) updateFields.is_trending = is_trending ? 1 : 0;
        if (is_daily_essential !== undefined) updateFields.is_daily_essential = is_daily_essential ? 1 : 0;
        if (description !== undefined) updateFields.description = description;
        if (variants !== undefined) updateFields.variants = JSON.stringify(variants);

        const keys = Object.keys(updateFields);
        if (keys.length > 0) {
            const setClause = keys.map(k => `${k} = ?`).join(", ");
            const values = Object.values(updateFields);
            values.push(req.params.id);
            await queryRun(`UPDATE products SET ${setClause} WHERE id = ?`, values);
        }

        const updatedProduct = await queryGet("SELECT * FROM products WHERE id = ?", [req.params.id]);
        if (updatedProduct) {
            if (updatedProduct.variants) {
                try {
                    updatedProduct.variants = JSON.parse(updatedProduct.variants);
                } catch(e) {
                    updatedProduct.variants = [];
                }
            }
            updatedProduct.originalprice = updatedProduct.originalPrice;
            updatedProduct.imgurl = updatedProduct.imgUrl;
        }
        res.json({ message: "Product updated successfully!", product: updatedProduct });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Remove product from shop catalog
router.delete('/products/:id', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        // Ensure product belongs to this shop
        const productCheck = await queryGet("SELECT shop_id FROM products WHERE id = ?", [req.params.id]);
        if (!productCheck || productCheck.shop_id !== shop.id) {
            return res.status(403).json({ error: "Permission Denied: Product belongs to another shop." });
        }

        await queryRun("DELETE FROM products WHERE id = ?", [req.params.id]);
        res.json({ message: "Product removed from catalog." });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Get shop orders
router.get('/orders', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const rows = await queryAll(
            `SELECT o.*, u.full_name as user_full_name, u.phone as user_phone
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.shop_id = ?
             ORDER BY o.id DESC`,
            [shop.id]
        );

        const orders = rows.map(r => {
            let itemsParsed = [];
            if (r.items) {
                try {
                    itemsParsed = typeof r.items === 'string' ? JSON.parse(r.items) : r.items;
                } catch(e) {
                    itemsParsed = [];
                }
            }
            return {
                ...r,
                items: itemsParsed,
                users: r.user_full_name ? {
                    full_name: r.user_full_name,
                    phone: r.user_phone
                } : null
            };
        });

        res.json(orders || []);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Update order status (Accept / Reject / Shift)
router.patch('/orders/:id', requireVendor, async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "New status parameter required." });

    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        // Ensure order belongs to this shop
        const order = await queryGet("SELECT * FROM orders WHERE id = ?", [req.params.id]);
        if (!order || order.shop_id !== shop.id) {
            return res.status(403).json({ error: "Access Denied: Order belongs to another shop." });
        }

        const newPaymentStatus = status === 'cancelled' ? 'cancelled' : order.payment_status;
        await queryRun(
            "UPDATE orders SET status = ?, payment_status = ? WHERE id = ?",
            [status, newPaymentStatus, req.params.id]
        );

        const updatedOrder = await queryGet("SELECT * FROM orders WHERE id = ?", [req.params.id]);

        // If order status changes to "delivered" (or accepted/completed), allocate earnings to vendor wallet!
        if (status === 'accepted' || status === 'delivered') {
            const wallet = await queryGet("SELECT * FROM vendor_wallets WHERE shop_id = ?", [shop.id]);
            if (wallet) {
                const ratePercent = shop.commission_rate !== undefined ? shop.commission_rate : 5;
                const commissionRate = ratePercent / 100;
                const vendorEarnings = Math.round(order.total * (1 - commissionRate));
                
                await queryRun(
                    "UPDATE vendor_wallets SET balance = balance + ?, revenue = revenue + ? WHERE id = ?",
                    [vendorEarnings, order.total, wallet.id]
                );
            }
        }

        res.json({ message: `Order status updated to: ${status}`, order: updatedOrder });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Vendor Wallet, Revenue, and Statistics
router.get('/wallet', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const wallet = await queryGet("SELECT * FROM vendor_wallets WHERE shop_id = ?", [shop.id]);
        if (!wallet) {
            return res.status(404).json({ error: "Wallet not found." });
        }

        // Gather metrics: total orders count, pending orders count, active items count
        const totalOrdersRow = await queryGet("SELECT COUNT(*) as count FROM orders WHERE shop_id = ?", [shop.id]);
        const pendingOrdersRow = await queryGet("SELECT COUNT(*) as count FROM orders WHERE shop_id = ? AND status = 'pending'", [shop.id]);
        const totalProductsRow = await queryGet("SELECT COUNT(*) as count FROM products WHERE shop_id = ?", [shop.id]);

        res.json({
            wallet,
            metrics: {
                totalOrders: totalOrdersRow ? totalOrdersRow.count : 0,
                pendingOrders: pendingOrdersRow ? pendingOrdersRow.count : 0,
                totalProducts: totalProductsRow ? totalProductsRow.count : 0
            }
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. Vendor isolated promotions (sliding banners & offers)
router.get('/promo-banners', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const data = await queryAll("SELECT * FROM promo_banners WHERE shop_id = ? ORDER BY displayOrder", [shop.id]);
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/promo-banners', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const { imageUrl, linkUrl, displayOrder } = req.body;
        const result = await queryRun(
            "INSERT INTO promo_banners (shop_id, imageUrl, linkUrl, displayOrder) VALUES (?, ?, ?, ?)",
            [shop.id, imageUrl, linkUrl || '#', parseInt(displayOrder) || 0]
        );

        const newBannerId = result.lastID;
        const banner = await queryGet("SELECT * FROM promo_banners WHERE id = ?", [newBannerId]);
        res.status(201).json({ message: "Promo banner added successfully!", banner });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/promo-banners/:id', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        // Ensure banner belongs to this shop
        const bannerCheck = await queryGet("SELECT shop_id FROM promo_banners WHERE id = ?", [req.params.id]);
        if (!bannerCheck || bannerCheck.shop_id !== shop.id) {
            return res.status(403).json({ error: "Access Denied: Promo banner belongs to another shop." });
        }

        await queryRun("DELETE FROM promo_banners WHERE id = ?", [req.params.id]);
        res.json({ message: "Promo banner deleted successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 12. Renew Vendor Shop Subscription
router.post('/renew-subscription', requireVendor, async (req, res) => {
    const { payment_id, amount } = req.body;
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found." });

        let currentExpiry = shop.subscription_expires ? new Date(shop.subscription_expires) : new Date();
        if (currentExpiry < new Date()) {
            currentExpiry = new Date();
        }
        currentExpiry.setFullYear(currentExpiry.getFullYear() + 1);
        const newExpiryStr = currentExpiry.toISOString();

        const nextStatus = shop.status === 'suspended' ? 'active' : shop.status;
        await queryRun(
            "UPDATE shops SET subscription_expires = ?, status = ? WHERE id = ?",
            [newExpiryStr, nextStatus, shop.id]
        );

        const updatedShop = await queryGet("SELECT * FROM shops WHERE id = ?", [shop.id]);
        res.json({ message: "Subscription renewed successfully!", expires: newExpiryStr, shop: updatedShop });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Vendor Customer Support Chat Endpoints
router.get('/support/chats', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found." });

        // Get list of unique chats for this shop
        const chats = await queryAll(
            `SELECT 
                COALESCE(user_id, session_id) AS chat_id,
                user_id,
                session_id,
                user_name,
                message AS last_message,
                created_at,
                (SELECT COUNT(*) FROM store_chat_messages 
                 WHERE shop_id = ? 
                   AND COALESCE(user_id, session_id) = COALESCE(m.user_id, m.session_id) 
                   AND sender = 'user' 
                   AND is_read = 0) AS unread_count
             FROM store_chat_messages m
             WHERE shop_id = ?
               AND id IN (
                   SELECT MAX(id) 
                   FROM store_chat_messages 
                   WHERE shop_id = ? 
                   GROUP BY COALESCE(user_id, session_id)
               )
             ORDER BY created_at DESC`,
            [shop.id, shop.id, shop.id]
        );

        res.json(chats || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/support/chats/:chatId', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found." });

        const chatId = req.params.chatId;

        // Fetch all messages for this chat
        const isNumeric = /^\d+$/.test(chatId);
        let messages;
        if (isNumeric) {
            const userId = parseInt(chatId, 10);
            messages = await queryAll(
                `SELECT * FROM store_chat_messages 
                 WHERE shop_id = ? AND (user_id = ? OR session_id = ?)
                 ORDER BY created_at ASC`,
                [shop.id, userId, chatId]
            );
        } else {
            messages = await queryAll(
                `SELECT * FROM store_chat_messages 
                 WHERE shop_id = ? AND session_id = ? AND user_id IS NULL
                 ORDER BY created_at ASC`,
                [shop.id, chatId]
            );
        }

        // Mark messages from user as read
        if (isNumeric) {
            const userId = parseInt(chatId, 10);
            await queryRun(
                `UPDATE store_chat_messages 
                 SET is_read = 1 
                 WHERE shop_id = ? AND (user_id = ? OR session_id = ?) AND sender = 'user'`,
                [shop.id, userId, chatId]
            );
        } else {
            await queryRun(
                `UPDATE store_chat_messages 
                 SET is_read = 1 
                 WHERE shop_id = ? AND session_id = ? AND user_id IS NULL AND sender = 'user'`,
                [shop.id, chatId]
            );
        }

        res.json(messages || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/support/chats/reply', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found." });

        const { chat_id, message } = req.body;
        if (!chat_id || !message) {
            return res.status(400).json({ error: "Missing chat_id or message." });
        }

        // Determine if chat_id is user_id or session_id
        const isNumeric = /^\d+$/.test(chat_id);
        const userId = isNumeric ? parseInt(chat_id, 10) : null;
        const sessionId = isNumeric ? null : chat_id;

        // Get user_name from the last message in this chat
        let userName = 'User';
        const lastMsg = await queryGet(
            `SELECT user_name FROM store_chat_messages 
             WHERE shop_id = ? AND (user_id = ? OR session_id = ?)
             ORDER BY id DESC LIMIT 1`,
            [shop.id, userId || -1, sessionId || '']
        );
        if (lastMsg) userName = lastMsg.user_name;

        const result = await queryRun(
            `INSERT INTO store_chat_messages (shop_id, user_id, session_id, user_name, sender, message, is_read) 
             VALUES (?, ?, ?, ?, 'vendor', ?, 1)`,
            [shop.id, userId, sessionId, userName, message]
        );

        res.status(201).json({ id: result.lastID, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Vendor Customer Support Messages (Inquiries) Endpoints
router.get('/support-messages', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found." });
        
        const date = req.query.date;
        let sql = "SELECT * FROM support_messages WHERE shop_id = ?";
        let params = [shop.id];
        
        if (date) {
            sql += " AND date(created_at) = date(?)";
            params.push(date);
        }
        sql += " ORDER BY created_at DESC";
        
        const messages = await queryAll(sql, params);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/support-messages/:id', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found." });
        
        const data = await queryGet("SELECT * FROM support_messages WHERE id = ? AND shop_id = ?", [req.params.id, shop.id]);
        if (!data) return res.status(404).json({ error: "Message not found." });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/support-messages/:id/read', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found." });
        
        await queryRun("UPDATE support_messages SET status = 'read' WHERE id = ? AND shop_id = ? AND status = 'unread'", [req.params.id, shop.id]);
        res.json({ message: "Marked as read." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/support-messages/:id/reply', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found." });
        
        const { reply } = req.body;
        if (!reply) return res.status(400).json({ error: "Reply text is required." });
        
        await queryRun(
            "UPDATE support_messages SET reply = ?, status = 'replied', replied_at = CURRENT_TIMESTAMP WHERE id = ? AND shop_id = ?",
            [reply, req.params.id, shop.id]
        );
        res.json({ message: "Reply submitted successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/support-messages/:id', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop not found." });
        
        await queryRun("DELETE FROM support_messages WHERE id = ? AND shop_id = ?", [req.params.id, shop.id]);
        res.json({ message: "Message deleted." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get notifications sent by Super Admin to vendors
router.get('/notifications', requireVendor, async (req, res) => {
    try {
        const { date } = req.query;
        let sql = "SELECT * FROM notifications WHERE (target_role = 'vendor' OR target_role = 'all')";
        let params = [];
        if (date) {
            sql += " AND date(created_at) = date(?)";
            params.push(date);
        }
        sql += " ORDER BY created_at DESC";
        const notifications = await queryAll(sql, params);
        res.json(notifications || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get special offers for this vendor shop
router.get('/special-offers', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        let offers = await queryAll("SELECT * FROM special_offers WHERE shop_id = ? ORDER BY id ASC", [shop.id]);
        if (offers.length === 0) {
            // Seed default offers for this vendor shop
            await queryRun(
                "INSERT INTO special_offers (title, description, colorClass, target_category, shop_id) VALUES (?, ?, ?, ?, ?)",
                ['Special Promo', 'Great deals on selected items', 'bg-orange', 'All', shop.id]
            );
            await queryRun(
                "INSERT INTO special_offers (title, description, colorClass, target_category, shop_id) VALUES (?, ?, ?, ?, ?)",
                ['Exclusive Offer', 'Limited time discount', 'bg-purple', 'All', shop.id]
            );
            offers = await queryAll("SELECT * FROM special_offers WHERE shop_id = ? ORDER BY id ASC", [shop.id]);
        }
        res.json(offers || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a specific special offer for this vendor shop
router.put('/special-offers/:id', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const { title, description, target_category } = req.body;
        
        // Ensure offer belongs to this shop
        const offer = await queryGet("SELECT shop_id FROM special_offers WHERE id = ?", [req.params.id]);
        if (!offer || offer.shop_id !== shop.id) {
            return res.status(403).json({ error: "Access Denied: Special offer belongs to another shop." });
        }

        await queryRun(
            "UPDATE special_offers SET title = ?, description = ?, target_category = ? WHERE id = ?",
            [title, description, target_category, req.params.id]
        );
        res.json({ message: "Offer updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
