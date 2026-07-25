const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Get active coupons
router.get('/coupons/active', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.all("SELECT * FROM coupons WHERE expiry_date >= ?", [today], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Get all products (with search & category filters)
router.get('/', (req, res) => {
    const { search, category } = req.query;
    
    let sql = "SELECT * FROM products WHERE 1=1";
    let params = [];

    if (search) {
        sql += " AND (name LIKE ? OR description LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
        sql += " AND category = ?";
        params.push(category);
    }

    sql += " ORDER BY id DESC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Get Reviews for a specific product
router.get('/:id/reviews', (req, res) => {
    const { id } = req.params;
    db.all("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC", [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Get specific product by ID
router.get('/:id', (req, res) => {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });
    
    db.get("SELECT * FROM products WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Product not found" });
        res.json(row);
    });
});

// Get products by Category
router.get('/category/:categoryName', (req, res) => {
    const { categoryName } = req.params;
    const { shop_id } = req.query;
    let sql = "SELECT * FROM products";
    let params = [];
    let conditions = [];
    
    if (categoryName !== 'All') {
        conditions.push("category = ?");
        params.push(categoryName);
    }
    if (shop_id) {
        conditions.push("shop_id = ?");
        params.push(shop_id);
    }
    
    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    
    sql += " ORDER BY id DESC";
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

module.exports = router;
