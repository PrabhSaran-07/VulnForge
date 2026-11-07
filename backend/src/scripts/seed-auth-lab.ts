import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { authLabChallenges } from '../lib/auth-lab-content.js';
import { AUTH_LAB_CHALLENGE_SLUGS, isAuthLabEnabled } from '../lib/auth-lab.js';
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
    const keyring: Keyring[] = [];
    for (const [version, encoded] of entries) {
      if (!/^[A-Za-z0-9._-]{1,50}$/.test(version) || typeof encoded !== 'string') {
        return null;
      }
      const key = Buffer.from(encoded, 'base64');
      if (key.length < 32 || key.toString('base64') !== encoded) {
        return null;
      }
      keyring.push({ version, key });
    }
    return keyring[0];
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
    const values = AUTH_LAB_CHALLENGE_SLUGS.map((slug, index) => flags[`AUTH-0${index + 1}`]);
    if (values.some((flag) => typeof flag !== 'string'
      || !/^VULNFORGE\{[A-Za-z0-9_-]{1,240}\}$/.test(flag))) {
      return null;
    }
    if (new Set(values).size !== values.length) {
      return null;
    }
    return Object.fromEntries(
      AUTH_LAB_CHALLENGE_SLUGS.map((slug, index) => [slug, values[index] as string]),
    );
  } catch {
    return null;
  }
}

async function seedAuthLab() {
  if (!isAuthLabEnabled(
    process.env.NODE_ENV ?? 'development',
    process.env.VULNFORGE_ENABLE_LOCAL_AUTH_LAB === 'true',
  ) || process.env.NODE_ENV !== 'development') {
    throw new Error('The authentication lab seed is available only in explicitly enabled development mode.');
  }

  const keyring = readKeyring(process.env.VULNFORGE_FLAG_HMAC_KEYS);
  const flags = readFlags(process.env.VULNFORGE_AUTH_LAB_FLAGS);
  if (!keyring || !flags) {
    throw new Error('Configure a valid backend flag keyring and distinct AUTH-01/AUTH-02/AUTH-03 flags in the ignored local .env.');
  }

  const { default: prisma } = await import('../lib/prisma.js');
  try {
    const seeded = await prisma.$transaction(async (transaction) => {
      const existingChallenges = await transaction.challenge.findMany({
        where: { slug: { in: [...AUTH_LAB_CHALLENGE_SLUGS] } },
        select: { id: true, slug: true, explanation: { select: { expectedAnswer: true } } },
      });
      if (existingChallenges.length === AUTH_LAB_CHALLENGE_SLUGS.length) {
        let updatedCount = 0;
        for (const content of authLabChallenges) {
          const existing = existingChallenges.find(({ slug }) => slug === content.slug);
          if (!existing) {
            continue;
          }
          if (!existing.explanation) {
            await transaction.challengeExplanation.create({
              data: { challengeId: existing.id, ...content.explanation },
            });
            updatedCount += 1;
          } else if (existing.explanation.expectedAnswer.length === 0) {
            await transaction.challengeExplanation.update({
              where: { challengeId: existing.id },
              data: content.explanation,
            });
            updatedCount += 1;
          }
        }
        return updatedCount > 0;
      }
      if (existingChallenges.length > 0) {
        throw new Error('Some authentication lab challenges already exist; no records were changed.');
      }

      const categorySlug = 'authentication-security';
      const existingCategory = await transaction.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true, name: true },
      });
      if (existingCategory && existingCategory.name !== 'Authentication Security') {
        throw new Error('The authentication-security category slug is already used by another category.');
      }
      const category = existingCategory ?? await transaction.category.create({
        data: {
          slug: categorySlug,
          name: 'Authentication Security',
          description: 'Local-only synthetic authentication and account-recovery security labs.',
        },
        select: { id: true },
      });

      for (const challenge of authLabChallenges) {
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
      ? 'Created or updated educational content for the local authentication-security challenges.'
      : 'Authentication-security challenges already have educational content; left them unchanged.');
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await seedAuthLab();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Authentication lab seeding failed.');
  process.exitCode = 1;
}
