require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
// Supabase is initialized in individual route files via supabaseClient.js

const { initDb } = require('./db');
initDb();

// Middleware
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://adyanta.vercel.app',
    'https://adyanta.vercel.app/'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const cleanOrigin = origin.replace(/\/$/, '');
        const cleanEnvOrigin = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.replace(/\/$/, '') : null;
        
        const isLocalhost = cleanOrigin.startsWith('http://localhost:') || 
                            cleanOrigin.startsWith('http://127.0.0.1:') || 
                            cleanOrigin === 'http://localhost' || 
                            cleanOrigin === 'http://127.0.0.1';

        const isVercel = cleanOrigin.endsWith('.vercel.app') || cleanOrigin.includes('.vercel.app');
        const isRender = cleanOrigin === 'https://adyanta.onrender.com';

        const isAllowed = isLocalhost || 
                         isVercel ||
                         isRender ||
                         allowedOrigins.some(o => o.replace(/\/$/, '') === cleanOrigin) || 
                         (cleanEnvOrigin && cleanEnvOrigin === cleanOrigin);

        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS: ' + origin));
        }
    },
    credentials: true 
}));

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl || req.url} - ${res.statusCode} (${duration}ms)`);
    });
    if (req.method === 'POST' || req.method === 'PATCH') console.log('Body:', req.body);
    next();
});

// Import Routes
const { router: authRouter } = require('./routes/authRoute');
const productRouter = require('./routes/productRoute');
const adminRouter = require('./routes/adminRoute');
const indexRouter = require('./routes/indexRoute');
const userRouter = require('./routes/userRoute');
const vendorRouter = require('./routes/vendorRoute');

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);
app.use('/api/vendor', vendorRouter);
app.use('/api', indexRouter);

// Admin routes are now handled by adminRouter

// User Profile logic is now handled by userRouter at /api/user

// Static Files - Serve frontend
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// Health Check endpoint for uptime pingers
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'active', message: 'ADYANTA Backend API is running' });
});

// Fallback for SPA routing / backend health check
app.get('/', (req, res) => {
    res.status(200).json({ status: 'active', message: 'ADYANTA Backend API is running' });
});

// Schedule Auto-Settlement at Midnight (Auto-Settlement Daemon)
const { triggerAutoSettlement } = require('./walletHelper');
function scheduleMidnightSettlement() {
    const now = new Date();
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0); // Next midnight
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    console.log(`[Auto-Settlement] Daemon scheduled to run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at 12:00 AM).`);

    setTimeout(() => {
        triggerAutoSettlement()
            .then(res => console.log(`[Auto-Settlement] Success:`, res))
            .catch(err => console.error(`[Auto-Settlement] Error:`, err));

        setInterval(() => {
            triggerAutoSettlement()
                .then(res => console.log(`[Auto-Settlement] Success:`, res))
                .catch(err => console.error(`[Auto-Settlement] Error:`, err));
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
}
scheduleMidnightSettlement();

const server = app.listen(PORT, () => {
    console.log(`Professional API Server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('SERVER ERROR:', err);
    process.exit(1);
});
