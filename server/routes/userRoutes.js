const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// Get all users (super_admin and khushal can view)
router.get('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'super_admin' && req.user.role !== 'khushal') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Don't return password, exclude super_admin from list
        const users = await User.find({ role: { $ne: 'super_admin' } })
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();

        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Create user (super_admin only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Only super admin can create users' });
        }

        const { username, password, role } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ message: 'Username, password, and role are required' });
        }

        // Validate role
        const validRoles = ['khushal', 'factory_manager', 'shop_manager'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        // Check if username exists
        const exists = await User.findOne({ username });
        if (exists) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            username,
            password: hashedPassword,
            role
        });

        await user.save();

        // Don't return password
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json(userResponse);
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Delete user (super_admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Only super admin can delete users' });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deleting super_admin
        if (user.role === 'super_admin') {
            return res.status(403).json({ message: 'Cannot delete super admin' });
        }

        await User.deleteOne({ _id: req.params.id });
        res.json({ message: 'User deleted' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Register push token
router.post('/push-token', authMiddleware, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        // Add token if not exists
        await User.findByIdAndUpdate(req.user.userId, {
            $addToSet: { pushTokens: token }
        });

        res.json({ message: 'Token registered' });
    } catch (err) {
        console.error('Error registering token:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
