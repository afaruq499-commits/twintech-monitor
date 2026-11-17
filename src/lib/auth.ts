import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  authenticateUser,
  getDefaultAdminUser,
  getUserByUsername,
  SessionUser,
  toSessionUser,
  UserRole,
} from "./users";

export type { SessionUser, UserRole };
export const SESSION_COOKIE_NAME = "pm_session";

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    "project-monitor-twintech-fallback-secret-key-2026";
  return new TextEncoder().encode(secret);
}

export function verifyPassword(
  inputPassword: string,
  username?: string
): boolean {
  if (username) {
    const user = authenticateUser(username, inputPassword);
    return Boolean(user);
  }
  const expected = process.env.APP_PASSWORD || "twintech2026";
  if (inputPassword === expected) return true;
  return Boolean(authenticateUser("", inputPassword));
}

export async function createSessionToken(
  user?: SessionUser | null
): Promise<string> {
  const sessionUser = user || toSessionUser(getDefaultAdminUser());

  return new SignJWT({
    sub: sessionUser.id,
    username: sessionUser.username,
    nama: sessionUser.nama,
    role: sessionUser.role,
    jabatan: sessionUser.jabatan,
    avatarText: sessionUser.avatarText,
    warna: sessionUser.warna,
    authenticated: true,
  })
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

export async function parseSessionToken(
  token: string | undefined | null
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.authenticated !== true) return null;

    if (payload.username && typeof payload.username === "string") {
      const known = getUserByUsername(payload.username);
      if (known) return toSessionUser(known);

      return {
        id: (payload.sub as string) || "user-session",
        username: payload.username,
        nama: (payload.nama as string) || payload.username,
        role: ((payload.role as string) === "ADMIN" ? "ADMIN" : "MEMBER") as UserRole,
        jabatan: (payload.jabatan as string) || "Tim Engineering",
        avatarText: (payload.avatarText as string) || payload.username.slice(0, 2).toUpperCase(),
        warna: (payload.warna as string) || "#F05232",
      };
    }

    // Default fallback untuk token legacy
    return toSessionUser(getDefaultAdminUser());
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
