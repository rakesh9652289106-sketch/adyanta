const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');

router.get('/coupons', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .gte('expiry_date', `${today}T00:00:00.000Z`);
        
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/coupons/validate', async (req, res) => {
    const { code, subtotal } = req.body;
    const userId = req.cookies.user_id;

    try {
        if (!code) return res.status(400).json({ error: "Coupon code required" });

        const { data: coupon, error } = await supabase
            .from('coupons')
            .select('*')
            .ilike('code', code)
            .single();

        if (error || !coupon) {
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
            const { data: usage, error: usageError } = await supabase
                .from('coupon_usage')
                .select('id')
                .eq('user_id', userId)
                .eq('coupon_id', coupon.id)
                .limit(1);

            if (!usageError && usage && usage.length > 0) {
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
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.get('/brands', async (req, res) => {
    const { data, error } = await supabase.from('brands').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.get('/banners', async (req, res) => {
    const { data, error } = await supabase.from('banners').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.get('/promo-banners', async (req, res) => {
    const { data, error } = await supabase.from('promo_banners').select('*').order('displayOrder').limit(6);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.get('/special-offers', async (req, res) => {
    const { data, error } = await supabase.from('special_offers').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.get('/settings', async (req, res) => {
    const { data, error } = await supabase.from('settings').select('*').limit(1).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/support/messages', async (req, res) => {
    const userId = req.cookies.user_id || null;
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: "Missing fields" });

    const insertData = { name, email, subject: subject || 'No Subject', message, status: 'unread' };
    if (userId) insertData.user_id = userId;

    const { data, error } = await supabase.from('support_messages').insert([insertData]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Message sent!", messageId: data.id });
});

router.post('/reviews', async (req, res) => {
    const username = req.cookies.username;
    if (!username) return res.status(401).json({ error: "Login required" });

    const { product_id, rating, comment } = req.body;
    const { data, error } = await supabase.from('reviews').insert([{ product_id, username, rating, comment }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Review submitted!", reviewId: data.id });
});

router.get('/user-info', async (req, res) => {
    const userId = req.cookies.user_id;
    if (!userId) return res.status(401).json({ error: "Not logged in" });
    const { data, error } = await supabase.from('users').select('id, full_name').eq('id', userId).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/orders', async (req, res) => {
    const userId = req.cookies.user_id || null;
    let { items, paymentMethod, address, couponId, deliveryType } = req.body;

    const parsePrice = (p) => typeof p === 'number' ? p : parseFloat(p.toString().replace(/[^0-9.]/g, '')) || 0;
    let subtotal = items?.reduce((sum, item) => sum + (parsePrice(item.price) * (item.quantity || 1)), 0) || 0;
    let finalTotal = subtotal;

    if (couponId) {
        const { data: coupon } = await supabase.from('coupons').select('*').eq('id', couponId).single();
        if (coupon) {
            const discount = coupon.discount_type === 'percent' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
            finalTotal = Math.max(0, subtotal - discount);
        }
    }

    const insertData = {
        total: Math.round(finalTotal),
        items, payment_method: paymentMethod, address,
        discount_amount: Math.round(subtotal - finalTotal),
        coupon_id: couponId,
        delivery_type: deliveryType || 'Home Delivery',
        user_id: userId
    };

    const { data, error } = await supabase.from('orders').insert([insertData]).select().single();
    if (error) return res.status(500).json({ error: error.message });

    if (couponId && userId) {
        await supabase.from('coupon_usage').insert([{ user_id: userId, coupon_id: couponId }]);
    }

    res.status(201).json({ message: "Order placed!", orderId: data.id });
});

router.post('/orders/cancel', async (req, res) => {
    const { error } = await supabase.from('orders').update({ status: 'cancelled', payment_status: 'cancelled' }).eq('id', req.body.orderId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Order cancelled" });
});

router.get('/reviews/recent', async (req, res) => {
    const { data, error } = await supabase.from('reviews').select('*, products(name)').order('created_at', { ascending: false }).limit(6);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.get('/notifications/history', async (req, res) => {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

module.exports = router;
