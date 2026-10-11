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
} as const;

export const safeUserFields = {
  id: true,
  username: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /\d/.test(value) && /[A-Za-z]/.test(value);
}

export function safeUser<T extends { id: string; username: string; email: string; role: 'STUDENT' | 'ADMIN'; createdAt: Date; updatedAt: Date }>(user: T) {
  const { passwordHash: _passwordHash, ...publicUser } = user as T & { passwordHash?: string };
  return publicUser;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(128),
});
