const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { hashPassword, verifyPassword } = require('./authRoute');

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

// Admin Auth Middleware
function checkAdminAuth(req, res, next) {
    const isSuperAdmin = (req.cookies.admin_auth === 'true' || req.cookies.role === 'super_admin') && req.cookies.username === '9490229108';
    if (isSuperAdmin) {
        next();
    } else {
        res.status(403).json({ error: "Forbidden. Only Suresh is authorized to access Super Admin features." });
    }
}

router.get('/check-setup', async (req, res) => {
    try {
        const row = await queryGet("SELECT COUNT(*) as count FROM admin_users");
        const setupRequired = !row || row.count === 0;
        res.json({ setupRequired });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/setup', async (req, res) => {
    const { full_name, phone, password, security_q1, security_a1, security_q2, security_a2 } = req.body;
    if (!full_name || !phone || !password || !security_q1 || !security_a1 || !security_q2 || !security_a2) {
        return res.status(400).json({ error: "All fields are required." });
    }
    
    try {
        const row = await queryGet("SELECT COUNT(*) as count FROM admin_users");
        if (row && row.count > 0) {
            return res.status(403).json({ error: "Admin already setup." });
        }
        
        const pwdHash = hashPassword(password);
        await queryRun(
            `INSERT INTO admin_users (phone, full_name, password, security_q1, security_a1, security_q2, security_a2)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [phone, full_name, pwdHash, security_q1, security_a1.toLowerCase().trim(), security_q2, security_a2.toLowerCase().trim()]
        );

        res.cookie('admin_auth', 'true', { httpOnly: false, path: '/' });
        res.json({ message: "Admin account setup successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/check-session', async (req, res) => {
    try {
        const row = await queryGet("SELECT COUNT(*) as count FROM admin_users");
        const exists = row && row.count > 0;
        const authenticated = req.cookies.admin_auth === 'true';
        res.json({ authenticated, exists });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required." });
    
    try {
        const row = await queryGet("SELECT * FROM admin_users LIMIT 1");
        if (!row) return res.status(404).json({ error: "Admin account not found." });

        if (verifyPassword(password, row.password)) {
            res.cookie('admin_auth', 'true', { httpOnly: false, path: '/' });
            res.json({ message: "Admin authenticated successfully." });
        } else {
            res.status(401).json({ error: "Invalid password." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/recovery/initiate', async (req, res) => {
    const { name, phone } = req.body;
    try {
        const user = await queryGet("SELECT full_name, security_q1, security_q2 FROM admin_users WHERE phone = ?", [phone]);
        if (!user) return res.status(404).json({ error: "Admin phone not found." });
        
        if (!name || user.full_name.toLowerCase().trim() !== name.toLowerCase().trim()) {
            return res.status(401).json({ error: "Name and Phone combination is incorrect." });
        }
        
        if (!user.security_q1 || !user.security_q2) {
            return res.status(400).json({ error: "No security questions set." });
        }
        
        res.json({ questions: [user.security_q1, user.security_q2] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/verify-security', async (req, res) => {
    const { phone, q1, a1, q2, a2 } = req.body;
    try {
        const row = await queryGet("SELECT id, security_a1, security_a2, security_q1, security_q2 FROM admin_users WHERE phone = ?", [phone]);
        if (!row) return res.status(401).json({ error: "Invalid security answers." });
        
        if (row.security_q1 === q1 && row.security_q2 === q2 && 
            row.security_a1.toLowerCase() === a1.toLowerCase().trim() && 
            row.security_a2.toLowerCase() === a2.toLowerCase().trim()) {
            res.json({ success: true, admin_id: row.id });
        } else {
            res.status(401).json({ error: "Invalid security answers." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/reset-password', async (req, res) => {
    const { admin_id, newPassword } = req.body;
    if (!admin_id || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: "Invalid request." });
    }
    
    try {
        const hashedPwd = hashPassword(newPassword);
        await queryRun("UPDATE admin_users SET password = ? WHERE id = ?", [hashedPwd, admin_id]);
        res.json({ message: "Password reset successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
    const start = `${filterDate} 00:00:00`;
    const end = `${filterDate} 23:59:59`;

    try {
        // total orders and total revenue
        const orderStats = await queryGet(
            `SELECT COUNT(*) as count, SUM(total) as revenue 
             FROM orders 
             WHERE payment_method = 'cash' OR payment_status = 'paid'`
        );
        stats.totalOrders = orderStats ? orderStats.count : 0;
        stats.totalRevenue = orderStats ? (orderStats.revenue || 0) : 0;

        // total products
        const productsCountRow = await queryGet("SELECT COUNT(*) as count FROM products");
        stats.totalProducts = productsCountRow ? productsCountRow.count : 0;

        // total reviews
        const reviewsCountRow = await queryGet("SELECT COUNT(*) as count FROM reviews");
        stats.totalReviews = reviewsCountRow ? reviewsCountRow.count : 0;

        // unread support messages
        const msgCountRow = await queryGet("SELECT COUNT(*) as count FROM support_messages WHERE status = 'unread'");
        stats.unreadInquiries = msgCountRow ? msgCountRow.count : 0;

        // orders today
        const ordersTodayRow = await queryGet(
            "SELECT COUNT(*) as count FROM orders WHERE datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?)",
            [start, end]
        );
        stats.ordersToday = ordersTodayRow ? ordersTodayRow.count : 0;

        // orders delivered
        const ordersDeliveredRow = await queryGet("SELECT COUNT(*) as count FROM orders WHERE status = 'delivered'");
        stats.ordersDelivered = ordersDeliveredRow ? ordersDeliveredRow.count : 0;

        // low stock alerts
        const lowStockRow = await queryGet("SELECT COUNT(*) as count FROM products WHERE stock_quantity < 10");
        stats.lowStockAlerts = lowStockRow ? lowStockRow.count : 0;

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
    try {
        let sql = "SELECT * FROM support_messages WHERE 1=1";
        let params = [];
        if (date) {
            sql += " AND datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?)";
            params.push(`${date} 00:00:00`, `${date} 23:59:59`);
        }
        if (search) {
            sql += " AND (name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += " ORDER BY created_at DESC";
        const data = await queryAll(sql, params);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/support-messages/:id', async (req, res) => {
    try {
        const data = await queryGet("SELECT * FROM support_messages WHERE id = ?", [req.params.id]);
        if (!data) return res.status(404).json({ error: "Not found" });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/support-messages/:id/read', async (req, res) => {
    try {
        await queryRun("UPDATE support_messages SET status = 'read' WHERE id = ?", [req.params.id]);
        res.json({ message: "Message marked as read" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/support-messages/:id/reply', async (req, res) => {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: "Reply required." });
    try {
        await queryRun(
            "UPDATE support_messages SET reply = ?, status = 'replied', replied_at = CURRENT_TIMESTAMP WHERE id = ?",
            [reply, req.params.id]
        );
        res.json({ message: "Reply sent successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/support-messages/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM support_messages WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Notifications
router.post('/notifications', async (req, res) => {
    const { message, is_important, target_role } = req.body;
    try {
        await queryRun(
            "INSERT INTO notifications (message, is_important, target_role) VALUES (?, ?, ?)",
            [message, is_important ? 1 : 0, target_role || 'all']
        );
        res.status(201).json({ message: "Notification sent!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/notifications/history', async (req, res) => {
    try {
        const data = await queryAll("SELECT * FROM notifications ORDER BY created_at DESC");
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/notifications/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM notifications WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/notifications/history', async (req, res) => {
    try {
        await queryRun("DELETE FROM notifications");
        res.json({ message: "Cleared" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reviews
router.get('/reviews', async (req, res) => {
    const { date, search } = req.query;
    try {
        let sql = `
            SELECT r.*, p.name as product_name
            FROM reviews r
            LEFT JOIN products p ON r.product_id = p.id
            WHERE 1=1
        `;
        let params = [];
        if (date) {
            sql += " AND datetime(r.created_at) >= datetime(?) AND datetime(r.created_at) <= datetime(?)";
            params.push(`${date} 00:00:00`, `${date} 23:59:59`);
        }
        sql += " ORDER BY r.created_at DESC";
        const rows = await queryAll(sql, params);
        
        let processed = rows.map(r => ({
            ...r,
            products: r.product_name ? { name: r.product_name } : null
        }));

        if (search) {
            const s = search.toLowerCase();
            processed = processed.filter(r => r.comment?.toLowerCase().includes(s) || r.products?.name?.toLowerCase().includes(s));
        }
        res.json(processed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/reviews/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM reviews WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Settings
router.get('/settings', async (req, res) => {
    try {
        const data = await queryGet("SELECT * FROM settings LIMIT 1");
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/settings', async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.id;
        const keys = Object.keys(updateData);
        if (keys.length > 0) {
            const setClause = keys.map(k => `${k} = ?`).join(", ");
            const values = Object.values(updateData);
            values.push(1);
            await queryRun(`UPDATE settings SET ${setClause} WHERE id = ?`, values);
        }
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Loyalty Program Settings & Verification
router.get('/loyalty/check-schema', async (req, res) => {
    try {
        let missing = [];

        // Check users table columns
        const usersTableInfo = await queryAll("PRAGMA table_info(users)");
        const userCols = usersTableInfo.map(c => c.name);
        if (!userCols.includes('coins')) missing.push("users.coins");

        // Check orders table columns
        const ordersTableInfo = await queryAll("PRAGMA table_info(orders)");
        const ordCols = ordersTableInfo.map(c => c.name);
        if (!ordCols.includes('coins_earned')) missing.push("orders.coins_earned");
        if (!ordCols.includes('coins_used')) missing.push("orders.coins_used");

        // Check settings table columns
        const settingsTableInfo = await queryAll("PRAGMA table_info(settings)");
        const setCols = settingsTableInfo.map(c => c.name);
        const required = ['coins_system_active', 'coin_reward_rate', 'coin_reward_amount', 'coin_value_per_rupee'];
        required.forEach(c => {
            if (!setCols.includes(c)) missing.push(`settings.${c}`);
        });

        res.json({ success: true, missing });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/loyalty/stats', async (req, res) => {
    try {
        // Fetch coin settings
        const settings = await queryGet("SELECT coin_value_per_rupee FROM settings LIMIT 1");
        const valuePerRupee = settings?.coin_value_per_rupee || 10;

        // 1. Coins in circulation
        const circulationRow = await queryGet("SELECT SUM(coins) as total FROM users");
        const totalCoins = circulationRow ? (circulationRow.total || 0) : 0;

        // 2. Savings
        const savingsRow = await queryGet("SELECT SUM(coins_used) as total FROM orders");
        const totalCoinsUsed = savingsRow ? (savingsRow.total || 0) : 0;
        const totalSavings = Math.floor(totalCoinsUsed / valuePerRupee);

        // 3. Active Members (coins > 0)
        const activeRow = await queryGet("SELECT COUNT(*) as count FROM users WHERE coins > 0");
        const activeMembers = activeRow ? activeRow.count : 0;

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
    try {
        await queryRun(
            "UPDATE settings SET pay_card_active = ?, pay_cash_active = ?, pay_upi_active = ? WHERE id = 1",
            [card ? 1 : 0, cash ? 1 : 0, upi ? 1 : 0]
        );
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Profile
router.get('/info', async (req, res) => {
    try {
        const data = await queryGet("SELECT full_name, phone FROM admin_users LIMIT 1");
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/security', async (req, res) => {
    const { newPassword, full_name, phone, security_q1, security_a1, security_q2, security_a2 } = req.body;
    try {
        const updateData = {};
        if (newPassword) updateData.password = hashPassword(newPassword);
        if (full_name) updateData.full_name = full_name;
        if (phone) updateData.phone = phone;
        if (security_q1) updateData.security_q1 = security_q1;
        if (security_a1) updateData.security_a1 = security_a1.toLowerCase().trim();
        if (security_q2) updateData.security_q2 = security_q2;
        if (security_a2) updateData.security_a2 = security_a2.toLowerCase().trim();

        const keys = Object.keys(updateData);
        if (keys.length > 0) {
            const setClause = keys.map(k => `${k} = ?`).join(", ");
            const values = Object.values(updateData);
            values.push(1);
            await queryRun(`UPDATE admin_users SET ${setClause} WHERE id = ?`, values);
        }
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Orders
router.get('/orders', async (req, res) => {
    const { date, search } = req.query;
    try {
        let sql = `
            SELECT o.*, u.username as user_username, u.full_name as user_full_name, u.email as user_email, u.phone as user_phone, s.name as shop_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN shops s ON o.shop_id = s.id
            WHERE 1=1
        `;
        let params = [];
        if (date) {
            sql += " AND datetime(o.created_at) >= datetime(?) AND datetime(o.created_at) <= datetime(?)";
            params.push(`${date} 00:00:00`, `${date} 23:59:59`);
        }
        sql += " ORDER BY o.created_at DESC";
        const rows = await queryAll(sql, params);

        let processed = rows.map(r => {
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
                users: r.user_username ? {
                    username: r.user_username,
                    full_name: r.user_full_name,
                    email: r.user_email,
                    phone: r.user_phone
                } : null
            };
        });

        // Filter: only cash or paid orders
        processed = processed.filter(o => o.payment_method?.toLowerCase() === 'cash' || o.payment_status?.toLowerCase() === 'paid');

        if (search) {
            const s = search.toLowerCase();
            processed = processed.filter(o => 
                o.id.toString().includes(s) || 
                o.users?.full_name?.toLowerCase().includes(s) || 
                o.users?.phone?.includes(s)
            );
        }
        res.json(processed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/orders/cancelled', async (req, res) => {
    const { date, search } = req.query;
    try {
        let sql = `
            SELECT o.*, u.username as user_username, u.full_name as user_full_name, u.phone as user_phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.status = 'cancelled'
        `;
        let params = [];
        if (date) {
            sql += " AND datetime(o.created_at) >= datetime(?) AND datetime(o.created_at) <= datetime(?)";
            params.push(`${date} 00:00:00`, `${date} 23:59:59`);
        }
        sql += " ORDER BY o.created_at DESC";
        const rows = await queryAll(sql, params);

        let processed = rows.map(r => {
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
                users: r.user_username ? {
                    username: r.user_username,
                    full_name: r.user_full_name,
                    phone: r.user_phone
                } : null
            };
        });

        if (search) {
            const s = search.toLowerCase();
            processed = processed.filter(o => o.id.toString().includes(s) || o.users?.full_name?.toLowerCase().includes(s));
        }
        res.json(processed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/orders/:id/status', async (req, res) => {
    try {
        await queryRun("UPDATE orders SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/orders/:id/payment-status', async (req, res) => {
    const { status } = req.body;
    try {
        const updateFields = { payment_status: status };
        if (status === 'received') updateFields.status = 'received';
        
        const setClause = Object.keys(updateFields).map(k => `${k} = ?`).join(", ");
        const values = Object.values(updateFields);
        values.push(req.params.id);
        
        await queryRun(`UPDATE orders SET ${setClause} WHERE id = ?`, values);
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/orders/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM orders WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Products
router.post('/products', async (req, res) => {
    const { name, category, weight, price, originalprice, imgurl, discount, stock_quantity, is_available, is_trending, is_daily_essential, description, shop_id, variants } = req.body;
    try {
        const variantsStr = variants ? JSON.stringify(variants) : JSON.stringify([]);
        const result = await queryRun(
            `INSERT INTO products (name, category, weight, price, originalPrice, imgUrl, discount, stock_quantity, is_available, is_trending, is_daily_essential, description, shop_id, variants)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                category,
                weight || '1 unit',
                parseInt(price) || 0,
                parseInt(originalprice || price) || 0,
                imgurl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300',
                discount || '0% OFF',
                parseInt(stock_quantity) || 100,
                is_available !== undefined ? (is_available ? 1 : 0) : 1,
                is_trending !== undefined ? (is_trending ? 1 : 0) : 0,
                is_daily_essential !== undefined ? (is_daily_essential ? 1 : 0) : 1,
                description || '',
                parseInt(shop_id) || 1,
                variantsStr
            ]
        );
        res.status(201).json({ message: "Added", productId: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/products/:id', async (req, res) => {
    try {
        const updateFields = { ...req.body };
        delete updateFields.id;
        
        if (updateFields.originalprice !== undefined) {
            updateFields.originalPrice = updateFields.originalprice;
            delete updateFields.originalprice;
        }
        if (updateFields.imgurl !== undefined) {
            updateFields.imgUrl = updateFields.imgurl;
            delete updateFields.imgurl;
        }
        if (updateFields.variants !== undefined) {
            updateFields.variants = typeof updateFields.variants === 'string' ? updateFields.variants : JSON.stringify(updateFields.variants);
        }

        const keys = Object.keys(updateFields);
        if (keys.length > 0) {
            const setClause = keys.map(k => `${k} = ?`).join(", ");
            const values = Object.values(updateFields);
            values.push(req.params.id);
            await queryRun(`UPDATE products SET ${setClause} WHERE id = ?`, values);
        }
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/products/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM products WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/products/:id/:field', async (req, res) => {
    const { id, field } = req.params;
    const key = field === 'availability' ? 'is_available' : field === 'trending' ? 'is_trending' : 'is_daily_essential';
    try {
        const val = req.body[key] ? 1 : 0;
        await queryRun(`UPDATE products SET ${key} = ? WHERE id = ?`, [val, id]);
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Categories
router.post('/categories', async (req, res) => {
    const { name, iconUrl } = req.body;
    try {
        const result = await queryRun("INSERT INTO categories (name, iconUrl) VALUES (?, ?)", [name, iconUrl]);
        const newRow = await queryGet("SELECT * FROM categories WHERE id = ?", [result.lastID]);
        res.status(201).json({ message: "Added", category: newRow });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/categories/:id', async (req, res) => {
    const { name, iconUrl } = req.body;
    try {
        await queryRun("UPDATE categories SET name = ?, iconUrl = ? WHERE id = ?", [name, iconUrl, req.params.id]);
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM categories WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Brands
router.get('/brands', async (req, res) => {
    try {
        const data = await queryAll("SELECT * FROM brands ORDER BY name");
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/brands', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await queryRun("INSERT INTO brands (name) VALUES (?)", [name]);
        const newRow = await queryGet("SELECT * FROM brands WHERE id = ?", [result.lastID]);
        res.status(201).json({ message: "Added", brand: newRow });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/brands/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM brands WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Coupons
router.get('/coupons', async (req, res) => {
    try {
        const data = await queryAll("SELECT * FROM coupons");
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/coupons', async (req, res) => {
    const { code, discount_value, discount_type, min_amount, is_one_time, expiry_date, shop_id } = req.body;
    try {
        await queryRun(
            `INSERT INTO coupons (code, discount_value, discount_type, min_amount, is_one_time, expiry_date, shop_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                code.toUpperCase(),
                parseInt(discount_value) || 0,
                discount_type,
                parseInt(min_amount) || 0,
                is_one_time ? 1 : 0,
                expiry_date,
                shop_id || null
            ]
        );
        res.status(201).json({ message: "Added" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/coupons/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM coupons WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Promo Banners
router.get('/promo-banners', async (req, res) => {
    try {
        const data = await queryAll("SELECT * FROM promo_banners ORDER BY displayOrder");
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/promo-banners', async (req, res) => {
    const { imageUrl, linkUrl, displayOrder, shop_id } = req.body;
    try {
        await queryRun(
            "INSERT INTO promo_banners (imageUrl, linkUrl, displayOrder, shop_id) VALUES (?, ?, ?, ?)",
            [imageUrl, linkUrl || '#', parseInt(displayOrder) || 0, shop_id || null]
        );
        res.status(201).json({ message: "Added" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/promo-banners/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM promo_banners WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Users
router.get('/users', async (req, res) => {
    const { search } = req.query;
    try {
        let sql = "SELECT * FROM users";
        let params = [];
        if (search) {
            sql += " WHERE full_name LIKE ? OR phone LIKE ? OR username LIKE ?";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += " ORDER BY created_at DESC";
        const data = await queryAll(sql, params);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/users/:id/status', async (req, res) => {
    try {
        await queryRun("UPDATE users SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/users/:id/role', async (req, res) => {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "Role value required." });
    if (!['customer', 'vendor', 'super_admin'].includes(role)) {
        return res.status(400).json({ error: "Invalid role value." });
    }

    try {
        await queryRun("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
        res.json({ message: `Role updated to ${role}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        await queryRun("DELETE FROM users WHERE id = ?", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================================================
// SUPER ADMIN MULTI-VENDOR MARKETPLACE ENDPOINTS
// ==========================================================================

// 1. Fetch all Platform Feature Flags
router.get('/features', async (req, res) => {
    try {
        const data = await queryAll("SELECT * FROM feature_flags ORDER BY name");
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
        const val = is_active ? 1 : 0;
        await queryRun("UPDATE feature_flags SET is_active = ? WHERE id = ?", [val, req.params.id]);
        const updatedFeature = await queryGet("SELECT * FROM feature_flags WHERE id = ?", [req.params.id]);
        res.json({ message: "Feature flag toggled successfully!", feature: updatedFeature });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Fetch all Vendor Shop Onboardings
router.get('/vendors', async (req, res) => {
    try {
        const rows = await queryAll(
            `SELECT s.*, u.full_name as user_full_name, u.phone as user_phone
             FROM shops s
             LEFT JOIN users u ON s.vendor_id = u.id
             ORDER BY s.created_at DESC`
        );
        const data = rows.map(r => ({
            ...r,
            users: r.user_full_name ? {
                full_name: r.user_full_name,
                phone: r.user_phone
            } : null
        }));
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
        await queryRun("UPDATE shops SET status = ? WHERE id = ?", [status, req.params.id]);
        const shop = await queryGet("SELECT * FROM shops WHERE id = ?", [req.params.id]);

        // If approved, verify the vendor user status as active too
        if (status === 'active' && shop.vendor_id) {
            await queryRun("UPDATE users SET status = 'active' WHERE id = ?", [shop.vendor_id]);
        }

        res.json({ message: `Vendor shop status updated to: ${status}`, shop });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4b. Set custom commission rate for vendor shop
router.patch('/vendors/:id/commission', async (req, res) => {
    const { commission_rate } = req.body;
    if (commission_rate === undefined) return res.status(400).json({ error: "commission_rate percentage required." });

    try {
        await queryRun("UPDATE shops SET commission_rate = ? WHERE id = ?", [parseInt(commission_rate), req.params.id]);
        const shop = await queryGet("SELECT * FROM shops WHERE id = ?", [req.params.id]);
        res.json({ message: "Vendor commission rate updated successfully!", shop });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. Global Marketplace Metrics and Commission Analytics
router.get('/marketplace/analytics', async (req, res) => {
    try {
        const shops = await queryAll("SELECT id, name, status FROM shops");
        const wallets = await queryAll("SELECT * FROM vendor_wallets");
        const orders = await queryAll("SELECT id, total, status, created_at FROM orders");

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
