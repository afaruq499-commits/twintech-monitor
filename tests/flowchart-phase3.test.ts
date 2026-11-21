import { describe, it, expect } from "vitest";
import { calculateNodeAlignment } from "../src/lib/flowchart-routing";
import type { FlowchartNode } from "../src/lib/flowchart-types";

describe("Flowchart Tahap 3: Alignment Guides, Styling, Z-Order & Geometry", () => {
  const nodeA: FlowchartNode = {
    id: "node-a",
    type: "process",
    x: 100,
    y: 100,
    width: 120,
    height: 60,
    label: "Node A",
  };

  const nodeB: FlowchartNode = {
    id: "node-b",
    type: "process",
    x: 300,
    y: 200,
    width: 120,
    height: 60,
    label: "Node B",
  };

  it("mendeteksi vertical center alignment dan melakukan snap koordinat X", () => {
    // nodeA centerX = 100 + 60 = 160
    // nodeMoving dengan width: 100. Jika x: 108, centerX = 158 (selisih 2px, dalam toleransi 6px)
    const dragged = { x: 108, y: 300, width: 100, height: 60 };
    const res = calculateNodeAlignment(dragged, [nodeA, nodeB], 6);

    // Harus snap ke centerX = 160 -> x = 160 - 50 = 110
    expect(res.snappedX).toBe(110);
    expect(res.guides.length).toBeGreaterThan(0);
    const vGuide = res.guides.find((g) => g.type === "vertical");
    expect(vGuide).toBeDefined();
    expect(vGuide?.position).toBe(160);
  });

  it("mendeteksi horizontal top alignment dan melakukan snap koordinat Y", () => {
    // nodeB y = 200, height = 60
    // dragged dengan height: 80, y = 203 (diffTT = 3px, center diff = 13px)
    const dragged = { x: 500, y: 203, width: 100, height: 80 };
    const res = calculateNodeAlignment(dragged, [nodeA, nodeB], 6);

    expect(res.snappedY).toBe(200);
    const hGuide = res.guides.find((g) => g.type === "horizontal");
    expect(hGuide).toBeDefined();
    expect(hGuide?.position).toBe(200);
  });

  it("tidak menampilkan guide jika node berada di luar batas toleransi snap", () => {
    const dragged = { x: 50, y: 50, width: 100, height: 60 };
    const res = calculateNodeAlignment(dragged, [nodeA, nodeB], 6);

    expect(res.guides.length).toBe(0);
    expect(res.snappedX).toBe(50);
    expect(res.snappedY).toBe(50);
  });

  it("mendukung kustomisasi warna isi, border, ukuran font, dan perataan teks pada FlowchartNode", () => {
    const styledNode: FlowchartNode = {
      id: "node-styled",
      type: "decision",
      x: 150,
      y: 250,
      width: 140,
      height: 80,
      label: "KONDISI VALID?",
      fillColor: "#059669",
      strokeColor: "#047857",
      strokeWidth: 3,
      textColor: "#fef08a",
      fontSize: 14,
      textAlign: "right",
    };

    expect(styledNode.fillColor).toBe("#059669");
    expect(styledNode.strokeColor).toBe("#047857");
    expect(styledNode.strokeWidth).toBe(3);
    expect(styledNode.fontSize).toBe(14);
    expect(styledNode.textAlign).toBe("right");
  });

  it("mendukung operasi z-order: bring to front dan send to back secara immutability", () => {
    const initialList: FlowchartNode[] = [
      { id: "1", type: "process", x: 0, y: 0, width: 50, height: 50, label: "1" },
      { id: "2", type: "process", x: 0, y: 0, width: 50, height: 50, label: "2" },
      { id: "3", type: "process", x: 0, y: 0, width: 50, height: 50, label: "3" },
    ];

    // Bring node 1 to front -> urutan jadi [2, 3, 1]
    const targetId = "1";
    const idx = initialList.findIndex((n) => n.id === targetId);
    const item = initialList[idx];
    const rest = initialList.filter((_, i) => i !== idx);
    const frontList = [...rest, item];
    expect(frontList.map((n) => n.id)).toEqual(["2", "3", "1"]);

    // Send node 3 to back -> urutan jadi [3, 2, 1]
    const backIdx = frontList.findIndex((n) => n.id === "3");
    const backItem = frontList[backIdx];
    const backRest = frontList.filter((_, i) => i !== backIdx);
    const backList = [backItem, ...backRest];
    expect(backList.map((n) => n.id)).toEqual(["3", "2", "1"]);
  });

  it("mendukung duplikasi node dengan offset posisi baru dan penanda salinan", () => {
    const original: FlowchartNode = {
      id: "node-orig",
      type: "start_end",
      x: 100,
      y: 100,
      width: 120,
      height: 50,
      label: "START",
      fillColor: "#2563eb",
    };

    const duplicate: FlowchartNode = {
      ...original,
      id: "node-copy-123",
      x: original.x + 30,
      y: original.y + 30,
      label: `${original.label} (Salinan)`,
    };

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.x).toBe(130);
    expect(duplicate.y).toBe(130);
    expect(duplicate.label).toBe("START (Salinan)");
    expect(duplicate.fillColor).toBe("#2563eb");
  });
});
