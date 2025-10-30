// Simple root handler - redirects to health or documentation
export default function handler(req, res) {
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
