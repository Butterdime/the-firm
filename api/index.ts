import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple root handler - redirects to health or documentation
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    message: 'CIS Platform API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      verify: '/api/verify-document',
    },
    documentation: 'https://github.com/Butterdime/the-firm',
  });
}

