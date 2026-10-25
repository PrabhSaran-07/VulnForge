import bcrypt from 'bcryptjs';
import { z } from 'zod';
export const userSelect = {
    id: true,
    username: true,
    email: true,
    role: true,
    passwordHash: true,
    createdAt: true,
    updatedAt: true,
};
export const safeUserFields = {
    id: true,
    username: true,
    email: true,
    role: true,
    createdAt: true,
    updatedAt: true,
};
export function normalizeUsername(value) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
export function normalizeEmail(value) {
    return value.trim().toLowerCase();
}
export function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function isStrongPassword(value) {
    return value.length >= 8 && /\d/.test(value) && /[A-Za-z]/.test(value);
}
export function safeUser(user) {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
}
export async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}
export async function verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
}
export const registerSchema = z.object({
    username: z.string().trim().min(3).max(50),
    email: z.string().trim().max(255).email(),
    password: z.string().min(8).max(128),
});
export const loginSchema = z.object({
    identifier: z.string().trim().min(1).max(120),
    password: z.string().min(8).max(128),
});
