import dotenv from 'dotenv';
import { resolve } from 'node:path';
dotenv.config({ path: resolve(process.cwd(), '../.env') });
const databaseUrl = process.env.DATABASE_URL;
const password = process.env.VULNFORGE_TEST_ADMIN_PASSWORD;
if (!databaseUrl) {
    console.error('DATABASE_URL is required. Configure the project .env file or environment before provisioning.');
    process.exitCode = 1;
}
else if (!password) {
    console.error('VULNFORGE_TEST_ADMIN_PASSWORD is required. Set it locally before provisioning.');
    process.exitCode = 1;
}
else if (password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || password.length < 8) {
    console.error('VULNFORGE_TEST_ADMIN_PASSWORD is invalid. Use 8-128 characters with at least one letter and one number.');
    process.exitCode = 1;
}
else {
    const { default: prisma } = await import('../lib/prisma.js');
    const { hashPassword, normalizeEmail, normalizeUsername, verifyPassword } = await import('../lib/auth.js');
    try {
        const username = normalizeUsername('testadmin');
        const email = normalizeEmail('admin@vulnforge.local');
        const existing = await prisma.user.findFirst({
            where: {
                OR: [{ username }, { email }],
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                passwordHash: true,
            },
        });
        if (existing) {
            if (existing.username !== username || existing.email !== email) {
                throw new Error('A different account already uses the test administrator username or email; no changes were made.');
            }
            if (existing.role !== 'ADMIN') {
                throw new Error('The test administrator account exists without the ADMIN role; no changes were made.');
            }
            if (!(await verifyPassword(password, existing.passwordHash))) {
                throw new Error('The test administrator account exists with a different password; no changes were made.');
            }
            console.info('Test administrator already exists with the configured password and ADMIN role; left unchanged.');
        }
        else {
            const passwordHash = await hashPassword(password);
            await prisma.user.create({
                data: {
                    username,
                    email,
                    passwordHash,
                    role: 'ADMIN',
                },
                select: {
                    id: true,
                },
            });
            console.info('Created development test administrator with the ADMIN role.');
        }
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : 'Admin provisioning failed due to an unexpected error.');
        process.exitCode = 1;
    }
    finally {
        await prisma.$disconnect();
    }
}
