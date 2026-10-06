import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vulnforge-backend',
    message: 'VULNFORGE backend is running.',
    timestamp: new Date().toISOString(),
  });
});

export default router;
