import { randomUUID } from 'node:crypto';
import app from './app.js';
import prisma from './lib/prisma.js';
import { env } from './config/env.js';
import { purgeExpiredSecurityEvents, recordSecurityEvent } from './lib/security-events.js';
import { isAccessControlLabEnabled, isAuthLabEnabled } from './lib/auth-lab.js';
import { bootstrapProductionData } from './lib/bootstrap.js';

const port = env.PORT;

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Database connection successful.');
    await bootstrapProductionData();
  } catch {
    console.error('Database connection failed; the backend was not started.');
    process.exitCode = 1;
    return;
  }

  void recordSecurityEvent({
    eventType: 'security_configuration_loaded',
    severity: 'INFO',
    requestId: randomUUID(),
    metadata: {
      environment: env.NODE_ENV,
      authLabEnabled: isAuthLabEnabled(env.NODE_ENV, env.VULNFORGE_ENABLE_LOCAL_AUTH_LAB),
      accessLabEnabled: isAccessControlLabEnabled(env.NODE_ENV, env.VULNFORGE_ENABLE_LOCAL_ACCESS_LAB),
    },
  });

  app.listen(port, () => {
    console.log(`VULNFORGE backend listening on http://localhost:${port}`);
    const cleanup = () => {
      void purgeExpiredSecurityEvents()
        .then((deleted) => {
          if (deleted > 0) {
            console.info(JSON.stringify({ type: 'security_event_retention', deleted }));
          }
        })
        .catch((error: unknown) => {
          console.error(JSON.stringify({
            type: 'security_event_retention_failure',
            error: error instanceof Error ? error.message : 'Unknown cleanup error',
          }));
        });
    };
    cleanup();
    setInterval(cleanup, 24 * 60 * 60 * 1000).unref();
  });
}

startServer();
