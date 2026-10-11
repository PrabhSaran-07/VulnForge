import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import {
  hashPassword,
  isStrongPassword,
  isValidEmail,
  loginSchema,
  normalizeEmail,
  normalizeUsername,
  safeUser,
  userSelect,
  verifyPassword,
  registerSchema,
} from '../lib/auth.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Please wait before creating another account.',
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Please wait before trying to sign in again.',
  },
});

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

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (existingUser) {
    if (existingUser.username === username) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username is already in use.',
      });
    }

    return res.status(409).json({
      error: 'Conflict',
      message: 'Email is already in use.',
    });
  }

  const passwordHash = await hashPassword(password);

  try {
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
  } catch (error) {
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

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: isEmail ? lookupValue : undefined }, { username: !isEmail ? lookupValue : undefined }],
      },
      select: userSelect,
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials.',
      });
    }

    req.session.userId = user.id;

    req.session.save((error) => {
      if (error) {
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
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to log in right now.',
    });
  }
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

    res.clearCookie('vulnforge.sid');
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
