import { Router, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AUTH_LAB_CHALLENGE_SLUGS, isAuthLabContentVisible } from '../lib/auth-lab.js';
import { requireAuth } from '../middleware/auth.js';
import { persistSubmission, verifySubmittedFlag } from '../lib/challenge-submissions.js';

const router = Router();
const authLabChallengeSlugs = new Set<string>(AUTH_LAB_CHALLENGE_SLUGS);

function canBrowseAuthLab(req: Request): boolean {
  return isAuthLabContentVisible(env.NODE_ENV, req.socket.remoteAddress);
}

router.param('slug', (req, res, next, slug) => {
  if (authLabChallengeSlugs.has(slug) && !canBrowseAuthLab(req)) {
    return res.status(404).json({
      error: 'Not found',
      message: 'The requested challenge does not exist.',
    });
  }
  return next();
});

const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const attemptIdSchema = z.string().uuid();
const flagSubmissionSchema = z.object({
  flag: z.string().min(1).max(256),
}).strict();
const hintRevealSchema = z.object({
  order: z.number().int().min(1).max(10_000),
  confirmPenalty: z.boolean().optional(),
}).strict();
const quizSubmissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
  }).strict()).min(1).max(100),
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

const currentAvailability = (now: Date, includeAuthLab: boolean) => ({
  status: 'PUBLISHED' as const,
  AND: [
    { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
    { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] },
    ...(!includeAuthLab ? [{ slug: { notIn: [...AUTH_LAB_CHALLENGE_SLUGS] } }] : []),
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

router.get('/categories', requireAuth, async (_req, res) => {
  const now = new Date();
  const availableChallenges = currentAvailability(now, canBrowseAuthLab(_req));

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

router.get('/challenges', requireAuth, async (req, res) => {
  const parsed = challengeListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return invalidRequest(res, 'Provide valid category, difficulty, solved, page, and limit filters.');
  }

  const { category, difficulty, solved, page, limit } = parsed.data;
  const now = new Date();
  const availableChallenges = currentAvailability(now, canBrowseAuthLab(req));
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

router.get('/challenges/:slug', requireAuth, async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    return invalidRequest(res, 'Provide a valid challenge slug.');
  }

  const now = new Date();
  try {
    const challenge = await prisma.challenge.findFirst({
      where: {
        slug: parsedSlug.data,
        ...currentAvailability(now, canBrowseAuthLab(req)),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        learningObjectives: true,
        context: true,
        prerequisites: true,
        difficulty: true,
        points: true,
        category: {
          select: { id: true, slug: true, name: true, description: true },
        },
        solves: {
          where: { userId: req.user!.id },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!challenge) {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge does not exist.',
      });
    }

    const { solves, ...publicChallenge } = challenge;
    return res.status(200).json({
      challenge: {
        ...publicChallenge,
        solved: solves.length > 0,
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

router.post('/challenges/:slug/attempts', requireAuth, async (req, res) => {
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

router.post('/challenges/:slug/attempts/:attemptId/stop', requireAuth, async (req, res) => {
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
  requireAuth,
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

router.get('/challenges/:slug/hints', requireAuth, async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    return invalidRequest(res, 'Provide a valid challenge slug.');
  }

  try {
    const challenge = await prisma.challenge.findFirst({
      where: {
        slug: parsedSlug.data,
        ...currentAvailability(new Date(), canBrowseAuthLab(req)),
      },
      select: { id: true },
    });
    if (!challenge) {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge does not exist.',
      });
    }

    const hints = await prisma.challengeHint.findMany({
      where: { challengeId: challenge.id },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: {
        order: true,
        content: true,
        pointsPenalty: true,
        usages: {
          where: { userId: req.user!.id },
          select: { revealedAt: true, penaltyPoints: true },
          take: 1,
        },
      },
    });
    const revealedHints = hints.flatMap((hint) => {
      const usage = hint.usages[0];
      return usage
        ? [{
            order: hint.order,
            content: hint.content,
            penaltyPoints: usage.penaltyPoints,
            revealedAt: usage.revealedAt,
          }]
        : [];
    });
    const nextHint = hints.find((hint) => hint.usages.length === 0);

    return res.status(200).json({
      hints: revealedHints,
      nextHint: nextHint
        ? { order: nextHint.order, penaltyPoints: nextHint.pointsPenalty }
        : null,
      totalPenaltyPoints: revealedHints.reduce((sum, hint) => sum + hint.penaltyPoints, 0),
    });
  } catch {
    return internalError(res);
  }
});

router.post('/challenges/:slug/hints', requireAuth, async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  const parsedBody = hintRevealSchema.safeParse(req.body);
  if (!parsedSlug.success || !parsedBody.success) {
    return invalidRequest(res, 'Provide a valid challenge slug and hint order.');
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

      const challenge = await transaction.challenge.findUnique({
        where: { id: challengeId },
        select: {
          status: true,
          availableFrom: true,
          availableUntil: true,
        },
      });
      if (!challenge || !isAvailable(challenge, new Date())) {
        return { kind: 'not-found' as const };
      }

      const hint = await transaction.challengeHint.findUnique({
        where: {
          challengeId_order: {
            challengeId,
            order: parsedBody.data.order,
          },
        },
        select: {
          id: true,
          order: true,
          content: true,
          pointsPenalty: true,
        },
      });
      if (!hint) {
        return { kind: 'not-found' as const };
      }

      const existingUsage = await transaction.challengeHintUsage.findUnique({
        where: {
          userId_hintId: {
            userId: req.user!.id,
            hintId: hint.id,
          },
        },
        select: {
          penaltyPoints: true,
          revealedAt: true,
        },
      });
      if (existingUsage) {
        return {
          kind: 'revealed' as const,
          hint,
          usage: existingUsage,
          alreadyRevealed: true,
        };
      }

      const earlierLockedHint = await transaction.challengeHint.findFirst({
        where: {
          challengeId,
          order: { lt: hint.order },
          usages: { none: { userId: req.user!.id } },
        },
        select: { id: true },
      });
      if (earlierLockedHint) {
        return { kind: 'out-of-order' as const };
      }

      const activeAttempts = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "challenge_attempts"
        WHERE "challenge_id" = ${challengeId}::uuid
          AND "user_id" = ${req.user!.id}::uuid
          AND "status" = 'ACTIVE'
        ORDER BY "started_at" ASC, "id" ASC
        LIMIT 1
        FOR UPDATE
      `;
      if (!activeAttempts[0]) {
        return { kind: 'inactive-attempt' as const };
      }
      if (hint.pointsPenalty > 0 && parsedBody.data.confirmPenalty !== true) {
        return {
          kind: 'confirmation-required' as const,
          penaltyPoints: hint.pointsPenalty,
        };
      }

      const usage = await transaction.challengeHintUsage.create({
        data: {
          userId: req.user!.id,
          challengeId,
          hintId: hint.id,
          penaltyPoints: hint.pointsPenalty,
        },
        select: {
          penaltyPoints: true,
          revealedAt: true,
        },
      });
      return {
        kind: 'revealed' as const,
        hint,
        usage,
        alreadyRevealed: false,
      };
    });

    if (result.kind === 'not-found') {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge or hint does not exist.',
      });
    }
    if (result.kind === 'confirmation-required') {
      return res.status(409).json({
        error: 'Penalty confirmation required',
        message: `Revealing this hint will reduce your challenge award by ${result.penaltyPoints} points.`,
        penaltyPoints: result.penaltyPoints,
      });
    }
    if (result.kind === 'out-of-order') {
      return res.status(409).json({
        error: 'Hint locked',
        message: 'Reveal the previous hint before requesting this one.',
      });
    }
    if (result.kind === 'inactive-attempt') {
      return res.status(409).json({
        error: 'Active attempt required',
        message: 'Start or resume an active challenge attempt before revealing a hint.',
      });
    }

    return res.status(result.alreadyRevealed ? 200 : 201).json({
      hint: {
        order: result.hint.order,
        content: result.hint.content,
        penaltyPoints: result.usage.penaltyPoints,
        revealedAt: result.usage.revealedAt,
      },
      alreadyRevealed: result.alreadyRevealed,
    });
  } catch {
    return internalError(res);
  }
});

router.get('/challenges/:slug/explanation', requireAuth, async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    return invalidRequest(res, 'Provide a valid challenge slug.');
  }

  try {
    const challenge = await prisma.challenge.findUnique({
      where: { slug: parsedSlug.data },
      select: {
        id: true,
        solves: {
          where: { userId: req.user!.id },
          select: { id: true },
          take: 1,
        },
        explanation: {
          select: {
            rootCause: true,
            technicalExplanation: true,
            impact: true,
            conditions: true,
            secureImplementation: true,
            remediationGuidance: true,
            detectionIdeas: true,
          },
        },
      },
    });
    if (!challenge) {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge does not exist.',
      });
    }
    if (challenge.solves.length === 0) {
      return res.status(403).json({
        error: 'Learning content locked',
        message: 'Challenge explanations are available after solving the challenge.',
      });
    }

    return res.status(200).json({ explanation: challenge.explanation });
  } catch {
    return internalError(res);
  }
});

router.get('/challenges/:slug/quiz', requireAuth, async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    return invalidRequest(res, 'Provide a valid challenge slug.');
  }

  try {
    const challenge = await prisma.challenge.findUnique({
      where: { slug: parsedSlug.data },
      select: {
        id: true,
        solves: {
          where: { userId: req.user!.id },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!challenge) {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge does not exist.',
      });
    }
    if (challenge.solves.length === 0) {
      return res.status(403).json({
        error: 'Learning content locked',
        message: 'Knowledge checks are available after solving the challenge.',
      });
    }

    const questions = await prisma.challengeQuizQuestion.findMany({
      where: { challengeId: challenge.id },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        order: true,
        prompt: true,
        options: {
          orderBy: [{ id: 'asc' }],
          select: { id: true, text: true },
        },
      },
    });
    return res.status(200).json({ questions });
  } catch {
    return internalError(res);
  }
});

router.post('/challenges/:slug/quiz/attempts', requireAuth, async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  const parsedBody = quizSubmissionSchema.safeParse(req.body);
  if (!parsedSlug.success || !parsedBody.success) {
    return invalidRequest(res, 'Provide valid answers for the challenge knowledge check.');
  }
  const answerByQuestion = new Map(
    parsedBody.data.answers.map(({ questionId, optionId }) => [questionId, optionId]),
  );
  if (answerByQuestion.size !== parsedBody.data.answers.length) {
    return invalidRequest(res, 'Submit exactly one answer for each question.');
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const challenge = await transaction.challenge.findUnique({
        where: { slug: parsedSlug.data },
        select: {
          id: true,
          solves: {
            where: { userId: req.user!.id },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!challenge) {
        return { kind: 'not-found' as const };
      }
      if (challenge.solves.length === 0) {
        return { kind: 'locked' as const };
      }

      const questions = await transaction.challengeQuizQuestion.findMany({
        where: { challengeId: challenge.id },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          prompt: true,
          options: {
            select: {
              id: true,
              text: true,
              isCorrect: true,
              explanation: true,
            },
          },
        },
      });
      if (
        questions.length === 0
        || questions.some((question) => question.options.filter((option) => option.isCorrect).length !== 1)
      ) {
        return { kind: 'quiz-unavailable' as const };
      }
      if (questions.length !== answerByQuestion.size) {
        return { kind: 'invalid-answers' as const };
      }

      const answeredQuestions = questions.map((question) => {
        const selectedOptionId = answerByQuestion.get(question.id);
        const selectedOption = question.options.find((option) => option.id === selectedOptionId);
        return selectedOption
          ? {
              question,
              selectedOption,
              isCorrect: selectedOption.isCorrect,
            }
          : null;
      });
      if (answeredQuestions.some((answer) => answer === null)) {
        return { kind: 'invalid-answers' as const };
      }

      const validAnswers = answeredQuestions.filter((answer) => answer !== null);
      const score = validAnswers.reduce((total, answer) => total + Number(answer.isCorrect), 0);
      const attempt = await transaction.challengeQuizAttempt.create({
        data: {
          userId: req.user!.id,
          challengeId: challenge.id,
          score,
          totalQuestions: questions.length,
        },
        select: {
          id: true,
          score: true,
          totalQuestions: true,
          submittedAt: true,
        },
      });
      await transaction.challengeQuizResponse.createMany({
        data: validAnswers.map(({ question, selectedOption, isCorrect }) => ({
          attemptId: attempt.id,
          challengeId: challenge.id,
          questionId: question.id,
          selectedOptionId: selectedOption.id,
          isCorrect,
        })),
      });

      return {
        kind: 'submitted' as const,
        attempt,
        responses: validAnswers.map(({ question, selectedOption, isCorrect }) => ({
          questionId: question.id,
          prompt: question.prompt,
          selectedOptionId: selectedOption.id,
          isCorrect,
          options: question.options.map((option) => ({
            id: option.id,
            text: option.text,
            isCorrect: option.isCorrect,
            explanation: option.explanation,
          })),
        })),
      };
    });

    if (result.kind === 'not-found') {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge does not exist.',
      });
    }
    if (result.kind === 'locked') {
      return res.status(403).json({
        error: 'Learning content locked',
        message: 'Knowledge checks are available after solving the challenge.',
      });
    }
    if (result.kind === 'quiz-unavailable') {
      return res.status(503).json({
        error: 'Knowledge check unavailable',
        message: 'This challenge knowledge check is not configured correctly.',
      });
    }
    if (result.kind === 'invalid-answers') {
      return invalidRequest(res, 'Select one valid option for every question.');
    }

    return res.status(201).json({
      attempt: {
        ...result.attempt,
        percentage: Math.round((result.attempt.score / result.attempt.totalQuestions) * 100),
      },
      responses: result.responses,
    });
  } catch {
    return internalError(res);
  }
});

router.get('/challenges/:slug/quiz/results', requireAuth, async (req, res) => {
  const parsedSlug = slugSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    return invalidRequest(res, 'Provide a valid challenge slug.');
  }

  try {
    const challenge = await prisma.challenge.findUnique({
      where: { slug: parsedSlug.data },
      select: {
        id: true,
        solves: {
          where: { userId: req.user!.id },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!challenge) {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested challenge does not exist.',
      });
    }
    if (challenge.solves.length === 0) {
      return res.status(403).json({
        error: 'Learning content locked',
        message: 'Knowledge-check results are available after solving the challenge.',
      });
    }

    const attempts = await prisma.challengeQuizAttempt.findMany({
      where: {
        userId: req.user!.id,
        challengeId: challenge.id,
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        score: true,
        totalQuestions: true,
        submittedAt: true,
        responses: {
          orderBy: [{ question: { order: 'asc' } }],
          select: {
            question: {
              select: {
                id: true,
                prompt: true,
                options: {
                  orderBy: [{ id: 'asc' }],
                  select: {
                    id: true,
                    text: true,
                    isCorrect: true,
                    explanation: true,
                  },
                },
              },
            },
            selectedOptionId: true,
            isCorrect: true,
          },
        },
      },
    });
    return res.status(200).json({
      attempts: attempts.map((attempt) => ({
        ...attempt,
        percentage: Math.round((attempt.score / attempt.totalQuestions) * 100),
      })),
    });
  } catch {
    return internalError(res);
  }
});

router.get('/learning/progress', requireAuth, async (req, res) => {
  try {
    const [solves, hintCount, attemptChallengeIds, quizAttempts] = await prisma.$transaction([
      prisma.challengeSolve.findMany({
        where: { userId: req.user!.id },
        orderBy: [{ solvedAt: 'desc' }, { id: 'desc' }],
        select: {
          pointsAwarded: true,
          solvedAt: true,
          challenge: {
            select: { slug: true, title: true, points: true },
          },
        },
      }),
      prisma.challengeHintUsage.count({
        where: { userId: req.user!.id },
      }),
      prisma.challengeAttempt.findMany({
        where: { userId: req.user!.id },
        distinct: ['challengeId'],
        select: { challengeId: true },
      }),
      prisma.challengeQuizAttempt.findMany({
        where: { userId: req.user!.id },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: 10,
        select: {
          id: true,
          score: true,
          totalQuestions: true,
          submittedAt: true,
          challenge: { select: { slug: true, title: true } },
        },
      }),
    ]);

    return res.status(200).json({
      points: solves.reduce((total, solve) => total + solve.pointsAwarded, 0),
      solvedChallenges: solves.length,
      attemptedChallenges: attemptChallengeIds.length,
      hintsRevealed: hintCount,
      solved: solves,
      recentQuizAttempts: quizAttempts.map((attempt) => ({
        ...attempt,
        percentage: Math.round((attempt.score / attempt.totalQuestions) * 100),
      })),
    });
  } catch {
    return internalError(res);
  }
});

export default router;
