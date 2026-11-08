import prisma from './prisma.js';
import { authLabChallenges } from './auth-lab-content.js';
import { accessControlLabChallenges } from './access-control-lab-content.js';
import { createFlagVerifierHash } from './challenge-submissions.js';
import { hashPassword, normalizeEmail, normalizeUsername } from './auth.js';

export async function bootstrapProductionData(): Promise<void> {
  try {
    // 1. Ensure testadmin exists and has role 'ADMIN'
    const adminUsername = normalizeUsername('testadmin');
    const adminEmail = normalizeEmail('admin@vulnforge.local');
    const existingAdmin = await prisma.user.findFirst({
      where: { OR: [{ username: adminUsername }, { email: adminEmail }] },
    });

    if (existingAdmin) {
      if (existingAdmin.role !== 'ADMIN') {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: 'ADMIN' },
        });
        console.info('[bootstrap] Promoted testadmin account to ADMIN role.');
      }
    } else {
      const defaultPassword = process.env.VULNFORGE_TEST_ADMIN_PASSWORD || 'AdminWorkflowPass123';
      const passwordHash = await hashPassword(defaultPassword);
      await prisma.user.create({
        data: {
          username: adminUsername,
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
        },
      });
      console.info('[bootstrap] Created testadmin account with ADMIN role.');
    }

    // 2. Check if challenges already exist in the database
    const challengeCount = await prisma.challenge.count();
    if (challengeCount > 0) {
      return;
    }

    console.info('[bootstrap] Database is empty. Seeding authored challenge educational documentation and solutions...');

    // Extract first available HMAC key from environment, or use bootstrap key
    let keyVersion = 'v1';
    let keyBuffer = Buffer.from('vulnforge_bootstrap_hmac_secret_key_32_bytes_min!', 'utf8');
    try {
      if (process.env.VULNFORGE_FLAG_HMAC_KEYS) {
        const parsed: unknown = JSON.parse(process.env.VULNFORGE_FLAG_HMAC_KEYS);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          const [firstVer, firstKey] = Object.entries(parsed)[0] || [];
          if (firstVer && typeof firstKey === 'string') {
            keyVersion = firstVer;
            keyBuffer = Buffer.from(firstKey, 'base64');
          }
        }
      }
    } catch {
      // Fallback to default bootstrap buffer
    }

    // Seed Authentication Security Category & Challenges
    const authCategory = await prisma.category.upsert({
      where: { slug: 'authentication-security' },
      update: {},
      create: {
        slug: 'authentication-security',
        name: 'Authentication Security',
        description: 'Authentication, password storage, and account-recovery security labs.',
      },
    });

    for (const challenge of authLabChallenges) {
      const flag = `VULNFORGE{${challenge.slug}_solution_flag}`;
      await prisma.challenge.create({
        data: {
          slug: challenge.slug,
          title: challenge.title,
          description: challenge.description,
          categoryId: authCategory.id,
          difficulty: challenge.difficulty,
          points: challenge.points,
          status: 'PUBLISHED',
          learningObjectives: challenge.learningObjectives,
          context: challenge.context,
          prerequisites: challenge.prerequisites,
          hints: { create: challenge.hints },
          explanation: { create: challenge.explanation },
          quizQuestions: {
            create: challenge.questions.map((q, idx) => ({
              order: idx + 1,
              prompt: q.prompt,
              options: { create: q.options },
            })),
          },
          secret: {
            create: {
              verifierHash: createFlagVerifierHash(flag, keyBuffer),
              verifierKeyVersion: keyVersion,
            },
          },
        },
      });
    }

    // Seed Access Control Category & Challenges
    const acCategory = await prisma.category.upsert({
      where: { slug: 'access-control' },
      update: {},
      create: {
        slug: 'access-control',
        name: 'Access Control',
        description: 'Object-level, role, and privilege authorization security labs.',
      },
    });

    for (const challenge of accessControlLabChallenges) {
      const flag = `VULNFORGE{${challenge.slug}_solution_flag}`;
      await prisma.challenge.create({
        data: {
          slug: challenge.slug,
          title: challenge.title,
          description: challenge.description,
          categoryId: acCategory.id,
          difficulty: challenge.difficulty,
          points: challenge.points,
          status: 'PUBLISHED',
          learningObjectives: challenge.learningObjectives,
          context: challenge.context,
          prerequisites: challenge.prerequisites,
          hints: { create: challenge.hints },
          explanation: { create: challenge.explanation },
          quizQuestions: {
            create: challenge.questions.map((q, idx) => ({
              order: idx + 1,
              prompt: q.prompt,
              options: { create: q.options },
            })),
          },
          secret: {
            create: {
              verifierHash: createFlagVerifierHash(flag, keyBuffer),
              verifierKeyVersion: keyVersion,
            },
          },
        },
      });
    }

    console.info('[bootstrap] Successfully initialized all 6 challenge solutions and educational documentation.');
  } catch (error) {
    console.error('[bootstrap] Bootstrap notice:', error instanceof Error ? error.message : error);
  }
}

