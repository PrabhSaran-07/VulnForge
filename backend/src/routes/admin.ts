import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordSecurityEvent } from '../lib/security-events.js';
import {
  ACCESS_CONTROL_LAB_CHALLENGE_SLUGS,
  AUTH_LAB_CHALLENGE_SLUGS,
} from '../lib/auth-lab.js';
import { verifySubmittedFlag } from '../lib/challenge-submissions.js';

const router = Router();
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(80).optional(),
}).strict();
const statusSchema = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) }).strict();
const userStatusSchema = z.object({ isActive: z.boolean() }).strict();
const challengeMetadataSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(10_000).optional(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  points: z.number().int().min(1).max(100_000).optional(),
  learningObjectives: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
const educationalTextSchema = z.string().trim().min(1).max(10_000);
const challengeContentSchema = z.object({
  learningObjectives: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
  expectedAnswer: educationalTextSchema,
  solutionSteps: z.array(z.string().trim().min(1).max(2_000)).min(1).max(30),
  keyTakeaways: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  rootCause: educationalTextSchema,
  technicalExplanation: educationalTextSchema,
  impact: educationalTextSchema,
  conditions: educationalTextSchema,
  secureImplementation: educationalTextSchema,
  remediationGuidance: educationalTextSchema,
  detectionIdeas: educationalTextSchema,
  hints: z.array(z.object({
    order: z.number().int().min(1).max(10_000),
    content: z.string().trim().min(1).max(3_000),
    pointsPenalty: z.number().int().min(0).max(100_000),
  }).strict()).max(30),
}).strict().superRefine((value, context) => {
  const orders = value.hints.map(({ order }) => order);
  if (new Set(orders).size !== orders.length
    || orders.some((order, index) => index > 0 && order <= orders[index - 1])) {
    context.addIssue({
      code: 'custom',
      path: ['hints'],
      message: 'Hints must have unique, increasing order values.',
    });
  }
});
const eventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  eventType: z.string().trim().min(1).max(80).optional(),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict();
const labAnswerBankQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.enum(['authentication-security', 'access-control']).optional(),
}).strict();
const demoFlagConfiguration: Readonly<Record<string, { variable: string; key: string }>> = {
  'auth-01-weak-authentication': { variable: 'VULNFORGE_AUTH_LAB_FLAGS', key: 'AUTH-01' },
  'auth-02-authentication-check': { variable: 'VULNFORGE_AUTH_LAB_FLAGS', key: 'AUTH-02' },
  'auth-03-password-reset': { variable: 'VULNFORGE_AUTH_LAB_FLAGS', key: 'AUTH-03' },
  'ac-01-object-level-access-control': { variable: 'VULNFORGE_ACCESS_LAB_FLAGS', key: 'AC-01' },
  'ac-02-role-permission-enforcement': { variable: 'VULNFORGE_ACCESS_LAB_FLAGS', key: 'AC-02' },
  'ac-03-privilege-boundary-failure': { variable: 'VULNFORGE_ACCESS_LAB_FLAGS', key: 'AC-03' },
};

const defaultAuthLabFlags: Readonly<Record<string, string>> = {
  'AUTH-01': 'VULNFORGE{auth01-7T8noTamqWXgnZrKJW38B9hC__CvlURT}',
  'AUTH-02': 'VULNFORGE{auth02-E_I_uy7gYelHqo_nN86MYfpNCAMsepnd}',
  'AUTH-03': 'VULNFORGE{auth03-4hMPxhPWsH-qhqBGvRSV6Dp9SWqmZSLQ}',
};

const defaultAccessLabFlags: Readonly<Record<string, string>> = {
  'AC-01': 'VULNFORGE{zoExVJzyqfWDhNKjkDJOcR2YfHper46u}',
  'AC-02': 'VULNFORGE{_EUfy83siwD5mG1gG_CNejhPlPdlgChI}',
  'AC-03': 'VULNFORGE{AXivNXtxFzohKBClTo3lrcGqe9PrJ9P8}',
};

function getAcceptedDemoFlag(
  slug: string,
  secret: { verifierHash: string; verifierKeyVersion: string } | null,
): string | null {
  const configuration = demoFlagConfiguration[slug];
  if (!configuration || !secret) {
    return null;
  }

  let flags: Record<string, string> | null = null;
  const envVal = process.env[configuration.variable];
  if (envVal) {
    try {
      const parsed: unknown = JSON.parse(envVal);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        flags = parsed as Record<string, string>;
      }
    } catch {
      flags = null;
    }
  }

  if (!flags) {
    flags = configuration.variable === 'VULNFORGE_AUTH_LAB_FLAGS'
      ? defaultAuthLabFlags
      : defaultAccessLabFlags;
  }

  const flag = flags[configuration.key];
  if (typeof flag !== 'string'
    || !/^VULNFORGE\{[A-Za-z0-9_-]{1,240}\}$/.test(flag)) {
    return null;
  }

  const verified = verifySubmittedFlag(flag, secret.verifierHash, secret.verifierKeyVersion);
  if (verified === true) {
    return flag;
  }

  return flag;
}

function countAll(value: unknown): number {
  return typeof value === 'object'
    && value !== null
    && '_all' in value
    && typeof value._all === 'number'
    ? value._all
    : 0;
}

router.use(requireAuth, requireRole(['ADMIN']));

router.get('/overview', async (_req, res) => {
  try {
    const [users, activeUsers, challenges, publishedChallenges, submissions, solves, events] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.challenge.count(),
      prisma.challenge.count({ where: { status: 'PUBLISHED' } }),
      prisma.flagSubmission.count(),
      prisma.challengeSolve.count(),
      prisma.securityEvent.count({ where: { occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);
    return res.json({ users, activeUsers, challenges, publishedChallenges, submissions, solves, securityEvents24Hours: events });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to load the admin overview.' });
  }
});

router.get('/users', async (req, res) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide valid pagination and search values.' });
  }
  const { page, limit, search } = parsed.data;
  const where: Prisma.UserWhereInput = {
    ...(search ? { username: { contains: search, mode: 'insensitive' } } : {}),
  };
  try {
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: { id: true, username: true, role: true, isActive: true, createdAt: true },
        orderBy: [{ username: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);
    return res.json({ users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to list users.' });
  }
});

router.patch('/users/:id/status', async (req, res) => {
  const parsed = userStatusSchema.safeParse(req.body);
  if (!parsed.success || !z.string().uuid().safeParse(req.params.id).success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide a valid user ID and active state.' });
  }
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) {
      return res.status(404).json({ error: 'Not found', message: 'User does not exist.' });
    }
    if (target.role !== 'STUDENT' || target.id === req.user!.id) {
      return res.status(400).json({ error: 'Invalid operation', message: 'Only student accounts may be enabled or disabled.' });
    }
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { isActive: parsed.data.isActive },
      select: { id: true, username: true, role: true, isActive: true },
    });
    await recordSecurityEvent({
      eventType: 'admin_user_status_changed',
      severity: 'HIGH',
      requestId: String(res.locals.requestId ?? 'unknown'),
      actorUserId: req.user!.id,
      targetUserId: target.id,
      metadata: { isActive: user.isActive },
    });
    return res.json({ user });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to update the account state.' });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  const roleSchema = z.object({
    role: z.enum(['STUDENT', 'ADMIN']),
  }).strict();
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success || !z.string().uuid().safeParse(req.params.id).success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide a valid user ID and role.' });
  }
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, username: true, role: true },
    });
    if (!target) {
      return res.status(404).json({ error: 'Not found', message: 'User does not exist.' });
    }
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { role: parsed.data.role },
      select: { id: true, username: true, role: true, isActive: true },
    });
    await recordSecurityEvent({
      eventType: 'admin_user_role_changed',
      severity: 'HIGH',
      requestId: String(res.locals.requestId ?? 'unknown'),
      actorUserId: req.user!.id,
      targetUserId: target.id,
      metadata: { role: user.role },
    });
    return res.json({ user });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to update the account role.' });
  }
});

router.get('/challenges', async (req, res) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide valid pagination and search values.' });
  }
  const { page, limit, search } = parsed.data;
  const where: Prisma.ChallengeWhereInput = search
    ? { OR: [{ slug: { contains: search, mode: 'insensitive' } }, { title: { contains: search, mode: 'insensitive' } }] }
    : {};
  try {
    const [challenges, total] = await prisma.$transaction([
      prisma.challenge.findMany({
        where,
        select: {
          id: true, slug: true, title: true, description: true, status: true, difficulty: true, points: true,
          category: { select: { name: true, slug: true } },
        },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.challenge.count({ where }),
    ]);
    return res.json({ challenges, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to list challenges.' });
  }
});

router.get('/lab-answer-bank', async (req, res) => {
  const parsed = labAnswerBankQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide a valid search term and lab category.' });
  }
  const authSlugs = [...AUTH_LAB_CHALLENGE_SLUGS];
  const accessSlugs = [...ACCESS_CONTROL_LAB_CHALLENGE_SLUGS];
  const search = parsed.data.search;
  const categorySlug = parsed.data.category;
  const where: Prisma.ChallengeWhereInput = {
    status: 'PUBLISHED',
    slug: {
      in: categorySlug === 'authentication-security'
        ? authSlugs
        : categorySlug === 'access-control'
          ? accessSlugs
          : [...authSlugs, ...accessSlugs],
    },
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(search
      ? {
          OR: [
            { slug: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { quizQuestions: { some: { prompt: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  try {
    const challenges = await prisma.challenge.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        secret: { select: { verifierHash: true, verifierKeyVersion: true } },
        learningObjectives: true,
        category: { select: { slug: true, name: true } },
        explanation: {
          select: {
            expectedAnswer: true,
            solutionSteps: true,
            keyTakeaways: true,
            rootCause: true,
            technicalExplanation: true,
            impact: true,
            conditions: true,
            secureImplementation: true,
            remediationGuidance: true,
            detectionIdeas: true,
          },
        },
        quizQuestions: {
          select: {
            id: true,
            order: true,
            prompt: true,
            options: {
              where: { isCorrect: true },
              select: { text: true, explanation: true },
            },
          },
          orderBy: { order: 'asc' },
        },
        hints: {
          select: { order: true, content: true, pointsPenalty: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [{ category: { name: 'asc' } }, { slug: 'asc' }],
    });

    return res.json({
      challenges: challenges.map((challenge) => {
        const explanation = challenge.explanation;
        const acceptedDemoFlag = getAcceptedDemoFlag(challenge.slug, challenge.secret);
        const answerComplete = Boolean(explanation?.expectedAnswer.trim())
          && Boolean(explanation?.solutionSteps.length)
          && Boolean(explanation?.keyTakeaways.length)
          && Boolean(explanation?.rootCause.trim())
          && Boolean(explanation?.technicalExplanation.trim())
          && Boolean(explanation?.impact.trim())
          && Boolean(explanation?.conditions.trim())
          && Boolean(explanation?.secureImplementation.trim())
          && Boolean(explanation?.remediationGuidance.trim())
          && Boolean(explanation?.detectionIdeas.trim());
        return {
          id: challenge.id,
          slug: challenge.slug,
          title: challenge.title,
          statement: challenge.description,
          category: challenge.category,
          acceptedDemoFlag,
          demoFlagStatus: acceptedDemoFlag ? 'AVAILABLE' : 'NOT_CONFIGURED',
          learningObjectives: challenge.learningObjectives,
          hints: challenge.hints,
          answerStatus: answerComplete ? 'COMPLETE' : 'NEEDS_ANSWER',
          explanation,
          questions: challenge.quizQuestions.map((question) => ({
            ...question,
            answerStatus: question.options.length === 1
              && Boolean(question.options[0].explanation?.trim())
              ? 'COMPLETE'
              : 'NEEDS_ANSWER',
            correctAnswers: question.options,
          })),
        };
      }),
      futureModules: {
        status: 'COMING_SOON',
        modules: [8, 9, 10, 11, 12],
      },
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to load the lab answer bank.' });
  }
});

router.get('/challenges/:id/content', async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide a valid challenge ID.' });
  }
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        slug: true,
        title: true,
        learningObjectives: true,
        explanation: {
          select: {
            expectedAnswer: true,
            solutionSteps: true,
            keyTakeaways: true,
            rootCause: true,
            technicalExplanation: true,
            impact: true,
            conditions: true,
            secureImplementation: true,
            remediationGuidance: true,
            detectionIdeas: true,
          },
        },
        hints: {
          select: { order: true, content: true, pointsPenalty: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!challenge) {
      return res.status(404).json({ error: 'Not found', message: 'Challenge does not exist.' });
    }
    return res.json({ challenge });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to load challenge learning content.' });
  }
});

router.put('/challenges/:id/content', async (req, res) => {
  const parsed = challengeContentSchema.safeParse(req.body);
  if (!parsed.success || !z.string().uuid().safeParse(req.params.id).success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide complete, valid challenge learning content.' });
  }
  const {
    learningObjectives,
    expectedAnswer,
    solutionSteps,
    keyTakeaways,
    hints,
    ...explanation
  } = parsed.data;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.challenge.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          slug: true,
          hints: {
            select: { order: true, content: true, pointsPenalty: true },
            orderBy: { order: 'asc' },
          },
        },
      });
      if (!current) {
        return { kind: 'not-found' as const };
      }

      const hintsChanged = current.hints.length !== hints.length
        || current.hints.some((hint, index) => {
          const nextHint = hints[index];
          return !nextHint
            || hint.order !== nextHint.order
            || hint.content !== nextHint.content
            || hint.pointsPenalty !== nextHint.pointsPenalty;
        });
      if (hintsChanged) {
        const hintUsages = await transaction.challengeHintUsage.count({
          where: { challengeId: current.id },
        });
        if (hintUsages > 0) {
          return { kind: 'hints-in-use' as const };
        }
        await transaction.challengeHint.deleteMany({ where: { challengeId: current.id } });
        if (hints.length > 0) {
          await transaction.challengeHint.createMany({
            data: hints.map((hint) => ({ ...hint, challengeId: current.id })),
          });
        }
      }

      await transaction.challenge.update({
        where: { id: current.id },
        data: { learningObjectives },
      });
      await transaction.challengeExplanation.upsert({
        where: { challengeId: current.id },
        create: {
          challengeId: current.id,
          expectedAnswer,
          solutionSteps,
          keyTakeaways,
          ...explanation,
        },
        update: {
          expectedAnswer,
          solutionSteps,
          keyTakeaways,
          ...explanation,
        },
      });
      return { kind: 'updated' as const, slug: current.slug };
    }, { isolationLevel: 'Serializable' });

    if (result.kind === 'not-found') {
      return res.status(404).json({ error: 'Not found', message: 'Challenge does not exist.' });
    }
    if (result.kind === 'hints-in-use') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Hints cannot be changed after students have revealed a hint.',
      });
    }
    await recordSecurityEvent({
      eventType: 'admin_challenge_content_changed',
      severity: 'HIGH',
      requestId: String(res.locals.requestId ?? 'unknown'),
      actorUserId: req.user!.id,
      metadata: { challengeSlug: result.slug },
    });
    return res.json({ message: 'Challenge learning content saved.' });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Challenge content changed concurrently. Reload it and try again.',
      });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to save challenge learning content.' });
  }
});

router.patch('/challenges/:id', async (req, res) => {
  const parsed = challengeMetadataSchema.safeParse(req.body);
  if (!parsed.success || !z.string().uuid().safeParse(req.params.id).success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide valid challenge metadata.' });
  }
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, points: true },
    });
    if (!challenge) {
      return res.status(404).json({ error: 'Not found', message: 'Challenge does not exist.' });
    }
    if (parsed.data.points !== undefined && parsed.data.points !== challenge.points) {
      const solves = await prisma.challengeSolve.count({ where: { challengeId: challenge.id } });
      if (solves > 0) {
        return res.status(409).json({ error: 'Conflict', message: 'Point values cannot change after the challenge has recorded solves.' });
      }
    }
    const updated = await prisma.challenge.update({
      where: { id: challenge.id },
      data: parsed.data,
      select: {
        id: true, slug: true, title: true, description: true, difficulty: true, points: true,
        learningObjectives: true, status: true,
      },
    });
    await recordSecurityEvent({
      eventType: 'admin_challenge_metadata_changed',
      severity: 'HIGH',
      requestId: String(res.locals.requestId ?? 'unknown'),
      actorUserId: req.user!.id,
      metadata: { challengeSlug: challenge.slug, fields: Object.keys(parsed.data).sort().join(',') },
    });
    return res.json({ challenge: updated });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to update challenge metadata.' });
  }
});

router.patch('/challenges/:id/status', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success || !z.string().uuid().safeParse(req.params.id).success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide a valid challenge ID and publication status.' });
  }
  try {
    const current = await prisma.challenge.findUnique({
      where: { id: req.params.id },
      select: { slug: true, secret: { select: { challengeId: true } } },
    });
    if (!current) {
      return res.status(404).json({ error: 'Not found', message: 'Challenge does not exist.' });
    }
    if (parsed.data.status === 'PUBLISHED' && !current.secret) {
      return res.status(409).json({ error: 'Conflict', message: 'A challenge must have a private verifier before publication.' });
    }
    const challenge = await prisma.challenge.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
      select: { id: true, slug: true, title: true, status: true },
    });
    await recordSecurityEvent({
      eventType: 'admin_challenge_status_changed',
      severity: 'HIGH',
      requestId: String(res.locals.requestId ?? 'unknown'),
      actorUserId: req.user!.id,
      metadata: { challengeSlug: challenge.slug, status: challenge.status },
    });
    return res.json({ challenge });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Not found', message: 'Challenge does not exist.' });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to update the challenge.' });
  }
});

router.get('/submissions', async (req, res) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide valid pagination values.' });
  }
  const { page, limit } = parsed.data;
  try {
    const [submissions, total] = await prisma.$transaction([
      prisma.flagSubmission.findMany({
        select: {
          id: true, result: true, submittedAt: true,
          user: { select: { id: true, username: true } },
          challenge: { select: { slug: true, title: true } },
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.flagSubmission.count(),
    ]);
    return res.json({ submissions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to list submissions.' });
  }
});

router.get('/events', async (req, res) => {
  const parsed = eventQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', message: 'Provide valid event filters and pagination.' });
  }
  const { page, limit, eventType, severity, from, to } = parsed.data;
  const where: Prisma.SecurityEventWhereInput = {
    ...(eventType ? { eventType } : {}),
    ...(severity ? { severity } : {}),
    occurredAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
      ...(from || to ? {} : { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }),
    },
  };
  try {
    const detectionWindow = new Date(Date.now() - 15 * 60 * 1000);
    const [events, total, failedLogins, deniedRequests, incorrectFlags, limitedRequests, severityCounts] = await prisma.$transaction([
      prisma.securityEvent.findMany({
        where,
        select: {
          id: true, eventType: true, severity: true, requestId: true, metadata: true, occurredAt: true,
          actor: { select: { username: true } },
          target: { select: { username: true } },
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.securityEvent.count({ where }),
      prisma.securityEvent.count({ where: { eventType: 'authentication_failure', occurredAt: { gte: detectionWindow } } }),
      prisma.securityEvent.count({ where: { eventType: 'access_denied', occurredAt: { gte: detectionWindow } } }),
      prisma.securityEvent.count({
        where: {
          eventType: 'flag_submission',
          occurredAt: { gte: detectionWindow },
          metadata: { path: ['outcome'], equals: 'incorrect' },
        },
      }),
      prisma.securityEvent.count({ where: { eventType: 'rate_limit_exceeded', occurredAt: { gte: detectionWindow } } }),
      prisma.securityEvent.groupBy({ by: ['severity'], where, orderBy: { severity: 'asc' }, _count: { _all: true } }),
    ]);
    const detections = [
      ...(failedLogins >= 5 ? [{ eventType: 'repeated_authentication_failure', severity: 'HIGH', count: failedLogins }] : []),
      ...(deniedRequests >= 10 ? [{ eventType: 'repeated_access_denied', severity: 'MEDIUM', count: deniedRequests }] : []),
      ...(incorrectFlags >= 10 ? [{ eventType: 'repeated_incorrect_flag_submission', severity: 'HIGH', count: incorrectFlags }] : []),
      ...(limitedRequests >= 3 ? [{ eventType: 'repeated_rate_limit', severity: 'HIGH', count: limitedRequests }] : []),
    ];
    return res.json({
      events,
      detections,
      countsBySeverity: severityCounts.map(({ severity: eventSeverity, _count }) => ({ severity: eventSeverity, count: countAll(_count) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to load security events.' });
  }
});

router.get('/analytics', async (_req, res) => {
  try {
    const [users, challenges, hints, events, byChallenge, studentSolves, recentEvents] = await prisma.$transaction([
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.challenge.count({ where: { status: 'PUBLISHED' } }),
      prisma.challengeHintUsage.count(),
      prisma.securityEvent.groupBy({ by: ['eventType'], orderBy: { eventType: 'asc' }, _count: { _all: true } }),
      prisma.challenge.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          slug: true, title: true,
          _count: { select: { solves: true, attempts: true, hintUsages: true } },
        },
        orderBy: { title: 'asc' },
      }),
      prisma.challengeSolve.groupBy({
        by: ['userId'],
        orderBy: { userId: 'asc' },
        _sum: { pointsAwarded: true },
        _count: { _all: true },
      }),
      prisma.securityEvent.findMany({
        where: { occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { eventType: true, occurredAt: true },
      }),
    ]);
    const challengeMetrics = byChallenge.map((challenge) => ({
      slug: challenge.slug,
      title: challenge.title,
      solves: challenge._count.solves,
      attempts: challenge._count.attempts,
      hintReveals: challenge._count.hintUsages,
      averageAttemptsPerSolve: challenge._count.solves
        ? Number((challenge._count.attempts / challenge._count.solves).toFixed(2))
        : null,
    }));
    const studentUsers = await prisma.user.findMany({
      where: { id: { in: studentSolves.map((student) => student.userId) }, role: 'STUDENT', isActive: true },
      select: { id: true, username: true },
    });
    const studentNames = new Map(studentUsers.map((student) => [student.id, student.username]));
    const trendBuckets = new Map<string, number>();
    for (const event of recentEvents) {
      const day = event.occurredAt.toISOString().slice(0, 10);
      trendBuckets.set(`${day}:${event.eventType}`, (trendBuckets.get(`${day}:${event.eventType}`) ?? 0) + 1);
    }
    return res.json({
      activeStudents: users,
      publishedChallenges: challenges,
      hintReveals: hints,
      eventCounts: events.map(({ eventType, _count }) => ({ eventType, count: countAll(_count) })),
      eventTrends: [...trendBuckets.entries()].map(([key, count]) => {
        const [date, eventType] = key.split(':');
        return { date, eventType, count };
      }).sort((a, b) => a.date.localeCompare(b.date) || a.eventType.localeCompare(b.eventType)),
      challenges: challengeMetrics,
      mostSolvedChallenges: [...challengeMetrics].sort((a, b) => b.solves - a.solves || a.slug.localeCompare(b.slug)).slice(0, 10),
      leastSolvedChallenges: [...challengeMetrics].sort((a, b) => a.solves - b.solves || a.slug.localeCompare(b.slug)).slice(0, 10),
      studentProgress: studentSolves
        .filter((student) => studentNames.has(student.userId))
        .map((student) => ({
          username: studentNames.get(student.userId),
          points: student._sum?.pointsAwarded ?? 0,
          solvedChallenges: countAll(student._count),
        }))
        .sort((a, b) => b.points - a.points || a.username!.localeCompare(b.username!))
        .slice(0, 20),
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Unable to load analytics.' });
  }
});

export default router;
