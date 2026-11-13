import { describe, expect, it } from "vitest";
import {
  extractCoreEntities,
  recommendComponentsWithMl,
} from "@/lib/ml-recommender";
import { DEFAULT_PR_CATALOG } from "@/lib/pr-catalog-default";

describe("Machine Learning Component Recommender (NLP + Hybrid k-NN + Panel Sizing)", () => {
  it('mengidentifikasi "3 valve, 1 robot Yasakawa tipe a, dan 2 motor servo seri b" secara akurat ke 5 pilar rekomendasi', () => {
    const prompt = "3 valve, 1 robot Yasakawa tipe a, dan 2 motor servo seri b";
    const entities = extractCoreEntities(prompt);

    expect(entities).toHaveLength(3);
    expect(entities[0]).toMatchObject({ kind: "VALVE", qty: 3 });
    expect(entities[1]).toMatchObject({
      kind: "ROBOT",
      qty: 1,
      brand: "Yaskawa",
      seriesOrType: "tipe a",
    });
    expect(entities[2]).toMatchObject({
      kind: "SERVO",
      qty: 2,
      seriesOrType: "seri b",
    });

    const rec = recommendComponentsWithMl(prompt, DEFAULT_PR_CATALOG);

    expect(rec.mlMeta.confidencePct).toBeGreaterThanOrEqual(80);
    expect(rec.mlMeta.nearestProfiles.length).toBeGreaterThan(0);

    // 1. PSU: 240W 24VDC (Omron S8VK-C24024)
    expect(rec.summaryFivePillars.psu.headline).toContain("S8VK-C24024");
    expect(rec.summaryFivePillars.psu.recommendedMinWatts).toBeGreaterThan(120);

    // 2. Safety Relay: Programmable Safety Controller G9SP-N10S (karena Robot + 2 Servo)
    expect(rec.summaryFivePillars.safetyRelay.headline).toContain("G9SP-N10S");

    // 3. Jumlah Relay: 3 valve + 4 servo + 4 robot + 3 spare = 14 pcs MY2N-D2 + 14 pcs Socket PYF08A
    expect(rec.summaryFivePillars.relay.totalRelayQty).toBe(14);
    expect(rec.summaryFivePillars.relay.primaryItems[0].qty).toBe(14);
    expect(rec.summaryFivePillars.relay.primaryItems[0].partType).toContain(
      "MY2N-D2"
    );
    expect(rec.summaryFivePillars.relay.primaryItems[1].qty).toBe(14);
    expect(rec.summaryFivePillars.relay.primaryItems[1].partType).toContain(
      "PYF08A"
    );

    // 4. PLC: FX5U-80MT/ES Transistor High-Speed Pulse (wajib transistor karena ada 2 motor servo)
    // Sesuai permintaan user: JANGAN beli modul 64-pin (RX42C4 / RY42NT2P) jika cukup dengan FX5U!
    expect(rec.summaryFivePillars.plc.outputType).toBe("TRANSISTOR_HIGH_SPEED");
    expect(rec.summaryFivePillars.plc.headline).toContain("FX5U");
    const has64PinModule = rec.summaryFivePillars.plc.primaryItems.some(
      (item) =>
        item.partType.includes("RX42") ||
        item.partType.includes("RY42") ||
        item.partType.includes("64 Point")
    );
    expect(has64PinModule).toBe(false);

    // Perhitungan PLC
    expect(rec.summaryFivePillars.plc.calculation).toBeDefined();
    expect(rec.summaryFivePillars.plc.calculation.io.rawDi).toBeGreaterThan(0);
    expect(rec.summaryFivePillars.plc.calculation.io.requiredDi).toBeGreaterThan(
      rec.summaryFivePillars.plc.calculation.io.rawDi
    );
    expect(rec.summaryFivePillars.plc.calculation.selection.family).toBe("FX5U");

    // Pilar Baru: Perhitungan & Rekomendasi HMI (karena ada 2 servo + 1 robot, total layar >10 sehingga HMI 10" GS2110 direkomendasikan)
    expect(rec.summaryFivePillars.hmi).toBeDefined();
    expect(rec.summaryFivePillars.hmi.calculation.totalScreens).toBeGreaterThan(5);
    expect(rec.summaryFivePillars.hmi.calculation.estimatedTags).toBeGreaterThan(50);
    expect(rec.summaryFivePillars.hmi.primaryItems[0].pillar).toBe("HMI");
    expect(rec.summaryFivePillars.hmi.headline).toContain("GS2110");

    // 5. MCB: 3-Phasa Main MCCB 40A + 3x MCB 16A (1 Robot + 2 Servo) + MCB 6A + CP 5A + MCB 4A
    expect(rec.summaryFivePillars.mcb.supplyPhase).toBe("3-PHASA 380V/220V");
    expect(rec.summaryFivePillars.mcb.headline).toContain("EZC100B3040");
    const mcb16Row = rec.summaryFivePillars.mcb.primaryItems.find((i) =>
      i.partType.includes("A9F74216")
    );
    expect(mcb16Row?.qty).toBe(3);
  });

  it("merekomendasikan komponen ringkas & ekonomis untuk jig pneumatik sederhana tanpa servo/robot", () => {
    const rec = recommendComponentsWithMl(
      "1 valve pneumatik, 4 sensor proximity",
      DEFAULT_PR_CATALOG
    );

    expect(rec.summaryFivePillars.psu.headline).toContain("60W");
    expect(rec.summaryFivePillars.safetyRelay.headline).toContain("G9SA-501");
    expect(rec.summaryFivePillars.plc.outputType).toBe("RELAY_STANDARD");
    expect(rec.summaryFivePillars.plc.headline).toContain("FX5U-32MR/ES");
    // Cukup FX5U-32M murni 16 In / 16 Out tanpa modul ekspansi apa pun
    expect(
      rec.summaryFivePillars.plc.calculation.selection.chosen.lines
    ).toHaveLength(1);
    expect(
      rec.summaryFivePillars.plc.calculation.selection.chosen.lines[0].hwKey
    ).toBe("FX5U_32MR");
    expect(rec.summaryFivePillars.mcb.supplyPhase).toBe("1-PHASA 220VAC");

    // HMI 7 inch GS2107 cukup untuk mesin kecil
    expect(rec.summaryFivePillars.hmi.calculation.hwKey).toBe("GS2107");
    expect(rec.summaryFivePillars.hmi.headline).toContain("GS2107");
  });

  it("meng-upgrade ke Dual PSU 240W & Modular PLC MELSEC iQ-R untuk sistem multi-robot skala besar serta belajar dari riwayat proyek", () => {
    const rec = recommendComponentsWithMl(
      "2 robot Fanuc, 4 motor servo, 8 solenoid valve, 1 motor vacuum 3 phase",
      DEFAULT_PR_CATALOG,
      [
        {
          projectId: "hist-1",
          projectName: "Line Welding Robot Twin",
          coreDescription: "2 robot Yaskawa, 4 motor servo, 8 valve",
          components: [
            { partType: "Mitsubishi R04CPU", partName: "PLC", qty: 1 },
            { partType: "Omron S8VK-C24024", partName: "PSU", qty: 2 },
            { partType: "Omron G9SP-N10S", partName: "Safety", qty: 1 },
          ],
        },
      ]
    );

    expect(rec.mlMeta.historicalSamplesCount).toBe(1);
    expect(
      rec.mlMeta.nearestProfiles.some((p) => p.source === "RIWAYAT_PROYEK")
    ).toBe(true);
    expect(rec.summaryFivePillars.psu.primaryItems[0].qty).toBe(2);
    expect(rec.summaryFivePillars.plc.outputType).toBe("MODULAR_HIGH_IO");
    expect(rec.summaryFivePillars.plc.headline).toContain("R04CPU");
  });
});
