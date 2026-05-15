const mongoose = require("mongoose");

// Cache the database connection
let cachedConnection = null;

const connectDB = async () => {
  // If we have a cached connection and it's ready, use it
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  // If connection is pending/connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    console.log('⏳ Database connection in progress, waiting...');
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve);
      setTimeout(resolve, 10000); // Max 10s wait
    });
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
  }

  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is not set");
    }

    const isLocalMongo = /localhost|127\.0\.0\.1|::1/i.test(mongoUri);
    console.log(
      `🔌 Connecting to ${isLocalMongo ? "local MongoDB" : "MongoDB Atlas"}...`,
    );

    const conn = await mongoose.connect(mongoUri, {
      // INCREASED timeouts for slow college WiFi + serverless cold starts
      serverSelectionTimeoutMS: 15000, // 15s (was 5s)
      socketTimeoutMS: 60000, // 60s (was 45s)
      connectTimeoutMS: 15000, // 15s for initial connection
      maxPoolSize: 10, // Maintain up to 10 connections
      minPoolSize: 2, // Keep at least 2 connections open
      retryWrites: true,
      retryReads: true,
    });

    cachedConnection = conn;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error('Connection String:', process.env.MONGODB_URI?.replace(/\/\/.*@/, '//<credentials>@')); // Log without credentials
    throw error;
  }
};

module.exports = connectDB;
