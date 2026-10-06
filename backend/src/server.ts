import app from './app.js';
import prisma from './lib/prisma.js';
import { env } from './config/env.js';

const port = env.PORT;

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Database connection successful.');
  } catch (error) {
    console.error('Database connection failed:', error);
  }

  app.listen(port, () => {
    console.log(`VULNFORGE backend listening on http://localhost:${port}`);
  });
}

startServer();
