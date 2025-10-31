import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    message: 'Test function works!',
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
    deployed: true
  });
}
