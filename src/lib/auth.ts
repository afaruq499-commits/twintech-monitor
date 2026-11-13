import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "pm_session";

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    "project-monitor-twintech-fallback-secret-key-2026";
  return new TextEncoder().encode(secret);
}

export function verifyPassword(inputPassword: string): boolean {
  const expected = process.env.APP_PASSWORD || "twintech2026";
  return inputPassword === expected;
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "engineer", authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
