const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const compression = require('compression');
const helmet = require('helmet');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB URI from environment variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/balaji-app';

// Middleware
app.use(compression()); // Gzip compression for all responses
app.use(helmet()); // Security headers
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' })); // Increased for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection with optimized settings
mongoose.connect(MONGODB_URI, {
    maxPoolSize: 10, // Connection pool
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/authRoutes');
const stockRoutes = require('./routes/stockRoutes');
const priceListRoutes = require('./routes/priceListRoutes');
const orderRoutes = require('./routes/orderRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/pricelist', priceListRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/users', userRoutes);
app.use('/api/seed', require('./routes/seedRoutes'));

app.get('/', (req, res) => {
    res.send('Balaji App API is running');
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

