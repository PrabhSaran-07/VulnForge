import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
const pageQuery = z.object({
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
function countAll(value) {
    return typeof value === 'object'
        && value !== null
        && '_all' in value
        && typeof value._all === 'number'
        ? value._all
        : 0;
}
router.get('/leaderboard', requireAuth, async (req, res) => {
    const parsed = pageQuery.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', message: 'Provide valid pagination values.' });
    }
    const { page, limit } = parsed.data;
    try {
        const [totals, firstSolve, categories] = await prisma.$transaction([
            prisma.challengeSolve.groupBy({
                by: ['userId'],
                orderBy: { userId: 'asc' },
                _sum: { pointsAwarded: true },
                _count: { _all: true },
            }),
            prisma.challengeSolve.findFirst({
                orderBy: [{ solvedAt: 'asc' }, { id: 'asc' }],
                select: { userId: true },
            }),
            prisma.category.findMany({
                where: { challenges: { some: { status: 'PUBLISHED' } } },
                select: { slug: true, name: true, _count: { select: { challenges: { where: { status: 'PUBLISHED' } } } } },
                orderBy: { slug: 'asc' },
            }),
        ]);
        const userIds = totals.map((row) => row.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds }, role: 'STUDENT', isActive: true },
            select: { id: true, username: true },
        });
        const usernames = new Map(users.map((user) => [user.id, user.username]));
        const ranked = totals
            .filter((row) => usernames.has(row.userId))
            .map((row) => ({
            userId: row.userId,
            username: usernames.get(row.userId),
            points: row._sum?.pointsAwarded ?? 0,
            solvedChallenges: countAll(row._count),
        }))
            .sort((a, b) => b.points - a.points || b.solvedChallenges - a.solvedChallenges || a.username.localeCompare(b.username) || a.userId.localeCompare(b.userId));
        let previousScore = '';
        let previousRank = 0;
        const rankedRows = ranked.map((row, index) => {
            const score = `${row.points}:${row.solvedChallenges}`;
            const rank = score === previousScore ? previousRank : index + 1;
            previousScore = score;
            previousRank = rank;
            return { ...row, rank };
        });
        const entries = rankedRows.slice((page - 1) * limit, page * limit);
        const categorySolves = await prisma.challengeSolve.findMany({
            where: { userId: { in: entries.map((entry) => entry.userId) }, challenge: { status: 'PUBLISHED' } },
            select: { userId: true, challenge: { select: { category: { select: { slug: true } } } } },
        });
        const leaderboard = entries.map((entry) => {
            const categoryProgress = categories.map((category) => {
                const solvedCount = categorySolves.filter((solve) => solve.userId === entry.userId && solve.challenge.category.slug === category.slug).length;
                return {
                    slug: category.slug,
                    name: category.name,
                    solved: solvedCount,
                    total: category._count.challenges,
                    completed: category._count.challenges > 0 && solvedCount >= category._count.challenges,
                };
            });
            const badges = [
                ...(firstSolve?.userId === entry.userId ? ['first-solve'] : []),
                ...categoryProgress.filter((category) => category.completed).map((category) => `category-complete:${category.slug}`),
            ];
            return {
                rank: entry.rank,
                username: entry.username,
                points: entry.points,
                solvedChallenges: entry.solvedChallenges,
                categoryProgress,
                badges,
            };
        });
        return res.json({ leaderboard, pagination: { page, limit, total: rankedRows.length, totalPages: Math.ceil(rankedRows.length / limit) } });
    }
    catch {
        return res.status(500).json({ error: 'Internal server error', message: 'Unable to load the leaderboard.' });
    }
});
router.get('/learning/analytics', requireAuth, async (req, res) => {
    try {
        const [attempts, solves, hints, quizzes, categoryCounts] = await prisma.$transaction([
            prisma.challengeAttempt.findMany({
                where: { userId: req.user.id },
                distinct: ['challengeId'],
                select: { challengeId: true },
            }),
            prisma.challengeSolve.findMany({
                where: { userId: req.user.id, challenge: { status: 'PUBLISHED' } },
                select: { challenge: { select: { category: { select: { slug: true, name: true } } } } },
            }),
            prisma.challengeHintUsage.count({ where: { userId: req.user.id } }),
            prisma.challengeQuizAttempt.findMany({
                where: { userId: req.user.id },
                select: { score: true, totalQuestions: true },
            }),
            prisma.category.findMany({
                where: { challenges: { some: { status: 'PUBLISHED' } } },
                select: {
                    slug: true, name: true,
                    _count: { select: { challenges: { where: { status: 'PUBLISHED' } } } },
                },
            }),
        ]);
        const solvedByCategory = new Map();
        for (const solve of solves) {
            const category = solve.challenge.category;
            const current = solvedByCategory.get(category.slug) ?? { name: category.name, count: 0 };
            current.count += 1;
            solvedByCategory.set(category.slug, current);
        }
        return res.json({
            challengesStarted: attempts.length,
            challengesSolved: solves.length,
            hintsRevealed: hints,
            quizAttempts: quizzes.length,
            quizAveragePercentage: quizzes.length
                ? Math.round(quizzes.reduce((sum, quiz) => sum + quiz.score / quiz.totalQuestions, 0) / quizzes.length * 100)
                : null,
            categories: categoryCounts.map((category) => ({
                slug: category.slug,
                name: category.name,
                solved: solvedByCategory.get(category.slug)?.count ?? 0,
                total: category._count.challenges,
            })),
        });
    }
    catch {
        return res.status(500).json({ error: 'Internal server error', message: 'Unable to load learning analytics.' });
    }
});
export default router;
