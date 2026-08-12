const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { generateToken, verifyToken } = require('../tokenHelper');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

// Ensure users table has role column
db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'", (err) => {
    // Column might already exist, which is fine
});

// Password Hashing Helpers
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return hash === verifyHash;
}

// Basic Auth Endpoints
router.post('/register', async (req, res) => {
    const { full_name, phone, password, security_q1, security_a1, security_q2, security_a2, role } = req.body;
    
    if (!full_name || !phone || !password || !security_q1 || !security_a1 || !security_q2 || !security_a2) {
        return res.status(400).json({ error: "All fields including security questions are required." });
    }

    const assignedRole = role === 'vendor' ? 'vendor' : 'customer';
    const hashedPassword = hashPassword(password);
    const lowercaseA1 = security_a1.toLowerCase().trim();
    const lowercaseA2 = security_a2.toLowerCase().trim();

    // Check if user already exists
    db.get("SELECT id FROM users WHERE phone = ? OR username = ?", [phone, phone], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user) return res.status(400).json({ error: "Mobile number already registered." });

        // Insert new user
        db.run(`INSERT INTO users (username, password, full_name, phone, role, security_q1, security_a1, security_q2, security_a2, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [phone, hashedPassword, full_name, phone, assignedRole, security_q1, lowercaseA1, security_q2, lowercaseA2, 'active'],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                const insertedId = this.lastID.toString();

                const token = generateToken({ user_id: insertedId, username: phone, role: assignedRole });
                if (assignedRole === 'vendor') {
                    res.cookie('vendor_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, path: '/' });
                    res.clearCookie('admin_token', { path: '/' });
                    res.clearCookie('customer_token', { path: '/' });
                } else {
                    res.cookie('customer_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, path: '/' });
                    res.clearCookie('admin_token', { path: '/' });
                    res.clearCookie('vendor_token', { path: '/' });
                }

                res.cookie('user_id', insertedId, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                res.cookie('username', phone, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                res.cookie('full_name', full_name, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                res.cookie('role', assignedRole, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });

                res.status(201).json({ 
                    id: insertedId, 
                    username: phone, 
                    full_name, 
                    role: assignedRole,
                    token: token
                });
            }
        );
    });
});

router.post('/recovery/initiate', async (req, res) => {
    const { name, phone } = req.body;
    
    db.get("SELECT full_name, security_q1, security_q2 FROM users WHERE phone = ?", [phone], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "Mobile number not found." });
        
        if (!name || user.full_name.toLowerCase().trim() !== name.toLowerCase().trim()) {
            return res.status(401).json({ error: "Name and Mobile Number combination is incorrect." });
        }
        
        if (!user.security_q1 || !user.security_q2) {
            return res.status(400).json({ error: "No security questions set for this account. Please contact support." });
        }
        
        res.json({ questions: [user.security_q1, user.security_q2] });
    });
});

router.post('/recovery/verify-answer', async (req, res) => {
    const { phone, questionIndex, answer } = req.body;
    const answerCol = questionIndex === 0 ? 'security_a1' : 'security_a2';
    
    db.get(`SELECT ${answerCol} FROM users WHERE phone = ?`, [phone], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found." });
        
        if (user[answerCol] === answer.toLowerCase().trim()) {
            res.json({ message: "Answer correct." });
        } else {
            res.status(401).json({ error: "Incorrect answer." });
        }
    });
});

router.post('/recovery/verify-all', async (req, res) => {
    const { phone, security_a1, security_a2 } = req.body;
    
    db.get("SELECT security_a1, security_a2 FROM users WHERE phone = ?", [phone], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found." });
        
        const isA1Correct = security_a1 && user.security_a1 === security_a1.toLowerCase().trim();
        const isA2Correct = security_a2 && user.security_a2 === security_a2.toLowerCase().trim();
        
        if (isA1Correct && isA2Correct) {
            res.json({ message: "Both answers correct." });
        } else {
            res.status(401).json({ error: "Incorrect security answers." });
        }
    });
});

router.post('/recovery/verify-and-login', async (req, res) => {
    const { phone, answer } = req.body;
    
    db.get("SELECT * FROM users WHERE phone = ?", [phone], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found." });
        
        if (user.status !== 'active') {
            return res.status(403).json({ error: "Account is inactive." });
        }

        const providedAnswer = answer.toLowerCase().trim();
        if ((user.security_a1 && user.security_a1 === providedAnswer) || 
            (user.security_a2 && user.security_a2 === providedAnswer)) {
            
            const userIdStr = user.id.toString();
            const userRole = user.role || 'customer';
            const token = generateToken({ user_id: userIdStr, username: user.username, role: userRole });

            if (userRole === 'vendor') {
                res.cookie('vendor_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, path: '/' });
                res.clearCookie('admin_token', { path: '/' });
                res.clearCookie('customer_token', { path: '/' });
            } else if (userRole === 'super_admin') {
                res.cookie('admin_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, path: '/' });
                res.clearCookie('vendor_token', { path: '/' });
                res.clearCookie('customer_token', { path: '/' });
            } else {
                res.cookie('customer_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, path: '/' });
                res.clearCookie('admin_token', { path: '/' });
                res.clearCookie('vendor_token', { path: '/' });
            }

            res.cookie('user_id', userIdStr, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
            res.cookie('username', user.username, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
            res.cookie('full_name', user.full_name, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
            res.cookie('role', userRole, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });

            res.json({ 
                message: "Login successful", 
                username: user.username, 
                full_name: user.full_name, 
                language: user.language,
                role: userRole,
                user_id: userIdStr,
                token: token
            });
        } else {
            res.status(401).json({ error: "Incorrect security answer." });
        }
    });
});

router.post('/reset-password', async (req, res) => {
    const { phone, password, security_a1, security_a2 } = req.body;

    db.get("SELECT id, security_a1, security_a2 FROM users WHERE phone = ?", [phone], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found." });
        
        const providedA1 = security_a1 ? security_a1.toLowerCase().trim() : null;
        const providedA2 = security_a2 ? security_a2.toLowerCase().trim() : null;

        const isA1Correct = providedA1 && user.security_a1 === providedA1;
        const isA2Correct = providedA2 && user.security_a2 === providedA2;

        if (!isA1Correct || !isA2Correct) {
            return res.status(401).json({ error: "Identity verification failed. Both security questions must be answered correctly." });
        }

        const newHashed = hashPassword(password);
        db.run("UPDATE users SET password = ? WHERE id = ?", [newHashed, user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Password reset successful!" });
        });
    });
});

router.post('/login', async (req, res) => {
    const { full_name, username, password } = req.body;
    
    if (!username || !password || !full_name) {
        return res.status(400).json({ error: "Full Name, Mobile Number and Password are required." });
    }

    const providedName = (full_name || '').toLowerCase().trim();

    // 1. Check admin_users table first
    db.get("SELECT * FROM admin_users WHERE phone = ?", [username], (err, adminUser) => {
        if (err) return res.status(500).json({ error: err.message });

        if (adminUser && verifyPassword(password, adminUser.password)) {
            const dbName = (adminUser.full_name || '').toLowerCase().trim();
            if (dbName === providedName) {
                const adminIdStr = adminUser.id.toString();
                const role = adminUser.role || 'super_admin';
                const token = generateToken({ user_id: adminIdStr, username: adminUser.phone, role: role });

                res.cookie('admin_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, path: '/' });
                res.clearCookie('vendor_token', { path: '/' });
                res.clearCookie('customer_token', { path: '/' });

                // Set standard cookies for frontend ease
                res.cookie('user_id', adminIdStr, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                res.cookie('username', adminUser.phone, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                res.cookie('full_name', adminUser.full_name, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                res.cookie('role', role, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });

                return res.json({
                    message: "Admin Login successful",
                    username: adminUser.phone,
                    full_name: adminUser.full_name,
                    is_admin: true,
                    role: role,
                    user_id: adminIdStr,
                    token: token
                });
            }
        }

        // 2. Check users table
        db.get("SELECT * FROM users WHERE phone = ? OR username = ?", [username, username], (err, userProfile) => {
            if (err) return res.status(500).json({ error: err.message });

            if (userProfile && verifyPassword(password, userProfile.password)) {
                const dbName = (userProfile.full_name || '').toLowerCase().trim();
                if (dbName === providedName) {
                    if (userProfile.status !== 'active') {
                        return res.status(403).json({ error: "Account is inactive. Please contact support." });
                    }

                    const userIdStr = userProfile.id.toString();
                    const role = userProfile.role || 'customer';
                    const token = generateToken({ user_id: userIdStr, username: userProfile.username, role: role });

                    if (role === 'vendor') {
                        res.cookie('vendor_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, path: '/' });
                        res.clearCookie('admin_token', { path: '/' });
                        res.clearCookie('customer_token', { path: '/' });
                    } else {
                        res.cookie('customer_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, path: '/' });
                        res.clearCookie('admin_token', { path: '/' });
                        res.clearCookie('vendor_token', { path: '/' });
                    }

                    res.cookie('user_id', userIdStr, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                    res.cookie('username', userProfile.username, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                    res.cookie('full_name', userProfile.full_name, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                    res.cookie('role', role, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });

                    return res.json({
                        message: "Login successful",
                        username: userProfile.username,
                        full_name: userProfile.full_name,
                        language: userProfile.language,
                        user_id: userIdStr,
                        role: role,
                        token: token,
                        is_admin: role === 'super_admin'
                    });
                }
            }

            return res.status(401).json({ error: "Invalid credentials or Name/Phone combination incorrect." });
        });
    });
});

router.post('/logout', (req, res) => {
    // Explicitly clear with path to ensure removal
    res.clearCookie('user_id', { path: '/' });
    res.clearCookie('username', { path: '/' });
    res.clearCookie('full_name', { path: '/' });
    res.clearCookie('role', { path: '/' });
    res.clearCookie('admin_token', { path: '/' });
    res.clearCookie('vendor_token', { path: '/' });
    res.clearCookie('customer_token', { path: '/' });
    res.json({ message: "Logged out" });
});

module.exports = { router, verifyPassword, hashPassword };
