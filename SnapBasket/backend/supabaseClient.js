require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Replace these with your Supabase URL and keys sent by the user
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const ws = require('ws');

// Use a dummy client if credentials are missing to prevent server crash
let supabase;
try {
    supabase = createClient(supabaseUrl, supabaseKey, {
        realtime: {
            transport: ws,
        },
    });
    console.log("Supabase Client initialized with WebSocket support.");
} catch (e) {
    console.warn("Supabase Client failed to initialize:", e.message);
    supabase = { from: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }) }) }) };
}

module.exports = { supabase };
