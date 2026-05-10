require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
// Supabase is initialized in individual route files via supabaseClient.js

// Middleware
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://adyanta.vercel.app',
    'https://adyanta.vercel.app/'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const cleanOrigin = origin.replace(/\/$/, '');
        const cleanEnvOrigin = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.replace(/\/$/, '') : null;
        
        const isAllowed = allowedOrigins.some(o => o.replace(/\/$/, '') === cleanOrigin) || 
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
    console.log(`${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PATCH') console.log('Body:', req.body);
    next();
});

// Import Routes
const { router: authRouter } = require('./routes/authRoute');
const productRouter = require('./routes/productRoute');
const adminRouter = require('./routes/adminRoute');
const indexRouter = require('./routes/indexRoute');
const userRouter = require('./routes/userRoute');

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);
app.use('/api', indexRouter);

// Admin routes are now handled by adminRouter

// User Profile logic is now handled by userRouter at /api/user

// Static Files - Serve frontend
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback for SPA routing if needed (optional)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`Professional API Server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('SERVER ERROR:', err);
    process.exit(1);
});
