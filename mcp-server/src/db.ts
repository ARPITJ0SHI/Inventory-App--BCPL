import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!, {});
        console.log('MCP Server: MongoDB Connected');
    } catch (err) {
        console.error('MCP Server: MongoDB Connection Error', err);
        process.exit(1);
    }
};
