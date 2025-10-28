import { Router } from 'express';

const router = Router();

// Stub endpoint for Phase 1B
router.post('/verify-document', (req, res) => {
  res.json({ message: 'Document verification stub (Phase 1B)' });
});

export default router;
