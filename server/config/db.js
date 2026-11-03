import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('[DB] MongoDB connection failed: MONGO_URI is not configured.');
      return null;
    }

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[DB] MongoDB connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    console.error('[DB] Debug: verify MONGO_URI and confirm MongoDB is reachable.');
    return null;
  }
};


export default connectDB;
