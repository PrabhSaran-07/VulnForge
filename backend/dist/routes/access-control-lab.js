import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { accessControlLabSimulator, accessControlScenarios, isLoopbackAddress, } from '../lib/access-control-lab.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
const objectAccessSchema = z.object({
    resourceId: z.enum(accessControlScenarios.objectAccess),
}).strict();
const rolePermissionSchema = z.object({
    scenario: z.enum(accessControlScenarios.rolePermission),
}).strict();
const privilegeBoundarySchema = z.object({
    scenario: z.enum(accessControlScenarios.privilegeBoundary),
}).strict();
const simulationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 100 : 20,
    keyGenerator: (req) => `user:${req.user.id}`,
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
router.post('/object-access', (req, res) => {
    const parsed = objectAccessSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'Invalid simulation input',
            message: 'Choose one of the fixed synthetic documents.',
        });
    }
    return res.status(200).json(accessControlLabSimulator.compareObjectAccess(req.user.id, parsed.data.resourceId));
});
router.post('/role-permission', (req, res) => {
    const parsed = rolePermissionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'Invalid simulation input',
            message: 'Choose one of the fixed synthetic role and permission cases.',
        });
    }
    return res.status(200).json(accessControlLabSimulator.compareRolePermission(parsed.data.scenario));
});
router.post('/privilege-boundary', (req, res) => {
    const parsed = privilegeBoundarySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'Invalid simulation input',
            message: 'Choose one of the fixed synthetic privilege cases.',
        });
    }
    return res.status(200).json(accessControlLabSimulator.comparePrivilegeBoundary(parsed.data.scenario));
});
export default router;
