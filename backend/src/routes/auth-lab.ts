import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AuthLabError, authLabSimulator, isLoopbackAddress } from '../lib/auth-lab.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const weakAuthenticationSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(128),
}).strict();

const authenticationCheckSchema = z.object({
  scenario: z.enum([
    'anonymous',
    'spoofed-client-authentication',
    'valid-student-session',
    'known-account',
    'unknown-account',
  ]),
}).strict();

const resetConfirmationSchema = z.object({
  scenario: z.enum(['valid', 'tampered', 'expired', 'replay']),
  newPassword: z.string().min(1).max(128).optional(),
}).strict();

const simulationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 100 : 20,
  keyGenerator: (req) => `user:${req.user!.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Pause this local simulation before trying again.',
  },
});

router.use((req, res, next) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return res.status(404).json({
      error: 'Not found',
      message: 'The requested resource does not exist.',
    });
  }
  return next();
});
router.use(requireAuth, simulationLimiter);

router.get('/status', (_req, res) => {
  return res.status(200).json({ available: true });
});

router.post('/weak-authentication', async (req, res) => {
  const parsed = weakAuthenticationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid simulation input',
      message: 'Provide a synthetic username and password.',
    });
  }

  try {
    const result = await authLabSimulator.compareWeakAuthentication(
      req.user!.id,
      parsed.data.username,
      parsed.data.password,
    );
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({
      error: 'Simulation unavailable',
      message: 'Unable to run the local authentication comparison.',
    });
  }
});

router.post('/authentication-check', (req, res) => {
  const parsed = authenticationCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid simulation input',
      message: 'Choose a supported synthetic authentication scenario.',
    });
  }

  return res.status(200).json(authLabSimulator.compareAuthenticationCheck(parsed.data.scenario));
});

router.get('/password-reset', (req, res) => {
  return res.status(200).json(authLabSimulator.getResetState(req.user!.id));
});

router.post('/password-reset/request', (req, res) => {
  if (req.body === undefined || typeof req.body !== 'object' || req.body === null
    || Array.isArray(req.body) || Object.keys(req.body).length !== 0) {
    return res.status(400).json({
      error: 'Invalid simulation input',
      message: 'This simulated reset request does not accept a request body.',
    });
  }
  return res.status(201).json(authLabSimulator.requestPasswordReset(req.user!.id));
});

router.post('/password-reset/confirm', async (req, res) => {
  const parsed = resetConfirmationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid simulation input',
      message: 'Choose a supported reset scenario and provide a new synthetic password when completing the reset.',
    });
  }

  try {
    const result = await authLabSimulator.confirmPasswordReset(
      req.user!.id,
      parsed.data.scenario,
      parsed.data.newPassword,
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AuthLabError) {
      return res.status(error.status).json({
        error: 'Reset simulation rejected',
        message: error.message,
      });
    }
    return res.status(500).json({
      error: 'Simulation unavailable',
      message: 'Unable to complete the local reset simulation.',
    });
  }
});

export default router;
