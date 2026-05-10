const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const crypto = require('crypto');

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
    const { full_name, phone, password, security_q1, security_a1, security_q2, security_a2 } = req.body;
    
    if (!full_name || !phone || !password || !security_q1 || !security_a1 || !security_q2 || !security_a2) {
        return res.status(400).json({ error: "All fields including security questions are required." });
    }

    // 1. Sign up with Supabase Auth
    // Use phone-style email as a proxy for Supabase Auth
    const email = `${phone}@adyanta.com`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name,
                phone
            }
        }
    });

    if (authError) {
        console.error("Auth Registration error:", authError);
        return res.status(400).json({ error: authError.message });
    }

    // 2. Sync with public.users table for metadata/recovery
    const { data: userData, error: dbError } = await supabase.from('users').insert([{
        id: authData.user.id,
        username: phone, 
        full_name, 
        phone,
        security_q1, 
        security_a1: security_a1.toLowerCase(),
        security_q2, 
        security_a2: security_a2.toLowerCase()
    }]).select().single();

    if (dbError) {
        console.error("Profile sync error:", dbError);
    }

    const finalUser = userData || { id: authData.user.id, full_name, username: phone };

    res.cookie('user_id', finalUser.id, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
    res.cookie('username', phone, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
    res.cookie('full_name', finalUser.full_name, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
    
    res.status(201).json({ 
        id: finalUser.id, 
        username: phone, 
        full_name: finalUser.full_name, 
        token: authData.session?.access_token || finalUser.id 
    });
});

router.post('/recovery/initiate', async (req, res) => {
    const { name, phone } = req.body;
    const { data: user, error } = await supabase.from('users').select('full_name, security_q1, security_q2').eq('phone', phone).single();
    
    if (error || !user) return res.status(404).json({ error: "Mobile number not found." });
    
    if (!name || user.full_name.toLowerCase() !== name.toLowerCase()) {
        return res.status(401).json({ error: "Name and Mobile Number combination is incorrect." });
    }
    
    if (!user.security_q1 || !user.security_q2) {
        return res.status(400).json({ error: "No security questions set for this account. Please contact support." });
    }
    
    res.json({ questions: [user.security_q1, user.security_q2] });
});

router.post('/recovery/verify-answer', async (req, res) => {
    const { phone, questionIndex, answer } = req.body;
    const answerCol = questionIndex === 0 ? 'security_a1' : 'security_a2';
    
    const { data: user, error } = await supabase.from('users').select(answerCol).eq('phone', phone).single();
    if (error || !user) return res.status(404).json({ error: "User not found." });
    
    if (user[answerCol] === answer.toLowerCase()) {
        res.json({ message: "Answer correct." });
    } else {
        res.status(401).json({ error: "Incorrect answer." });
    }
});

router.post('/recovery/verify-all', async (req, res) => {
    const { phone, security_a1, security_a2 } = req.body;
    const { data: user, error } = await supabase.from('users').select('security_a1, security_a2').eq('phone', phone).single();
    
    if (error || !user) return res.status(404).json({ error: "User not found." });
    
    const isA1Correct = security_a1 && user.security_a1 === security_a1.toLowerCase().trim();
    const isA2Correct = security_a2 && user.security_a2 === security_a2.toLowerCase().trim();
    
    if (isA1Correct && isA2Correct) {
        res.json({ message: "Both answers correct." });
    } else {
        res.status(401).json({ error: "Incorrect security answers." });
    }
});


router.post('/recovery/verify-and-login', async (req, res) => {
    const { phone, answer } = req.body;
    const { data: user, error } = await supabase.from('users').select('*').eq('phone', phone).single();
    if (error || !user) return res.status(404).json({ error: "User not found." });
    
    if (user.status !== 'active') {
        return res.status(403).json({ error: "Account is inactive." });
    }

    const providedAnswer = answer.toLowerCase().trim();
    if ((user.security_a1 && user.security_a1 === providedAnswer) || 
        (user.security_a2 && user.security_a2 === providedAnswer)) {
        
        res.json({ 
            message: "Login successful", 
            username: user.username, 
            full_name: user.full_name, 
            language: user.language,
            token: user.id
        });
    } else {
        res.status(401).json({ error: "Incorrect security answer." });
    }
});

router.post('/reset-password', async (req, res) => {
    const { phone, password, security_a1, security_a2 } = req.body;

    const { data: user, error: dbError } = await supabase.from('users').select('id, security_a1, security_a2').eq('phone', phone).single();
    if (dbError || !user) return res.status(404).json({ error: "User not found." });
    
    const providedA1 = security_a1 ? security_a1.toLowerCase() : null;
    const providedA2 = security_a2 ? security_a2.toLowerCase() : null;

    const isA1Correct = providedA1 && user.security_a1 === providedA1;
    const isA2Correct = providedA2 && user.security_a2 === providedA2;

    if (!isA1Correct || !isA2Correct) {
        return res.status(401).json({ error: "Identity verification failed. Both security questions must be answered correctly." });
    }

    // Update password in Supabase Auth using the service role power
    const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
        password: password
    });
    
    if (authError) {
        console.error("Auth password reset error:", authError);
        return res.status(500).json({ error: "Password update failed: " + authError.message });
    }

    res.json({ message: "Password reset successful!" });
});

router.post('/login', async (req, res) => {
    const { full_name, username, password } = req.body;
    
    if (!username || !password || !full_name) {
        return res.status(400).json({ error: "Full Name, Mobile Number and Password are required." });
    }
    
    // 1. Attempt Supabase Auth Login
    const email = `${username}@adyanta.com`;
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (!authError && authData.user) {
        // 2. Fetch profile from public.users
        const { data: userProfile } = await supabase.from('users').select('*').eq('id', authData.user.id).single();
        
        if (userProfile) {
            const dbName = (userProfile.full_name || '').toLowerCase().trim();
            const providedName = (full_name || '').toLowerCase().trim();

            if (dbName === providedName) {
                if (userProfile.status !== 'active') {
                    return res.status(403).json({ error: "Account is inactive. Please contact support." });
                }

                res.cookie('user_id', userProfile.id, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                res.cookie('username', userProfile.username, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                res.cookie('full_name', userProfile.full_name, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
                
                return res.json({ 
                    message: "Login successful", 
                    username: userProfile.username, 
                    full_name: userProfile.full_name, 
                    language: userProfile.language,
                    user_id: userProfile.id,
                    token: authData.session.access_token,
                    is_admin: false
                });
            }
        }
    }

    // 3. Fallback to admin_users table (Legacy/Separate Admin)
    const { data: adminUser } = await supabase.from('admin_users').select('*').or(`phone.eq.${username}`).single();
    if (adminUser && verifyPassword(password, adminUser.password)) {
        const dbName = (adminUser.full_name || '').toLowerCase().trim();
        const providedName = (full_name || '').toLowerCase().trim();

        if (dbName === providedName) {
            res.cookie('admin_auth', 'true', { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
            res.cookie('user_id', adminUser.id, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
            res.cookie('username', adminUser.phone, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
            res.cookie('full_name', adminUser.full_name, { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });

            return res.json({
                message: "Admin Login successful",
                username: adminUser.phone,
                full_name: adminUser.full_name,
                is_admin: true,
                token: adminUser.id
            });
        }
    }

    return res.status(401).json({ error: "Invalid credentials or Name/Phone combination incorrect." });
});

router.post('/logout', (req, res) => {
    // Explicitly clear with path to ensure removal
    res.clearCookie('user_id', { path: '/' });
    res.clearCookie('username', { path: '/' });
    res.clearCookie('full_name', { path: '/' });
    res.json({ message: "Logged out" });
});

module.exports = { router, verifyPassword, hashPassword };
