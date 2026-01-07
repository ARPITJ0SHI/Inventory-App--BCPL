const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Get all stocks (paginated items, filtered by role and search)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { role } = req.user;
        const { page = 1, limit = 20, search } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 50);
        const skip = (pageNum - 1) * limitNum;

        let locationFilter = {};

        // Role Logic
        if (role === 'factory_manager') locationFilter = { location: { $in: ['Factory', 'Trade'] } };
        if (role === 'shop_manager') locationFilter = { location: { $in: ['Shop', 'Godown'] } };
        // super_admin, viewer see all

        // Fetch all relevant documents (small number of docs)
        const stocks = await Stock.find(locationFilter).lean();

        // Flatten all items from location documents
        let allItems = [];
        stocks.forEach(doc => {
            if (doc.items && Array.isArray(doc.items)) {
                doc.items.forEach(item => {
                    allItems.push({
                        ...item,
                        productName: item.name, // Frontend expects productName
                        itemName: item.name,    // Alias
                        location: doc.location,
                        _id: item._id || `${doc.location}_${item.name}`
                    });
                });
            }
        });

        // Filter by search
        if (search) {
            const searchLower = search.toLowerCase();
            allItems = allItems.filter(item =>
                (item.productName && item.productName.toLowerCase().includes(searchLower))
            );
        }

        // Sort alphabetically by productName
        allItems.sort((a, b) => (a.productName || '').localeCompare(b.productName || ''));

        // Pagination
        const total = allItems.length;
        const paginatedItems = allItems.slice(skip, skip + limitNum);

        res.json({
            data: paginatedItems,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
                hasMore: pageNum * limitNum < total
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Update or Create Stock Item
router.post('/update', authMiddleware, async (req, res) => {
    const { location, itemName, quantity, unit } = req.body;

    try {
        let stock = await Stock.findOne({ location });

        if (!stock) {
            stock = new Stock({ location, items: [] });
        }

        const itemIndex = stock.items.findIndex(i => i.name === itemName);
        if (itemIndex > -1) {
            stock.items[itemIndex].quantity = quantity;
            if (unit) stock.items[itemIndex].unit = unit;
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
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: 'Invalid items array' });
    }

    try {
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
