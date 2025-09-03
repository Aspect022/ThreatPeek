const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const scanRoutes = require('./routes/scan');
const enhancedScanRoutes = require('./routes/enhancedScan');
const webhookRoutes = require('./routes/webhook');
const webhookHistoryRoutes = require('./routes/webhookHistory');

const app = express();
const PORT = process.env.PORT || 3001;

// Production environment check
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware
app.use(helmet());

// CORS configuration for development and production
const allowedOrigins = [
  'https://threat-peek.vercel.app',
  'https://threatpeek.vercel.app', // Add your actual Vercel domain
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL // Allow dynamic frontend URL from env
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-Event-Type'
}));



// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - More specific routes first to avoid conflicts
app.use('/api/webhook', webhookRoutes);
app.use('/api/webhook-history', webhookHistoryRoutes);
app.use('/api/enhanced-scan', enhancedScanRoutes);
app.use('/api', scanRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Don't leak error details in production
  const errorMessage = isProduction
    ? 'Something went wrong!'
    : err.message;

  res.status(500).json({
    error: errorMessage,
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 ThreatPeek Backend running on port ${PORT}`);
});