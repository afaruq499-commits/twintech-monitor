import fs from "fs";
import path from "path";
import {
  DEFAULT_USERS,
  SessionUser,
  SystemUser,
  toSessionUser,
  UserRole,
} from "./users";

const CREDENTIALS_FILE = path.join(
  process.cwd(),
  "prisma",
  "user-credentials.json"
);

// In-memory cache
let cachedUsers: SystemUser[] | null = null;

export function loadUsers(): SystemUser[] {
  if (cachedUsers && cachedUsers.length > 0) {
    return cachedUsers;
  }

  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const raw = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedUsers = parsed;
        return cachedUsers;
      }
    }
  } catch (err) {
    console.error("Gagal membaca user-credentials.json:", err);
  }

  // Jika file belum ada atau rusak, inisialisasi dengan DEFAULT_USERS
  cachedUsers = JSON.parse(JSON.stringify(DEFAULT_USERS));
  saveUsers(cachedUsers!);
  return cachedUsers!;
}

export function saveUsers(users: SystemUser[]): void {
  try {
    cachedUsers = users;
    const dir = path.dirname(CREDENTIALS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(users, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("Gagal menulis ke user-credentials.json:", err);
  }
}

export function getAllUsers(): SystemUser[] {
  return loadUsers();
}

export function getUserByUsername(username: string): SystemUser | null {
  const clean = username.trim().toLowerCase();
  const users = loadUsers();
  return users.find((u) => u.username.toLowerCase() === clean) || null;
}

export function getUserById(id: string): SystemUser | null {
  const users = loadUsers();
  return users.find((u) => u.id === id) || null;
}

export function getDefaultAdminUser(): SystemUser {
  const users = loadUsers();
  return users.find((u) => u.role === "ADMIN") || DEFAULT_USERS[0];
}

export function authenticateUser(
  usernameOrRole: string,
  password?: string,
  expectedRole?: UserRole
): SystemUser | null {
  const cleanIdentifier = (usernameOrRole || "").trim().toLowerCase();
  const inputPass = (password || "").trim();
  const users = loadUsers();

  let targetUser: SystemUser | undefined = undefined;

  // 1. Cari berdasarkan username
  if (cleanIdentifier) {
    targetUser = users.find(
      (u) => u.username.toLowerCase() === cleanIdentifier
    );
  }

  // 2. Jika identifier adalah "admin" dan tidak ada username "admin" spesifik, ambil admin utama
  if (!targetUser && cleanIdentifier === "admin") {
    targetUser = users.find((u) => u.role === "ADMIN");
  }

  // 3. Jika username kosong tapi expectedRole adalah ADMIN, coba cek apakah password cocok dengan akun admin
  if (!targetUser && (!cleanIdentifier || cleanIdentifier === "admin") && expectedRole === "ADMIN") {
    const admin = users.find((u) => u.role === "ADMIN");
    if (admin) {
      targetUser = admin;
    }
  }

  // 4. Jika masih belum ketemu dan expectedRole ditentukan, cari di role tersebut yang cocok passwordnya
  if (!targetUser && expectedRole) {
    const roleUsers = users.filter((u) => u.role === expectedRole);
    const matched = roleUsers.find(
      (u) =>
        u.allowedPasswords.some(
          (p) => p.toLowerCase() === inputPass.toLowerCase()
        ) ||
        (process.env.APP_PASSWORD &&
          inputPass.toLowerCase() === process.env.APP_PASSWORD.toLowerCase())
    );
    if (matched) {
      targetUser = matched;
    }
  }

  // 5. Cek password global fallback
  if (!targetUser && inputPass) {
    const envPass = process.env.APP_PASSWORD || "twintech2026";
    if (inputPass === envPass) {
      if (expectedRole === "MEMBER") {
        targetUser = users.find((u) => u.role === "MEMBER") || users[1];
      } else {
        targetUser = getDefaultAdminUser();
      }
    }
  }

  if (!targetUser) return null;

  // Verifikasi role jika expectedRole ditentukan
  if (expectedRole && targetUser.role !== expectedRole) {
    return null;
  }

  // Verifikasi password
  const envPass = process.env.APP_PASSWORD || "twintech2026";
  const isMatch =
    targetUser.allowedPasswords.some(
      (p) => p.toLowerCase() === inputPass.toLowerCase()
    ) || inputPass === envPass;

  if (isMatch) {
    return targetUser;
  }

  return null;
}

export function updateSelfCredentials({
  userId,
  currentPassword,
  newUsername,
  newNama,
  newPassword,
}: {
  userId: string;
  currentPassword?: string;
  newUsername?: string;
  newNama?: string;
  newPassword?: string;
}): { success: boolean; user?: SessionUser; error?: string } {
  const users = loadUsers();
  const targetIndex = users.findIndex((u) => u.id === userId);

  if (targetIndex === -1) {
    return { success: false, error: "Pengguna tidak ditemukan." };
  }

  const current = users[targetIndex];

  // Verifikasi password saat ini jika user mengubah password atau username
  if (currentPassword) {
    const envPass = process.env.APP_PASSWORD || "twintech2026";
    const valid =
      current.allowedPasswords.some(
        (p) => p.toLowerCase() === currentPassword.trim().toLowerCase()
      ) || currentPassword.trim() === envPass;

    if (!valid) {
      return { success: false, error: "Password saat ini salah." };
    }
  }

  // Periksa apakah username baru sudah digunakan user lain
  if (newUsername && newUsername.trim()) {
    const cleanUser = newUsername.trim().toLowerCase();
    const existing = users.find(
      (u) => u.id !== userId && u.username.toLowerCase() === cleanUser
    );
    if (existing) {
      return { success: false, error: `Username "${newUsername}" sudah digunakan akun lain.` };
    }
    current.username = cleanUser;
  }

  if (newNama && newNama.trim()) {
    current.nama = newNama.trim();
    current.avatarText = current.nama.slice(0, 2).toUpperCase();
  }

  if (newPassword && newPassword.trim()) {
    const pass = newPassword.trim();
    if (pass.length < 4) {
      return { success: false, error: "Password baru minimal 4 karakter." };
    }
    // Set password baru di urutan terdepan
    current.allowedPasswords = [pass, ...current.allowedPasswords.filter((p) => p !== pass)];
  }

  users[targetIndex] = current;
  saveUsers(users);

  return { success: true, user: toSessionUser(current) };
}

export function updateTeamUserByAdmin({
  targetUserId,
  newUsername,
  newNama,
  newJabatan,
  newPassword,
}: {
  targetUserId: string;
  newUsername?: string;
  newNama?: string;
  newJabatan?: string;
  newPassword?: string;
}): { success: boolean; user?: SessionUser; error?: string } {
  const users = loadUsers();
  const targetIndex = users.findIndex((u) => u.id === targetUserId);

  if (targetIndex === -1) {
    return { success: false, error: "Pengguna target tidak ditemukan." };
  }

  const target = users[targetIndex];

  if (newUsername && newUsername.trim()) {
    const cleanUser = newUsername.trim().toLowerCase();
    const existing = users.find(
      (u) => u.id !== targetUserId && u.username.toLowerCase() === cleanUser
    );
    if (existing) {
      return { success: false, error: `Username "${newUsername}" sudah digunakan akun lain.` };
    }
    target.username = cleanUser;
  }

  if (newNama && newNama.trim()) {
    target.nama = newNama.trim();
    target.avatarText = target.nama.slice(0, 2).toUpperCase();
  }

  if (newJabatan && newJabatan.trim()) {
    target.jabatan = newJabatan.trim();
  }

  if (newPassword && newPassword.trim()) {
    const pass = newPassword.trim();
    if (pass.length < 4) {
      return { success: false, error: "Password baru minimal 4 karakter." };
    }
    target.allowedPasswords = [pass, ...target.allowedPasswords.filter((p) => p !== pass)];
  }

  users[targetIndex] = target;
  saveUsers(users);

  return { success: true, user: toSessionUser(target) };
}
