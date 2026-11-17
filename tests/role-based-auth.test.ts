import { describe, expect, it } from "vitest";
import {
  DEFAULT_USERS,
  isTaskAssignedToUser,
  SYSTEM_PICS,
  toSessionUser,
} from "../src/lib/users";
import {
  authenticateUser,
  getAllUsers,
  getUserByUsername,
  updateSelfCredentials,
  updateTeamUserByAdmin,
} from "../src/lib/users-store";
import {
  createSessionToken,
  parseSessionToken,
} from "../src/lib/auth";

describe("Sistem Otentikasi & Role Pengguna (Admin vs Member)", () => {
  it("memiliki akun default Admin (Faruq) dan Member (Apip & Rajip)", () => {
    const users = getAllUsers();
    expect(users.length).toBeGreaterThanOrEqual(3);

    const faruq = users.find((u) => u.username === "faruq");
    expect(faruq).toBeDefined();
    expect(faruq?.role).toBe("ADMIN");

    const apip = users.find((u) => u.username === "apip");
    expect(apip).toBeDefined();
    expect(apip?.role).toBe("MEMBER");

    const rajip = users.find((u) => u.username === "rajip");
    expect(rajip).toBeDefined();
    expect(rajip?.role).toBe("MEMBER");
  });

  it("dapat memverifikasi login Admin dengan password yang sesuai", () => {
    const auth1 = authenticateUser("faruq", "faruq123", "ADMIN");
    expect(auth1).not.toBeNull();
    expect(auth1?.role).toBe("ADMIN");

    // Login sebagai Admin dengan username 'admin'
    const auth2 = authenticateUser("admin", "admin123", "ADMIN");
    expect(auth2).not.toBeNull();
    expect(auth2?.role).toBe("ADMIN");

    // Password salah
    const authFail = authenticateUser("faruq", "wrongpass", "ADMIN");
    expect(authFail).toBeNull();
  });

  it("dapat memverifikasi login Member dengan password yang sesuai", () => {
    const apip = authenticateUser("apip", "apip123", "MEMBER");
    expect(apip).not.toBeNull();
    expect(apip?.role).toBe("MEMBER");

    const rajip = authenticateUser("rajip", "rajip123", "MEMBER");
    expect(rajip).not.toBeNull();
    expect(rajip?.role).toBe("MEMBER");

    // Salah password
    expect(authenticateUser("apip", "salah", "MEMBER")).toBeNull();
    expect(authenticateUser("rajip", "salah", "MEMBER")).toBeNull();
  });

  it("dapat mengubah username dan password pengguna (updateSelfCredentials)", () => {
    const apip = getUserByUsername("apip")!;
    expect(apip).toBeDefined();

    // Coba ubah password dengan password saat ini yang salah -> harus gagal
    const failRes = updateSelfCredentials({
      userId: apip.id,
      currentPassword: "password_salah",
      newPassword: "apip_baru_123",
    });
    expect(failRes.success).toBe(false);

    // Ubah password dengan password saat ini yang benar -> harus berhasil
    const successRes = updateSelfCredentials({
      userId: apip.id,
      currentPassword: "apip123",
      newPassword: "apip_password_baru",
    });
    expect(successRes.success).toBe(true);

    // Verifikasi bahwa password baru bisa dipakai login
    const loginNew = authenticateUser("apip", "apip_password_baru", "MEMBER");
    expect(loginNew).not.toBeNull();

    // Kembalikan ke password awal agar test idempotent
    updateSelfCredentials({
      userId: apip.id,
      currentPassword: "apip_password_baru",
      newPassword: "apip123",
    });
  });

  it("Admin dapat mengatur/mereset password dan username anggota tim (updateTeamUserByAdmin)", () => {
    const rajip = getUserByUsername("rajip")!;
    expect(rajip).toBeDefined();

    const resetRes = updateTeamUserByAdmin({
      targetUserId: rajip.id,
      newPassword: "rajip_reset_admin",
    });
    expect(resetRes.success).toBe(true);

    const loginAfterReset = authenticateUser("rajip", "rajip_reset_admin", "MEMBER");
    expect(loginAfterReset).not.toBeNull();

    // Kembalikan ke password default
    updateTeamUserByAdmin({
      targetUserId: rajip.id,
      newPassword: "rajip123",
    });
  });

  it("menyediakan SYSTEM_PICS untuk delegasi pengerjaan oleh Admin", () => {
    expect(SYSTEM_PICS).toHaveLength(3);
    const picValues = SYSTEM_PICS.map((p) => p.value);
    expect(picValues).toContain("Faruq");
    expect(picValues).toContain("Apip");
    expect(picValues).toContain("Rajip");
  });

  it("mencocokkan penugasan tugas (isTaskAssignedToUser) dengan tepat", () => {
    expect(isTaskAssignedToUser("Apip", "Apip")).toBe(true);
    expect(isTaskAssignedToUser("Apip Dimas", "Apip")).toBe(true);
    expect(isTaskAssignedToUser("Faruq & Apip", "Apip")).toBe(true);
    expect(isTaskAssignedToUser("Faruq / Tim Elektrik", "Faruq")).toBe(true);
    expect(isTaskAssignedToUser("Rajip", "Rajip")).toBe(true);
    expect(isTaskAssignedToUser("Dedi", "Apip")).toBe(false);
  });

  it("membuat dan membaca kembali Session Token JWT dengan benar", async () => {
    const apipUser = getUserByUsername("apip")!;
    const token = await createSessionToken(toSessionUser(apipUser));
    expect(typeof token).toBe("string");

    const parsed = await parseSessionToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.username).toBe("apip");
    expect(parsed?.role).toBe("MEMBER");
  });
});
