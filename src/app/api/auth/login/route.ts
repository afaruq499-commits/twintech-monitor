import { NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { toSessionUser, UserRole } from "@/lib/users";
import { authenticateUser } from "@/lib/users-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const role = (body?.role === "ADMIN" || body?.role === "MEMBER" ? body.role : undefined) as UserRole | undefined;

    const user = authenticateUser(username, password, role);

    if (!user) {
      return NextResponse.json(
        { error: "Username atau password yang Anda masukkan tidak valid." },
        { status: 401 }
      );
    }

    const sessionUser = toSessionUser(user);
    const token = await createSessionToken(sessionUser);
    const res = NextResponse.json({ ok: true, user: sessionUser });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 hari
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: "Gagal memproses permintaan login." },
      { status: 400 }
    );
  }
}
