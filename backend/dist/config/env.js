import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().default('postgresql://vulnforge:vulnforge_password@localhost:5433/vulnforge?schema=public'),
    CORS_ORIGIN: z.string().url().refine((value) => {
        try {
            return value !== '*' && new URL(value).origin === value;
        }
        catch {
            return false;
        }
    }, 'CORS_ORIGIN must be one explicit frontend origin without a path.')
        .default('http://localhost:5173'),
    SESSION_SECRET: z.string().min(32),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten());
    throw new Error('Environment validation failed.');
}
const env = parsed.data;
if (/^(change_me|replace_with|your_.*|example)/i.test(env.SESSION_SECRET)) {
    throw new Error('SESSION_SECRET must be set to a unique, strong secret; example and development placeholders are not permitted.');
}
export { env };
export default env;
