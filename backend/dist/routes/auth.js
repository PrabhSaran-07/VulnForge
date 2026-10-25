import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { hashPassword, isStrongPassword, isValidEmail, loginSchema, normalizeEmail, normalizeUsername, safeUser, userSelect, verifyPassword, registerSchema, } from '../lib/auth.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const router = Router();
function summarizeError(error, depth = 0) {
    if (!(error instanceof Error)) {
        return String(error);
    }
    const detailedError = error;
    return {
        name: error.name,
        message: error.message,
        code: detailedError.code,
        address: detailedError.address,
        port: detailedError.port,
        meta: detailedError.meta,
        cause: depth < 3 && detailedError.cause
            ? summarizeError(detailedError.cause, depth + 1)
            : undefined,
    };
}
function logAuthFailure(operation, error, requestPassword) {
    const rawTrace = error instanceof Error ? error.stack ?? `${error.name}: ${error.message}` : String(error);
    const details = summarizeError(error);
    const sensitiveValues = [env.SESSION_SECRET, env.DATABASE_URL, requestPassword]
        .filter((value) => Boolean(value));
    const redact = (text) => sensitiveValues.reduce((trace, secret) => trace.replaceAll(secret, '[REDACTED]'), text).replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, '[REDACTED_DATABASE_URL]')
        .replace(/(password\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^,\s)]+)/gi, '$1[REDACTED]');
    console.error(`[auth] ${operation} failed: ${redact(JSON.stringify(details))}\n${redact(rawTrace)}`);
}
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 100 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests',
        message: 'Please wait before creating another account.',
    },
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 100 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests',
        message: 'Please wait before trying to sign in again.',
    },
});
function getDuplicateConflictMessage(error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') {
        return undefined;
    }
    const meta = 'meta' in error && typeof error.meta === 'object' && error.meta !== null
        ? error.meta
        : undefined;
    const target = meta && 'target' in meta ? meta.target : undefined;
    const fields = (Array.isArray(target) ? target : [target])
        .filter((field) => typeof field === 'string')
        .join(' ')
        .toLowerCase();
    if (fields.includes('username')) {
        return 'Username is already in use.';
    }
    if (fields.includes('email')) {
        return 'Email is already in use.';
    }
    return 'Username or email is already in use.';
}
router.post('/register', registerLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'Invalid registration data',
            message: 'Please provide a valid username, email, and password.',
        });
    }
    const username = normalizeUsername(parsed.data.username);
    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;
    if (username.length < 3 || username.length > 50) {
        return res.status(400).json({
            error: 'Invalid username',
            message: 'Username must be between 3 and 50 characters long.',
        });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({
            error: 'Invalid email',
            message: 'Please provide a valid email address.',
        });
    }
    if (!isStrongPassword(password)) {
        return res.status(400).json({
            error: 'Weak password',
            message: 'Password must be at least 8 characters and include at least one letter and one number.',
        });
    }
    try {
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ username }, { email }],
            },
        });
        if (existingUser) {
            const message = existingUser.username === username
                ? 'Username is already in use.'
                : 'Email is already in use.';
            return res.status(409).json({
                error: 'Conflict',
                message,
            });
        }
        const passwordHash = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                username,
                email,
                passwordHash,
                role: 'STUDENT',
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return res.status(201).json({
            message: 'Account created successfully.',
            user: safeUser(user),
        });
    }
    catch (error) {
        const duplicateMessage = getDuplicateConflictMessage(error);
        if (duplicateMessage) {
            return res.status(409).json({
                error: 'Conflict',
                message: duplicateMessage,
            });
        }
        logAuthFailure('registration persistence', error, password);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to create the account right now.',
        });
    }
});
router.post('/login', loginLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'Invalid login data',
            message: 'Please provide a valid identifier and password.',
        });
    }
    const identifier = parsed.data.identifier.trim();
    const password = parsed.data.password;
    const isEmail = isValidEmail(identifier);
    const lookupValue = isEmail ? normalizeEmail(identifier) : normalizeUsername(identifier);
    let user;
    try {
        user = await prisma.user.findFirst({
            where: {
                OR: [{ email: isEmail ? lookupValue : undefined }, { username: !isEmail ? lookupValue : undefined }],
            },
            select: userSelect,
        });
    }
    catch (error) {
        logAuthFailure('login user lookup', error, password);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to log in right now.',
        });
    }
    try {
        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid credentials.',
            });
        }
    }
    catch (error) {
        logAuthFailure('login password verification', error, password);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to log in right now.',
        });
    }
    // Regenerate the session to prevent session fixation: the old session ID
    // (issued before authentication) is replaced with a new one.
    req.session.regenerate((regenerateError) => {
        if (regenerateError) {
            logAuthFailure('login session regeneration', regenerateError, password);
            return res.status(500).json({
                error: 'Internal server error',
                message: 'Unable to establish your session.',
            });
        }
        req.session.userId = user.id;
        req.session.save((saveError) => {
            if (saveError) {
                logAuthFailure('login session persistence', saveError, password);
                return res.status(500).json({
                    error: 'Internal server error',
                    message: 'Unable to establish your session.',
                });
            }
            return res.status(200).json({
                message: 'Login successful.',
                user: safeUser(user),
            });
        });
    });
});
router.get('/me', requireAuth, (req, res) => {
    res.status(200).json({
        user: req.user,
    });
});
router.post('/logout', requireAuth, (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                error: 'Internal server error',
                message: 'Unable to log out right now.',
            });
        }
        res.clearCookie('vulnforge.sid', {
            httpOnly: true,
            sameSite: 'lax',
            secure: env.NODE_ENV === 'production',
            path: '/',
        });
        return res.status(200).json({
            message: 'Logged out successfully.',
        });
    });
});
router.get('/admin-check', requireAuth, requireRole(['ADMIN']), (_req, res) => {
    res.status(200).json({
        message: 'Admin access granted.',
    });
});
export default router;
