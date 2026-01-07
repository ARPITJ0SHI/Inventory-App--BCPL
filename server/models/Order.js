const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    location: {
        type: String,
        enum: ['Shop', 'Factory'],
        required: true
    },
    items: [
        {
            name: { type: String, required: true },
            price: { type: Number }, // Optional for some roles
            quantity: { type: Number }
        }
    ],
    images: [{
        data: { type: String }, // Base64 encoded image
        contentType: { type: String }, // e.g., 'image/jpeg'
        name: { type: String } // Original field name (orderImage/parchiImage)
    }],
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'pending'
    },
    totalAmount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// Indexes for faster queries
orderSchema.index({ createdAt: -1 }); // For sorting by newest first
orderSchema.index({ status: 1 }); // For filtering by status
orderSchema.index({ location: 1 }); // For filtering by location
orderSchema.index({ createdBy: 1 }); // For user's orders

module.exports = mongoose.model('Order', orderSchema);

