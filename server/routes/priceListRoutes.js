const express = require('express');
const router = express.Router();
const PriceList = require('../models/PriceList');
const authMiddleware = require('../middleware/authMiddleware');

// Get all price items (paginated)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, sort = 'newest' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 50);
        const skip = (pageNum - 1) * limitNum;

        let priceList = await PriceList.findOne().lean();
        if (!priceList) {
            priceList = new PriceList({ items: [] });
            await priceList.save();
            return res.json({
                data: [],
                pagination: { page: 1, limit: limitNum, total: 0, pages: 0, hasMore: false }
            });
        }

        let allItems = priceList.items || [];

        // Filter by Type (buying/selling) - Default to 'selling' if not specified? 
        // Actually, frontend will always send type. Let's make it optional but recommended.
        const { type } = req.query;
        if (type) {
            // Treat items with no type as 'selling' (Legacy support)
            allItems = allItems.filter(item => (item.type || 'selling') === type);
        }

        // Server-side filtering
        if (search) {
            const searchLower = search.toLowerCase();
            allItems = allItems.filter(item =>
                (item.productName && item.productName.toLowerCase().includes(searchLower)) ||
                (item.category && item.category.toLowerCase().includes(searchLower))
            );
        }

        // Sort by newest/oldest (default: newest)
        // Sort by newest/oldest (default: newest)
        const sortOrder = sort;
        allItems.sort((a, b) => {
            if (sortOrder === 'asc') {
                return a.productName.localeCompare(b.productName);
            } else if (sortOrder === 'desc_alpha') {
                return b.productName.localeCompare(a.productName);
            } else if (sortOrder === 'oldest') {
                const aTime = a._id?.getTimestamp?.() || new Date(0);
                const bTime = b._id?.getTimestamp?.() || new Date(0);
                return aTime - bTime;
            } else {
                // Newest (default)
                const aTime = a._id?.getTimestamp?.() || new Date(0);
                const bTime = b._id?.getTimestamp?.() || new Date(0);
                return bTime - aTime;
            }
        });

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

// Create a new price item
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { productName, price, category, type } = req.body;

        let priceList = await PriceList.findOne();
        if (!priceList) {
            priceList = new PriceList({ items: [] });
        }

        // Add new item (with type)
        priceList.items.push({
            productName,
            price,
            category,
            type: type || 'selling' // Default to selling
        });
        priceList.lastUpdated = Date.now();
        await priceList.save();

        // Return the newly created item
        const newItem = priceList.items[priceList.items.length - 1];
        res.json(newItem);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Update a price item
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const { productName, price, category, type } = req.body;

        let priceList = await PriceList.findOne();
        if (!priceList) {
            return res.status(404).json({ message: 'Price list not found' });
        }

        const item = priceList.items.id(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Price item not found' });
        }

        if (productName) item.productName = productName;
        if (price !== undefined) item.price = price;
        if (category !== undefined) item.category = category;
        if (type !== undefined) item.type = type;

        priceList.lastUpdated = Date.now();
        await priceList.save();

        res.json(item);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Delete a price item
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        let priceList = await PriceList.findOne();
        if (!priceList) {
            return res.status(404).json({ message: 'Price list not found' });
        }

        const item = priceList.items.id(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Price item not found' });
        }

        item.deleteOne();
        priceList.lastUpdated = Date.now();
        await priceList.save();

        res.json({ message: 'Price item deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;

