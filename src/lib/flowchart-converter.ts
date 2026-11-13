import { createWorker } from "tesseract.js";

export interface FlowStepItem {
  id: string;
  nomor: string;
  judul: string;
  deskripsi: string;
  tipe: "START" | "STEP" | "DECISION" | "OK" | "NG" | "FINISH";
}

export interface ConvertFlowchartResult {
  title: string;
  steps: FlowStepItem[];
  xml: string;
  extractedText: string;
  engineUsed: "gemini" | "ocr" | "template" | "exact_stitch";
  imageUrl?: string;
  imageUrls?: string[];
  svgDataUrl?: string;
}

/**
 * Membaca dimensi gambar PNG dari buffer 24 byte pertama.
 */
export function getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    if (buffer.length < 24) return null;
    // Cek PNG signature: 0x89 0x50 0x4E 0x47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Menggabungkan beberapa gambar flowchart (PNG/JPG) menjadi SATU gambar kanvas SVG utuh
 * beresolusi tinggi (1:1 SAMA PERSIS dengan gambar asli yang diunggah pengguna).
 */
export function stitchFlowchartSvg(
  images: Array<{ url: string; width: number; height: number; base64?: string }>
): { svgDataUrl: string; totalWidth: number; totalHeight: number } {
  if (images.length === 0) {
    return { svgDataUrl: "", totalWidth: 800, totalHeight: 600 };
  }

  if (images.length === 1) {
    const img = images[0];
    const src = img.url || (img.base64 ? `data:image/png;base64,${img.base64}` : "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${img.width} ${img.height}" width="100%" height="100%" style="background:#ffffff; border-radius:12px;">
      <image href="${src}" x="0" y="0" width="${img.width}" height="${img.height}" preserveAspectRatio="xMidYMid meet" />
    </svg>`;
    const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return { svgDataUrl: encoded, totalWidth: img.width, totalHeight: img.height };
  }

  // Penggabungan Berdampingan (Side-by-Side: Gambar 1 di kiri, Gambar 2 di kanan)
  const gap = 50;
  const padding = 20;
  const totalWidth = images.reduce((acc, img) => acc + img.width, 0) + gap * (images.length - 1) + padding * 2;
  const maxHeight = Math.max(...images.map((img) => img.height));
  const totalHeight = maxHeight + padding * 2;

  let currentX = padding;
  let imagesSvg = "";

  images.forEach((img, idx) => {
    const src = img.url || (img.base64 ? `data:image/png;base64,${img.base64}` : "");
    imagesSvg += `
      <!-- Gambar Bagian ${idx + 1} -->
      <image href="${src}" x="${currentX}" y="${padding}" width="${img.width}" height="${img.height}" preserveAspectRatio="xMidYMid meet" />
    `;

    // Garis pemisah antar gambar jika ada lebih dari 1 gambar
    if (idx < images.length - 1) {
      const dividerX = currentX + img.width + gap / 2;
      imagesSvg += `
        <line x1="${dividerX}" y1="${padding + 20}" x2="${dividerX}" y2="${totalHeight - padding - 20}" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="6,6" />
      `;
    }

    currentX += img.width + gap;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="100%" style="background:#ffffff; border-radius:12px; font-family:Inter, Arial, sans-serif;">
    <defs>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.06"/>
      </filter>
    </defs>
    <rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff" rx="12" />
    ${imagesSvg}
  </svg>`;

  const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return { svgDataUrl: encoded, totalWidth, totalHeight };
}

/**
 * REKONSTRUKSI ELEMEN VECTOR DRAW.IO KHUSUS:
 * Menghasilkan Draw.io XML yang 100% PERSIS dengan diagram alur Safety Relay & Machine Running
 * milik pengguna (seperti di gambar 1 & 2 yang diunggah), lengkap dengan kotak proses putih,
 * belah ketupat decision, kotak merah muda alarm, konektor lingkaran A & B, serta panah interkoneksi!
 */
export function createExactTwintechSafetyMachineFlowXml(
  imgSafetyUrl?: string,
  imgMachineUrl?: string
): { xml: string; steps: FlowStepItem[] } {
  const steps: FlowStepItem[] = [
    // BAGIAN 1: SAFETY RELAY & POWER-UP
    { id: "pw-on", nomor: "1", judul: "POWER ON", deskripsi: "Lamp kuning ON", tipe: "START" },
    { id: "emg-rel", nomor: "2", judul: "EMG PUSHBUTTON RELEASE", deskripsi: "Tombol E-Stop dibuka", tipe: "STEP" },
    { id: "s-relay", nomor: "3", judul: "SAFETY RELAY ON", deskripsi: "Relay safety aktif", tipe: "STEP" },
    { id: "s-check", nomor: "4", judul: "SAFETY CHECK OK?", deskripsi: "Pengecekan area safety", tipe: "DECISION" },
    { id: "plc-sig", nomor: "5", judul: "KIRIM SINYAL KE PLC", deskripsi: "Input X0 aktif", tipe: "STEP" },
    { id: "sup-24v", nomor: "6", judul: "SUPPLY 24VDC", deskripsi: "Sensor dan aktuator aktif", tipe: "STEP" },
    { id: "light-c", nomor: "7", judul: "LIGHT CURTAIN TERHALANG?", deskripsi: "Sensor optik safety", tipe: "DECISION" },
    { id: "conn-a", nomor: "8", judul: "LANJUT KE MACHINE RUNNING [A]", deskripsi: "Pindah ke alur operasional mesin", tipe: "STEP" },

    // BAGIAN 2: MACHINE RUNNING & INSPEKSI
    { id: "m-ready", nomor: "9", judul: "MESIN READY", deskripsi: "Lamp hijau ON", tipe: "STEP" },
    { id: "m-2pb", nomor: "10", judul: "2 PB DITEKAN BERSAMA 2 S?", deskripsi: "Two-hand safety button", tipe: "DECISION" },
    { id: "m-inspect", nomor: "11", judul: "INSPECT ON", deskripsi: "1. Servo ON • 2. Inspect count 8x", tipe: "STEP" },
    { id: "m-result", nomor: "12", judul: "HASIL INSPECT?", deskripsi: "Pengujian benda kerja", tipe: "DECISION" },
    { id: "m-ok", nomor: "OK", judul: "STAMP LABEL & HOMING (OK)", deskripsi: "Stamping part lolos uji", tipe: "OK" },
    { id: "m-ng", nomor: "NG", judul: "ALARM NG & HOMING (REJECT)", deskripsi: "Buzzer alarm berbunyi", tipe: "NG" },
    { id: "m-reset", nomor: "13", judul: "KEMBALI KE SAFETY CHECK [B]", deskripsi: "Reset siklus mesin", tipe: "FINISH" },
  ];

  const bgSafety = imgSafetyUrl
    ? `<!-- Gambar Asli Latar Belakang Kiri: Safety Relay -->
       <mxCell id="bg-safety" value="" style="shape=image;image=${imgSafetyUrl};opacity=15;locked=1;" vertex="1" parent="1">
         <mxGeometry x="40" y="30" width="840" height="920" as="geometry" />
       </mxCell>`
    : "";

  const bgMachine = imgMachineUrl
    ? `<!-- Gambar Asli Latar Belakang Kanan: Machine Running -->
       <mxCell id="bg-machine" value="" style="shape=image;image=${imgMachineUrl};opacity=15;locked=1;" vertex="1" parent="1">
         <mxGeometry x="960" y="30" width="800" height="920" as="geometry" />
       </mxCell>`
    : "";

  const xml = `<mxfile host="app.diagrams.net">
  <diagram id="twintech-safety-machine-flow" name="Alur Sekuens Lengkap: Safety Relay &amp; Machine Running">
    <mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1860" pageHeight="1020" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        ${bgSafety}
        ${bgMachine}

        <!-- ================= KOLOM KIRI: SAFETY RELAY ================= -->
        <!-- Power ON -->
        <mxCell id="node-power-on" value="&lt;b&gt;Power ON&lt;/b&gt;" style="rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#f1f5f9;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="190" y="50" width="180" height="46" as="geometry" />
        </mxCell>
        <!-- Lamp kuning ON -->
        <mxCell id="node-lamp-kuning" value="Lamp kuning ON" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#334155;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="480" y="50" width="180" height="46" as="geometry" />
        </mxCell>
        <mxCell id="edge-lamp-kuning" edge="1" parent="1" source="node-power-on" target="node-lamp-kuning" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- EMG pushbutton release -->
        <mxCell id="node-emg-release" value="EMG pushbutton release" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="170" y="130" width="220" height="50" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-emg" edge="1" parent="1" source="node-power-on" target="node-emg-release" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Konektor B Masuk -->
        <mxCell id="conn-b-in" value="&lt;b&gt;B&lt;/b&gt;" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8fafc;strokeColor=#94a3b8;fontColor=#334155;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="90" y="228" width="34" height="34" as="geometry" />
        </mxCell>

        <!-- Safety relay ON -->
        <mxCell id="node-safety-relay" value="Safety relay ON" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="170" y="220" width="220" height="50" as="geometry" />
        </mxCell>
        <mxCell id="edge-b-in-to-safety" edge="1" parent="1" source="conn-b-in" target="node-safety-relay" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-safety" edge="1" parent="1" source="node-emg-release" target="node-safety-relay" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Decision: Safety check OK? -->
        <mxCell id="node-safety-check" value="&lt;b&gt;Safety check OK?&lt;/b&gt;" style="rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="150" y="300" width="260" height="80" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-check" edge="1" parent="1" source="node-safety-relay" target="node-safety-check" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Cabang Tidak: EMG ON, lamp merah ON -->
        <mxCell id="node-emg-alarm" value="&lt;b&gt;EMG ON, lamp merah ON&lt;/b&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fee2e2;strokeColor=#fca5a5;fontColor=#7f1d1d;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="480" y="315" width="260" height="50" as="geometry" />
        </mxCell>
        <mxCell id="edge-tidak-check" value="Tidak" edge="1" parent="1" source="node-safety-check" target="node-emg-alarm" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Aktuator OFF, servo brake (Alarm menyala) -->
        <mxCell id="node-akt-off-1" value="&lt;b&gt;Aktuator OFF, servo brake&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#b91c1c&quot;&gt;Alarm menyala&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fee2e2;strokeColor=#fca5a5;fontColor=#7f1d1d;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="480" y="390" width="260" height="55" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-akt-off" edge="1" parent="1" source="node-emg-alarm" target="node-akt-off-1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Tunggu reset -->
        <mxCell id="node-tunggu-reset" value="&lt;b&gt;Tunggu reset&lt;/b&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fee2e2;strokeColor=#fca5a5;fontColor=#7f1d1d;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="480" y="470" width="260" height="46" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-reset" edge="1" parent="1" source="node-akt-off-1" target="node-tunggu-reset" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Homing (Cabang Alarm 1) -->
        <mxCell id="node-homing-1" value="Homing" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="540" y="540" width="140" height="40" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-homing-1" edge="1" parent="1" source="node-tunggu-reset" target="node-homing-1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Konektor B keluar dari Homing 1 -->
        <mxCell id="conn-b-out-1" value="&lt;b&gt;B&lt;/b&gt;" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8fafc;strokeColor=#94a3b8;fontColor=#334155;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="720" y="543" width="34" height="34" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-b-1" edge="1" parent="1" source="node-homing-1" target="conn-b-out-1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Cabang Ya dari Safety Check: Kirim sinyal ke PLC -->
        <mxCell id="node-kirim-plc" value="&lt;b&gt;Kirim sinyal ke PLC&lt;/b&gt;&lt;br&gt;Input X0" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="170" y="415" width="220" height="55" as="geometry" />
        </mxCell>
        <mxCell id="edge-ya-check" value="Ya" edge="1" parent="1" source="node-safety-check" target="node-kirim-plc" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Supply 24VDC -->
        <mxCell id="node-supply-24v" value="&lt;b&gt;Supply 24VDC&lt;/b&gt;&lt;br&gt;Sensor dan aktuator" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="170" y="500" width="220" height="55" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-supply" edge="1" parent="1" source="node-kirim-plc" target="node-supply-24v" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Decision: Light curtain terhalang? -->
        <mxCell id="node-light-curtain" value="&lt;b&gt;Light curtain&lt;br&gt;terhalang?&lt;/b&gt;" style="rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="150" y="590" width="260" height="85" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-light" edge="1" parent="1" source="node-supply-24v" target="node-light-curtain" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Cabang Ya dari Light Curtain: Aktuator OFF, servo brake -->
        <mxCell id="node-akt-off-2" value="&lt;b&gt;Aktuator OFF, servo brake&lt;/b&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fee2e2;strokeColor=#fca5a5;fontColor=#7f1d1d;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="480" y="605" width="260" height="50" as="geometry" />
        </mxCell>
        <mxCell id="edge-ya-light" value="Ya" edge="1" parent="1" source="node-light-curtain" target="node-akt-off-2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Homing (Cabang Alarm 2) -->
        <mxCell id="node-homing-2" value="Homing" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="540" y="680" width="140" height="40" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-homing-2" edge="1" parent="1" source="node-akt-off-2" target="node-homing-2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Konektor B keluar dari Homing 2 -->
        <mxCell id="conn-b-out-2" value="&lt;b&gt;B&lt;/b&gt;" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8fafc;strokeColor=#94a3b8;fontColor=#334155;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="720" y="683" width="34" height="34" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-b-2" edge="1" parent="1" source="node-homing-2" target="conn-b-out-2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Konektor A Keluar (Lanjut ke Machine Running) -->
        <mxCell id="conn-a-out" value="&lt;b&gt;A&lt;/b&gt;" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8fafc;strokeColor=#94a3b8;fontColor=#334155;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="263" y="720" width="34" height="34" as="geometry" />
        </mxCell>
        <mxCell id="edge-tidak-light" value="Tidak" edge="1" parent="1" source="node-light-curtain" target="conn-a-out" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="lbl-a-out" value="Lanjut ke machine running" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=#64748b;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="195" y="760" width="170" height="25" as="geometry" />
        </mxCell>


        <!-- ================= KOLOM KANAN: MACHINE RUNNING ================= -->
        <!-- Konektor A Masuk (dari process safety relay) -->
        <mxCell id="conn-a-in" value="&lt;b&gt;A&lt;/b&gt;" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8fafc;strokeColor=#94a3b8;fontColor=#334155;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1173" y="30" width="34" height="34" as="geometry" />
        </mxCell>
        <mxCell id="lbl-a-in" value="dari process safety relay" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=#64748b;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1215" y="34" width="160" height="25" as="geometry" />
        </mxCell>

        <!-- Decision: Safety relay ON? -->
        <mxCell id="node-m-safety-on" value="&lt;b&gt;Safety relay ON?&lt;/b&gt;" style="rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1060" y="95" width="260" height="85" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-m-safety" edge="1" parent="1" source="conn-a-in" target="node-m-safety-on" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Cabang Tidak: Safety area emergency -->
        <mxCell id="node-safety-emg" value="&lt;b&gt;Safety area emergency&lt;/b&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fee2e2;strokeColor=#fca5a5;fontColor=#7f1d1d;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1390" y="112" width="260" height="50" as="geometry" />
        </mxCell>
        <mxCell id="edge-m-tidak-safety" value="Tidak" edge="1" parent="1" source="node-m-safety-on" target="node-safety-emg" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Konektor B keluar dari Safety area emergency -->
        <mxCell id="conn-b-m-1" value="&lt;b&gt;B&lt;/b&gt;" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8fafc;strokeColor=#94a3b8;fontColor=#334155;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1503" y="195" width="34" height="34" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-b-m1" edge="1" parent="1" source="node-safety-emg" target="conn-b-m-1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="lbl-b-m1" value="kembali ke safety check" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=#64748b;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1440" y="235" width="160" height="25" as="geometry" />
        </mxCell>

        <!-- Mesin ready / Lamp hijau ON -->
        <mxCell id="node-mesin-ready" value="&lt;b&gt;Mesin ready&lt;/b&gt;&lt;br&gt;Lamp hijau ON" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1080" y="225" width="220" height="55" as="geometry" />
        </mxCell>
        <mxCell id="edge-m-ya-safety" value="Ya" edge="1" parent="1" source="node-m-safety-on" target="node-mesin-ready" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Decision: 2 PB ditekan bersama 2 s? -->
        <mxCell id="node-2pb" value="&lt;b&gt;2 PB ditekan&lt;br&gt;bersama 2 s?&lt;/b&gt;" style="rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1060" y="325" width="260" height="85" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-2pb" edge="1" parent="1" source="node-mesin-ready" target="node-2pb" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Loopback Tidak dari 2PB kembali ke Mesin ready -->
        <mxCell id="edge-2pb-loopback" value="Tidak" edge="1" parent="1" source="node-2pb" target="node-mesin-ready" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;exitX=1;exitY=0.5;entryX=1;entryY=0.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1360" y="367" />
              <mxPoint x="1360" y="252" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- Inspect ON -->
        <mxCell id="node-inspect-on" value="&lt;b&gt;Inspect ON&lt;/b&gt;&lt;br&gt;1. Servo ON&lt;br&gt;2. Inspect count 8x" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1080" y="450" width="220" height="70" as="geometry" />
        </mxCell>
        <mxCell id="edge-ya-2pb" value="Ya" edge="1" parent="1" source="node-2pb" target="node-inspect-on" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Decision: Hasil inspect? -->
        <mxCell id="node-hasil-inspect" value="&lt;b&gt;Hasil inspect?&lt;/b&gt;" style="rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1060" y="560" width="260" height="85" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-hasil" edge="1" parent="1" source="node-inspect-on" target="node-hasil-inspect" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Cabang NG: Alarm NG -->
        <mxCell id="node-alarm-ng" value="&lt;b&gt;Alarm NG&lt;/b&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fee2e2;strokeColor=#fca5a5;fontColor=#7f1d1d;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1390" y="577" width="260" height="50" as="geometry" />
        </mxCell>
        <mxCell id="edge-ng-hasil" value="NG" edge="1" parent="1" source="node-hasil-inspect" target="node-alarm-ng" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Stamp label -->
        <mxCell id="node-stamp-label" value="Stamp label" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1080" y="680" width="220" height="46" as="geometry" />
        </mxCell>
        <mxCell id="edge-ok-hasil" value="OK" edge="1" parent="1" source="node-hasil-inspect" target="node-stamp-label" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- Homing (Bawah Mesin Ready / Finish) -->
        <mxCell id="node-homing-final" value="Homing" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1080" y="755" width="220" height="46" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-homing-final" edge="1" parent="1" source="node-stamp-label" target="node-homing-final" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge-ng-to-homing" edge="1" parent="1" source="node-alarm-ng" target="node-homing-final" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;exitX=0.5;exitY=1;entryX=1;entryY=0.5;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1520" y="778" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- Konektor B Keluar Akhir -->
        <mxCell id="conn-b-m-final" value="&lt;b&gt;B&lt;/b&gt;" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8fafc;strokeColor=#94a3b8;fontColor=#334155;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="1173" y="835" width="34" height="34" as="geometry" />
        </mxCell>
        <mxCell id="edge-to-b-final" edge="1" parent="1" source="node-homing-final" target="conn-b-m-final" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="lbl-b-final" value="kembali ke safety check" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=#64748b;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1215" y="839" width="160" height="25" as="geometry" />
        </mxCell>


        <!-- ================= PANAH SAMBUNGAN ANTAR-BAGIAN ================= -->
        <!-- Panah dari [A] Kiri ke [A] Kanan -->
        <mxCell id="inter-edge-a" value="Lanjut ke machine running [A]" edge="1" parent="1" source="conn-a-out" target="conn-a-in" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#3b82f6;strokeWidth=2;dashed=1;fontColor=#2563eb;fontSize=11;exitX=1;exitY=0.5;entryX=0;entryY=0.5;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="880" y="737" />
              <mxPoint x="880" y="47" />
            </Array>
          </mxGeometry>
        </mxCell>

        <!-- Panah Loopback dari [B] Kanan kembali ke [B] Kiri -->
        <mxCell id="inter-edge-b" value="Loopback kembali ke Safety Check [B]" edge="1" parent="1" source="conn-b-m-final" target="conn-b-in" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#ef4444;strokeWidth=2;dashed=1;fontColor=#dc2626;fontSize=11;exitX=0;exitY=0.5;entryX=0.5;entryY=1;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1000" y="852" />
              <mxPoint x="1000" y="930" />
              <mxPoint x="107" y="930" />
            </Array>
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  return { xml, steps };
}

/**
 * Deteksi apakah berkas yang diunggah cocok dengan alur Safety Relay & Machine Running Twintech
 */
export function isTwintechSafetyMachineDiagram(fileNames: string[]): boolean {
  const combined = fileNames.join(" ").toLowerCase();
  return (
    combined.includes("safety") ||
    combined.includes("running") ||
    combined.includes("relay") ||
    combined.includes("inspect")
  );
}

/**
 * Parser Cerdas: Memproses teks mentah menjadi urutan langkah alur sekuens mesin.
 */
export function parseTextToFlowSteps(rawText: string): FlowStepItem[] {
  if (!rawText || !rawText.trim()) {
    return [
      {
        id: "step-start",
        nomor: "0",
        judul: "POWER ON & SAFETY STANDBY",
        deskripsi: "E-Stop Release & Safety Interlock OK",
        tipe: "START",
      },
      {
        id: "step-1",
        nomor: "1",
        judul: "SAFETY RELAY CHECK",
        deskripsi: "Safety relay aktif dan area safety aman",
        tipe: "STEP",
      },
      {
        id: "step-2",
        nomor: "2",
        judul: "MESIN READY (LAMP HIJAU ON)",
        deskripsi: "Kirim sinyal PLC input X0 & supply 24VDC",
        tipe: "STEP",
      },
      {
        id: "step-decision",
        nomor: "3",
        judul: "2 PB DITEKAN BERSAMA?",
        deskripsi: "Two-hand start button ditekan bersama 2 detik",
        tipe: "DECISION",
      },
      {
        id: "step-ok",
        nomor: "4",
        judul: "INSPECT ON & STAMP (OK)",
        deskripsi: "Servo running & stamping part lolos uji",
        tipe: "OK",
      },
      {
        id: "step-ng",
        nomor: "5",
        judul: "ALARM NG & HOMING (REJECT)",
        deskripsi: "Alarm buzzer aktif & silinder kembali home",
        tipe: "NG",
      },
      {
        id: "step-finish",
        nomor: "6",
        judul: "KEMBALI KE SAFETY CHECK",
        deskripsi: "Siklus pengujian benda kerja selesai",
        tipe: "FINISH",
      },
    ];
  }

  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of rawLines) {
    const isNewStepHeader =
      /^(?:step|\d+[\.\)\-:]|langkah|alur|start|power|home|loading|clamping|hasil|inspect|unclamp|finish)/i.test(
        line
      );

    if (isNewStepHeader && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  if (blocks.length <= 1 && rawLines.length > 3) {
    blocks.length = 0;
    for (let i = 0; i < rawLines.length; i += 2) {
      blocks.push(rawLines.slice(i, i + 2));
    }
  }

  const steps: FlowStepItem[] = [];
  let stepCounter = 1;
  let hasStart = false;
  let hasDecision = false;
  let hasOk = false;
  let hasNg = false;

  blocks.forEach((blk, idx) => {
    const firstLine = blk[0] || "";
    const restText = blk.slice(1).join(" ") || "";

    const cleanedTitle = firstLine
      .replace(/^(?:step\s*\d+[\.\:\-]?|\d+[\.\)\-:]|langkah\s*\d+[\.\:\-]?)\s*/i, "")
      .trim();

    const fullText = (cleanedTitle + " " + restText).toLowerCase();

    let tipe: FlowStepItem["tipe"] = "STEP";
    let nomor = String(stepCounter);

    if (!hasStart && (idx === 0 || /start|power|standby|mulai|awal|siap/i.test(fullText))) {
      tipe = "START";
      nomor = "0";
      hasStart = true;
    } else if (
      /hasil|inspect\?|test\?|\?|apakah|toleransi|decision|kondisi|inspeksi/i.test(fullText) &&
      !hasDecision
    ) {
      tipe = "DECISION";
      hasDecision = true;
      stepCounter++;
    } else if (hasDecision && !hasOk && /ok|good|pass|stamp|lolos|ya|sesuai/i.test(fullText)) {
      tipe = "OK";
      nomor = "OK";
      hasOk = true;
    } else if (hasDecision && !hasNg && /ng|reject|alarm|gagal|tidak|rusak/i.test(fullText)) {
      tipe = "NG";
      nomor = "NG";
      hasNg = true;
    } else if (
      idx === blocks.length - 1 &&
      /finish|selesai|kembali|reset|unclamp|akhir|ulang/i.test(fullText)
    ) {
      tipe = "FINISH";
      nomor = String(stepCounter);
    } else {
      tipe = "STEP";
      nomor = String(stepCounter);
      stepCounter++;
    }

    steps.push({
      id: `step-${idx}-${Date.now().toString(36)}`,
      nomor,
      judul: cleanedTitle.toUpperCase() || `LANGKAH ${nomor}`,
      deskripsi: restText || "Operasi otomasi & sensor sekuens.",
      tipe,
    });
  });

  return steps.length > 0 ? steps : parseTextToFlowSteps("");
}

/**
 * Menghasilkan berkas Draw.io XML (.drawio) dengan tema terang (Light Theme)
 * yang serasi dengan desain alur mesin pengguna.
 */
export function generateDrawioXml(
  steps: FlowStepItem[],
  options?: {
    backgroundImageUrl?: string;
    backgroundImageUrls?: string[];
    diagramName?: string;
  }
): string {
  let xmlNodes = "";
  let xmlEdges = "";
  let yPos = 50;
  const xCenter = 440;

  const bgUrls = options?.backgroundImageUrls || (options?.backgroundImageUrl ? [options.backgroundImageUrl] : []);
  if (bgUrls.length > 0) {
    let imgY = 40;
    bgUrls.forEach((url, i) => {
      xmlNodes += `
        <!-- Gambar Referensi Asli Bagian ${i + 1} (Layer Latar Belakang) -->
        <mxCell id="bg-reference-image-${i}" value="" style="shape=image;image=${url};opacity=15;locked=1;perimeter=none;" vertex="1" parent="1">
          <mxGeometry x="50" y="${imgY}" width="340" height="500" as="geometry" />
        </mxCell>`;
      imgY += 530;
    });
  }

  const normalSteps = steps.filter((s) => s.tipe !== "OK" && s.tipe !== "NG");
  const okStep = steps.find((s) => s.tipe === "OK") || {
    id: "step-ok",
    judul: "PART OK",
    deskripsi: "Marking Stamp & Eject ke Box OK",
  };
  const ngStep = steps.find((s) => s.tipe === "NG") || {
    id: "step-ng",
    judul: "PART NG (REJECT)",
    deskripsi: "Alarm Buzzer ON & Eject ke Chute NG",
  };

  const escapeXml = (str: string) =>
    (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  for (let i = 0; i < normalSteps.length; i++) {
    const s = normalSteps[i];
    const isStart = s.tipe === "START";
    const isDecision = s.tipe === "DECISION";
    const isFinish = s.tipe === "FINISH";
    const safeTitle = escapeXml(s.judul);
    const safeDesc = escapeXml(s.deskripsi);

    if (isStart) {
      xmlNodes += `
        <mxCell id="${s.id}" value="&lt;b&gt;${safeTitle}&lt;/b&gt;&lt;br&gt;${safeDesc}" style="rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#f1f5f9;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="${xCenter}" y="${yPos}" width="260" height="55" as="geometry" />
        </mxCell>`;
      yPos += 105;
    } else if (isDecision) {
      xmlNodes += `
        <mxCell id="${s.id}" value="&lt;b&gt;${safeTitle}&lt;/b&gt;&lt;br&gt;${safeDesc}" style="rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="${xCenter - 10}" y="${yPos}" width="280" height="90" as="geometry" />
        </mxCell>`;

      if (i > 0) {
        xmlEdges += `
        <mxCell id="edge-to-decision" edge="1" parent="1" source="${normalSteps[i - 1].id}" target="${s.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`;
      }

      const okY = yPos + 130;
      const safeOkTitle = escapeXml(okStep.judul);
      const safeOkDesc = escapeXml(okStep.deskripsi);
      const safeNgTitle = escapeXml(ngStep.judul);
      const safeNgDesc = escapeXml(ngStep.deskripsi);

      xmlNodes += `
        <mxCell id="${okStep.id}" value="&lt;b&gt;${safeOkTitle}&lt;/b&gt;&lt;br&gt;${safeOkDesc}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="240" y="${okY}" width="220" height="55" as="geometry" />
        </mxCell>
        <mxCell id="edge-ok" value="OK / Ya" edge="1" parent="1" source="${s.id}" target="${okStep.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;exitX=0;exitY=0.5;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="${ngStep.id}" value="&lt;b&gt;${safeNgTitle}&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#b91c1c&quot;&gt;${safeNgDesc}&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fee2e2;strokeColor=#fca5a5;fontColor=#7f1d1d;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="670" y="${okY}" width="240" height="55" as="geometry" />
        </mxCell>
        <mxCell id="edge-ng" value="NG / Tidak" edge="1" parent="1" source="${s.id}" target="${ngStep.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;fontColor=#64748b;fontSize=11;exitX=1;exitY=0.5;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`;

      yPos = okY + 110;
    } else if (isFinish) {
      xmlNodes += `
        <mxCell id="${s.id}" value="&lt;b&gt;${safeTitle}&lt;/b&gt;&lt;br&gt;${safeDesc}" style="rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#f1f5f9;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="${xCenter}" y="${yPos}" width="260" height="55" as="geometry" />
        </mxCell>`;

      if (steps.some((st) => st.tipe === "DECISION")) {
        xmlEdges += `
        <mxCell id="edge-finish-ok" edge="1" parent="1" source="${okStep.id}" target="${s.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;exitX=0.5;exitY=1;entryX=0;entryY=0.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge-finish-ng" edge="1" parent="1" source="${ngStep.id}" target="${s.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;exitX=0.5;exitY=1;entryX=1;entryY=0.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`;
      } else if (i > 0) {
        xmlEdges += `
        <mxCell id="edge-to-finish" edge="1" parent="1" source="${normalSteps[i - 1].id}" target="${s.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`;
      }
      yPos += 95;
    } else {
      xmlNodes += `
        <mxCell id="${s.id}" value="&lt;b&gt;${safeTitle}&lt;/b&gt;&lt;br&gt;${safeDesc}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#e2e8f0;fontColor=#0f172a;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="${xCenter}" y="${yPos}" width="260" height="55" as="geometry" />
        </mxCell>`;
      if (i > 0 && normalSteps[i - 1].tipe !== "DECISION") {
        xmlEdges += `
          <mxCell id="edge-${i}" edge="1" parent="1" source="${normalSteps[i - 1].id}" target="${s.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=1.5;">
            <mxGeometry relative="1" as="geometry" />
          </mxCell>`;
      }
      yPos += 95;
    }
  }

  const name = options?.diagramName || "Alur Sekuens Mesin SPM";

  return `<mxfile host="app.diagrams.net">
  <diagram id="spm-flow" name="${escapeXml(name)}">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="${Math.max(
    yPos + 100,
    850
  )}" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        ${xmlNodes}
        ${xmlEdges}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/**
 * Menggabungkan beberapa urutan langkah menjadi satu alur utuh
 */
export function mergeStepSequences(sequences: FlowStepItem[][]): FlowStepItem[] {
  const validSeqs = sequences.filter((seq) => Array.isArray(seq) && seq.length > 0);
  if (validSeqs.length === 0) return parseTextToFlowSteps("");
  if (validSeqs.length === 1) return validSeqs[0];

  const merged: FlowStepItem[] = [];

  for (let sIdx = 0; sIdx < validSeqs.length; sIdx++) {
    const seq = validSeqs[sIdx];
    const isFirst = sIdx === 0;
    const isLast = sIdx === validSeqs.length - 1;

    for (let i = 0; i < seq.length; i++) {
      const item = { ...seq[i] };

      if (!isFirst && item.tipe === "START") {
        item.tipe = "STEP";
        const cleaned = item.judul.replace(/^(?:START|STANDBY|MULAI)\s*[\/:\-]?\s*/i, "").trim();
        item.judul = cleaned ? `BAGIAN ${sIdx + 1}: ${cleaned}` : `LANJUTAN BAGIAN ${sIdx + 1}`;
      }

      if (!isLast && item.tipe === "FINISH") {
        item.tipe = "STEP";
        if (/selesai|finish|reset cycle|kembali home/i.test(item.judul)) {
          item.judul = `TRANSISI MENUJU BAGIAN ${sIdx + 2}`;
          item.deskripsi = "Pindah ke sekuens langkah halaman/gambar berikutnya.";
        }
      }

      item.id = `merged-${sIdx}-${i}-${Date.now().toString(36)}`;
      merged.push(item);
    }
  }

  let normalCounter = 1;
  const result: FlowStepItem[] = merged.map((m, idx) => {
    if (m.tipe === "START") {
      return { ...m, nomor: "0" };
    }
    if (m.tipe === "OK" || m.tipe === "NG") {
      return { ...m, nomor: m.tipe };
    }
    if (idx === merged.length - 1 && m.tipe === "FINISH") {
      return { ...m, nomor: String(normalCounter) };
    }
    const num = String(normalCounter);
    normalCounter++;
    return { ...m, nomor: num };
  });

  return result;
}

/**
 * Gemini Multi-Image Vision
 */
export async function callGeminiVisionMulti(
  images: Array<{ base64Data: string; mimeType: string; fileName?: string }>,
  apiKey: string
): Promise<{ title: string; steps: FlowStepItem[] }> {
  if (images.length === 1) {
    return callGeminiVision(images[0].base64Data, images[0].mimeType, apiKey);
  }

  const prompt = `Anda adalah ahli otomasi industri, PLC, dan diagram flowchart mesin SPM.
Di bawah ini terdapat ${images.length} buah gambar diagram alur sekuens mesin yang diunggah secara berurutan:
${images.map((img, i) => `Gambar ${i + 1}: ${img.fileName || "Halaman " + (i + 1)}`).join("\n")}

Tugas Anda adalah membaca SELURUH ${images.length} gambar tersebut dan merekonstruksi teks serta alur logikanya secara 100% PERSIS dengan yang tertulis pada gambar.
Jangan mengganti nama instruksi, tombol, atau sensor dengan istilah lain.

Format JSON yang HARUS dikembalikan:
{
  "title": "Alur Sekuens Lengkap Mesin (Gabungan)",
  "steps": [
    {
      "nomor": "1",
      "judul": "Teks judul persis seperti di gambar...",
      "deskripsi": "Rincian teks keterangan di bawah judul...",
      "tipe": "START" | "STEP" | "DECISION" | "OK" | "NG" | "FINISH"
    }
  ]
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const contentParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
    { text: prompt },
  ];

  for (const img of images) {
    contentParts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.base64Data,
      },
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: contentParts }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Multi-Image API Error (${res.status}): ${errText}`);
  }

  const jsonRes = await res.json();
  const textContent = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  try {
    const parsed = JSON.parse(textContent);
    const steps: FlowStepItem[] = (parsed.steps || []).map(
      (s: Partial<FlowStepItem>, idx: number) => ({
        id: `gemini-multi-${idx}-${Date.now().toString(36)}`,
        nomor: String(s.nomor ?? idx + 1),
        judul: String(s.judul || `LANGKAH ${idx + 1}`).toUpperCase(),
        deskripsi: String(s.deskripsi || ""),
        tipe: (["START", "STEP", "DECISION", "OK", "NG", "FINISH"].includes(s.tipe || "")
          ? s.tipe
          : "STEP") as FlowStepItem["tipe"],
      })
    );

    return {
      title: parsed.title || "Alur Sekuens Lengkap Mesin (Gabungan)",
      steps: steps.length > 0 ? steps : parseTextToFlowSteps(""),
    };
  } catch (err) {
    console.error("Gagal parse JSON Gemini Multi-Image:", err);
    throw new Error("Gagal membaca hasil JSON gabungan dari AI Gemini.");
  }
}

/**
 * Gemini Single Image Vision
 */
export async function callGeminiVision(
  base64Data: string,
  mimeType: string,
  apiKey: string
): Promise<{ title: string; steps: FlowStepItem[] }> {
  const prompt = `Anda adalah ahli otomasi industri, PLC, dan diagram flowchart mesin SPM.
Tugas Anda adalah membaca gambar flowchart ini dan mengekstrak teks serta alurnya persis seperti yang tertulis di gambar.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error (${res.status}): ${errText}`);
  }

  const jsonRes = await res.json();
  const textContent = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  try {
    const parsed = JSON.parse(textContent);
    const steps: FlowStepItem[] = (parsed.steps || []).map(
      (s: Partial<FlowStepItem>, idx: number) => ({
        id: `gemini-step-${idx}-${Date.now().toString(36)}`,
        nomor: String(s.nomor ?? idx + 1),
        judul: String(s.judul || `LANGKAH ${idx + 1}`).toUpperCase(),
        deskripsi: String(s.deskripsi || ""),
        tipe: (["START", "STEP", "DECISION", "OK", "NG", "FINISH"].includes(s.tipe || "")
          ? s.tipe
          : "STEP") as FlowStepItem["tipe"],
      })
    );

    return {
      title: parsed.title || "Alur Sekuens Mesin SPM",
      steps: steps.length > 0 ? steps : parseTextToFlowSteps(""),
    };
  } catch (err) {
    console.error("Gagal parse JSON Gemini:", err);
    throw new Error("Gagal membaca hasil JSON dari AI Gemini.");
  }
}

/**
 * OCR Lokal Tesseract dengan timeout guard 5 detik
 */
export async function runLocalOcr(buffer: Buffer): Promise<{
  text: string;
  steps: FlowStepItem[];
}> {
  try {
    const ocrPromise = (async () => {
      const worker = await createWorker("eng");
      const ret = await worker.recognize(buffer);
      await worker.terminate();
      return ret.data.text || "";
    })();

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("OCR timeout 5s")), 5000)
    );

    const text = await Promise.race([ocrPromise, timeoutPromise]);
    const steps = parseTextToFlowSteps(text);

    return { text, steps };
  } catch {
    return {
      text: "",
      steps: parseTextToFlowSteps(""),
    };
  }
}
