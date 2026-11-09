import prisma from './prisma.js';
import { authLabChallenges } from './auth-lab-content.js';
import { accessControlLabChallenges } from './access-control-lab-content.js';
import { createFlagVerifierHash } from './challenge-submissions.js';
import { hashPassword, normalizeEmail, normalizeUsername } from './auth.js';

const DEFAULT_AUTH_FLAGS: Record<string, string> = {
  'auth-01-weak-authentication': 'VULNFORGE{auth01-7T8noTamqWXgnZrKJW38B9hC__CvlURT}',
  'auth-02-authentication-check': 'VULNFORGE{auth02-E_I_uy7gYelHqo_nN86MYfpNCAMsepnd}',
  'auth-03-password-reset': 'VULNFORGE{auth03-4hMPxhPWsH-qhqBGvRSV6Dp9SWqmZSLQ}',
};

const DEFAULT_ACCESS_FLAGS: Record<string, string> = {
  'ac-01-object-level-access-control': 'VULNFORGE{zoExVJzyqfWDhNKjkDJOcR2YfHper46u}',
  'ac-02-role-permission-enforcement': 'VULNFORGE{_EUfy83siwD5mG1gG_CNejhPlPdlgChI}',
  'ac-03-privilege-boundary-failure': 'VULNFORGE{AXivNXtxFzohKBClTo3lrcGqe9PrJ9P8}',
};

function getActiveKeyring(): { version: string; key: Buffer } {
  const raw = process.env.VULNFORGE_FLAG_HMAC_KEYS || '{"dev_v1":"jv7VXON4WRwiupApZvNaUfei0N4tOBVe4cbUrCXfd34="}';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      for (const [version, encoded] of Object.entries(parsed)) {
        if (/^[A-Za-z0-9._-]{1,50}$/.test(version) && typeof encoded === 'string') {
          const key = Buffer.from(encoded, 'base64');
          if (key.length >= 32) {
            return { version, key };
          }
        }
      }
    }
  } catch {
    // fallback
  }
  return {
    version: 'dev_v1',
    key: Buffer.from('jv7VXON4WRwiupApZvNaUfei0N4tOBVe4cbUrCXfd34=', 'base64'),
  };
}

function getChallengeFlags(): Record<string, string> {
  const flags = { ...DEFAULT_AUTH_FLAGS, ...DEFAULT_ACCESS_FLAGS };

  if (process.env.VULNFORGE_AUTH_LAB_FLAGS) {
    try {
      const parsed: unknown = JSON.parse(process.env.VULNFORGE_AUTH_LAB_FLAGS);
      if (typeof parsed === 'object' && parsed !== null) {
        const record = parsed as Record<string, string>;
        if (record['AUTH-01']) flags['auth-01-weak-authentication'] = record['AUTH-01'];
        if (record['AUTH-02']) flags['auth-02-authentication-check'] = record['AUTH-02'];
        if (record['AUTH-03']) flags['auth-03-password-reset'] = record['AUTH-03'];
      }
    } catch {
      // ignore
    }
  }

  if (process.env.VULNFORGE_ACCESS_LAB_FLAGS) {
    try {
      const parsed: unknown = JSON.parse(process.env.VULNFORGE_ACCESS_LAB_FLAGS);
      if (typeof parsed === 'object' && parsed !== null) {
        const record = parsed as Record<string, string>;
        if (record['AC-01']) flags['ac-01-object-level-access-control'] = record['AC-01'];
        if (record['AC-02']) flags['ac-02-role-permission-enforcement'] = record['AC-02'];
        if (record['AC-03']) flags['ac-03-privilege-boundary-failure'] = record['AC-03'];
      }
    } catch {
      // ignore
    }
  }

  return flags;
}

export async function bootstrapProductionData(): Promise<void> {
  try {
    // 1. Ensure administrator accounts exist and have role 'ADMIN'
    const defaultPassword = process.env.VULNFORGE_TEST_ADMIN_PASSWORD || 'a1Brwhjk2BqB0fTNyj4Wenh71QA3hElmpuLeiBGX2OBjM';
    const passwordHash = await hashPassword(defaultPassword);

    const adminAccounts = [
      { username: 'testadmin', email: 'admin@vulnforge.local' },
      { username: 'admin', email: 'admin@vulnforge.dev' },
    ];

    for (const account of adminAccounts) {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { username: account.username },
            { email: account.email },
          ],
        },
      });

      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            role: 'ADMIN',
            passwordHash,
            isActive: true,
          },
        });
        console.info(`[bootstrap] Updated ${account.username} to ADMIN role with verified credentials.`);
      } else {
        await prisma.user.create({
          data: {
            username: account.username,
            email: account.email,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
          },
        });
        console.info(`[bootstrap] Created ${account.username} with ADMIN role.`);
      }
    }

    // Also promote user accounts to ADMIN
    const promoteUsernames = ['prabhleen_kaur', 'prabhleen kaur', 'test admin'];
    const promoteEmails = ['prabhleenkaursaran2007@gmail.com'];

    for (const name of promoteUsernames) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: normalizeUsername(name) },
            { username: name },
            { username: { contains: name, mode: 'insensitive' } },
          ],
        },
      });
      for (const user of users) {
        if (user.role !== 'ADMIN') {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN', isActive: true },
          });
          console.info(`[bootstrap] Promoted account ${user.username} to ADMIN role.`);
        }
      }
    }

    for (const email of promoteEmails) {
      const users = await prisma.user.findMany({
        where: { email: normalizeEmail(email) },
      });
      for (const user of users) {
        if (user.role !== 'ADMIN') {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN', isActive: true },
          });
          console.info(`[bootstrap] Promoted account with email ${user.email} to ADMIN role.`);
        }
      }
    }

    // 2. Ensure Categories exist
    const authCategory = await prisma.category.upsert({
      where: { slug: 'authentication-security' },
      update: {},
      create: {
        slug: 'authentication-security',
        name: 'Authentication Security',
        description: 'Authentication, password storage, and account-recovery security labs.',
      },
    });

    const acCategory = await prisma.category.upsert({
      where: { slug: 'access-control' },
      update: {},
      create: {
        slug: 'access-control',
        name: 'Access Control',
        description: 'Object-level, role, and privilege authorization security labs.',
      },
    });

    // 3. Ensure all 6 challenges exist with verified secrets and published status
    const challengeFlags = getChallengeFlags();
    const { version: keyVersion, key: keyBuffer } = getActiveKeyring();

    const allAuthoredChallenges = [
      ...authLabChallenges.map((c) => ({ ...c, categoryId: authCategory.id })),
      ...accessControlLabChallenges.map((c) => ({ ...c, categoryId: acCategory.id })),
    ];

    for (const challengeData of allAuthoredChallenges) {
      const flag = challengeFlags[challengeData.slug] || `VULNFORGE{${challengeData.slug}_solution_flag}`;
      const expectedVerifierHash = createFlagVerifierHash(flag, keyBuffer);

      const existing = await prisma.challenge.findUnique({
        where: { slug: challengeData.slug },
        include: { secret: true, explanation: true },
      });

      if (!existing) {
        await prisma.challenge.create({
          data: {
            slug: challengeData.slug,
            title: challengeData.title,
            description: challengeData.description,
            categoryId: challengeData.categoryId,
            difficulty: challengeData.difficulty,
            points: challengeData.points,
            status: 'PUBLISHED',
            learningObjectives: challengeData.learningObjectives,
            context: challengeData.context,
            prerequisites: challengeData.prerequisites,
            hints: { create: challengeData.hints },
            explanation: { create: challengeData.explanation },
            quizQuestions: {
              create: challengeData.questions.map((q, idx) => ({
                order: idx + 1,
                prompt: q.prompt,
                options: { create: q.options },
              })),
            },
            secret: {
              create: {
                verifierHash: expectedVerifierHash,
                verifierKeyVersion: keyVersion,
              },
            },
          },
        });
        console.info(`[bootstrap] Created challenge ${challengeData.slug} with verified secret.`);
      } else {
        // Ensure status is published
        if (existing.status !== 'PUBLISHED') {
          await prisma.challenge.update({
            where: { id: existing.id },
            data: { status: 'PUBLISHED' },
          });
        }

        // Ensure challenge secret matches the active key and exact demo flag
        if (
          !existing.secret ||
          existing.secret.verifierHash !== expectedVerifierHash ||
          existing.secret.verifierKeyVersion !== keyVersion
        ) {
          await prisma.challengeSecret.upsert({
            where: { challengeId: existing.id },
            update: {
              verifierHash: expectedVerifierHash,
              verifierKeyVersion: keyVersion,
            },
            create: {
              challengeId: existing.id,
              verifierHash: expectedVerifierHash,
              verifierKeyVersion: keyVersion,
            },
          });
          console.info(`[bootstrap] Synced secret verifier for ${challengeData.slug} with active keyring.`);
        }

        // Ensure explanation exists
        if (!existing.explanation) {
          await prisma.challengeExplanation.create({
            data: {
              challengeId: existing.id,
              ...challengeData.explanation,
            },
          });
          console.info(`[bootstrap] Created missing explanation for ${challengeData.slug}.`);
        }
      }
    }

    console.info('[bootstrap] Successfully verified all challenges, secrets, and answers.');
  } catch (error) {
    console.error('[bootstrap] Bootstrap notice:', error instanceof Error ? error.message : error);
  }
}
