const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const authMiddleware = require('../middleware/authMiddleware');
const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const expo = new Expo();

const MAX_ANNOUNCEMENTS = 20;

// Get all announcements (non-expired, max 20, newest first)
router.get('/', authMiddleware, async (req, res) => {
    try {
        // MongoDB TTL index handles expiry, but we also filter just in case
        const announcements = await Announcement.find({
            expiresAt: { $gt: new Date() }
        })
            .sort({ createdAt: -1 })
            .limit(MAX_ANNOUNCEMENTS)
            .lean();

        res.json(announcements);
    } catch (err) {
        console.error('Error fetching announcements:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Create Announcement - Any authenticated user can create
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, message } = req.body;

        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required' });
        }

        // Check if we have MAX_ANNOUNCEMENTS, if so delete oldest
        const count = await Announcement.countDocuments();
        if (count >= MAX_ANNOUNCEMENTS) {
            // Delete oldest announcement(s) to make room (FIFO)
            const oldest = await Announcement.find()
                .sort({ createdAt: 1 })
                .limit(count - MAX_ANNOUNCEMENTS + 1);

            for (const old of oldest) {
                await Announcement.deleteOne({ _id: old._id });
            }
        }

        const announcement = new Announcement({
            title,
            message,
            createdBy: req.user.userId
        });



        await announcement.save();

        // Send Push Notifications
        // 1. Get all users with push tokens
        const users = await User.find({ pushTokens: { $exists: true, $not: { $size: 0 } } });

        const messages = [];
        for (const user of users) {
            for (const token of user.pushTokens) {
                if (!Expo.isExpoPushToken(token)) {
                    console.error(`Push token ${token} is not a valid Expo push token`);
                    continue;
                }
                messages.push({
                    to: token,
                    sound: 'default',
                    title: `New Announcement: ${title}`,
                    body: message,
                    data: { announcementId: announcement._id },
                });
            }
        }

        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];
        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error(error);
            }
        }

        res.status(201).json(announcement);
    } catch (err) {
        console.error('Error creating announcement:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
