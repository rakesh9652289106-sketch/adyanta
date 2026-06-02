const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');

// Helper to verify Vendor authorization
async function requireVendor(req, res, next) {
    const userId = req.cookies.user_id;
    const userRole = req.cookies.role;
    if (!userId) return res.status(401).json({ error: "Access Denied: Please log in." });

    // Fetch user from DB to confirm role
    const { data: user, error } = await supabase.from('users').select('role').eq('id', userId).single();
    if (error || !user || user.role !== 'vendor') {
        return res.status(403).json({ error: "Access Denied: Vendor privileges required." });
    }
    req.vendorId = userId;
    next();
}

// A. Create Razorpay order for vendor onboarding fee
router.post('/create-registration-order', requireVendor, async (req, res) => {
    try {
        const { couponCode } = req.body;

        // Fetch settings config
        const { data: settings, error: sErr } = await supabase.from('settings').select('*').limit(1).single();
        if (sErr || !settings) {
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
        razorpay_payment_id, razorpay_order_id, razorpay_signature, couponCode
    } = req.body;

    if (!name || !contact_phone || !kyc_document) {
        return res.status(400).json({ error: "Shop Name, Contact Phone, and KYC verification document are required." });
    }

    try {
        // Fetch settings config to verify fee
        const { data: settings, error: sErr } = await supabase.from('settings').select('*').limit(1).single();
        if (sErr || !settings) {
            return res.status(500).json({ error: "Failed to fetch platform setup configurations." });
        }

        const baseFee = settings.vendor_fee_amount || 0;
        let discount = 0;
        let finalAmount = baseFee;

        if (couponCode && settings.vendor_fee_coupon && couponCode.trim().toLowerCase() === settings.vendor_fee_coupon.trim().toLowerCase()) {
            discount = settings.vendor_fee_discount || 0;
            finalAmount = Math.max(0, baseFee - discount);
        }

        let isPaidVal = false;
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

                isPaidVal = true;
                regFeeVal = baseFee;
                discAppliedVal = discount;
                rzpOrderVal = razorpay_order_id;
                rzpPaymentVal = razorpay_payment_id;
            } else {
                // Registration discounted to 0
                isPaidVal = true;
                regFeeVal = baseFee;
                discAppliedVal = discount; // 100% off
            }
        } else {
            // No payment required by platform globally
            isPaidVal = true;
        }

        // Insert new shop
        const { data: shop, error } = await supabase.from('shops').insert([{
            vendor_id: req.vendorId,
            name,
            logo: logo || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&h=150',
            banner: banner || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200',
            description: description || 'Fresh multi-vendor market shop.',
            timings: timings || '9:00 AM - 10:00 PM',
            category: category || 'General',
            contact_phone,
            kyc_document,
            status: 'pending', // Super admin needs to approve
            is_paid: isPaidVal,
            registration_fee: regFeeVal,
            discount_applied: discAppliedVal,
            razorpay_order_id: rzpOrderVal,
            razorpay_payment_id: rzpPaymentVal
        }]).select().single();

        if (error) throw error;

        // Initialize wallet for this shop
        await supabase.from('vendor_wallets').insert([{ shop_id: shop.id, balance: 0, revenue: 0 }]);

        res.status(201).json({ message: "Shop registration and setup fee payment completed! Pending Super Admin approval.", shop });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to get current vendor's shop
async function getVendorShop(vendorId) {
    const { data: shop } = await supabase.from('shops').select('*').eq('vendor_id', vendorId).single();
    return shop;
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

        const { name, logo, banner, description, timings, category, contact_phone } = req.body;
        const { data: updatedShop, error } = await supabase
            .from('shops')
            .update({ name, logo, banner, description, timings, category, contact_phone })
            .eq('id', shop.id)
            .select()
            .single();

        if (error) throw error;
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

        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('shop_id', shop.id)
            .order('id', { ascending: false });

        if (error) throw error;
        res.json(products || []);
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

        const { data: product, error } = await supabase.from('products').insert([{
            shop_id: shop.id,
            name,
            category,
            weight: weight || '1 unit',
            price: parseInt(price) || 0,
            originalprice: parseInt(originalprice) || parseInt(price),
            imgurl: imgurl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300',
            discount: discount || '0% OFF',
            stock_quantity: parseInt(stock_quantity) || 100,
            is_available: is_available !== undefined ? (is_available ? 1 : 0) : 1,
            is_trending: is_trending !== undefined ? (is_trending ? 1 : 0) : 0,
            is_daily_essential: is_daily_essential !== undefined ? (is_daily_essential ? 1 : 0) : 1,
            description: description || 'Fresh catalog item.',
            variants: variants || []
        }]).select().single();

        if (error) throw error;
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
        const { data: productCheck } = await supabase.from('products').select('shop_id').eq('id', req.params.id).single();
        if (!productCheck || productCheck.shop_id !== shop.id) {
            return res.status(403).json({ error: "Permission Denied: Product belongs to another shop." });
        }

        const { name, category, weight, price, originalprice, imgurl, discount, stock_quantity, is_available, is_trending, is_daily_essential, description, variants } = req.body;
        
        const updateFields = {};
        if (name !== undefined) updateFields.name = name;
        if (category !== undefined) updateFields.category = category;
        if (weight !== undefined) updateFields.weight = weight;
        if (price !== undefined) updateFields.price = parseInt(price) || 0;
        if (originalprice !== undefined) updateFields.originalprice = parseInt(originalprice) || 0;
        if (imgurl !== undefined) updateFields.imgurl = imgurl;
        if (discount !== undefined) updateFields.discount = discount;
        if (stock_quantity !== undefined) updateFields.stock_quantity = parseInt(stock_quantity) || 0;
        if (is_available !== undefined) updateFields.is_available = is_available ? 1 : 0;
        if (is_trending !== undefined) updateFields.is_trending = is_trending ? 1 : 0;
        if (is_daily_essential !== undefined) updateFields.is_daily_essential = is_daily_essential ? 1 : 0;
        if (description !== undefined) updateFields.description = description;
        if (variants !== undefined) updateFields.variants = variants;

        const { data: updatedProduct, error } = await supabase
            .from('products')
            .update(updateFields)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
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
        const { data: productCheck } = await supabase.from('products').select('shop_id').eq('id', req.params.id).single();
        if (!productCheck || productCheck.shop_id !== shop.id) {
            return res.status(403).json({ error: "Permission Denied: Product belongs to another shop." });
        }

        const { error } = await supabase.from('products').delete().eq('id', req.params.id);
        if (error) throw error;
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

        const { data: orders, error } = await supabase
            .from('orders')
            .select('*, users(full_name, phone)')
            .eq('shop_id', shop.id)
            .order('id', { ascending: false });

        if (error) throw error;
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
        const { data: order, error: orderErr } = await supabase.from('orders').select('*').eq('id', req.params.id).single();
        if (orderErr || !order || order.shop_id !== shop.id) {
            return res.status(403).json({ error: "Access Denied: Order belongs to another shop." });
        }

        const previousStatus = order.status;
        const { data: updatedOrder, error } = await supabase
            .from('orders')
            .update({ status: status, payment_status: status === 'cancelled' ? 'cancelled' : order.payment_status })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        // If order status changes to "delivered" (or accepted/completed), allocate earnings to vendor wallet!
        if (status === 'accepted' || status === 'delivered') {
            const { data: wallet } = await supabase.from('vendor_wallets').select('*').eq('shop_id', shop.id).single();
            if (wallet) {
                const commissionRate = 0.05; // 5% marketplace commission
                const vendorEarnings = Math.round(order.total * (1 - commissionRate));
                
                await supabase
                    .from('vendor_wallets')
                    .update({ 
                        balance: wallet.balance + vendorEarnings,
                        revenue: wallet.revenue + order.total
                    })
                    .eq('id', wallet.id);
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

        const { data: wallet, error } = await supabase
            .from('vendor_wallets')
            .select('*')
            .eq('shop_id', shop.id)
            .single();

        if (error) throw error;

        // Gather metrics: total orders count, pending orders count, active items count
        const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id);
        const { count: pendingOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'pending');
        const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id);

        res.json({
            wallet,
            metrics: {
                totalOrders: totalOrders || 0,
                pendingOrders: pendingOrders || 0,
                totalProducts: totalProducts || 0
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

        const { data, error } = await supabase
            .from('promo_banners')
            .select('*')
            .eq('shop_id', shop.id)
            .order('displayOrder');

        if (error) throw error;
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
        const { data, error } = await supabase
            .from('promo_banners')
            .insert([{
                shop_id: shop.id,
                imageUrl,
                linkUrl: linkUrl || '#',
                displayOrder: parseInt(displayOrder) || 0
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ message: "Promo banner added successfully!", banner: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/promo-banners/:id', requireVendor, async (req, res) => {
    try {
        const shop = await getVendorShop(req.vendorId);
        if (!shop) return res.status(404).json({ error: "Shop profile not found." });

        // Ensure banner belongs to this shop
        const { data: bannerCheck, error: checkErr } = await supabase
            .from('promo_banners')
            .select('shop_id')
            .eq('id', req.params.id)
            .single();

        if (checkErr || !bannerCheck || bannerCheck.shop_id !== shop.id) {
            return res.status(403).json({ error: "Access Denied: Promo banner belongs to another shop." });
        }

        const { error } = await supabase.from('promo_banners').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: "Promo banner deleted successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
