const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    vendorName: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        enum: ['Shop', 'Factory'],
        required: true
    },
    items: [
        {
            name: { type: String, required: true },
            price: { type: Number },
            quantity: { type: Number },
            gst: { type: Number, default: 0 } // GST Percentage
        }
    ],
    images: [
        {
            data: { type: String }, // Base64
            contentType: { type: String },
            name: { type: String }
        }
    ],
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'pending'
    },
    totalAmount: { type: Number, default: 0 },
    deposit: { type: Number, default: 0 }, // Advance payment
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// Indexes for faster queries
orderSchema.index({ createdAt: -1 }); // For sorting by newest first
orderSchema.index({ status: 1 }); // For filtering by status
orderSchema.index({ location: 1 }); // For filtering by location
orderSchema.index({ createdBy: 1 }); // For user's orders
orderSchema.index({ vendorName: 'text', 'items.name': 'text' }); // For text search

module.exports = mongoose.model('Order', orderSchema);

