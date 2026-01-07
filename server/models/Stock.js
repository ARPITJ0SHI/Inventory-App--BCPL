const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
    location: {
        type: String,
        enum: ['Shop', 'Godown', 'Factory', 'Trade'],
        required: true,
        unique: true
    },
    items: [
        {
            name: { type: String, required: true },
            quantity: { type: Number, default: 0 }, // in kg/L
            unit: { type: String, default: 'kg' }
        }
    ],
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Stock', stockSchema);
