const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { handleOrderDelivery, releasePendingBalances, confirmCodCollection } = require('../walletHelper');

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

        // MANDATORY AUDIT ENFORCEMENT: Block moving to "packed" or "ready_for_pickup" without photo & checklist evidence
        if ((status === 'packed' || status === 'ready_for_pickup' || status === 'out_for_delivery') && !order.packing_photo) {
            return res.status(400).json({
                error: "Mandatory Packing Verification Required! You must complete the item checklist and upload a package photo before marking order as packed.",
                requires_pack_verification: true
            });
        }

        const newPaymentStatus = status === 'cancelled' ? 'cancelled' : order.payment_status;
        await queryRun(
            "UPDATE orders SET status = ?, payment_status = ? WHERE id = ?",
            [status, newPaymentStatus, req.params.id]
        );

        const updatedOrder = await queryGet("SELECT * FROM orders WHERE id = ?", [req.params.id]);

        // If order status changes to "delivered", run wallet flow rules
        if (status === 'delivered') {
            await handleOrderDelivery(req.params.id);
        }

        res.json({ message: `Order status updated to: ${status}`, order: updatedOrder });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 9b. Mandatory Packed Order Photo & Item Verification Endpoint
router.post('/orders/:id/pack-verification', requireVendor, async (req, res) => {
    try {
        const { packing_photo, checklist, is_tamper_sealed, packing_geo } = req.body;
        if (!packing_photo) {
            return res.status(400).json({ error: "Mandatory packing evidence photo is required." });
        }

        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const order = await queryGet("SELECT * FROM orders WHERE id = ?", [req.params.id]);
        if (!order || order.shop_id !== shop.id) {
            return res.status(403).json({ error: "Access Denied: Order belongs to another shop." });
        }

        // Parse items in order
        let itemsList = [];
        try { itemsList = JSON.parse(order.items || '[]'); } catch(e){}

        // Verify item count / checklist matching
        const verifiedItemIds = Array.isArray(checklist) ? checklist : [];
        if (itemsList.length > 0 && verifiedItemIds.length < itemsList.length) {
            return res.status(400).json({
                error: `Item Mismatch Detected! Order contains ${itemsList.length} items, but only ${verifiedItemIds.length} were verified in checklist. All items must be checked off before packing.`,
                mismatch: true
            });
        }

        // Generate 4-digit Pickup & Delivery OTPs
        const pickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const geoString = packing_geo || `Pack Hub | ${new Date().toLocaleTimeString()}`;

        await queryRun(
            `UPDATE orders SET 
                status = 'packed',
                packing_photo = ?,
                packing_checklist = ?,
                is_tamper_sealed = ?,
                packing_geo = ?,
                packed_at = CURRENT_TIMESTAMP,
                pickup_otp = ?,
                delivery_otp = ?
             WHERE id = ?`,
            [packing_photo, JSON.stringify(verifiedItemIds), is_tamper_sealed ? 1 : 0, geoString, pickupOtp, deliveryOtp, req.params.id]
        );

        const updatedOrder = await queryGet("SELECT * FROM orders WHERE id = ?", [req.params.id]);
        res.json({
            message: "Order packed and photo evidence verified successfully!",
            order: updatedOrder,
            pickup_otp: pickupOtp,
            delivery_otp: deliveryOtp
        });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// 9c. Linked Evidence Chain Endpoint
router.get('/orders/:id/evidence-chain', async (req, res) => {
    try {
        const order = await queryGet("SELECT * FROM orders WHERE id = ?", [req.params.id]);
        if (!order) return res.status(404).json({ error: "Order not found" });

        const disputes = await queryAll("SELECT * FROM order_disputes WHERE order_id = ? ORDER BY created_at DESC", [req.params.id]);
        const shop = await queryGet("SELECT name, logo, contact_phone FROM shops WHERE id = ?", [order.shop_id]);

        let itemsParsed = [];
        try { itemsParsed = JSON.parse(order.items || '[]'); } catch(e){}

        res.json({
            order_id: order.id,
            status: order.status,
            total: order.total,
            items: itemsParsed,
            created_at: order.created_at,
            packed_at: order.packed_at,
            picked_up_at: order.picked_up_at,
            delivered_at: order.delivered_at,
            packing_photo: order.packing_photo,
            packing_checklist: order.packing_checklist ? JSON.parse(order.packing_checklist) : [],
            is_tamper_sealed: order.is_tamper_sealed === 1,
            packing_geo: order.packing_geo,
            pickup_otp: order.pickup_otp,
            delivery_otp: order.delivery_otp,
            delivery_proof_photo: order.delivery_proof_photo,
            shop: shop || {},
            disputes: disputes || []
        });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// 9d. Vendor Packing Accuracy & SLA Score Endpoint
router.get('/packing-accuracy', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const packedOrdersRow = await queryGet("SELECT COUNT(*) as count FROM orders WHERE shop_id = ? AND packing_photo IS NOT NULL", [shop.id]);
        const totalPacked = packedOrdersRow ? packedOrdersRow.count : 0;

        const disputesRow = await queryGet("SELECT COUNT(*) as count FROM order_disputes WHERE shop_id = ?", [shop.id]);
        const totalDisputes = disputesRow ? disputesRow.count : 0;

        const resolvedVendorFavorRow = await queryGet("SELECT COUNT(*) as count FROM order_disputes WHERE shop_id = ? AND status = 'resolved_vendor_favor'", [shop.id]);
        const vendorFavors = resolvedVendorFavorRow ? resolvedVendorFavorRow.count : 0;

        const effectiveErrors = Math.max(0, totalDisputes - vendorFavors);
        const accuracyScore = totalPacked > 0 ? parseFloat(Math.max(0, Math.min(100, (((totalPacked - effectiveErrors) / totalPacked) * 100))).toFixed(1)) : 100;

        res.json({
            total_packed_orders: totalPacked,
            total_disputes: totalDisputes,
            disputes_vendor_favor: vendorFavors,
            accuracy_score: accuracyScore,
            sla_avg_packing_mins: 8.5
        });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// 9e. Vendor Disputes Management Endpoints
router.get('/disputes', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const disputes = await queryAll(
            `SELECT d.*, o.total, o.packing_photo, o.packing_checklist, u.full_name as customer_name, u.phone as customer_phone
             FROM order_disputes d
             JOIN orders o ON d.order_id = o.id
             LEFT JOIN users u ON d.user_id = u.id
             WHERE d.shop_id = ?
             ORDER BY d.created_at DESC`,
            [shop.id]
        );

        res.json(disputes || []);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/disputes/:id/resolve', requireVendor, async (req, res) => {
    try {
        const { status, resolution_notes } = req.body;
        if (!status) return res.status(400).json({ error: "Status required." });

        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        await queryRun(
            "UPDATE order_disputes SET status = ?, resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND shop_id = ?",
            [status, resolution_notes || '', req.params.id, shop.id]
        );

        res.json({ message: `Dispute marked as ${status}` });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// 10. Vendor Wallet, Revenue, and Statistics
router.get('/wallet', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        // Release eligible return-hold funds dynamically first
        await releasePendingBalances(shop.id);

        let wallet = await queryGet("SELECT * FROM vendor_wallets WHERE shop_id = ?", [shop.id]);
        if (!wallet) {
            // Auto-initialize if missing
            await queryRun("INSERT INTO vendor_wallets (shop_id, balance, revenue, pending_balance, total_balance, available_balance) VALUES (?, 0, 0, 0, 0, 0)", [shop.id]);
            wallet = await queryGet("SELECT * FROM vendor_wallets WHERE shop_id = ?", [shop.id]);
        }

        // Gather metrics: total orders count, pending orders count, active products count
        const totalOrdersRow = await queryGet("SELECT COUNT(*) as count FROM orders WHERE shop_id = ?", [shop.id]);
        const pendingOrdersRow = await queryGet("SELECT COUNT(*) as count FROM orders WHERE shop_id = ? AND status = 'pending'", [shop.id]);
        const totalProductsRow = await queryGet("SELECT COUNT(*) as count FROM products WHERE shop_id = ?", [shop.id]);

        // Fetch wallet sublogs
        const orders = await queryAll(
            `SELECT o.id, o.total, o.payment_method, o.status, o.wallet_status, o.hold_until, o.cod_collected, o.returned_or_replaced, o.delivered_at, o.created_at, u.full_name as customer_name 
             FROM orders o 
             LEFT JOIN users u ON o.user_id = u.id 
             WHERE o.shop_id = ? 
             ORDER BY o.id DESC`, 
            [shop.id]
        );

        const transactions = await queryAll("SELECT * FROM wallet_transactions WHERE shop_id = ? ORDER BY id DESC", [shop.id]);
        const returns = await queryAll("SELECT * FROM vendor_returns_replacements WHERE shop_id = ? ORDER BY id DESC", [shop.id]);
        const settlements = await queryAll("SELECT * FROM settlement_logs WHERE shop_id = ? ORDER BY id DESC", [shop.id]);
        const disputes = await queryAll("SELECT * FROM order_disputes WHERE shop_id = ? ORDER BY id DESC", [shop.id]);

        res.json({
            wallet,
            metrics: {
                totalOrders: totalOrdersRow ? totalOrdersRow.count : 0,
                pendingOrders: pendingOrdersRow ? pendingOrdersRow.count : 0,
                totalProducts: totalProductsRow ? totalProductsRow.count : 0
            },
            orders,
            transactions,
            returns,
            settlements,
            disputes
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 10a. Update Payout Options & Bank/UPI details
router.post('/wallet/settings', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const { withdrawal_mode, payout_threshold, return_hold_hours, bank_name, bank_account, bank_ifsc, bank_holder_name, upi_id } = req.body;

        await queryRun(
            `UPDATE vendor_wallets 
             SET withdrawal_mode = ?, 
                 payout_threshold = ?, 
                 return_hold_hours = ?, 
                 bank_name = ?, 
                 bank_account = ?, 
                 bank_ifsc = ?, 
                 bank_holder_name = ?, 
                 upi_id = ? 
             WHERE shop_id = ?`,
            [
                withdrawal_mode || 'auto',
                parseInt(payout_threshold, 10) || 1000,
                parseInt(return_hold_hours, 10) || 24,
                bank_name || '',
                bank_account || '',
                bank_ifsc || '',
                bank_holder_name || '',
                upi_id || '',
                shop.id
            ]
        );

        res.json({ message: "Wallet payout settings updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10b. Penny-drop Bank Account Verification Simulation
router.post('/wallet/verify-bank', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const { bank_account, bank_ifsc, bank_holder_name } = req.body;
        if (!bank_account || !bank_ifsc || !bank_holder_name) {
            return res.status(400).json({ error: "Missing bank details for verification." });
        }

        // Simulate penny drop verification - Credit ₹1 to vendor
        await queryRun(
            `UPDATE vendor_wallets 
             SET available_balance = available_balance + 1, 
                 total_balance = total_balance + 1,
                 upi_verified = 1
             WHERE shop_id = ?`,
            [shop.id]
        );

        // Record verification transaction log
        await queryRun(
            `INSERT INTO wallet_transactions (shop_id, order_id, type, amount, category, description) 
             VALUES (?, NULL, 'credit', 1, 'adjustment', 'Simulated penny-drop bank account verification credit.')`,
            [shop.id]
        );

        // Trigger notification
        await queryRun(
            `INSERT INTO notifications (message, is_important, target_role, target_shop_id) 
             VALUES (?, 0, 'vendor', ?)`,
            [`🎉 Bank account ending in ${bank_account.slice(-4)} successfully verified via ₹1 penny-drop!`, shop.id]
        );

        res.json({ message: "Bank Account Verified! ₹1 penny-drop successfully processed." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10c. Manual Withdrawal Payout Request
router.post('/wallet/withdraw', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const wallet = await queryGet("SELECT * FROM vendor_wallets WHERE shop_id = ?", [shop.id]);
        if (!wallet) return res.status(404).json({ error: "Wallet not found." });

        if (wallet.withdrawal_mode !== 'manual') {
            return res.status(400).json({ error: "Manual withdrawals are only allowed when withdrawal mode is set to Manual." });
        }

        const reqAmount = parseInt(req.body.amount, 10);
        if (!reqAmount || reqAmount <= 0) {
            return res.status(400).json({ error: "Invalid payout amount requested." });
        }

        if (reqAmount < wallet.payout_threshold) {
            return res.status(400).json({ error: `Withdrawal amount must be at least the minimum threshold of ₹${wallet.payout_threshold}.` });
        }

        if (wallet.available_balance < reqAmount) {
            return res.status(400).json({ error: `Insufficient Available Balance. Your available balance is ₹${wallet.available_balance}.` });
        }

        // Deduct from available balance immediately and place in settlement processing
        await queryRun(
            "UPDATE vendor_wallets SET available_balance = available_balance - ? WHERE shop_id = ?",
            [reqAmount, shop.id]
        );

        // Log manual payout request
        const refUTR = "MREQ" + Math.floor(100000000000 + Math.random() * 900000000000);
        await queryRun(
            `INSERT INTO settlement_logs (shop_id, amount, bank_utr, payment_mode, status, failure_reason) 
             VALUES (?, ?, ?, 'manual', 'processing', 'Awaiting Super Admin Approval')`,
            [shop.id, reqAmount, refUTR]
        );

        await queryRun(
            `INSERT INTO notifications (message, is_important, target_role, target_shop_id) 
             VALUES (?, 0, 'vendor', ?)`,
            [`Payout request of ₹${reqAmount} submitted. Awaiting admin approval. Reference: ${refUTR}.`, shop.id]
        );

        res.json({ message: "Payout request submitted successfully!", available_balance: wallet.available_balance - reqAmount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10d. Confirm COD Collection
router.post('/orders/:id/cod-collected', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const order = await queryGet("SELECT * FROM orders WHERE id = ? AND shop_id = ?", [req.params.id, shop.id]);
        if (!order) return res.status(404).json({ error: "Order not found." });

        const result = await confirmCodCollection(order.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10e. Raise Dispute
router.post('/orders/:id/raise-dispute', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const { reason_code, description } = req.body;
        if (!reason_code) return res.status(400).json({ error: "Dispute reason is required." });

        const order = await queryGet("SELECT * FROM orders WHERE id = ? AND shop_id = ?", [req.params.id, shop.id]);
        if (!order) return res.status(404).json({ error: "Order not found." });

        // Insert dispute
        await queryRun(
            `INSERT INTO order_disputes (order_id, user_id, shop_id, reason_code, description, status) 
             VALUES (?, ?, ?, ?, ?, 'open')`,
            [order.id, order.user_id, shop.id, reason_code, description || '']
        );

        // Alert super admin via notification
        await queryRun(
            `INSERT INTO notifications (message, is_important, target_role) 
             VALUES (?, 1, 'admin')`,
            [`🚨 Vendor of "${shop.name}" raised a dispute on Order #${order.id}. Reason: ${reason_code}.`]
        );

        res.json({ message: "Dispute raised successfully! Super Admin will review." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10f. Simulate Order Return (Deduction Flow)
router.post('/orders/:id/simulate-return', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const order = await queryGet("SELECT * FROM orders WHERE id = ? AND shop_id = ?", [req.params.id, shop.id]);
        if (!order) return res.status(404).json({ error: "Order not found." });

        if (order.status !== 'delivered') {
            return res.status(400).json({ error: "Only delivered orders are eligible for return." });
        }

        // Return Eligibility Deadline check: 7 days post-delivery
        const deliveredDate = new Date(order.delivered_at);
        const daysDiff = (new Date() - deliveredDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > 7) {
            return res.status(400).json({ error: "Return period locked! Order delivered more than 7 days ago." });
        }

        const rateRow = await queryGet("SELECT commission_rate FROM shops WHERE id = ?", [shop.id]);
        const commissionRate = (rateRow && rateRow.commission_rate !== undefined) ? rateRow.commission_rate : 5;
        const vendorEarnings = Math.round(order.total * (1 - commissionRate / 100));

        // Deduct from available balance (can go negative as requested)
        await queryRun(
            `UPDATE vendor_wallets 
             SET available_balance = available_balance - ?, 
                 total_balance = total_balance - ? 
             WHERE shop_id = ?`,
            [vendorEarnings, vendorEarnings, shop.id]
        );

        // Update order returned state
        await queryRun(
            "UPDATE orders SET returned_or_replaced = 'returned', wallet_status = 'returned' WHERE id = ?",
            [order.id]
        );

        // Log transaction debit
        await queryRun(
            `INSERT INTO wallet_transactions (shop_id, order_id, type, amount, category, description) 
             VALUES (?, ?, 'debit', ?, 'return_deduction', ?)`,
            [shop.id, order.id, vendorEarnings, 'return_deduction', `Return deduction for Order #${order.id}. Reason: Customer requested refund.`]
        );

        // Log in return registry
        await queryRun(
            `INSERT INTO vendor_returns_replacements (shop_id, order_id, type, reason, amount, status, resolved_at) 
             VALUES (?, ?, 'return', ?, ?, 'approved', CURRENT_TIMESTAMP)`,
            [shop.id, order.id, req.body.reason || 'Customer Refund', vendorEarnings]
        );

        // Send alert notification
        await queryRun(
            `INSERT INTO notifications (message, is_important, target_role, target_shop_id) 
             VALUES (?, 1, 'vendor', ?)`,
            [`⚠️ Return Processed: ₹${vendorEarnings} has been deducted from your wallet for Order #${order.id}.`, shop.id]
        );

        res.json({ message: "Order return simulated successfully! Wallet balances updated." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10g. Simulate Order Replacement (Adjustment Flow)
router.post('/orders/:id/simulate-replacement', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        const order = await queryGet("SELECT * FROM orders WHERE id = ? AND shop_id = ?", [req.params.id, shop.id]);
        if (!order) return res.status(404).json({ error: "Order not found." });

        if (order.status !== 'delivered') {
            return res.status(400).json({ error: "Only delivered orders are eligible for replacement." });
        }

        // Return Eligibility Deadline check: 7 days post-delivery
        const deliveredDate = new Date(order.delivered_at);
        const daysDiff = (new Date() - deliveredDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > 7) {
            return res.status(400).json({ error: "Replacement period locked! Order delivered more than 7 days ago." });
        }

        // Price difference: positive if vendor earns more (credit), negative if vendor loses money (debit)
        const priceDiff = parseInt(req.body.price_difference, 10) || 0; 
        const rateRow = await queryGet("SELECT commission_rate FROM shops WHERE id = ?", [shop.id]);
        const commissionRate = (rateRow && rateRow.commission_rate !== undefined) ? rateRow.commission_rate : 5;
        
        let adjustment = 0;
        if (priceDiff !== 0) {
            adjustment = Math.round(priceDiff * (1 - commissionRate / 100));
            
            // Adjust balances
            await queryRun(
                `UPDATE vendor_wallets 
                 SET available_balance = available_balance + ?, 
                     total_balance = total_balance + ? 
                 WHERE shop_id = ?`,
                [adjustment, adjustment, shop.id]
            );

            // Log transaction adjustment
            const txType = adjustment > 0 ? 'credit' : 'debit';
            const category = 'adjustment';
            const absAmt = Math.abs(adjustment);
            await queryRun(
                `INSERT INTO wallet_transactions (shop_id, order_id, type, amount, category, description) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [shop.id, order.id, txType, absAmt, category, `Price adjustment for replacement Order #${order.id}. Diff: ₹${adjustment}.`]
            );
        }

        // Update order state
        await queryRun(
            "UPDATE orders SET returned_or_replaced = 'replaced' WHERE id = ?",
            [order.id]
        );

        // Log replacement details
        await queryRun(
            `INSERT INTO vendor_returns_replacements (shop_id, order_id, type, reason, amount, status, resolved_at) 
             VALUES (?, ?, 'replacement', ?, ?, 'approved', CURRENT_TIMESTAMP)`,
            [shop.id, order.id, req.body.reason || 'Product Swap', adjustment]
        );

        // Send alert notification
        await queryRun(
            `INSERT INTO notifications (message, is_important, target_role, target_shop_id) 
             VALUES (?, 0, 'vendor', ?)`,
            [`🔄 Replacement Processed: Order #${order.id} replaced. Wallet adjustment of ₹${adjustment} applied.`, shop.id]
        );

        res.json({ message: "Order replacement simulated successfully!", adjustment });
    } catch (err) {
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
        const shop = await getVendorShop(req.vendorId);
        const shopId = shop ? shop.id : null;

        let sql = "SELECT * FROM notifications WHERE (target_role = 'vendor' OR target_role = 'all') AND (target_shop_id IS NULL OR target_shop_id = ?)";
        let params = [shopId];
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
