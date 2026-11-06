import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { accessControlLabChallenges } from '../lib/access-control-lab-content.js';
import { ACCESS_CONTROL_LAB_CHALLENGE_SLUGS, isAccessControlLabEnabled } from '../lib/auth-lab.js';
import { createFlagVerifierHash } from '../lib/challenge-submissions.js';

dotenv.config({ path: resolve(process.cwd(), '../.env') });

type Keyring = { version: string; key: Buffer };

function readKeyring(value: string | undefined): Keyring | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const entries = Object.entries(parsed);
    if (entries.length === 0) {
      return null;
    }
    const [version, encoded] = entries[0];
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(version) || typeof encoded !== 'string') {
      return null;
    }
    const key = Buffer.from(encoded, 'base64');
    if (key.length < 32 || key.toString('base64') !== encoded) {
      return null;
    }
    return { version, key };
  } catch {
    return null;
  }
}

function readFlags(value: string | undefined): Record<string, string> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const flags = parsed as Record<string, unknown>;
    const values = ACCESS_CONTROL_LAB_CHALLENGE_SLUGS.map(
      (_slug, index) => flags[`AC-0${index + 1}`],
    );
    if (values.some((flag) => typeof flag !== 'string'
      || !/^VULNFORGE\{[A-Za-z0-9_-]{1,240}\}$/.test(flag))) {
      return null;
    }
    if (new Set(values).size !== values.length) {
      return null;
    }
    return Object.fromEntries(
      ACCESS_CONTROL_LAB_CHALLENGE_SLUGS.map((slug, index) => [slug, values[index] as string]),
    );
  } catch {
    return null;
  }
}

async function seedAccessControlLab() {
  if (process.env.NODE_ENV !== 'development'
    || !isAccessControlLabEnabled(
      process.env.NODE_ENV,
      process.env.VULNFORGE_ENABLE_LOCAL_ACCESS_LAB === 'true',
    )) {
    throw new Error('The access-control lab seed requires explicitly enabled development mode.');
  }

  const keyring = readKeyring(process.env.VULNFORGE_FLAG_HMAC_KEYS);
  const flags = readFlags(process.env.VULNFORGE_ACCESS_LAB_FLAGS);
  if (!keyring || !flags) {
    throw new Error('Configure a valid backend flag keyring and distinct AC-01/AC-02/AC-03 flags in the ignored local .env.');
  }

  const { default: prisma } = await import('../lib/prisma.js');
  try {
    const seeded = await prisma.$transaction(async (transaction) => {
      const existingChallenges = await transaction.challenge.findMany({
        where: { slug: { in: [...ACCESS_CONTROL_LAB_CHALLENGE_SLUGS] } },
        select: { slug: true },
      });
      if (existingChallenges.length === ACCESS_CONTROL_LAB_CHALLENGE_SLUGS.length) {
        return false;
      }
      if (existingChallenges.length > 0) {
        throw new Error('Some access-control lab challenges already exist; no records were changed.');
      }

      const categorySlug = 'access-control';
      const existingCategory = await transaction.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true, name: true },
      });
      if (existingCategory && existingCategory.name !== 'Access Control') {
        throw new Error('The access-control category slug is already used by another category.');
      }
      const category = existingCategory ?? await transaction.category.create({
        data: {
          slug: categorySlug,
          name: 'Access Control',
          description: 'Local-only synthetic object, role, and privilege authorization labs.',
        },
        select: { id: true },
      });

      for (const challenge of accessControlLabChallenges) {
        const created = await transaction.challenge.create({
          data: {
            slug: challenge.slug,
            title: challenge.title,
            description: challenge.description,
            categoryId: category.id,
            difficulty: challenge.difficulty,
            points: challenge.points,
            status: 'PUBLISHED',
            learningObjectives: challenge.learningObjectives,
            context: challenge.context,
            prerequisites: challenge.prerequisites,
            hints: { create: challenge.hints },
            explanation: { create: challenge.explanation },
            quizQuestions: {
              create: challenge.questions.map((question, index) => ({
                order: index + 1,
                prompt: question.prompt,
                options: { create: question.options },
              })),
            },
          },
          select: { id: true },
        });
        await transaction.challengeSecret.create({
          data: {
            challengeId: created.id,
            verifierHash: createFlagVerifierHash(flags[challenge.slug], keyring.key),
            verifierKeyVersion: keyring.version,
          },
        });
      }
      return true;
    });

    console.info(seeded
      ? 'Created the three local access-control challenges.'
      : 'All three local access-control challenges already exist; left them unchanged.');
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await seedAccessControlLab();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Access-control lab seeding failed.');
  process.exitCode = 1;
}
