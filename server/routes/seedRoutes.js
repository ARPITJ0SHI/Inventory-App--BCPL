const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Stock = require('../models/Stock');
const User = require('../models/User');
const Announcement = require('../models/Announcement');
const bcrypt = require('bcryptjs');

// Seed super_admin only (called on server startup if not exists)
const ensureSuperAdmin = async () => {
    try {
        const exists = await User.findOne({ role: 'super_admin' });
        if (!exists) {
            const salt = await bcrypt.genSalt(10);
            const password = await bcrypt.hash('Dsum@40778', salt);
            await new User({
                username: 'Superadmin',
                password,
                role: 'super_admin'
            }).save();
            console.log('Super admin created: Superadmin / Dsum@40778');
        }
    } catch (err) {
        console.error('Failed to seed super admin:', err);
    }
};

// Call on module load
ensureSuperAdmin();

// Full reset (dev only)
router.post('/reset', async (req, res) => {
    try {
        // Clear Orders, Stock, Announcements
        await Order.deleteMany({});
        await Stock.deleteMany({});
        await Announcement.deleteMany({});
        // Don't delete users - keep the super_admin

        // Seed Users (for testing)
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash('test123', salt);

        const users = [
            { username: 'khushal_user', role: 'khushal' },
            { username: 'factory_mgr', role: 'factory_manager' },
            { username: 'shop_mgr', role: 'shop_manager' }
        ];

        for (const u of users) {
            const exists = await User.findOne({ username: u.username });
            if (!exists) {
                await new User({ username: u.username, password, role: u.role }).save();
            }
        }

        // Locations (only Shop and Factory now)
        const locations = ['Shop', 'Factory'];
        const items = ['Mustard Oil', 'Refined Oil', 'Cake', 'Khal'];

        // Seed Stock
        for (const loc of locations) {
            const stockItems = items.map(name => ({
                name,
                quantity: Math.floor(Math.random() * 1000) + 50,
                unit: 'kg'
            }));
            await new Stock({ location: loc, items: stockItems }).save();
        }

        // Seed Orders
        const orders = [];
        for (let i = 0; i < 15; i++) {
            const isFactory = Math.random() > 0.5;
            const status = Math.random() > 0.4 ? 'completed' : 'pending';
            orders.push({
                location: isFactory ? 'Factory' : 'Shop',
                items: [
                    { name: 'Mustard Oil', quantity: Math.floor(Math.random() * 10) + 1, price: 1500 },
                    { name: 'Cake', quantity: Math.floor(Math.random() * 50) + 10, price: 800 }
                ],
                totalAmount: Math.floor(Math.random() * 50000) + 5000,
                status,
                images: [],
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000))
            });
        }
        await Order.insertMany(orders);

        // Seed Announcements
        const announcements = [
            { title: 'Welcome!', message: 'Welcome to the new stock management system. Please report any issues.' },
            { title: 'Maintenance', message: 'Scheduled maintenance this weekend. Please save your work.' }
        ];
        for (const a of announcements) {
            await new Announcement(a).save();
        }

        res.json({ message: 'Data reset and seeded successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Seed failed', error: err.message });
    }
});

module.exports = router;
