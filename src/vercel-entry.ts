import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import verifyRouter from './routes/verify';
import reportsRouter from './routes/reports';
import analyticsRouter from './routes/analytics';
import kycRouter from './routes/kyc';
import { generalApiLimiter, healthCheckLimiter } from './middleware/rate-limiter';

dotenv.config();

const app = express();

// Middleware
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

// Export for Vercel serverless
export default app;

