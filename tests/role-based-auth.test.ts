import { describe, expect, it } from "vitest";
import {
  authenticateUser,
  getAllUsers,
  getUserByUsername,
  isTaskAssignedToUser,
  SYSTEM_PICS,
  toSessionUser,
} from "../src/lib/users";
import {
  createSessionToken,
  parseSessionToken,
  verifyPassword,
} from "../src/lib/auth";

describe("Sistem Otentikasi & Role Pengguna (Admin vs Member)", () => {
  it("memiliki 1 akun Admin (Faruq) dan 2 akun Member (Apip & Rajip)", () => {
    const users = getAllUsers();
    expect(users).toHaveLength(3);

    const faruq = users.find((u) => u.username === "faruq");
    expect(faruq).toBeDefined();
    expect(faruq?.role).toBe("ADMIN");
    expect(faruq?.nama).toBe("Faruq");

    const apip = users.find((u) => u.username === "apip");
    expect(apip).toBeDefined();
    expect(apip?.role).toBe("MEMBER");
    expect(apip?.nama).toBe("Apip");

    const rajip = users.find((u) => u.username === "rajip");
    expect(rajip).toBeDefined();
    expect(rajip?.role).toBe("MEMBER");
    expect(rajip?.nama).toBe("Rajip");
  });

  it("dapat memverifikasi login Faruq sebagai Admin", () => {
    const auth1 = authenticateUser("faruq", "faruq123");
    expect(auth1).not.toBeNull();
    expect(auth1?.role).toBe("ADMIN");

    // Login dengan identifier role 'admin'
    const auth2 = authenticateUser("admin", "admin123");
    expect(auth2).not.toBeNull();
    expect(auth2?.username).toBe("faruq");

    // Password salah
    const authFail = authenticateUser("faruq", "wrongpass");
    expect(authFail).toBeNull();
  });

  it("dapat memverifikasi login Apip dan Rajip sebagai Member", () => {
    const apip = authenticateUser("apip", "apip123");
    expect(apip).not.toBeNull();
    expect(apip?.role).toBe("MEMBER");
    expect(apip?.nama).toBe("Apip");

    const rajip = authenticateUser("rajip", "rajip123");
    expect(rajip).not.toBeNull();
    expect(rajip?.role).toBe("MEMBER");
    expect(rajip?.nama).toBe("Rajip");

    // Salah password
    expect(authenticateUser("apip", "salah")).toBeNull();
    expect(authenticateUser("rajip", "salah")).toBeNull();
  });

  it("menyediakan SYSTEM_PICS untuk delegasi pengerjaan oleh Admin", () => {
    expect(SYSTEM_PICS).toHaveLength(3);
    const picValues = SYSTEM_PICS.map((p) => p.value);
    expect(picValues).toContain("Faruq");
    expect(picValues).toContain("Apip");
    expect(picValues).toContain("Rajip");

    const faruqPic = SYSTEM_PICS.find((p) => p.value === "Faruq");
    expect(faruqPic?.role).toBe("ADMIN");

    const apipPic = SYSTEM_PICS.find((p) => p.value === "Apip");
    expect(apipPic?.role).toBe("MEMBER");
  });

  it("mencocokkan penugasan tugas (isTaskAssignedToUser) dengan tepat", () => {
    expect(isTaskAssignedToUser("Apip", "Apip")).toBe(true);
    expect(isTaskAssignedToUser("Apip Dimas", "Apip")).toBe(true);
    expect(isTaskAssignedToUser("Faruq & Apip", "Apip")).toBe(true);
    expect(isTaskAssignedToUser("Faruq / Tim Elektrik", "Faruq")).toBe(true);
    expect(isTaskAssignedToUser("Rajip", "Rajip")).toBe(true);
    expect(isTaskAssignedToUser("Dedi", "Apip")).toBe(false);
    expect(isTaskAssignedToUser(null, "Apip")).toBe(false);
  });

  it("membuat dan membaca kembali Session Token JWT dengan benar", async () => {
    const apipUser = getUserByUsername("apip")!;
    const token = await createSessionToken(toSessionUser(apipUser));
    expect(typeof token).toBe("string");

    const parsed = await parseSessionToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.username).toBe("apip");
    expect(parsed?.role).toBe("MEMBER");
    expect(parsed?.nama).toBe("Apip");
  });
});
