import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        role: 'STUDENT' | 'ADMIN';
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

export {};
