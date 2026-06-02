const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const { hashPassword, verifyPassword } = require('./authRoute');

// Admin Auth Middleware
function checkAdminAuth(req, res, next) {
    if (req.cookies.admin_auth === 'true' || req.cookies.role === 'super_admin') {
        next();
    } else {
        res.status(401).json({ error: "Unauthorized. Admin access required." });
    }
}

router.get('/check-setup', async (req, res) => {
    res.json({ setupRequired: false });
});

router.post('/setup', async (req, res) => {
    const { full_name, phone, password, security_q1, security_a1, security_q2, security_a2 } = req.body;
    if (!full_name || !phone || !password || !security_q1 || !security_a1 || !security_q2 || !security_a2) {
        return res.status(400).json({ error: "All fields are required." });
    }
    
    const { count, error } = await supabase.from('admin_users').select('*', { count: 'exact', head: true });
    if (error) return res.status(500).json({ error: error.message });
    if (count > 0) return res.status(403).json({ error: "Admin already setup." });
    
    const pwdHash = hashPassword(password);
    const { error: insertError } = await supabase.from('admin_users').insert([{
        phone, full_name, password: pwdHash, security_q1, security_a1, security_q2, security_a2
    }]);

    if (insertError) return res.status(500).json({ error: "Failed to setup admin account" });
    res.cookie('admin_auth', 'true', { httpOnly: false, path: '/' });
    res.json({ message: "Admin account setup successfully." });
});

router.get('/check-session', async (req, res) => {
    const { count, error } = await supabase.from('admin_users').select('*', { count: 'exact', head: true });
    const exists = !error && count > 0;
    const authenticated = req.cookies.admin_auth === 'true';
    res.json({ authenticated, exists });
});

router.post('/login', async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required." });
    
    const { data: row, error } = await supabase.from('admin_users').select('*').limit(1).single();
    if (error || !row) return res.status(404).json({ error: "Admin account not found." });

    if (verifyPassword(password, row.password)) {
        res.cookie('admin_auth', 'true', { httpOnly: false, path: '/' });
        res.json({ message: "Admin authenticated successfully." });
    } else {
        res.status(401).json({ error: "Invalid password." });
    }
});

router.post('/recovery/initiate', async (req, res) => {
    const { name, phone } = req.body;
    const { data: user, error } = await supabase.from('admin_users').select('full_name, security_q1, security_q2').eq('phone', phone).single();
    
    if (error || !user) return res.status(404).json({ error: "Admin phone not found." });
    
    if (!name || user.full_name.toLowerCase().trim() !== name.toLowerCase().trim()) {
        return res.status(401).json({ error: "Name and Phone combination is incorrect." });
    }
    
    if (!user.security_q1 || !user.security_q2) {
        return res.status(400).json({ error: "No security questions set." });
    }
    
    res.json({ questions: [user.security_q1, user.security_q2] });
});

router.post('/verify-security', async (req, res) => {
    const { phone, q1, a1, q2, a2 } = req.body;
    const { data: row, error } = await supabase.from('admin_users').select('id, security_a1, security_a2, security_q1, security_q2').eq('phone', phone).single();
    if (error || !row) return res.status(401).json({ error: "Invalid security answers." });
    
    if (row.security_q1 === q1 && row.security_q2 === q2 && 
        row.security_a1.toLowerCase() === a1.toLowerCase().trim() && 
        row.security_a2.toLowerCase() === a2.toLowerCase().trim()) {
        res.json({ success: true, admin_id: row.id });
    } else {
        res.status(401).json({ error: "Invalid security answers." });
    }
});

router.patch('/reset-password', async (req, res) => {
    const { admin_id, newPassword } = req.body;
    if (!admin_id || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: "Invalid request." });
    }
    
    const hashedPwd = hashPassword(newPassword);
    const { error } = await supabase.from('admin_users').update({ password: hashedPwd }).eq('id', admin_id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Password reset successfully!" });
});

router.post('/logout', (req, res) => {
    res.clearCookie('admin_auth', { path: '/' });
    res.json({ message: "Admin logged out successfully." });
});

router.get('/dashboard/stats', async (req, res) => {
    const { date } = req.query;
    const stats = {
        totalOrders: 0,
        totalRevenue: 0,
        totalProducts: 0,
        totalReviews: 0,
        unreadInquiries: 0,
        ordersToday: 0,
        ordersDelivered: 0,
        lowStockAlerts: 0
    };

    const filterDate = date || new Date().toISOString().split('T')[0];
    const start = `${filterDate}T00:00:00.000Z`;
    const end = `${filterDate}T23:59:59.999Z`;

    try {
        const { count: orderCount, data: revenueData } = await supabase.from('orders').select('total', { count: 'exact' }).or('payment_method.eq.cash,payment_status.eq.paid');
        stats.totalOrders = orderCount || 0;
        stats.totalRevenue = revenueData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;

        const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
        stats.totalProducts = prodCount || 0;

        const { count: revCount } = await supabase.from('reviews').select('*', { count: 'exact', head: true });
        stats.totalReviews = revCount || 0;

        const { count: msgCount } = await supabase.from('support_messages').select('*', { count: 'exact', head: true }).eq('status', 'unread');
        stats.unreadInquiries = msgCount || 0;

        const { count: todayCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end);
        stats.ordersToday = todayCount || 0;

        const { count: delCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered');
        stats.ordersDelivered = delCount || 0;

        const { count: stockCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).lt('stock_quantity', 10);
        stats.lowStockAlerts = stockCount || 0;

        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Protect all below routes with admin auth
router.use(checkAdminAuth);

// Support Messages
router.get('/support-messages', async (req, res) => {
    const { date, search } = req.query;
    let query = supabase.from('support_messages').select('*');
    if (date) {
        const start = `${date}T00:00:00.000Z`;
        const end = `${date}T23:59:59.999Z`;
        query = query.gte('created_at', start).lte('created_at', end);
    }
    if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%,message.ilike.%${search}%`);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.get('/support-messages/:id', async (req, res) => {
    const { data, error } = await supabase.from('support_messages').select('*').eq('id', req.params.id).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.patch('/support-messages/:id/read', async (req, res) => {
    const { error } = await supabase.from('support_messages').update({ status: 'read' }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Message marked as read" });
});

router.patch('/support-messages/:id/reply', async (req, res) => {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: "Reply required." });
    const { error } = await supabase.from('support_messages').update({
        reply, status: 'replied', replied_at: new Date().toISOString()
    }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Reply sent successfully!" });
});

router.delete('/support-messages/:id', async (req, res) => {
    const { error } = await supabase.from('support_messages').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

// Notifications
router.post('/notifications', async (req, res) => {
    const { message, is_important } = req.body;
    const { error } = await supabase.from('notifications').insert([{ message, is_important: is_important ? 1 : 0 }]);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Notification sent!" });
});

router.get('/notifications/history', async (req, res) => {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.delete('/notifications/:id', async (req, res) => {
    const { error } = await supabase.from('notifications').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

router.delete('/notifications/history', async (req, res) => {
    const { error } = await supabase.from('notifications').delete().neq('id', 0);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Cleared" });
});

// Reviews
router.get('/reviews', async (req, res) => {
    const { date, search } = req.query;
    let query = supabase.from('reviews').select('*, products(name)');
    if (date) {
        const start = `${date}T00:00:00.000Z`;
        const end = `${date}T23:59:59.999Z`;
        query = query.gte('created_at', start).lte('created_at', end);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    
    let processed = data || [];
    if (search) {
        const s = search.toLowerCase();
        processed = processed.filter(r => r.comment?.toLowerCase().includes(s) || r.products?.name?.toLowerCase().includes(s));
    }
    res.json(processed);
});

router.delete('/reviews/:id', async (req, res) => {
    const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

// Settings
router.get('/settings', async (req, res) => {
    const { data, error } = await supabase.from('settings').select('*').limit(1).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.patch('/settings', async (req, res) => {
    const { error } = await supabase.from('settings').update(req.body).eq('id', 1);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Updated" });
});

// Loyalty Program Settings & Verification
router.get('/loyalty/check-schema', async (req, res) => {
    try {
        let missing = [];

        // Check users table
        const { data: userData, error: userErr } = await supabase.from('users').select('*').limit(1);
        if (userErr) {
            missing.push("users.coins");
        } else if (userData && userData.length > 0) {
            const userCols = Object.keys(userData[0]);
            if (!userCols.includes('coins')) missing.push("users.coins");
        } else {
            const { error: coinsSelectErr } = await supabase.from('users').select('coins').limit(1);
            if (coinsSelectErr) missing.push("users.coins");
        }

        // Check orders table
        const { data: orderData, error: orderErr } = await supabase.from('orders').select('*').limit(1);
        if (orderErr) {
            missing.push("orders.coins_earned");
            missing.push("orders.coins_used");
        } else if (orderData && orderData.length > 0) {
            const ordCols = Object.keys(orderData[0]);
            if (!ordCols.includes('coins_earned')) missing.push("orders.coins_earned");
            if (!ordCols.includes('coins_used')) missing.push("orders.coins_used");
        } else {
            const { error: coinsUsedErr } = await supabase.from('orders').select('coins_earned, coins_used').limit(1);
            if (coinsUsedErr) {
                missing.push("orders.coins_earned");
                missing.push("orders.coins_used");
            }
        }

        // Check settings table
        const { data: settingsData, error: settingsErr } = await supabase.from('settings').select('*').limit(1);
        if (settingsErr) {
            missing.push("settings.coins_system_active");
            missing.push("settings.coin_reward_rate");
            missing.push("settings.coin_reward_amount");
            missing.push("settings.coin_value_per_rupee");
        } else if (settingsData && settingsData.length > 0) {
            const setCols = Object.keys(settingsData[0]);
            const required = ['coins_system_active', 'coin_reward_rate', 'coin_reward_amount', 'coin_value_per_rupee'];
            required.forEach(c => {
                if (!setCols.includes(c)) missing.push(`settings.${c}`);
            });
        } else {
            const { error: settingsColsErr } = await supabase.from('settings').select('coins_system_active, coin_reward_rate, coin_reward_amount, coin_value_per_rupee').limit(1);
            if (settingsColsErr) {
                missing.push("settings.coins_system_active");
                missing.push("settings.coin_reward_rate");
                missing.push("settings.coin_reward_amount");
                missing.push("settings.coin_value_per_rupee");
            }
        }

        res.json({ success: true, missing });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/loyalty/stats', async (req, res) => {
    try {
        // Fetch coin settings
        const { data: settings } = await supabase.from('settings').select('coin_value_per_rupee').limit(1).single();
        const valuePerRupee = settings?.coin_value_per_rupee || 10;

        // 1. Coins in circulation
        const { data: users, error: userErr } = await supabase.from('users').select('coins');
        if (userErr) throw userErr;
        const totalCoins = users?.reduce((sum, u) => sum + (u.coins || 0), 0) || 0;

        // 2. Savings
        const { data: orders, error: orderErr } = await supabase.from('orders').select('coins_used');
        if (orderErr) throw orderErr;
        const totalCoinsUsed = orders?.reduce((sum, o) => sum + (o.coins_used || 0), 0) || 0;
        const totalSavings = Math.floor(totalCoinsUsed / valuePerRupee);

        // 3. Active Members (coins > 0)
        const activeMembers = users?.filter(u => (u.coins || 0) > 0).length || 0;

        res.json({
            success: true,
            totalCoins,
            totalSavings,
            activeMembers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/settings/payments', async (req, res) => {
    const { card, cash, upi } = req.body;
    const { error } = await supabase.from('settings').update({
        pay_card_active: card ? 1 : 0,
        pay_cash_active: cash ? 1 : 0,
        pay_upi_active: upi ? 1 : 0
    }).eq('id', 1);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Updated" });
});

// Admin Profile
router.get('/info', async (req, res) => {
    const { data, error } = await supabase.from('admin_users').select('full_name, phone').limit(1).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.patch('/security', async (req, res) => {
    const { newPassword, full_name, phone, security_q1, security_a1, security_q2, security_a2 } = req.body;
    const updateData = {};
    if (newPassword) updateData.password = hashPassword(newPassword);
    if (full_name) updateData.full_name = full_name;
    if (phone) updateData.phone = phone;
    if (security_q1) updateData.security_q1 = security_q1;
    if (security_a1) updateData.security_a1 = security_a1.toLowerCase().trim();
    if (security_q2) updateData.security_q2 = security_q2;
    if (security_a2) updateData.security_a2 = security_a2.toLowerCase().trim();

    const { error } = await supabase.from('admin_users').update(updateData).eq('id', 1);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Updated" });
});

// Orders
router.get('/orders', async (req, res) => {
    const { date, search } = req.query;
    let query = supabase.from('orders').select('*, users(username, full_name, email, phone)');
    if (date) {
        const start = `${date}T00:00:00.000Z`;
        const end = `${date}T23:59:59.999Z`;
        query = query.gte('created_at', start).lte('created_at', end);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    
    let processed = (data || []).filter(o => o.payment_method?.toLowerCase() === 'cash' || o.payment_status?.toLowerCase() === 'paid');
    
    if (search) {
        const s = search.toLowerCase();
        processed = processed.filter(o => 
            o.id.toString().includes(s) || 
            o.users?.full_name?.toLowerCase().includes(s) || 
            o.users?.phone?.includes(s)
        );
    }
    res.json(processed);
});

router.get('/orders/cancelled', async (req, res) => {
    const { date, search } = req.query;
    let query = supabase.from('orders').select('*, users(username, full_name, phone)').eq('status', 'cancelled');
    if (date) {
        const start = `${date}T00:00:00.000Z`;
        const end = `${date}T23:59:59.999Z`;
        query = query.gte('created_at', start).lte('created_at', end);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    
    let processed = data || [];
    if (search) {
        const s = search.toLowerCase();
        processed = processed.filter(o => o.id.toString().includes(s) || o.users?.full_name?.toLowerCase().includes(s));
    }
    res.json(processed);
});

router.patch('/orders/:id/status', async (req, res) => {
    const { error } = await supabase.from('orders').update({ status: req.body.status }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Updated" });
});

router.patch('/orders/:id/payment-status', async (req, res) => {
    const { status } = req.body;
    const updateData = { payment_status: status };
    if (status === 'received') updateData.status = 'received';
    const { error } = await supabase.from('orders').update(updateData).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Updated" });
});

router.delete('/orders/:id', async (req, res) => {
    const { error } = await supabase.from('orders').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

// Products
router.post('/products', async (req, res) => {
    const { data, error } = await supabase.from('products').insert([req.body]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Added", productId: data.id });
});

router.put('/products/:id', async (req, res) => {
    const { error } = await supabase.from('products').update(req.body).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Updated" });
});

router.delete('/products/:id', async (req, res) => {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

router.patch('/products/:id/:field', async (req, res) => {
    const { id, field } = req.params;
    const key = field === 'availability' ? 'is_available' : field === 'trending' ? 'is_trending' : 'is_daily_essential';
    const { error } = await supabase.from('products').update({ [key]: req.body[key] }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Updated" });
});

// Categories
router.post('/categories', async (req, res) => {
    const { data, error } = await supabase.from('categories').insert([req.body]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Added", category: data });
});

router.put('/categories/:id', async (req, res) => {
    const { error } = await supabase.from('categories').update(req.body).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Updated" });
});

router.delete('/categories/:id', async (req, res) => {
    const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

// Brands
router.get('/brands', async (req, res) => {
    const { data, error } = await supabase.from('brands').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/brands', async (req, res) => {
    const { data, error } = await supabase.from('brands').insert([req.body]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Added", brand: data });
});

router.delete('/brands/:id', async (req, res) => {
    const { error } = await supabase.from('brands').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

// Coupons
router.get('/coupons', async (req, res) => {
    const { data, error } = await supabase.from('coupons').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/coupons', async (req, res) => {
    const { error } = await supabase.from('coupons').insert([req.body]);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Added" });
});

router.delete('/coupons/:id', async (req, res) => {
    const { error } = await supabase.from('coupons').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

// Promo Banners
router.get('/promo-banners', async (req, res) => {
    const { data, error } = await supabase.from('promo_banners').select('*').order('displayOrder');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/promo-banners', async (req, res) => {
    const { error } = await supabase.from('promo_banners').insert([req.body]);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Added" });
});

router.delete('/promo-banners/:id', async (req, res) => {
    const { error } = await supabase.from('promo_banners').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

// Users
router.get('/users', async (req, res) => {
    const { search } = req.query;
    let query = supabase.from('users').select('*');
    if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,username.ilike.%${search}%`);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.patch('/users/:id/status', async (req, res) => {
    const { error } = await supabase.from('users').update({ status: req.body.status }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Updated" });
});

router.patch('/users/:id/role', async (req, res) => {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "Role value required." });
    if (!['customer', 'vendor', 'super_admin'].includes(role)) {
        return res.status(400).json({ error: "Invalid role value." });
    }

    try {
        const { error } = await supabase.from('users').update({ role }).eq('id', req.params.id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: `Role updated to ${role}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
});

// ==========================================================================
// SUPER ADMIN MULTI-VENDOR MARKETPLACE ENDPOINTS
// ==========================================================================

// 1. Fetch all Platform Feature Flags
router.get('/features', async (req, res) => {
    try {
        const { data, error } = await supabase.from('feature_flags').select('*').order('name');
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Toggle Feature Flag (ON/OFF)
router.patch('/features/:id', async (req, res) => {
    const { is_active } = req.body;
    if (is_active === undefined) return res.status(400).json({ error: "is_active state required." });

    try {
        const { data, error } = await supabase
            .from('feature_flags')
            .update({ is_active })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: "Feature flag toggled successfully!", feature: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Fetch all Vendor Shop Onboardings
router.get('/vendors', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('shops')
            .select('*, users(full_name, phone)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Onboard / Suspend Vendor Shop status
router.patch('/vendors/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Shop status value required." });

    try {
        const { data: shop, error: shopErr } = await supabase
            .from('shops')
            .update({ status })
            .eq('id', req.params.id)
            .select()
            .single();

        if (shopErr) throw shopErr;

        // If approved, verify the vendor user status as active too
        if (status === 'active' && shop.vendor_id) {
            await supabase.from('users').update({ status: 'active' }).eq('id', shop.vendor_id);
        }

        res.json({ message: `Vendor shop status updated to: ${status}`, shop });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. Create platform-wide or respected store Coupon
router.post('/coupons', async (req, res) => {
    const { code, discount_value, discount_type, min_amount, is_one_time, expiry_date, shop_id } = req.body;
    if (!code || !discount_value || !discount_type || !expiry_date) {
        return res.status(400).json({ error: "Missing required coupon details." });
    }

    try {
        const { data, error } = await supabase.from('coupons').insert([{
            code: code.toUpperCase(),
            discount_value: parseInt(discount_value) || 0,
            discount_type,
            min_amount: parseInt(min_amount) || 0,
            is_one_time: is_one_time ? 1 : 0,
            expiry_date,
            shop_id: shop_id || null // Link to respected shop storefront (or null for global)
        }]).select().single();

        if (error) throw error;
        res.status(201).json({ message: "Marketplace coupon distributed successfully!", coupon: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. Global Marketplace Metrics and Commission Analytics
router.get('/marketplace/analytics', async (req, res) => {
    try {
        const { data: shops } = await supabase.from('shops').select('id, name, status');
        const { data: wallets } = await supabase.from('vendor_wallets').select('*');
        const { data: orders } = await supabase.from('orders').select('id, total, status, created_at');

        const totalSales = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
        const totalCommission = Math.round(totalSales * 0.05); // 5% flat platform commission

        res.json({
            metrics: {
                totalSales,
                totalCommission,
                activeVendors: shops?.filter(s => s.status === 'active')?.length || 0,
                pendingVendors: shops?.filter(s => s.status === 'pending')?.length || 0,
            },
            wallets: wallets || [],
            recentTransactions: orders?.slice(0, 10) || []
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
