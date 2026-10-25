import app from './app.js';
import prisma from './lib/prisma.js';
import { env } from './config/env.js';

const port = env.PORT;

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Database connection successful.');
  } catch {
    console.error('Database connection failed; the backend was not started.');
    process.exitCode = 1;
    return;
  }

  app.listen(port, () => {
    console.log(`VULNFORGE backend listening on http://localhost:${port}`);
  });
}

startServer();
