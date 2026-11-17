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

export const DEFAULT_USERS: SystemUser[] = [
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

export const SYSTEM_USERS = DEFAULT_USERS;

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
