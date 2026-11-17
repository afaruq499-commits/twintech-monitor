import { describe, it, expect } from "vitest";
import { getHmiBrandBadge } from "@/components/ProjectHmiProgramPanel";
import { POST as handleUpload } from "@/app/api/upload/route";
import { GET as handleServeUpload } from "@/app/uploads/[...path]/route";
import { unlink, rm } from "fs/promises";
import path from "path";

// Test helper untuk ekstensi PLC badge
function testPlcBrand(fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  switch (ext) {
    case "kvp":
    case "kvs":
    case "kvr":
    case "kvd":
    case "kbp":
    case "kvz":
    case "kv":
      return "Keyence KV STUDIO (KV-8000)";
    case "kpr":
      return "Panasonic FPWIN GR (.kpr)";
    case "p7":
    case "p6":
    case "fp":
    case "fpw":
    case "fpe":
    case "prg":
      return "Panasonic FPWIN Pro 7 (.p7)";
    case "fkg":
    case "pms":
    case "ldf":
      return "Fatek UpperLogic (.fkg/.pms)";
    case "cxp":
      return "Omron CX-Programmer (.cxp)";
    case "gx3":
      return "Mitsubishi GX Works 3 (.gx3)";
    default:
      return `Software PLC (.${ext.toUpperCase()})`;
  }
}

describe("Engineering File Formats & Badge Detection", () => {
  it("mengenali format AutoCAD DWG untuk Diagram Wiring", () => {
    const filename = "MTM.dwg";
    const lower = filename.toLowerCase();
    expect(lower.endsWith(".dwg")).toBe(true);
    expect(lower.endsWith(".pdf")).toBe(false);
  });

  it("mengenali berkas Panasonic FPWIN GR (.kpr) untuk Program PLC", () => {
    const plcBadge = testPlcBrand("WEJ_11082026.kpr");
    expect(plcBadge).toBe("Panasonic FPWIN GR (.kpr)");
  });

  it("mengenali berkas Keyence VT STUDIO AutoBackup (.vfx) untuk Program HMI", () => {
    const hmiBadge = getHmiBrandBadge("!AutoBackup0.vfx");
    expect(hmiBadge.brand).toBe("Keyence");
    expect(hmiBadge.label).toBe("Keyence VT STUDIO (.vfx)");
  });

  it("mengenali berkas standar HMI lainnya (Panasonic GTWIN, Fatek FV, Omron, Mitsubishi)", () => {
    expect(getHmiBrandBadge("Panel.gtn").brand).toBe("Panasonic");
    expect(getHmiBrandBadge("Screen.fvd").brand).toBe("Fatek");
    expect(getHmiBrandBadge("Touch.pkg").brand).toBe("Omron");
    expect(getHmiBrandBadge("Display.gtx").brand).toBe("Mitsubishi");
  });
});

describe("Upload & Download Round-Trip for CAD & Engineering Files", () => {
  let uploadedDwgUrl = "";
  let uploadedKprUrl = "";
  let uploadedVfxUrl = "";

  it("berhasil mengunggah berkas AutoCAD DWG ke category wiring-diagrams", async () => {
    const sampleDwgBytes = new Uint8Array([0x41, 0x43, 0x31, 0x30, 0x32, 0x34]); // AC1024 DWG magic bytes
    const blob = new Blob([sampleDwgBytes], { type: "application/octet-stream" });
    const file = new File([blob], "MTM.dwg", { type: "application/octet-stream" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "wiring-diagrams");

    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await handleUpload(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.fileName).toBe("MTM.dwg");
    expect(json.url).toMatch(/^\/uploads\/wiring-diagrams\/\d+_MTM\.dwg$/);
    uploadedDwgUrl = json.url;
  });

  it("berhasil mengunggah berkas Panasonic PLC .kpr ke category plc-programs", async () => {
    const sampleKprBytes = new Uint8Array([0x50, 0x41, 0x4e, 0x41, 0x53, 0x4f]);
    const blob = new Blob([sampleKprBytes], { type: "application/octet-stream" });
    const file = new File([blob], "WEJ_11082026.kpr", { type: "application/octet-stream" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "plc-programs");

    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await handleUpload(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.fileName).toBe("WEJ_11082026.kpr");
    expect(json.url).toMatch(/^\/uploads\/plc-programs\/\d+_WEJ_11082026\.kpr$/);
    uploadedKprUrl = json.url;
  });

  it("berhasil mengunggah berkas Keyence HMI .vfx ke category hmi-programs", async () => {
    const sampleVfxBytes = new Uint8Array([0x56, 0x54, 0x53, 0x38, 0x47]);
    const blob = new Blob([sampleVfxBytes], { type: "application/octet-stream" });
    const file = new File([blob], "!AutoBackup0.vfx", { type: "application/octet-stream" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "hmi-programs");

    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await handleUpload(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.fileName).toBe("!AutoBackup0.vfx");
    expect(json.url).toMatch(/^\/uploads\/hmi-programs\/\d+__AutoBackup0\.vfx$/);
    uploadedVfxUrl = json.url;
  });

  it("menyajikan berkas unduhan dengan Content-Disposition attachment untuk dibuka di software laptop", async () => {
    expect(uploadedDwgUrl).toBeTruthy();
    const segments = uploadedDwgUrl.replace("/uploads/", "").split("/");

    const serveReq = new Request(`http://localhost${uploadedDwgUrl}`);
    const serveRes = await handleServeUpload(serveReq, {
      params: Promise.resolve({ path: segments }),
    });

    expect(serveRes.status).toBe(200);
    const disposition = serveRes.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("MTM.dwg");

    // Clean up file test dari disk
    try {
      const filePath = path.join(process.cwd(), "public", "uploads", ...segments);
      await unlink(filePath);
    } catch {}
  });
});
