const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Middleware to check if user is logged in
const checkUserAuth = (req, res, next) => {
    const userId = req.cookies.user_id;
    if (!userId) {
        return res.status(401).json({ error: "Please log in to continue." });
    }
    req.userId = parseInt(userId, 10);
    next();
};

router.use(checkUserAuth);

// 1. Profile Details
router.get('/profile', (req, res) => {
    db.get("SELECT * FROM users WHERE id = ?", [req.userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "User not found." });
        delete row.password;
        res.json(row);
    });
});

router.put('/profile', (req, res) => {
    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.password;
    delete updateData.username;
    delete updateData.created_at;

    const keys = Object.keys(updateData);
    if (keys.length === 0) {
        return res.json({ message: "No fields to update." });
    }

    const setClause = keys.map(k => `${k} = ?`).join(", ");
    const values = Object.values(updateData);
    values.push(req.userId);

    db.run(`UPDATE users SET ${setClause} WHERE id = ?`, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Profile updated successfully" });
    });
});

// 2. Orders History
router.get('/orders', (req, res) => {
    db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// 3. Address Management
router.get('/addresses', (req, res) => {
    db.all("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC", [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

router.post('/addresses', (req, res) => {
    try {
        const addr = { ...req.body, user_id: req.userId };
        
        if (typeof addr.is_default === 'boolean') {
            addr.is_default = addr.is_default ? 1 : 0;
        } else {
            addr.is_default = parseInt(addr.is_default || 0, 10);
        }

        const proceedInsert = () => {
            db.run(`INSERT INTO addresses (user_id, label, address_line, city, pincode, is_default) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                [req.userId, addr.label, addr.address_line, addr.city, addr.pincode, addr.is_default],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    const insertedId = this.lastID;
                    db.get("SELECT * FROM addresses WHERE id = ?", [insertedId], (err, row) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.status(201).json(row);
                    });
                }
            );
        };

        if (addr.is_default === 1) {
            db.run("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [req.userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                proceedInsert();
            });
        } else {
            proceedInsert();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/addresses/:id/default', (req, res) => {
    const { id } = req.params;
    db.serialize(() => {
        db.run("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [req.userId]);
        db.run("UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?", [id, req.userId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Default address updated" });
        });
    });
});

router.delete('/addresses/:id', (req, res) => {
    db.run("DELETE FROM addresses WHERE id = ? AND user_id = ?", [req.params.id, req.userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Address deleted" });
    });
});

// 4. Wishlist
router.get('/wishlist', (req, res) => {
    const sql = `
        SELECT w.id as wishlist_id, w.product_id, p.* 
        FROM wishlist_items w 
        JOIN products p ON w.product_id = p.id 
        WHERE w.user_id = ?
    `;
    db.all(sql, [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Structure exact same as Supabase response format for frontend parsing
        const formatted = (rows || []).map(r => ({
            id: r.wishlist_id,
            product_id: r.product_id,
            products: {
                id: r.product_id,
                name: r.name,
                category: r.category,
                weight: r.weight,
                price: r.price,
                originalPrice: r.originalPrice,
                rating: r.rating,
                reviews: r.reviews,
                imgUrl: r.imgUrl,
                discount: r.discount,
                stock_quantity: r.stock_quantity,
                is_available: r.is_available,
                is_trending: r.is_trending,
                is_daily_essential: r.is_daily_essential,
                description: r.description,
                shop_id: r.shop_id,
                variants: r.variants
            }
        }));
        
        // The frontend code maps this format in profile-script.js
        res.json(formatted);
    });
});

router.post('/wishlist', (req, res) => {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: "Product ID required." });

    db.get("SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?", [req.userId, product_id], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing) return res.json({ message: "Already in wishlist" });

        db.run("INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)", [req.userId, product_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Added to wishlist" });
        });
    });
});

router.delete('/wishlist/:pid', (req, res) => {
    db.run("DELETE FROM wishlist_items WHERE product_id = ? AND user_id = ?", [req.params.pid, req.userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Removed from wishlist" });
    });
});

// 5. Inquiries & Activity
router.get('/inquiries', (req, res) => {
    db.all("SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at DESC", [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

router.get('/activity', (req, res) => {
    db.all("SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at DESC", [req.userId], (err, inquiries) => {
        if (err) return res.status(500).json({ error: err.message });

        const combined = [];
        (inquiries || []).forEach(i => {
            combined.push({
                ...i,
                type: 'support_inquiry',
                title: i.subject || 'Support Inquiry',
                message: i.message,
                date: i.created_at
            });

            if (i.reply) {
                combined.push({
                    ...i,
                    type: 'support_reply',
                    title: i.subject || 'Support Reply',
                    message: i.reply,
                    date: i.replied_at || i.created_at
                });
            }
        });

        combined.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(combined);
    });
});

router.get('/coupons', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.all("SELECT * FROM coupons WHERE expiry_date >= ?", [today], (err, coupons) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all("SELECT coupon_id FROM coupon_usage WHERE user_id = ?", [req.userId], (err, usage) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const usedIds = (usage || []).map(u => u.coupon_id);
            const processed = (coupons || []).map(c => ({
                ...c,
                used: usedIds.includes(c.id)
            }));
            
            res.json(processed);
        });
    });
});

router.get('/settings', (req, res) => {
    db.get("SELECT language, order_reminders, sms_permissions, flash_sale_alerts FROM users WHERE id = ?", [req.userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || {});
    });
});

router.patch('/settings', (req, res) => {
    const updateData = { ...req.body };
    const keys = Object.keys(updateData);
    if (keys.length === 0) return res.json({ message: "No settings to update" });

    const setClause = keys.map(k => `${k} = ?`).join(", ");
    const values = Object.values(updateData);
    values.push(req.userId);

    db.run(`UPDATE users SET ${setClause} WHERE id = ?`, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Settings updated" });
    });
});

module.exports = router;
