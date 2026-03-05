import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { UserRole } from './models/User';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'zemen-bank-jwt-secret-change-in-production');
const JWT_EXPIRY = '8h';

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_EXPIRY)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
