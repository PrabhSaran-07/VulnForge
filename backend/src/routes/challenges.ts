import { Router, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { persistSubmission, verifySubmittedFlag } from '../lib/challenge-submissions.js';

const router = Router();

const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const attemptIdSchema = z.string().uuid();
const flagSubmissionSchema = z.object({
  flag: z.string().min(1).max(256),
}).strict();
const difficultySchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']);
const booleanQuerySchema = z.enum(['true', 'false']).transform((value) => value === 'true');
const positiveIntegerQuerySchema = (maximum: number, fallback: number) => z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(maximum))
  .optional()
  .transform((value) => value ?? fallback);

const challengeListQuerySchema = z.object({
  category: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  difficulty: difficultySchema.optional(),
  solved: booleanQuerySchema.optional(),
  page: positiveIntegerQuerySchema(100_000, 1),
  limit: positiveIntegerQuerySchema(100, 20),
}).strict();

const submissionLimitMessage = {
  error: 'Too many requests',
  message: 'Too many flag submissions. Please wait before trying again.',
};

const submissionUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 5 : 10,
  keyGenerator: (req) => `user:${req.user!.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: submissionLimitMessage,
});

const submissionIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 100,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
  message: submissionLimitMessage,
});

const currentAvailability = (now: Date) => ({
  status: 'PUBLISHED' as const,
  AND: [
    { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
    { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] },
  ],
});

function hasNoRequestBody(body: unknown): boolean {
  return body === undefined
    || (typeof body === 'object' && body !== null && !Array.isArray(body) && Object.keys(body).length === 0);
}

function isAvailable(challenge: {
  status: string;
  availableFrom: Date | null;
  availableUntil: Date | null;
}, now: Date): boolean {
  return challenge.status === 'PUBLISHED'
    && (challenge.availableFrom === null || challenge.availableFrom <= now)
    && (challenge.availableUntil === null || challenge.availableUntil > now);
}

function invalidRequest(res: Response, message: string) {
  return res.status(400).json({
    error: 'Invalid request',
    message,
  });
}

function internalError(res: Response) {
  return res.status(500).json({
    error: 'Internal server error',
    message: 'Unable to complete the challenge request right now.',
  });
}

router.use(requireAuth);

router.get('/categories', async (_req, res) => {
  const now = new Date();
  const availableChallenges = currentAvailability(now);

  try {
    const categories = await prisma.category.findMany({
      where: {
        challenges: {
          some: availableChallenges,
        },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        _count: {
          select: {
            challenges: {
              where: availableChallenges,
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        challengeCount: _count.challenges,
      })),
    });
  } catch {
    return internalError(res);
  }
});

router.get('/challenges', async (req, res) => {
  const parsed = challengeListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return invalidRequest(res, 'Provide valid category, difficulty, solved, page, and limit filters.');
  }

  const { category, difficulty, solved, page, limit } = parsed.data;
  const now = new Date();
  const availableChallenges = currentAvailability(now);
  const where: Prisma.ChallengeWhereInput = {
    ...availableChallenges,
    ...(category ? { category: { slug: category } } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(solved !== undefined
      ? {
          solves: solved
            ? { some: { userId: req.user!.id } }
            : { none: { userId: req.user!.id } },
        }
      : {}),
  };

  try {
    const [challenges, total] = await prisma.$transaction([
      prisma.challenge.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          category: {
            select: { id: true, slug: true, name: true },
          },
          difficulty: true,
          points: true,
          solves: {
            where: { userId: req.user!.id },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.challenge.count({ where }),
    ]);

    return res.status(200).json({
      challenges: challenges.map(({ solves, ...challenge }) => ({
        ...challenge,
        solved: solves.length > 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return internalError(res);
  }
});

router.get('/challenges/:slug', async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    return invalidRequest(res, 'Provide a valid challenge slug.');
  }

  const now = new Date();
  try {
    const challenge = await prisma.challenge.findFirst({
      where: {
        slug: parsedSlug.data,
        ...currentAvailability(now),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        learningObjectives: true,
        difficulty: true,
        points: true,
        category: {
          select: { id: true, slug: true, name: true, description: true },
        },
      },
    });

    if (!challenge) {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge does not exist.',
      });
    }

    return res.status(200).json({
      challenge: {
        ...challenge,
        lifecycleInstructions: {
          start: 'Start an attempt before working on this challenge.',
          activeAttempt: 'Starting again returns your current active attempt.',
          stop: 'An active attempt can be stopped once. Stopped attempts cannot be resumed.',
        },
      },
    });
  } catch {
    return internalError(res);
  }
});

router.post('/challenges/:slug/attempts', async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    return invalidRequest(res, 'Provide a valid challenge slug.');
  }
  if (!hasNoRequestBody(req.body)) {
    return invalidRequest(res, 'This endpoint does not accept a request body.');
  }

  try {
    const challenge = await prisma.challenge.findUnique({
      where: { slug: parsedSlug.data },
      select: {
        id: true,
        status: true,
        availableFrom: true,
        availableUntil: true,
      },
    });
    const now = new Date();

    if (!challenge || !isAvailable(challenge, now)) {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge does not exist.',
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "challenges"
        WHERE "id" = ${challenge.id}::uuid
        FOR UPDATE
      `;

      const currentChallenge = await transaction.challenge.findUnique({
        where: { id: challenge.id },
        select: {
          status: true,
          availableFrom: true,
          availableUntil: true,
        },
      });
      const startedAt = new Date();
      if (!currentChallenge || !isAvailable(currentChallenge, startedAt)) {
        return { kind: 'unavailable' as const };
      }

      const existingAttempt = await transaction.challengeAttempt.findFirst({
        where: {
          userId: req.user!.id,
          challengeId: challenge.id,
          status: 'ACTIVE',
        },
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          status: true,
          startedAt: true,
          solvedAt: true,
          stoppedAt: true,
        },
      });
      if (existingAttempt) {
        return { kind: 'existing' as const, attempt: existingAttempt };
      }

      const attempt = await transaction.challengeAttempt.create({
        data: {
          userId: req.user!.id,
          challengeId: challenge.id,
          startedAt,
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          solvedAt: true,
          stoppedAt: true,
        },
      });
      return { kind: 'created' as const, attempt };
    });

    if (result.kind === 'unavailable') {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge does not exist.',
      });
    }

    return res.status(result.kind === 'created' ? 201 : 200).json({
      attempt: result.attempt,
    });
  } catch {
    return internalError(res);
  }
});

router.post('/challenges/:slug/attempts/:attemptId/stop', async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  const parsedAttemptId = attemptIdSchema.safeParse(req.params.attemptId);
  if (!parsedSlug.success || !parsedAttemptId.success) {
    return invalidRequest(res, 'Provide a valid challenge slug and attempt ID.');
  }
  if (!hasNoRequestBody(req.body)) {
    return invalidRequest(res, 'This endpoint does not accept a request body.');
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const challenge = await transaction.challenge.findUnique({
        where: { slug: parsedSlug.data },
        select: { id: true },
      });
      if (!challenge) {
        return { kind: 'not-found' as const };
      }

      const stoppedAt = new Date();
      const update = await transaction.challengeAttempt.updateMany({
        where: {
          id: parsedAttemptId.data,
          challengeId: challenge.id,
          userId: req.user!.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'STOPPED',
          stoppedAt,
        },
      });

      if (update.count === 1) {
        const attempt = await transaction.challengeAttempt.findUnique({
          where: { id: parsedAttemptId.data },
          select: {
            id: true,
            status: true,
            startedAt: true,
            solvedAt: true,
            stoppedAt: true,
          },
        });
        return { kind: 'stopped' as const, attempt };
      }

      const existingAttempt = await transaction.challengeAttempt.findFirst({
        where: {
          id: parsedAttemptId.data,
          challengeId: challenge.id,
          userId: req.user!.id,
        },
        select: { id: true },
      });
      return existingAttempt ? { kind: 'invalid-transition' as const } : { kind: 'not-found' as const };
    });

    if (result.kind === 'not-found') {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested attempt does not exist.',
      });
    }
    if (result.kind === 'invalid-transition') {
      return res.status(409).json({
        error: 'Invalid attempt state',
        message: 'Only an active attempt can be stopped.',
      });
    }

    return res.status(200).json({ attempt: result.attempt });
  } catch {
    return internalError(res);
  }
});

router.post(
  '/challenges/:slug/attempts/:attemptId/submissions',
  submissionUserLimiter,
  submissionIpLimiter,
  async (req, res) => {
    const parsedSlug = slugSchema.safeParse(req.params.slug);
    const parsedAttemptId = attemptIdSchema.safeParse(req.params.attemptId);
    const parsedBody = flagSubmissionSchema.safeParse(req.body);
    if (!parsedSlug.success || !parsedAttemptId.success || !parsedBody.success) {
      return invalidRequest(res, 'Provide a valid challenge, attempt, and flag submission.');
    }

    const flag = parsedBody.data.flag;
    if (Buffer.byteLength(flag, 'utf8') > 256) {
      return invalidRequest(res, 'Flag submissions must not exceed 256 UTF-8 bytes.');
    }

    try {
      const result = await prisma.$transaction(async (transaction) => {
        const challenges = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "challenges"
          WHERE "slug" = ${parsedSlug.data}
          FOR UPDATE
        `;
        const challengeId = challenges[0]?.id;
        if (!challengeId) {
          return { kind: 'not-found' as const };
        }

        await transaction.$queryRaw`
          SELECT "id"
          FROM "challenge_attempts"
          WHERE "id" = ${parsedAttemptId.data}::uuid
            AND "challenge_id" = ${challengeId}::uuid
            AND "user_id" = ${req.user!.id}::uuid
          FOR UPDATE
        `;

        const attempt = await transaction.challengeAttempt.findFirst({
          where: {
            id: parsedAttemptId.data,
            challengeId,
            userId: req.user!.id,
          },
          select: {
            id: true,
            status: true,
            challenge: {
              select: {
                points: true,
                status: true,
                availableFrom: true,
                availableUntil: true,
                secret: {
                  select: {
                    verifierHash: true,
                    verifierKeyVersion: true,
                  },
                },
              },
            },
          },
        });
        if (!attempt) {
          return { kind: 'not-found' as const };
        }
        if (!isAvailable(attempt.challenge, new Date())) {
          return { kind: 'unavailable' as const };
        }
        if (attempt.status !== 'ACTIVE') {
          return { kind: 'invalid-state' as const };
        }

        const secret = attempt.challenge.secret;
        if (!secret) {
          return { kind: 'verification-unavailable' as const };
        }

        const isCorrect = verifySubmittedFlag(
          flag,
          secret.verifierHash,
          secret.verifierKeyVersion,
        );
        if (isCorrect === null) {
          return { kind: 'verification-unavailable' as const };
        }

        const submittedAt = new Date();
        const persisted = await persistSubmission(transaction, {
          userId: req.user!.id,
          challengeId,
          attemptId: attempt.id,
          points: attempt.challenge.points,
          correct: isCorrect,
          submittedAt,
        });
        return { kind: 'submitted' as const, correct: isCorrect, ...persisted };
      });

      if (result.kind === 'not-found') {
        return res.status(404).json({
          error: 'Not found',
          message: 'The requested attempt does not exist.',
        });
      }
      if (result.kind === 'unavailable') {
        return res.status(404).json({
          error: 'Not found',
          message: 'The requested challenge is not available.',
        });
      }
      if (result.kind === 'invalid-state') {
        return res.status(409).json({
          error: 'Invalid attempt state',
          message: 'Only an active attempt can accept flag submissions.',
        });
      }
      if (result.kind === 'verification-unavailable') {
        return res.status(503).json({
          error: 'Verification unavailable',
          message: 'Flag verification is temporarily unavailable.',
        });
      }
      if (!result.correct) {
        return res.status(200).json({
          correct: false,
          message: 'Incorrect flag.',
        });
      }

      return res.status(200).json({
        correct: true,
        pointsAwarded: result.pointsAwarded,
        alreadySolved: result.alreadySolved,
      });
    } catch {
      return internalError(res);
    }
  },
);

export default router;
