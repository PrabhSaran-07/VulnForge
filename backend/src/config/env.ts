import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { hasValidFlagVerifierKeyring } from '../lib/challenge-submissions.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  VULNFORGE_ENABLE_LOCAL_AUTH_LAB: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  VULNFORGE_ENABLE_LOCAL_ACCESS_LAB: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DATABASE_URL: z.string().default('postgresql://vulnforge:vulnforge_password@localhost:5433/vulnforge?schema=public'),
  CORS_ORIGIN: z.string().url().refine((value) => {
    try {
      return value !== '*' && new URL(value).origin === value;
    } catch {
      return false;
    }
  }, 'CORS_ORIGIN must be one explicit frontend origin without a path.')
    .default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(32),
});

export type AppEnvironment = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten());
  throw new Error('Environment validation failed.');
}

const env = parsed.data;

if (env.NODE_ENV === 'production') {
  const missingProductionVariables = [
    'DATABASE_URL',
    'CORS_ORIGIN',
  ].filter((name) => !process.env[name]);

  if (missingProductionVariables.length > 0) {
    console.error(
      `Missing required production environment variables: ${missingProductionVariables.join(', ')}`,
    );
    throw new Error('Production environment configuration is incomplete.');
  }
  if (!hasValidFlagVerifierKeyring()) {
    console.error(
      'VULNFORGE_FLAG_HMAC_KEYS must be a JSON map of versions to base64-encoded keys of at least 32 bytes.',
    );
    throw new Error('Production flag verification configuration is invalid.');
  }
}

if (/^(change_me|replace_with|your_.*|example)/i.test(env.SESSION_SECRET)) {
  throw new Error(
    'SESSION_SECRET must be set to a unique, strong secret; example and development placeholders are not permitted.',
  );
}

export { env };
export default env;
