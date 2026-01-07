const express = require('express');
const router = express.Router();
const PriceList = require('../models/PriceList');
const authMiddleware = require('../middleware/authMiddleware');

// Get all price items
router.get('/', authMiddleware, async (req, res) => {
    try {
        let priceList = await PriceList.findOne();
        if (!priceList) {
            priceList = new PriceList({ items: [] });
            await priceList.save();
        }
        res.json(priceList.items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Create a new price item
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { productName, price, category } = req.body;

        let priceList = await PriceList.findOne();
        if (!priceList) {
            priceList = new PriceList({ items: [] });
        }

        // Add new item
        priceList.items.push({ productName, price, category });
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
        const { productName, price, category } = req.body;

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

