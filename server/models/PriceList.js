const mongoose = require('mongoose');

const priceListSchema = new mongoose.Schema({
    items: [
        {
            productName: { type: String, required: true },
            price: { type: Number, default: 0 },
            category: { type: String, default: '' }
        }
    ],
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PriceList', priceListSchema);

