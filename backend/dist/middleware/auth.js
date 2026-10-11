import prisma from '../lib/prisma.js';
import { safeUser, userSelect } from '../lib/auth.js';
export async function requireAuth(req, res, next) {
    if (!req.session?.userId) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required.',
        });
    }
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.session.userId },
            select: userSelect,
        });
        if (!user) {
            req.session.destroy(() => undefined);
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required.',
            });
        }
        req.user = safeUser(user);
        return next();
    }
    catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to verify your session.',
        });
    }
}
export function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required.',
            });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'You do not have permission to access this resource.',
            });
        }
        return next();
    };
}
