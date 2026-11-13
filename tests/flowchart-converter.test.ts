import { describe, it, expect } from "vitest";
import {
  parseTextToFlowSteps,
  generateDrawioXml,
  mergeStepSequences,
  stitchFlowchartSvg,
  getPngDimensions,
  createExactTwintechSafetyMachineFlowXml,
  isTwintechSafetyMachineDiagram,
  FlowStepItem,
} from "../src/lib/flowchart-converter";

describe("Flowchart Converter", () => {
  it("harus mengekstrak langkah sekuens mesin dari teks OCR dengan benar", () => {
    const sampleOcrText = `
      START STANDBY
      E-Stop Release & Pintu Safety Tutup

      1. HOME POSITION
      Servo Origin & Silinder Retract Reed SW OK

      2. LOADING PART
      Sensor Part Detect DI ON & Tombol Start Ditekan

      3. CLAMPING & PROBE TEST
      Silinder Clamp Maju & Silinder Probe Turun

      4. HASIL PENGUJIAN?
      Pengecekan Tegangan dan Arus Sesuai Toleransi?

      5. PART OK
      Marking Stamp & Eject ke Pallet OK

      6. PART NG
      Buzzer Alarm & Eject ke Chute NG

      7. UNCLAMP & RESET
      Silinder Kembali Home Siap Siklus Berikutnya
    `;

    const steps = parseTextToFlowSteps(sampleOcrText);

    expect(steps.length).toBeGreaterThanOrEqual(5);

    // Verifikasi node START
    const startStep = steps.find((s) => s.tipe === "START");
    expect(startStep).toBeDefined();

    // Verifikasi node DECISION
    const decisionStep = steps.find((s) => s.tipe === "DECISION");
    expect(decisionStep).toBeDefined();
    expect(decisionStep?.judul).toContain("HASIL");

    // Verifikasi cabang OK & NG
    const okStep = steps.find((s) => s.tipe === "OK");
    const ngStep = steps.find((s) => s.tipe === "NG");
    expect(okStep).toBeDefined();
    expect(ngStep).toBeDefined();

    // Verifikasi node FINISH
    const finishStep = steps.find((s) => s.tipe === "FINISH");
    expect(finishStep).toBeDefined();
  });

  it("harus menghasilkan Draw.io XML yang valid dan menyertakan node serta panah logika", () => {
    const steps = parseTextToFlowSteps("");
    const xml = generateDrawioXml(steps, { diagramName: "Test Mesin SPM" });

    expect(xml).toContain('<mxfile host="app.diagrams.net">');
    expect(xml).toContain('<diagram id="spm-flow" name="Test Mesin SPM">');
    expect(xml).toContain("POWER ON &amp; SAFETY STANDBY");
    expect(xml).toContain("INSPECT ON &amp; STAMP (OK)");
    expect(xml).toContain("ALARM NG &amp; HOMING (REJECT)");
    expect(xml).toContain("KEMBALI KE SAFETY CHECK");
    expect(xml).toContain("edge-ok");
    expect(xml).toContain("edge-ng");
  });

  it("harus mendukung opsi background image untuk tracing 1:1", () => {
    const steps = parseTextToFlowSteps("");
    const xml = generateDrawioXml(steps, {
      backgroundImageUrl: "/uploads/flowcharts/test.png",
      diagramName: "Tracing Test",
    });

    expect(xml).toContain('id="bg-reference-image-0"');
    expect(xml).toContain("shape=image;image=/uploads/flowcharts/test.png");
  });

  it("harus menggabungkan 2 gambar alur sekuens menjadi 1 rangkaian flowchart utuh", () => {
    // Alur dari Gambar 1 (Safety & Power-Up)
    const seqGambar1: FlowStepItem[] = [
      { id: "s1", nomor: "0", judul: "POWER ON & SAFETY", deskripsi: "E-Stop release", tipe: "START" },
      { id: "s2", nomor: "1", judul: "SAFETY RELAY ON", deskripsi: "Safety door tutup", tipe: "STEP" },
      { id: "s3", nomor: "2", judul: "SUPPLY 24VDC", deskripsi: "Sensor dan aktuator siap", tipe: "STEP" },
      { id: "s4", nomor: "3", judul: "SELESAI SAFETY CHECK", deskripsi: "Siap ke proses berikutnya", tipe: "FINISH" },
    ];

    // Alur dari Gambar 2 (Auto Running & Part Testing)
    const seqGambar2: FlowStepItem[] = [
      { id: "g1", nomor: "0", judul: "START AUTO RUNNING", deskripsi: "Tombol start ditekan", tipe: "START" },
      { id: "g2", nomor: "1", judul: "HOMING & CLAMPING", deskripsi: "Silinder menjepit benda kerja", tipe: "STEP" },
      { id: "g3", nomor: "2", judul: "HASIL TEST OK?", deskripsi: "Pengecekan voltase", tipe: "DECISION" },
      { id: "g4", nomor: "OK", judul: "PART OK", deskripsi: "Eject box OK", tipe: "OK" },
      { id: "g5", nomor: "NG", judul: "PART NG", deskripsi: "Alarm buzzer", tipe: "NG" },
      { id: "g6", nomor: "3", judul: "UNCLAMP & RESET", deskripsi: "Siklus selesai", tipe: "FINISH" },
    ];

    const merged = mergeStepSequences([seqGambar1, seqGambar2]);

    // Verifikasi total langkah tergabung
    expect(merged.length).toBe(10);

    // Node START pertama berasal dari Gambar 1
    expect(merged[0].tipe).toBe("START");
    expect(merged[0].judul).toContain("POWER ON");

    // Node START dari Gambar 2 otomatis diubah menjadi langkah kelanjutan (STEP)
    const stepLanjutan = merged.find((s) => s.judul.includes("AUTO RUNNING") || s.judul.includes("BAGIAN 2"));
    expect(stepLanjutan).toBeDefined();
    expect(stepLanjutan?.tipe).toBe("STEP");

    // Node FINISH akhir berasal dari Gambar 2
    expect(merged[merged.length - 1].tipe).toBe("FINISH");
    expect(merged[merged.length - 1].judul).toContain("UNCLAMP");

    // Generate Draw.io XML dari 2 gambar tergabung
    const xml = generateDrawioXml(merged, {
      backgroundImageUrls: ["/uploads/flowcharts/img1.png", "/uploads/flowcharts/img2.png"],
      diagramName: "Alur Gabungan 2 Halaman",
    });

    expect(xml).toContain("bg-reference-image-0");
    expect(xml).toContain("bg-reference-image-1");
    expect(xml).toContain("POWER ON");
    expect(xml).toContain("HOMING &amp; CLAMPING");
    expect(xml).toContain("edge-ok");
    expect(xml).toContain("edge-ng");
  });

  it("harus menjahit multi-gambar flowchart menjadi kanvas SVG 1:1 berdampingan (stitch)", () => {
    const images = [
      { url: "/uploads/flowcharts/part1.png", width: 947, height: 1024 },
      { url: "/uploads/flowcharts/part2.png", width: 838, height: 1024 },
    ];

    const result = stitchFlowchartSvg(images);
    expect(result.totalWidth).toBe(947 + 838 + 90);
    expect(result.totalHeight).toBe(1024 + 40);
    expect(result.svgDataUrl).toContain("data:image/svg+xml");
    expect(result.svgDataUrl).toContain(encodeURIComponent("/uploads/flowcharts/part1.png"));
    expect(result.svgDataUrl).toContain(encodeURIComponent("/uploads/flowcharts/part2.png"));
  });

  it("harus merekonstruksi alur Draw.io XML Twintech Safety & Machine Running secara presisi", () => {
    const { xml, steps } = createExactTwintechSafetyMachineFlowXml(
      "/uploads/flowcharts/safety.png",
      "/uploads/flowcharts/running.png"
    );

    expect(steps.length).toBe(15);
    expect(xml).toContain("Power ON");
    expect(xml).toContain("Safety relay ON");
    expect(xml).toContain("Safety check OK?");
    expect(xml).toContain("Light curtain");
    expect(xml).toContain("Mesin ready");
    expect(xml).toContain("2 PB ditekan bersama 2 s?");
    expect(xml).toContain("Inspect ON");
    expect(xml).toContain("Hasil inspect?");
    expect(xml).toContain("Stamp label");
    expect(xml).toContain("Homing");
    expect(xml).toContain("inter-edge-a");
    expect(xml).toContain("inter-edge-b");
    expect(xml).toContain("shape=image;image=/uploads/flowcharts/safety.png");
    expect(xml).toContain("shape=image;image=/uploads/flowcharts/running.png");
  });

  it("harus mendeteksi nama berkas diagram alur Twintech Safety Relay", () => {
    expect(isTwintechSafetyMachineDiagram(["process_safety_relay.png"])).toBe(true);
    expect(isTwintechSafetyMachineDiagram(["machine_running_inspect.png"])).toBe(true);
    expect(isTwintechSafetyMachineDiagram(["random_diagram.png"])).toBe(false);
  });
});
