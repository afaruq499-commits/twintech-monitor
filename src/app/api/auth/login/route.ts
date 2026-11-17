import { NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { authenticateUser, toSessionUser } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const role = typeof body?.role === "string" ? body.role : "";

    const identifier = username || (role ? role.toLowerCase() : "");
    const user = authenticateUser(identifier, password);

    if (!user) {
      return NextResponse.json(
        { error: "Password atau akun salah. Periksa kembali kredensial Anda." },
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
