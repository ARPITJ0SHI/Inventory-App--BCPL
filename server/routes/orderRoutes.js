const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const sharp = require('sharp');

// Multer Config - Memory storage for MongoDB base64 storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper to compress and convert image to base64
async function processImage(file) {
    try {
        // Compress image with sharp - resize to max 800px width, quality 70%
        const compressedBuffer = await sharp(file.buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();

        return {
            data: compressedBuffer.toString('base64'),
            contentType: 'image/jpeg',
            name: file.fieldname
        };
    } catch (error) {
        console.error('Image processing error:', error);
        // Fallback to original buffer
        return {
            data: file.buffer.toString('base64'),
            contentType: file.mimetype,
            name: file.fieldname
        };
    }
}

// Create Order (with images stored in MongoDB)
router.post('/', authMiddleware, upload.fields([
    { name: 'orderImage', maxCount: 1 },
    { name: 'parchiImage', maxCount: 1 }
]), async (req, res) => {
    try {
        const { vendorName, location, items, totalAmount } = req.body;
        console.log(`[DEBUG] Order Create - User Role: ${req.user.role}, Target Location: ${location}`);

        // Enforce Location Access
        if (req.user.role === 'factory_manager' && location !== 'Factory') {
            console.log('[DEBUG] Blocked Factory Manager from creating non-Factory order');
            return res.status(403).json({ message: 'Access Denied: You can only create orders for Factory' });
        }
        if (req.user.role === 'shop_manager' && location !== 'Shop') {
            console.log('[DEBUG] Blocked Shop Manager from creating non-Shop order');
            return res.status(403).json({ message: 'Access Denied: You can only create orders for Shop' });
        }

        const parsedItems = JSON.parse(items);

        // Process and compress images
        const images = [];
        if (req.files && req.files['orderImage']) {
            const processed = await processImage(req.files['orderImage'][0]);
            images.push(processed);
        }
        if (req.files && req.files['parchiImage']) {
            const processed = await processImage(req.files['parchiImage'][0]);
            images.push(processed);
        }

        const order = new Order({
            vendorName,
            location,
            items: parsedItems,
            totalAmount: Number(totalAmount) || 0,
            images,
            createdBy: req.user.userId
        });

        await order.save();
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
});

const mongoose = require('mongoose');

// Get Orders (List - paginated, excludes heavy image data for speed)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { role } = req.user;
        const { page = 1, limit = 20, search, location, sort = 'newest' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 50);
        const skip = (pageNum - 1) * limitNum;

        let filter = {};

        // Search filter (vendor name + item names)
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            const orConditions = [
                { vendorName: searchRegex },
                { 'items.name': searchRegex }
            ];

            if (mongoose.Types.ObjectId.isValid(search)) {
                orConditions.push({ _id: search });
            }

            filter.$or = orConditions;
        }

        // Location filter (for admin UI)
        if (location) {
            filter.location = location;
        }

        // Get total count for pagination metadata
        const total = await Order.countDocuments(filter);

        // Sort order
        const sortOrder = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

        // Fetch paginated orders
        const orders = await Order.find(filter)
            .select('-images')
            .populate('createdBy', 'username')
            .sort(sortOrder)
            .skip(skip)
            .limit(limitNum)
            .lean();

        res.json({
            data: orders,
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

// Get Single Order
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('createdBy', 'username');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Update Order (Status or other details)
// Managers can update status (Pending -> Completed). Admins can update all.
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const { status, totalAmount, items } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Logic: Managers can only mark completed? Admin can edit all?
        // For MVP, letting them update fields provided.
        if (status) order.status = status;
        if (totalAmount) order.totalAmount = totalAmount;
        if (items) order.items = items;

        // Enforce Location Access (Write Security)
        if (req.user.role === 'factory_manager' && order.location !== 'Factory') {
            return res.status(403).json({ message: 'Access Denied: You cannot edit Factory orders' });
        }
        if (req.user.role === 'shop_manager' && order.location !== 'Shop') {
            return res.status(403).json({ message: 'Access Denied: You cannot edit Shop orders' });
        }

        await order.save();
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Delete Order (Super Admin only - check role in middleware or inside)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        // Optional: specific role check
        // if (req.user.role !== 'super_admin') return res.status(403).json(...);

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        await order.deleteOne();
        res.json({ message: 'Order removed' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Bulk Delete Orders
router.post('/bulk-delete', authMiddleware, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ message: 'Invalid IDs' });
        }

        await Order.deleteMany({ _id: { $in: ids } });
        res.json({ message: 'Orders deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
