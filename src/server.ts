import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { testConnection, pool } from './config/database';
import verifyRouter from './routes/verify';
import reportsRouter from './routes/reports';
import analyticsRouter from './routes/analytics';
import kycRouter from './routes/kyc';
import generateCisRouter from './routes/generate-cis';
import testCisRouter from './routes/test-cis';
import uploadDocumentsRouter from './routes/upload-documents';
import cisRouter from './routes/cis';
import mismatchReviewRouter, { setDbPool as setMismatchDbPool } from './routes/mismatch-review';
import { generalApiLimiter, healthCheckLimiter } from './middleware/rate-limiter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check (with rate limiting)
app.get('/health', healthCheckLimiter, (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API routes (with rate limiting)
app.use('/api', generalApiLimiter, verifyRouter);
app.use('/api/reports', generalApiLimiter, reportsRouter);
app.use('/api/analytics', generalApiLimiter, analyticsRouter);
// KYC routes (v2)
app.use('/api/kyc', generalApiLimiter, kycRouter);
// CIS platform routes
app.use('/api/cis', generalApiLimiter, cisRouter);
// CIS generation routes
app.use('/api', generalApiLimiter, generateCisRouter);
// Test CIS generation (bypasses verification)
app.use('/api', generalApiLimiter, testCisRouter);
// Customer document upload routes
app.use('/api', generalApiLimiter, uploadDocumentsRouter);
// Mismatch detection and review routes
app.use('/api/mismatch', generalApiLimiter, mismatchReviewRouter);

// Serve mismatch viewer page
app.get('/verification/review', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/mismatch-viewer.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
async function start() {
  try {
    // Test database connection
    await testConnection();

    // Inject database pool into mismatch review router
    setMismatchDbPool(pool);
    
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/health`);
      console.log(`✅ API endpoint: http://localhost:${PORT}/api/verify-document`);
    });

    // Handle graceful shutdown on development hot reload
    process.on('SIGTERM', async () => {
      console.log('⚠️ SIGTERM received. Closing gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
      
      // Force exit after 10 seconds if graceful close fails
      const forceExitTimer = setTimeout(() => {
        console.log('❌ Graceful shutdown timeout. Force exiting.');
        process.exit(1);
      }, 10000);
      
      forceExitTimer.unref();
    });

    process.on('SIGINT', async () => {
      console.log('⚠️ SIGINT received. Closing gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
      
      setTimeout(() => {
        console.log('❌ Graceful shutdown timeout. Force exiting.');
        process.exit(1);
      }, 10000);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
