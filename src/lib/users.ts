export type UserRole = "ADMIN" | "MEMBER";

export interface SystemUser {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  jabatan: string;
  avatarText: string;
  warna: string;
  allowedPasswords: string[];
}

export interface SessionUser {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  jabatan: string;
  avatarText: string;
  warna: string;
}

export const SYSTEM_USERS: SystemUser[] = [
  {
    id: "user-faruq",
    username: "faruq",
    nama: "Faruq",
    role: "ADMIN",
    jabatan: "Admin / Project & Electrical Lead",
    avatarText: "FQ",
    warna: "#F05232",
    allowedPasswords: ["faruq123", "admin123", "twintech2026", "faruq", "admin"],
  },
  {
    id: "user-apip",
    username: "apip",
    nama: "Apip",
    role: "MEMBER",
    jabatan: "Member / Automation & PLC Engineer",
    avatarText: "AP",
    warna: "#0284c7",
    allowedPasswords: ["apip123", "twintech2026", "apip", "member123"],
  },
  {
    id: "user-rajip",
    username: "rajip",
    nama: "Rajip",
    role: "MEMBER",
    jabatan: "Member / Electrical & Wiring Engineer",
    avatarText: "RJ",
    warna: "#059669",
    allowedPasswords: ["rajip123", "twintech2026", "rajip", "member123"],
  },
];

export const SYSTEM_PICS = [
  {
    value: "Faruq",
    label: "Faruq (Admin)",
    role: "ADMIN" as UserRole,
    color: "#F05232",
    description: "Lead Engineer / Penjadwalan & Pengerjaan",
  },
  {
    value: "Apip",
    label: "Apip (Member)",
    role: "MEMBER" as UserRole,
    color: "#0284c7",
    description: "Automation & PLC Engineer",
  },
  {
    value: "Rajip",
    label: "Rajip (Member)",
    role: "MEMBER" as UserRole,
    color: "#059669",
    description: "Electrical & Wiring Engineer",
  },
] as const;

export function getAllUsers(): SystemUser[] {
  return SYSTEM_USERS;
}

export function getUserByUsername(username: string): SystemUser | null {
  const clean = username.trim().toLowerCase();
  return SYSTEM_USERS.find((u) => u.username.toLowerCase() === clean) || null;
}

export function getUserById(id: string): SystemUser | null {
  return SYSTEM_USERS.find((u) => u.id === id) || null;
}

export function getDefaultAdminUser(): SystemUser {
  return SYSTEM_USERS[0];
}

export function toSessionUser(user: SystemUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    nama: user.nama,
    role: user.role,
    jabatan: user.jabatan,
    avatarText: user.avatarText,
    warna: user.warna,
  };
}

export function authenticateUser(
  usernameOrRole: string,
  password?: string
): SystemUser | null {
  const cleanIdentifier = (usernameOrRole || "").trim().toLowerCase();
  const inputPass = (password || "").trim();

  // 1. Cari berdasarkan username
  let targetUser = SYSTEM_USERS.find(
    (u) => u.username.toLowerCase() === cleanIdentifier
  );

  // 2. Jika tidak ada dan identifier adalah "admin", pilih Faruq
  if (!targetUser && cleanIdentifier === "admin") {
    targetUser = SYSTEM_USERS.find((u) => u.role === "ADMIN");
  }

  // 3. Jika tidak ada dan identifier adalah "member", pilih Apip sebagai default member
  if (!targetUser && cleanIdentifier === "member") {
    targetUser = SYSTEM_USERS.find((u) => u.role === "MEMBER");
  }

  // 4. Jika tetap tidak ketemu, cari berdasarkan nama (case-insensitive)
  if (!targetUser) {
    targetUser = SYSTEM_USERS.find(
      (u) => u.nama.toLowerCase() === cleanIdentifier
    );
  }

  // 5. Jika tidak ada username sama sekali tapi password diberikan, coba cek apakah password global atau milik salah satu user
  if (!targetUser && inputPass) {
    const matched = SYSTEM_USERS.find((u) =>
      u.allowedPasswords.some((p) => p.toLowerCase() === inputPass.toLowerCase())
    );
    if (matched) return matched;
    // Default fallback to Admin jika password sesuai env APP_PASSWORD
    const envPass = process.env.APP_PASSWORD || "twintech2026";
    if (inputPass === envPass) {
      return getDefaultAdminUser();
    }
    return null;
  }

  if (!targetUser) return null;

  // Verifikasi password untuk targetUser
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

/**
 * Cek apakah sebuah pekerjaan atau cell ditugaskan kepada user tertentu.
 * Contoh: pic "Apip", "Apip Dimas", "Faruq", dll.
 */
export function isTaskAssignedToUser(
  taskPic: string | null | undefined,
  userNamaOrUsername: string
): boolean {
  if (!taskPic) return false;
  const target = userNamaOrUsername.trim().toLowerCase();
  const haystack = taskPic.trim().toLowerCase();

  if (haystack === target) return true;
  // Periksa word boundary (contoh: "Apip Dimas" mencocokkan "Apip")
  const words = haystack.split(/[\s,+/&|_-]+/);
  return words.some((w) => w === target);
}
