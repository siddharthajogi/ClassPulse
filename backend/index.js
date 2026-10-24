const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const path = require('path');

// Load environment variables from .env
dotenv.config();
// Notification system initialized

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[Error] MONGODB_URI is not set in environment variables.');
}

// Enable trust proxy if in production / reverse-proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS configuration for local React frontend with credentials support
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Persistent server-side session configuration
const mongoStoreCreate = MongoStore.create || (MongoStore.default && MongoStore.default.create);

const sessionStore = mongoStoreCreate({
  mongoUrl: MONGODB_URI,
  collectionName: 'sessions',
  ttl: 24 * 60 * 60 // 1 day
});

sessionStore.on('error', (err) => {
  console.warn(`[Session Store] Storage warning: ${err.message}`);
});
if (sessionStore.clientP?.catch) {
  sessionStore.clientP.catch(() => {});
}
if (sessionStore.collectionP?.catch) {
  sessionStore.collectionP.catch(() => {});
}

app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'studypoint_default_session_secret_2026',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// MongoDB Connection Event Listeners
mongoose.connection.on('connected', () => {
  console.log(`[Database] MongoDB connected successfully (${mongoose.connection.host}/${mongoose.connection.name})`);
});

mongoose.connection.on('error', (err) => {
  console.error(`[Database] MongoDB runtime error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('[Database] MongoDB disconnected');
});

// Database connection logic
let reconnectTimer = null;
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  } catch (error) {
    console.error(`[Database] Initial MongoDB connection failed: ${error.message}`);
    console.warn('[Database] The server will continue running. Auto-reconnect active.');
    if (!reconnectTimer) {
      reconnectTimer = setInterval(async () => {
        if (mongoose.connection.readyState === 0) {
          try {
            await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
            if (reconnectTimer) {
              clearInterval(reconnectTimer);
              reconnectTimer = null;
            }
          } catch (_) {}
        }
      }, 8000);
    }
  }
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ClassPulse API Server is running',
    healthCheck: '/api/health'
  });
});

// Health-check endpoint
app.get('/api/health', (req, res) => {
  const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = connectionStates[mongoose.connection.readyState] || 'unknown';
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    database: {
      connected: isDbConnected,
      state: dbState,
      name: isDbConnected ? mongoose.connection.name : null
    },
    server: {
      port: Number(PORT),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Mount feature routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error] Unhandled server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

// Start server and initialize database connection
app.listen(PORT, async () => {
  console.log(`=========================================`);
  console.log(` ClassPulse Backend Server`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(` Allowed CORS Origin: ${CLIENT_URL}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=========================================`);

  await connectDB();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed.');
  }
  process.exit(0);
});
