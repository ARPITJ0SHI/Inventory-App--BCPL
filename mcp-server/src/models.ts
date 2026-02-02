import mongoose from 'mongoose';

// IMPORTANT: This schema must match server/models/Stock.js exactly!
const stockSchema = new mongoose.Schema({
    location: {
        type: String,
        required: true,
        enum: ['Shop', 'Factory'] // Capitalized!
    },
    items: [
        {
            name: { type: String, required: true },
            quantity: { type: Number, default: 0 },
            unit: { type: String, default: 'kg' }
        }
    ],
    lastUpdated: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema({
    vendorName: String,
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    items: [{
        name: String, // Was productName (incorrect)
        quantity: Number,
        price: Number,
    }],
    createdAt: { type: Date, default: Date.now }
});

export const Stock = mongoose.model('Stock', stockSchema);
export const Order = mongoose.model('Order', orderSchema);
