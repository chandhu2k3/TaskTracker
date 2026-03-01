const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

// Load environment config
// For local development, use .env.development if it exists
// For production (Vercel), use environment variables from Vercel dashboard
const devEnvPath = path.join(__dirname, '.env.development');
const defaultEnvPath = path.join(__dirname, '.env');

if (fs.existsSync(devEnvPath)) {
  dotenv.config({ path: devEnvPath });
  console.log('📦 Loaded: .env.development');
} else if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
  console.log('📦 Loaded: .env');
} else {
  console.log('📦 Using Vercel environment variables');
}

console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🗄️ Database: ${process.env.MONGODB_URI?.includes('localhost') ? 'Local MongoDB' : 'MongoDB Atlas'}`);

// Connect to database asynchronously (don't block server startup)
connectDB().catch(err => {
  console.error('❌ Initial DB connection failed:', err.message);
  console.log('⚠️ Server will start anyway, DB reconnection will be attempted on requests');
});

const app = express();

// ✅ Slow request logging middleware should go HERE
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 2000) {
      console.warn(`[SLOW REQUEST] ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  next();
});


// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow localhost
    if (origin === "http://localhost:3000") {
      return callback(null, true);
    }

    // Allow any Vercel deployment of task-tracker-frontend
    if (
      origin.startsWith("https://task-tracker-frontend") &&
      origin.endsWith(".vercel.app")
    ) {
      return callback(null, true);
    }

    // Reject all others
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Timezone", "x-keep-alive", "Cache-Control"],
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 🔌 Ensure DB is connected before every API request (fixes cold-start buffering timeout)
app.use("/api", async (req, res, next) => {
  // Skip DB check for ping (no DB needed)
  if (req.path === "/ping") return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ DB connection failed for request:", req.path);
    res.status(503).json({
      message: "Database unavailable. Please try again in a few seconds.",
      retry: true,
    });
  }
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/templates", require("./routes/templates"));
app.use("/api/sleep", require("./routes/sleepRoutes"));
app.use("/api/todos", require("./routes/todos"));
app.use("/api/calendar", require("./routes/calendar"));

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "Task Tracker API is running",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Super lightweight ping - no DB required, optimized for keep-alive
app.get("/api/ping", (req, res) => {
  // Skip logging for keep-alive requests to reduce noise
  if (!req.headers['x-keep-alive']) {
    console.log('📡 Ping request');
  }
  
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=60'
  });
  
  res.status(200).json({ 
    status: "ok",
    timestamp: Date.now(),
    message: "pong",
    cold: false // Always warm now!
  });
});

// Quick health check for warming up
app.get("/api/health", async (req, res) => {
  try {
    const { getRedis } = require('./config/redis');
    const redisClient = getRedis();
    
    // Try to reconnect if disconnected
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB disconnected, attempting reconnect...');
      try {
        await connectDB();
      } catch (err) {
        console.error('Reconnect failed:', err.message);
      }
    }
    
    // Get connection state details
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    const mongoState = mongoose.connection.readyState;
    
    res.status(200).json({ 
      status: "ok",
      mongodb: stateMap[mongoState] || 'unknown',
      mongodbState: mongoState,
      mongodbHost: mongoose.connection.host || 'none',
      mongodbError: mongoose.connection.error?.message || null,
      redis: redisClient ? 'connected' : 'disabled',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(200).json({ 
      status: "ok",
      mongodb: 'error',
      error: error.message,
      redis: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
