import { NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!verifyPassword(password)) {
      return NextResponse.json(
        { error: "Password salah. Periksa kembali password Anda." },
        { status: 401 }
      );
    }

    const token = await createSessionToken();
    const res = NextResponse.json({ ok: true });
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
