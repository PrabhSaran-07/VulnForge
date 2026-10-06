import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import healthRouter from './routes/health.js';
import { env } from './config/env.js';

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'http://localhost:5173'],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(express.json());
app.use('/api', healthRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource does not exist.',
  });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (env.NODE_ENV === 'production') {
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred.',
    });
    return;
  }

  res.status(500).json({
    error: 'Unexpected error',
    message: error.message,
    stack: error.stack,
  });
});

export default app;
