import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionUser,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import {
  getAllUsers,
  getUserById,
  updateSelfCredentials,
  updateTeamUserByAdmin,
} from "@/lib/users-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Sesi telah berakhir. Silakan login kembali." },
        { status: 401 }
      );
    }

    const currentUser = getUserById(session.id);
    const isAdmin = session.role === "ADMIN";

    let teamUsers: Array<{
      id: string;
      username: string;
      nama: string;
      role: string;
      jabatan: string;
      avatarText: string;
      warna: string;
    }> = [];

    if (isAdmin) {
      teamUsers = getAllUsers().map((u) => ({
        id: u.id,
        username: u.username,
        nama: u.nama,
        role: u.role,
        jabatan: u.jabatan,
        avatarText: u.avatarText,
        warna: u.warna,
      }));
    }

    return NextResponse.json({
      currentUser: currentUser
        ? {
            id: currentUser.id,
            username: currentUser.username,
            nama: currentUser.nama,
            role: currentUser.role,
            jabatan: currentUser.jabatan,
            avatarText: currentUser.avatarText,
            warna: currentUser.warna,
          }
        : session,
      teamUsers,
      isAdmin,
    });
  } catch (err) {
    console.error("GET /api/auth/users error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data akun pengguna." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Sesi telah berakhir. Silakan login kembali." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body?.action || "UPDATE_SELF";

    // 1. Aksi ubah profil sendiri (Username, Nama, Password)
    if (action === "UPDATE_SELF") {
      const {
        currentPassword,
        newUsername,
        newNama,
        newPassword,
      } = body;

      const result = updateSelfCredentials({
        userId: session.id,
        currentPassword,
        newUsername,
        newNama,
        newPassword,
      });

      if (!result.success || !result.user) {
        return NextResponse.json(
          { error: result.error || "Gagal memperbarui kredensial Anda." },
          { status: 400 }
        );
      }

      // Update cookie sesi dengan info user terbaru
      const token = await createSessionToken(result.user);
      const res = NextResponse.json({
        ok: true,
        message: "Kredensial akun Anda berhasil diperbarui.",
        user: result.user,
      });

      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      return res;
    }

    // 2. Aksi kelola akun anggota tim oleh Admin
    if (action === "UPDATE_TEAM_USER") {
      if (session.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Hanya Admin yang dapat mengelola kredensial akun tim." },
          { status: 403 }
        );
      }

      const {
        targetUserId,
        newUsername,
        newNama,
        newJabatan,
        newPassword,
      } = body;

      if (!targetUserId) {
        return NextResponse.json(
          { error: "ID pengguna target diperlukan." },
          { status: 400 }
        );
      }

      const result = updateTeamUserByAdmin({
        targetUserId,
        newUsername,
        newNama,
        newJabatan,
        newPassword,
      });

      if (!result.success || !result.user) {
        return NextResponse.json(
          { error: result.error || "Gagal memperbarui akun anggota tim." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: `Akun "${result.user.nama}" (${result.user.username}) berhasil diperbarui.`,
        user: result.user,
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    console.error("POST /api/auth/users error:", err);
    return NextResponse.json(
      { error: "Gagal memproses perubahan akun." },
      { status: 500 }
    );
  }
}
