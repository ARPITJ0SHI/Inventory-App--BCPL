"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = exports.Stock = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const stockSchema = new mongoose_1.default.Schema({
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: 'kg' },
    location: { type: String, required: true, enum: ['shop', 'godown', 'factory'] },
    lastUpdated: { type: Date, default: Date.now },
});
const orderSchema = new mongoose_1.default.Schema({
    vendorName: String,
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    items: [{
            productName: String,
            quantity: Number,
            price: Number,
        }],
    createdAt: { type: Date, default: Date.now }
});
exports.Stock = mongoose_1.default.model('Stock', stockSchema);
exports.Order = mongoose_1.default.model('Order', orderSchema);
//# sourceMappingURL=models.js.map