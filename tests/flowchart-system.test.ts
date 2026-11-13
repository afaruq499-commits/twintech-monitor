import { describe, it, expect } from "vitest";
import {
  normalizeFlowchartPayload,
  validateDrawioXml,
  validatePngMagicBytes,
  StoredFlowchartPayload,
} from "../src/lib/flowchart-storage";
import { stitchFlowchartSvg, generateDrawioXml } from "../src/lib/flowchart-converter";

describe("Flowchart Storage & Conversion Verification (12 Skenario)", () => {
  it("Skenario 1 & 2: Normalisasi format legacy XML Draw.io mentah", () => {
    const rawXml = `<mxfile host="app.diagrams.net"><diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;
    const normalized = normalizeFlowchartPayload(rawXml, "proj-1");

    expect(normalized).not.toBeNull();
    expect(normalized?.schemaVersion).toBe(2);
    expect(normalized?.xml).toContain("<mxfile");
    expect(normalized?.projectId).toBe("proj-1");
  });

  it("Skenario 3: Normalisasi payload JSON versi 1 ke versi 2 standar", () => {
    const legacyJson = JSON.stringify({
      imageUrl: "/uploads/flowcharts/part1.png",
      imageUrls: ["/uploads/flowcharts/part1.png"],
      svgDataUrl: "data:image/svg+xml;utf8,<svg></svg>",
      xml: "<mxfile><diagram><mxGraphModel><root><mxCell id='0'/><mxCell id='1' parent='0'/></root></mxGraphModel></diagram></mxfile>",
    });

    const normalized = normalizeFlowchartPayload(legacyJson, "proj-2");
    expect(normalized).not.toBeNull();
    expect(normalized?.schemaVersion).toBe(2);
    expect(normalized?.primaryImageUrl).toBe("/uploads/flowcharts/part1.png");
    expect(normalized?.imageUrls).toEqual(["/uploads/flowcharts/part1.png"]);
  });

  it("Skenario 4: Validasi XML Draw.io mxfile yang valid & auto-sanitasi ampersand", () => {
    const xmlWithRawAmpersand = `<mxfile host="app.diagrams.net"><diagram name="Safety & Machine"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;
    const result = validateDrawioXml(xmlWithRawAmpersand);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedXml).toContain("Safety &amp; Machine");
  });

  it("Skenario 5: Penolakan XML rusak atau bukan mxfile", () => {
    const invalidXml1 = `<invalid>xml without mxfile or mxGraphModel</invalid>`;
    expect(validateDrawioXml(invalidXml1).isValid).toBe(false);

    const emptyXml = "";
    expect(validateDrawioXml(emptyXml).isValid).toBe(false);
  });

  it("Skenario 6: Validasi Magic Bytes PNG (89 50 4E 47)", async () => {
    // Valid PNG signature
    const validPngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validFile = new File([validPngBuffer], "valid.png", { type: "image/png" });
    const isPng = await validatePngMagicBytes(validFile);
    expect(isPng).toBe(true);

    // Fake PNG (misal file text atau jpeg dengan ekstensi .png)
    const fakeBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes
    const fakeFile = new File([fakeBuffer], "fake.png", { type: "image/png" });
    const isFakePng = await validatePngMagicBytes(fakeFile);
    expect(isFakePng).toBe(false);
  });

  it("Skenario 7 & 8: stitchFlowchartSvg mengutamakan HTTP public URL dibanding base64 raksasa", () => {
    const images = [
      {
        url: "/uploads/flowcharts/sample_1.png",
        base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        width: 800,
        height: 600,
      },
      {
        url: "/uploads/flowcharts/sample_2.png",
        base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        width: 800,
        height: 600,
      },
    ];

    const result = stitchFlowchartSvg(images);
    expect(result.svgDataUrl).toBeDefined();
    // Harus menyematkan path URL '/uploads/flowcharts/sample_1.png', BUKAN data:image/png;base64,...
    const decoded = decodeURIComponent(result.svgDataUrl);
    expect(decoded).toContain("/uploads/flowcharts/sample_1.png");
    expect(decoded).not.toContain("data:image/png;base64");
    // Ukuran SVG harus kecil (< 2KB), tidak membengkak menjadi MB
    expect(result.svgDataUrl.length).toBeLessThan(2000);
  });

  it("Skenario 9: Export dan Import roundtrip mempertahankan schema dan data", () => {
    const originalPayload: StoredFlowchartPayload = {
      schemaVersion: 2,
      projectId: "proj-100",
      primaryImageUrl: "/uploads/flowcharts/diagram.png",
      imageUrls: ["/uploads/flowcharts/diagram.png"],
      svgDataUrl: "data:image/svg+xml;utf8,<svg></svg>",
      xml: "<mxfile><diagram><mxGraphModel><root><mxCell id='0'/><mxCell id='1' parent='0'/></root></mxGraphModel></diagram></mxfile>",
      updatedAt: "2026-11-04T00:00:00.000Z",
    };

    const exportedJsonStr = JSON.stringify(originalPayload);
    const importedPayload = normalizeFlowchartPayload(exportedJsonStr, "proj-100");

    expect(importedPayload).toEqual(originalPayload);
  });

  it("Skenario 10: Import JSON yang rusak tidak menyebabkan crash", () => {
    expect(normalizeFlowchartPayload("corrupted json {{{{", "proj-error")).toBeNull();
    expect(normalizeFlowchartPayload("", "proj-error")).toBeNull();
    expect(normalizeFlowchartPayload(null, "proj-error")).toBeNull();
    expect(normalizeFlowchartPayload(undefined, "proj-error")).toBeNull();
  });

  it("Skenario 11: generateDrawioXml menghasilkan struktur mxfile dengan edge source-target valid", () => {
    const steps = [
      { id: "step_1", nomor: "1", judul: "Mulai", deskripsi: "Mulai Operasi", tipe: "START" as const },
      { id: "step_2", nomor: "2", judul: "Cek", deskripsi: "Cek Sensor", tipe: "DECISION" as const },
      { id: "step_3", nomor: "3", judul: "Selesai", deskripsi: "Operasi Selesai", tipe: "FINISH" as const },
    ];

    const xml = generateDrawioXml(steps, { diagramName: "Uji Alur" });
    expect(xml).toContain('<mxfile host="app.diagrams.net">');
    expect(xml).toContain('<mxCell id="step_1"');
    expect(xml).toContain('<mxCell id="step_2"');
    expect(xml).toContain('source="step_1" target="step_2"');
    expect(validateDrawioXml(xml).isValid).toBe(true);
  });
});
