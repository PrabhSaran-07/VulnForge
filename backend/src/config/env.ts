import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://vulnforge:vulnforge_password@localhost:5433/vulnforge?schema=public'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type AppEnvironment = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten());
  throw new Error('Environment validation failed.');
}

export const env = parsed.data;
export default env;
