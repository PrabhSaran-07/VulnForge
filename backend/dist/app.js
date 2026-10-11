import cors from 'cors';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import { env } from './config/env.js';
const app = express();
app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
}));
app.use(session({
    name: 'vulnforge.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 8,
    },
}));
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
app.use(express.urlencoded({ extended: true }));
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use((_req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'The requested resource does not exist.',
    });
});
app.use((error, _req, res, _next) => {
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
