const mongoose = require('mongoose');

const priceListSchema = new mongoose.Schema({
    items: [
        {
            productName: { type: String, required: true },
            price: { type: Number, default: 0 },
            category: { type: String, default: '' },
            type: { type: String, enum: ['buying', 'selling'], default: 'selling' }
        }
    ],
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PriceList', priceListSchema);

