const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Get all stocks (paginated, filtered by role)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { role } = req.user;
        const { page = 1, limit = 20 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 50); // Max 50 per page
        const skip = (pageNum - 1) * limitNum;

        let filter = {};

        // Role Logic
        if (role === 'factory_manager') filter = { location: { $in: ['Factory', 'Trade'] } };
        if (role === 'shop_manager') filter = { location: { $in: ['Shop', 'Godown'] } };
        // super_admin, viewer see all (empty filter)

        // Get total count
        const total = await Stock.countDocuments(filter);

        // Fetch paginated stocks
        const stocks = await Stock.find(filter)
            .skip(skip)
            .limit(limitNum)
            .lean();

        res.json({
            data: stocks,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
                hasMore: pageNum * limitNum < total
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Update or Create Stock (A & D can update all, B/C usually update their own via orders but maybe direct edit is requested?)
// Assuming direct edit for MVP for enabled roles.
// Update or Create Stock Item
router.post('/update', authMiddleware, async (req, res) => {
    const { location, itemName, quantity, unit } = req.body; // Added unit

    try {
        let stock = await Stock.findOne({ location });

        if (!stock) {
            stock = new Stock({ location, items: [] });
        }

        const itemIndex = stock.items.findIndex(i => i.name === itemName);
        if (itemIndex > -1) {
            stock.items[itemIndex].quantity = quantity;
            if (unit) stock.items[itemIndex].unit = unit; // Update unit if provided
        } else {
            stock.items.push({ name: itemName, quantity, unit: unit || 'kg' });
        }

        stock.lastUpdated = Date.now();
        await stock.save();

        res.json(stock);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Delete Stock Item
router.delete('/:location/:itemName', authMiddleware, async (req, res) => {
    const { location, itemName } = req.params;

    try {
        let stock = await Stock.findOne({ location });
        if (!stock) return res.status(404).json({ message: 'Location not found' });

        stock.items = stock.items.filter(i => i.name !== itemName);
        stock.lastUpdated = Date.now();
        await stock.save();

        res.json(stock);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Seed Initial Stocks (Helper)
router.post('/seed', async (req, res) => {
    try {
        const locations = ['Shop', 'Godown', 'Factory', 'Trade'];
        for (const loc of locations) {
            const exists = await Stock.findOne({ location: loc });
            if (!exists) {
                await new Stock({ location: loc, items: [] }).save();
            }
        }
        res.json({ message: 'Stocks seeded' });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Bulk Delete Stock Items
router.post('/bulk-delete', authMiddleware, async (req, res) => {
    const { items } = req.body; // Array of { location, itemName }

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: 'Invalid items array' });
    }

    try {
        // Group by location to minimize DB calls
        const itemsByLoc = {};
        for (const item of items) {
            if (!itemsByLoc[item.location]) itemsByLoc[item.location] = [];
            itemsByLoc[item.location].push(item.itemName);
        }

        for (const [loc, names] of Object.entries(itemsByLoc)) {
            await Stock.updateOne(
                { location: loc },
                {
                    $pull: { items: { name: { $in: names } } },
                    $set: { lastUpdated: Date.now() }
                }
            );
        }

        res.json({ message: 'Stock items deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
