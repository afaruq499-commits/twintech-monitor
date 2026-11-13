"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileImage,
  ListOrdered,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { ProjectFlowchartImportModal } from "./ProjectFlowchartImportModal";

interface ProjectFlowchartCanvasEditorProps {
  projectId: string;
  initialXmlOrJson?: string | null;
  onSaveSuccess?: (savedData: string) => void;
}

// Template awal diagram sekuens mesin otomasi SPM dalam format Draw.io XML
export const DEFAULT_SPM_FLOWCHART_XML = `<mxfile host="app.diagrams.net">
  <diagram id="spm-flow" name="Alur Sekuens Mesin SPM">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" background="#1e1e24" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        
        <!-- START / STANDBY -->
        <mxCell id="node-start" value="&lt;b&gt;START / STANDBY&lt;/b&gt;&lt;br&gt;E-Stop Release &amp;amp; Safety Door Tutup" style="rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#1e3a8a;strokeColor=#3b82f6;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="440" y="40" width="220" height="60" as="geometry" />
        </mxCell>
        
        <!-- STEP 1: HOMING -->
        <mxCell id="node-step1" value="&lt;b&gt;1. HOME POSITION CHECK&lt;/b&gt;&lt;br&gt;Servo Origin &amp;amp; Silinder Retract (Reed SW OK)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#64748b;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="430" y="150" width="240" height="60" as="geometry" />
        </mxCell>
        <mxCell id="edge-1" edge="1" parent="1" source="node-start" target="node-step1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#60a5fa;strokeWidth=2;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- STEP 2: LOADING -->
        <mxCell id="node-step2" value="&lt;b&gt;2. LOADING PART &amp;amp; DETEKSI&lt;/b&gt;&lt;br&gt;Sensor Part Detect (DI) ON &amp;amp; Tombol Start" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#64748b;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="430" y="260" width="240" height="60" as="geometry" />
        </mxCell>
        <mxCell id="edge-2" edge="1" parent="1" source="node-step1" target="node-step2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#60a5fa;strokeWidth=2;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- STEP 3: CLAMP & PROBE -->
        <mxCell id="node-step3" value="&lt;b&gt;3. CLAMPING &amp;amp; PROBE TEST&lt;/b&gt;&lt;br&gt;Silinder Clamp Maju &amp;amp; Silinder Probe Turun" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#64748b;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="430" y="370" width="240" height="60" as="geometry" />
        </mxCell>
        <mxCell id="edge-3" edge="1" parent="1" source="node-step2" target="node-step3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#60a5fa;strokeWidth=2;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- STEP 4: INSPEKSI (DECISION) -->
        <mxCell id="node-decision" value="&lt;b&gt;4. HASIL TEST?&lt;/b&gt;&lt;br&gt;(Tegangan, Arus, Komunikasi)" style="rhombus;whiteSpace=wrap;html=1;fillColor=#312e81;strokeColor=#6366f1;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="440" y="480" width="220" height="100" as="geometry" />
        </mxCell>
        <mxCell id="edge-4" edge="1" parent="1" source="node-step3" target="node-decision" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#60a5fa;strokeWidth=2;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <!-- CABANG OK -->
        <mxCell id="node-ok" value="&lt;b&gt;PART OK&lt;/b&gt;&lt;br&gt;Marking Stamp &amp;amp; Eject ke Box OK" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#064e3b;strokeColor=#10b981;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="250" y="630" width="200" height="60" as="geometry" />
        </mxCell>
        <mxCell id="edge-ok" edge="1" parent="1" source="node-decision" target="node-ok" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#10b981;strokeWidth=2;exitX=0;exitY=0.5;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry">
            <mxPoint as="offset" />
          </mxGeometry>
        </mxCell>

        <!-- CABANG NG -->
        <mxCell id="node-ng" value="&lt;b&gt;PART NG (REJECT)&lt;/b&gt;&lt;br&gt;Buzzer Alarm ON &amp;amp; Eject ke Chute NG" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#7f1d1d;strokeColor=#ef4444;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="650" y="630" width="200" height="60" as="geometry" />
        </mxCell>
        <mxCell id="edge-ng" edge="1" parent="1" source="node-decision" target="node-ng" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#ef4444;strokeWidth=2;exitX=1;exitY=0.5;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry">
            <mxPoint as="offset" />
          </mxGeometry>
        </mxCell>

        <!-- SIKLUS SELESAI -->
        <mxCell id="node-finish" value="&lt;b&gt;UNCLAMP &amp;amp; RESET CYCLE&lt;/b&gt;&lt;br&gt;Kembali ke Siap Test Part Berikutnya" style="rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#1e3a8a;strokeColor=#3b82f6;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="440" y="740" width="220" height="60" as="geometry" />
        </mxCell>
        <mxCell id="edge-finish1" edge="1" parent="1" source="node-ok" target="node-finish" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#10b981;strokeWidth=2;exitX=0.5;exitY=1;entryX=0;entryY=0.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge-finish2" edge="1" parent="1" source="node-ng" target="node-finish" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#ef4444;strokeWidth=2;exitX=0.5;exitY=1;entryX=1;entryY=0.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

export interface FlowStepItem {
  id: string;
  nomor: string;
  judul: string;
  deskripsi: string;
  tipe: "START" | "STEP" | "DECISION" | "OK" | "NG" | "FINISH";
}

const DEFAULT_FLOW_STEPS: FlowStepItem[] = [
  {
    id: "step-start",
    nomor: "0",
    judul: "START / STANDBY",
    deskripsi: "E-Stop Release & Safety Door Tutup (Interlock OK)",
    tipe: "START",
  },
  {
    id: "step-1",
    nomor: "1",
    judul: "HOME POSITION CHECK",
    deskripsi: "Servo Origin & Silinder Retract (Reed SW OK)",
    tipe: "STEP",
  },
  {
    id: "step-2",
    nomor: "2",
    judul: "LOADING PART & DETEKSI",
    deskripsi: "Sensor Part Detect (DI) ON & Tombol Start ditekan",
    tipe: "STEP",
  },
  {
    id: "step-3",
    nomor: "3",
    judul: "CLAMPING & PROBE TEST",
    deskripsi: "Silinder Clamp Maju & Silinder Probe Turun",
    tipe: "STEP",
  },
  {
    id: "step-decision",
    nomor: "4",
    judul: "HASIL PENGUJIAN?",
    deskripsi: "Tegangan, Arus, dan Sinyal Komunikasi Sesuai Toleransi?",
    tipe: "DECISION",
  },
  {
    id: "step-ok",
    nomor: "5",
    judul: "PART OK (GOOD)",
    deskripsi: "Marking Stamp & Eject ke Pallet / Box Part OK",
    tipe: "OK",
  },
  {
    id: "step-ng",
    nomor: "6",
    judul: "PART NG (REJECT)",
    deskripsi: "Alarm Buzzer ON & Eject ke Chute Box NG",
    tipe: "NG",
  },
  {
    id: "step-finish",
    nomor: "7",
    judul: "UNCLAMP & RESET CYCLE",
    deskripsi: "Silinder Kembali Home, Siap Siklus Part Berikutnya",
    tipe: "FINISH",
  },
];

interface StoredFlowchartData {
  xml: string;
  svgDataUrl?: string | null;
  updatedAt?: string;
  steps?: FlowStepItem[];
}

function parseStoredData(stored: string | null | undefined): StoredFlowchartData {
  if (!stored) {
    return { xml: DEFAULT_SPM_FLOWCHART_XML, steps: DEFAULT_FLOW_STEPS };
  }
  const trimmed = stored.trim();
  if (
    trimmed.startsWith("<mxfile") ||
    trimmed.startsWith("<xml") ||
    trimmed.includes("<mxGraphModel")
  ) {
    return { xml: trimmed, steps: DEFAULT_FLOW_STEPS };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.xml === "string") {
      return {
        xml: parsed.xml,
        svgDataUrl: parsed.svgDataUrl || null,
        updatedAt: parsed.updatedAt,
        steps: Array.isArray(parsed.steps) ? parsed.steps : DEFAULT_FLOW_STEPS,
      };
    }
  } catch {
    // fallback
  }
  return { xml: DEFAULT_SPM_FLOWCHART_XML, steps: DEFAULT_FLOW_STEPS };
}

// Menghasilkan Draw.io XML dari daftar steps sekuens
function generateXmlFromSteps(steps: FlowStepItem[]): string {
  let xmlNodes = "";
  let xmlEdges = "";
  let yPos = 40;
  const xCenter = 440;

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

  for (let i = 0; i < normalSteps.length; i++) {
    const s = normalSteps[i];
    const isStart = s.tipe === "START";
    const isDecision = s.tipe === "DECISION";
    const isFinish = s.tipe === "FINISH";

    if (isStart) {
      xmlNodes += `
        <mxCell id="${s.id}" value="&lt;b&gt;${s.judul}&lt;/b&gt;&lt;br&gt;${s.deskripsi}" style="rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#1e3a8a;strokeColor=#3b82f6;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="${xCenter}" y="${yPos}" width="240" height="60" as="geometry" />
        </mxCell>`;
      yPos += 110;
    } else if (isDecision) {
      xmlNodes += `
        <mxCell id="${s.id}" value="&lt;b&gt;${s.judul}&lt;/b&gt;&lt;br&gt;${s.deskripsi}" style="rhombus;whiteSpace=wrap;html=1;fillColor=#312e81;strokeColor=#6366f1;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="${xCenter - 10}" y="${yPos}" width="260" height="100" as="geometry" />
        </mxCell>`;

      // Render OK (kiri) dan NG (kanan)
      const okY = yPos + 140;
      xmlNodes += `
        <mxCell id="${okStep.id}" value="&lt;b&gt;${okStep.judul}&lt;/b&gt;&lt;br&gt;${okStep.deskripsi}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#064e3b;strokeColor=#10b981;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="250" y="${okY}" width="200" height="60" as="geometry" />
        </mxCell>
        <mxCell id="edge-ok" edge="1" parent="1" source="${s.id}" target="${okStep.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#10b981;strokeWidth=2;exitX=0;exitY=0.5;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>

        <mxCell id="${ngStep.id}" value="&lt;b&gt;${ngStep.judul}&lt;/b&gt;&lt;br&gt;${ngStep.deskripsi}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#7f1d1d;strokeColor=#ef4444;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="670" y="${okY}" width="200" height="60" as="geometry" />
        </mxCell>
        <mxCell id="edge-ng" edge="1" parent="1" source="${s.id}" target="${ngStep.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#ef4444;strokeWidth=2;exitX=1;exitY=0.5;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`;

      yPos = okY + 110;
    } else if (isFinish) {
      xmlNodes += `
        <mxCell id="${s.id}" value="&lt;b&gt;${s.judul}&lt;/b&gt;&lt;br&gt;${s.deskripsi}" style="rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#1e3a8a;strokeColor=#3b82f6;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="${xCenter}" y="${yPos}" width="240" height="60" as="geometry" />
        </mxCell>`;

      xmlEdges += `
        <mxCell id="edge-finish-ok" edge="1" parent="1" source="${okStep.id}" target="${s.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#10b981;strokeWidth=2;exitX=0.5;exitY=1;entryX=0;entryY=0.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge-finish-ng" edge="1" parent="1" source="${ngStep.id}" target="${s.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#ef4444;strokeWidth=2;exitX=0.5;exitY=1;entryX=1;entryY=0.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`;
      yPos += 100;
    } else {
      xmlNodes += `
        <mxCell id="${s.id}" value="&lt;b&gt;${s.judul}&lt;/b&gt;&lt;br&gt;${s.deskripsi}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#64748b;fontColor=#ffffff;fontSize=12;" vertex="1" parent="1">
          <mxGeometry x="${xCenter - 10}" y="${yPos}" width="260" height="60" as="geometry" />
        </mxCell>`;
      if (i > 0 && normalSteps[i - 1].tipe !== "DECISION") {
        xmlEdges += `
          <mxCell id="edge-${i}" edge="1" parent="1" source="${normalSteps[i - 1].id}" target="${s.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#60a5fa;strokeWidth=2;">
            <mxGeometry relative="1" as="geometry" />
          </mxCell>`;
      }
      yPos += 100;
    }
  }

  return `<mxfile host="app.diagrams.net">
  <diagram id="spm-flow" name="Alur Sekuens Mesin SPM">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="${Math.max(
      yPos + 100,
      827
    )}" background="#1e1e24" math="0" shadow="0">
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

export function ProjectFlowchartCanvasEditor({
  projectId,
  initialXmlOrJson,
  onSaveSuccess,
}: ProjectFlowchartCanvasEditorProps) {
  const [data, setData] = useState<StoredFlowchartData>(() =>
    parseStoredData(initialXmlOrJson)
  );

  // Status Tampilan: false = Pratinjau; true = Mode Editor Aktif
  const [isEditing, setIsEditing] = useState(false);
  const [editModeTab, setEditModeTab] = useState<"canvas" | "steps">("canvas");
  const [saving, setSaving] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);

  // Local state untuk Editor Langkah Sekuens SPM (Built-in Step Sequence Builder)
  const [steps, setSteps] = useState<FlowStepItem[]>(
    data.steps || DEFAULT_FLOW_STEPS
  );

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(
    data.updatedAt
      ? new Date(data.updatedAt).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null
  );

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const handshakeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Menerapkan hasil konversi gambar PNG ke diagram flowchart
  const handleApplyConverted = useCallback(
    async (
      newXml: string,
      newSteps: FlowStepItem[],
      _imageUrl?: string,
      svgDataUrl?: string
    ) => {
      const updatedData: StoredFlowchartData = {
        xml: newXml,
        svgDataUrl: svgDataUrl || null,
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      };

      setData(updatedData);
      setSteps(newSteps);
      setIsEditing(false); // Tetap di mode pratinjau agar user langsung melihat gambar gabungan persis aslinya!

      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flowSequenceJson: JSON.stringify(updatedData),
          }),
        });

        setLastSavedTime(
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
        onSaveSuccess?.(JSON.stringify(updatedData));

        if (iframeRef.current) {
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({
              action: "load",
              autosave: 1,
              xml: newXml,
            }),
            "*"
          );
        }
      } catch (err) {
        console.error("Gagal menyimpan hasil konversi gambar:", err);
      }
    },
    [projectId, onSaveSuccess]
  );

  // Fungsi pengiriman action 'load' ke iframe diagrams.net
  const sendLoadMessage = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          action: "load",
          autosave: 1,
          xml: data.xml,
          title: "Alur Sekuens Mesin SPM",
        }),
        "*"
      );
      setIframeReady(true);
      setLoadError(false);
    } catch (err) {
      console.warn("Gagal postMessage ke diagrams.net iframe:", err);
    }
  }, [data.xml]);

  // Handler pesan postMessage yang mendukung tipe STRING maupun OBJECT
  const handleIframeMessage = useCallback(
    async (event: MessageEvent) => {
      let msg: { event?: string; xml?: string; data?: string; [key: string]: unknown } | null = null;

      // Parsing toleran terhadap string JSON maupun object dari diagrams.net
      if (typeof event.data === "string") {
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
      } else if (typeof event.data === "object" && event.data !== null) {
        msg = event.data as { event?: string; xml?: string; data?: string; [key: string]: unknown };
      } else {
        return;
      }

      if (!msg || !msg.event) return;

      // 1. Draw.io inisialisasi selesai -> kirim XML diagram
      if (msg.event === "init" || msg.event === "configure") {
        if (msg.event === "configure") {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ action: "configure", config: { defaultFonts: ["Inter", "Arial"] } }),
            "*"
          );
        }
        sendLoadMessage();
      }

      // 2. Event save / autosave dari Draw.io
      if (msg.event === "save" || msg.event === "autosave") {
        const newXml = msg.xml;
        if (newXml) {
          setSaving(true);
          // Minta export SVG dari Draw.io agar pratinjau tajam dan indah
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ action: "export", format: "xmlsvg" }),
            "*"
          );

          const updatedData: StoredFlowchartData = {
            xml: newXml,
            svgDataUrl: data.svgDataUrl,
            steps: data.steps,
            updatedAt: new Date().toISOString(),
          };

          setData(updatedData);

          try {
            await fetch(`/api/projects/${projectId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                flowSequenceJson: JSON.stringify(updatedData),
              }),
            });

            setLastSavedTime(
              new Date().toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })
            );
            onSaveSuccess?.(JSON.stringify(updatedData));
          } catch (err) {
            console.error("Gagal simpan flowSequenceJson:", err);
          } finally {
            setSaving(false);
          }
        }
      }

      // 3. Event export (menerima SVG gambar dari Draw.io)
      if (msg.event === "export") {
        const svgData = msg.data; // data:image/svg+xml;base64,...
        if (svgData) {
          const updatedData: StoredFlowchartData = {
            xml: msg.xml || data.xml,
            svgDataUrl: svgData,
            steps: data.steps,
            updatedAt: new Date().toISOString(),
          };
          setData(updatedData);

          try {
            await fetch(`/api/projects/${projectId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                flowSequenceJson: JSON.stringify(updatedData),
              }),
            });
            onSaveSuccess?.(JSON.stringify(updatedData));
          } catch (err) {
            console.error("Gagal simpan export SVG flow:", err);
          }
        }
      }

      // 4. User klik tombol exit di Draw.io
      if (msg.event === "exit") {
        setIsEditing(false);
      }
    },
    [data.xml, data.svgDataUrl, data.steps, projectId, onSaveSuccess, sendLoadMessage]
  );

  useEffect(() => {
    window.addEventListener("message", handleIframeMessage);
    return () => {
      window.removeEventListener("message", handleIframeMessage);
    };
  }, [handleIframeMessage]);

  // Heartbeat fallback pengiriman load message ketika editor dibuka
  useEffect(() => {
    if (!isEditing || editModeTab !== "canvas") return;

    // Bersihkan timer sebelumnya
    if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current);

    // Kirim load message bertahap (setelah 400ms, 1200ms, 2500ms) untuk mengantisipasi init yang terlewat
    const t1 = setTimeout(() => sendLoadMessage(), 400);
    const t2 = setTimeout(() => sendLoadMessage(), 1200);
    const t3 = setTimeout(() => {
      sendLoadMessage();
      // Jika setelah 4 detik belum ready, set loadError untuk menampilkan tombol bantuan
      if (!iframeReady) {
        setLoadError(true);
      }
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isEditing, editModeTab, sendLoadMessage, iframeReady]);

  function handleOpenEditor() {
    setIsEditing(true);
    setIframeReady(false);
    setLoadError(false);
  }

  function handleCloseEditor() {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ action: "export", format: "xmlsvg" }),
        "*"
      );
    }
    setTimeout(() => {
      setIsEditing(false);
    }, 400);
  }

  function handleReloadIframe() {
    setIframeReady(false);
    setLoadError(false);
    if (iframeRef.current) {
      // Reload iframe src
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc;
        }
      }, 100);
    }
  }

  function handleResetTemplate() {
    if (
      !window.confirm(
        "Ganti diagram alur dengan Template Flowchart Standar SPM?"
      )
    ) {
      return;
    }
    const updatedData: StoredFlowchartData = {
      xml: DEFAULT_SPM_FLOWCHART_XML,
      svgDataUrl: null,
      steps: DEFAULT_FLOW_STEPS,
      updatedAt: new Date().toISOString(),
    };
    setData(updatedData);
    setSteps(DEFAULT_FLOW_STEPS);

    if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({
          action: "load",
          autosave: 1,
          xml: DEFAULT_SPM_FLOWCHART_XML,
        }),
        "*"
      );
    }

    void (async () => {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flowSequenceJson: JSON.stringify(updatedData),
          }),
        });
        onSaveSuccess?.(JSON.stringify(updatedData));
      } catch (err) {
        console.error("Gagal reset template flowchart:", err);
      }
    })();
  }

  // Terapkan perubahan langkah kerja (Step Editor) menjadi Diagram Flowchart
  async function handleApplyStepsToDiagram() {
    setSaving(true);
    const newXml = generateXmlFromSteps(steps);
    const updatedData: StoredFlowchartData = {
      xml: newXml,
      svgDataUrl: null, // akan digambar ulang oleh SVG native
      steps,
      updatedAt: new Date().toISOString(),
    };
    setData(updatedData);

    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowSequenceJson: JSON.stringify(updatedData),
        }),
      });

      setLastSavedTime(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      onSaveSuccess?.(JSON.stringify(updatedData));

      // Jika iframe aktif, perbarui diagram di canvas
      if (iframeRef.current) {
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({
            action: "load",
            autosave: 1,
            xml: newXml,
          }),
          "*"
        );
      }

      alert("Langkah sekuens berhasil diterapkan ke Diagram Flowchart!");
    } catch (err) {
      console.error("Gagal menerapkan langkah sekuens:", err);
      alert("Gagal menyimpan alur sekuens mesin.");
    } finally {
      setSaving(false);
    }
  }

  // Unduh berkas .drawio / XML
  function handleDownloadXml() {
    const blob = new Blob([data.xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Flowchart-Sekuens-${projectId}.drawio`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Salin XML ke clipboard
  function handleCopyXml() {
    navigator.clipboard.writeText(data.xml);
    alert("Kode XML Draw.io disalin ke clipboard!");
  }

  // URL Draw.io embed yang stabil & ringan
  const drawioEmbedUrl =
    "https://embed.diagrams.net/?embed=1&ui=dark&spin=1&proto=json&lang=id&noSaveBtn=0&saveAndExit=1&modified=unsavedChanges&returnFormat=xmlsvg&libraries=1";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Workflow className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-slate-900 text-base">
              Flowchart Alur Sekuens Mesin
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            {isEditing
              ? editModeTab === "canvas"
                ? "Mode Editor Draw.io Aktif: Tarik simbol, sambungkan panah logika, atau gunakan Editor Sekuens Cepat."
                : "Mode Editor Sekuens Langkah Cepat: Ubah urutan langkah mesin SPM secara visual (100% Offline)."
              : "Pratinjau diagram alur operasional mesin SPM. Klik \"Ubah Flowchart\" untuk menyunting."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lastSavedTime && !isEditing && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tersimpan {lastSavedTime}
            </span>
          )}

          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={handleDownloadXml}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Unduh berkas .drawio untuk diedit di Draw.io Desktop"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Unduh .drawio</span>
              </button>

              <button
                type="button"
                onClick={handleCopyXml}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Salin kode XML diagram ke clipboard"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Salin XML</span>
              </button>

              <button
                type="button"
                onClick={handleResetTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Muat alur flowchart standar SPM Function Tester"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Template SPM</span>
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Unggah gambar PNG diagram alur dan konversi otomatis menjadi flowchart yang bisa diedit"
              >
                <FileImage className="w-3.5 h-3.5 text-indigo-600" />
                <span>Import Gambar PNG</span>
              </button>

              <button
                type="button"
                onClick={handleOpenEditor}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                <Edit3 className="w-4 h-4 text-indigo-200" />
                <span>Ubah Flowchart</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Unggah gambar PNG baru untuk dikonversi menjadi alur flowchart"
              >
                <FileImage className="w-3.5 h-3.5 text-indigo-600" />
                <span>Import Gambar PNG</span>
              </button>

              <button
                type="button"
                onClick={handleCloseEditor}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saving ? "Menyimpan..." : "Selesai & Simpan Gambar"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Tutup editor"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Konten: Mode Pratinjau (Lihat Gambar) VS Mode Editor */}
      <div className="p-4 sm:p-5">
        {!isEditing ? (
          /* ================= MODE LIHAT (HANYA GAMBAR ALUR) ================= */
          <div className="space-y-3">
            <div
              className={`relative rounded-2xl overflow-hidden border p-4 sm:p-6 shadow-inner flex flex-col items-center justify-center min-h-[440px] group ${
                data.svgDataUrl ? "bg-white border-slate-200" : "bg-[#1e1e24] border-slate-800"
              }`}
            >
              {/* Gambar Flowchart */}
              {data.svgDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={data.svgDataUrl}
                  alt="Flowchart Sekuens Mesin"
                  className="max-w-full max-h-[750px] object-contain rounded-xl"
                />
              ) : (
                /* Diagram Visual Alur SPM (Vector SVG Dinamis Beresolusi Tinggi) */
                <div className="w-full max-w-4xl py-6 flex flex-col items-center">
                  <svg
                    viewBox="0 0 920 720"
                    className="w-full h-auto max-h-[600px] drop-shadow-2xl"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <marker
                        id="arrow-blue"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#60a5fa" />
                      </marker>
                      <marker
                        id="arrow-green"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                      </marker>
                      <marker
                        id="arrow-red"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                      </marker>
                    </defs>

                    {/* Step 0: START / STANDBY */}
                    <rect
                      x="340"
                      y="20"
                      width="240"
                      height="56"
                      rx="28"
                      fill="#1e3a8a"
                      stroke="#3b82f6"
                      strokeWidth="2"
                    />
                    <text
                      x="460"
                      y="44"
                      fill="#ffffff"
                      fontSize="13"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      START / STANDBY
                    </text>
                    <text
                      x="460"
                      y="62"
                      fill="#93c5fd"
                      fontSize="11"
                      textAnchor="middle"
                    >
                      E-Stop Release &amp; Safety Door Tutup
                    </text>

                    {/* Panah 0 -> 1 */}
                    <path
                      d="M460 76 V118"
                      stroke="#60a5fa"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow-blue)"
                    />

                    {/* Step 1: HOME POSITION */}
                    <rect
                      x="320"
                      y="120"
                      width="280"
                      height="60"
                      rx="10"
                      fill="#1e293b"
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                    <text
                      x="460"
                      y="145"
                      fill="#ffffff"
                      fontSize="13"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      1. HOME POSITION CHECK
                    </text>
                    <text
                      x="460"
                      y="165"
                      fill="#cbd5e1"
                      fontSize="11"
                      textAnchor="middle"
                    >
                      Servo Origin &amp; Silinder Retract (Reed SW OK)
                    </text>

                    {/* Panah 1 -> 2 */}
                    <path
                      d="M460 180 V222"
                      stroke="#60a5fa"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow-blue)"
                    />

                    {/* Step 2: LOADING PART */}
                    <rect
                      x="320"
                      y="224"
                      width="280"
                      height="60"
                      rx="10"
                      fill="#1e293b"
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                    <text
                      x="460"
                      y="249"
                      fill="#ffffff"
                      fontSize="13"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      2. LOADING PART &amp; DETEKSI
                    </text>
                    <text
                      x="460"
                      y="269"
                      fill="#cbd5e1"
                      fontSize="11"
                      textAnchor="middle"
                    >
                      Sensor Part Detect (DI) ON &amp; Tombol Start
                    </text>

                    {/* Panah 2 -> 3 */}
                    <path
                      d="M460 284 V326"
                      stroke="#60a5fa"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow-blue)"
                    />

                    {/* Step 3: CLAMPING & PROBE */}
                    <rect
                      x="320"
                      y="328"
                      width="280"
                      height="60"
                      rx="10"
                      fill="#1e293b"
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                    <text
                      x="460"
                      y="353"
                      fill="#ffffff"
                      fontSize="13"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      3. CLAMPING &amp; PROBE TEST
                    </text>
                    <text
                      x="460"
                      y="373"
                      fill="#cbd5e1"
                      fontSize="11"
                      textAnchor="middle"
                    >
                      Silinder Clamp Maju &amp; Silinder Probe Turun
                    </text>

                    {/* Panah 3 -> 4 (Decision) */}
                    <path
                      d="M460 388 V428"
                      stroke="#60a5fa"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow-blue)"
                    />

                    {/* Step 4: Decision Diamond */}
                    <polygon
                      points="460,430 590,480 460,530 330,480"
                      fill="#312e81"
                      stroke="#818cf8"
                      strokeWidth="2"
                    />
                    <text
                      x="460"
                      y="475"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      4. HASIL TEST?
                    </text>
                    <text
                      x="460"
                      y="493"
                      fill="#c7d2fe"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      Tegangan, Arus &amp; Data OK?
                    </text>

                    {/* Cabang Kiri: OK */}
                    <path
                      d="M330 480 H210 V554"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow-green)"
                    />
                    <text
                      x="265"
                      y="470"
                      fill="#34d399"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      [ YA: OK ]
                    </text>
                    <rect
                      x="110"
                      y="556"
                      width="200"
                      height="56"
                      rx="10"
                      fill="#064e3b"
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                    <text
                      x="210"
                      y="580"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      PART OK
                    </text>
                    <text
                      x="210"
                      y="598"
                      fill="#a7f3d0"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      Marking Stamp &amp; Eject Box OK
                    </text>

                    {/* Cabang Kanan: NG */}
                    <path
                      d="M590 480 H710 V554"
                      stroke="#ef4444"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow-red)"
                    />
                    <text
                      x="655"
                      y="470"
                      fill="#f87171"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      [ TIDAK: NG ]
                    </text>
                    <rect
                      x="610"
                      y="556"
                      width="200"
                      height="56"
                      rx="10"
                      fill="#7f1d1d"
                      stroke="#ef4444"
                      strokeWidth="2"
                    />
                    <text
                      x="710"
                      y="580"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      PART NG (REJECT)
                    </text>
                    <text
                      x="710"
                      y="598"
                      fill="#fecaca"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      Alarm Buzzer &amp; Eject Chute NG
                    </text>

                    {/* Garis Menuju Finish */}
                    <path
                      d="M210 612 V646 H334"
                      stroke="#10b981"
                      strokeWidth="2"
                      markerEnd="url(#arrow-green)"
                    />
                    <path
                      d="M710 612 V646 H586"
                      stroke="#ef4444"
                      strokeWidth="2"
                      markerEnd="url(#arrow-red)"
                    />

                    {/* Step 5: Finish */}
                    <rect
                      x="340"
                      y="622"
                      width="240"
                      height="48"
                      rx="24"
                      fill="#1e3a8a"
                      stroke="#3b82f6"
                      strokeWidth="2"
                    />
                    <text
                      x="460"
                      y="643"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      UNCLAMP &amp; RESET CYCLE
                    </text>
                    <text
                      x="460"
                      y="659"
                      fill="#93c5fd"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      Siap Siklus Benda Kerja Berikutnya
                    </text>
                  </svg>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-2">
              <span>
                💡 <strong>Catatan:</strong> Diagram di atas dapat disesuaikan. Klik{" "}
                <strong>&ldquo;Ubah Flowchart&rdquo;</strong> untuk membuka editor grafis Draw.io atau klik{" "}
                <strong>&ldquo;Import Gambar PNG&rdquo;</strong> untuk mengonversi gambar alur baru.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <FileImage className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Import Gambar PNG &rarr;</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenEditor}
                  className="text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Buka Editor Flowchart &rarr;
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ================= MODE EDIT (CANVAS DRAW.IO & STEP BUILDER) ================= */
          <div className="space-y-3 animate-in fade-in zoom-in-95 duration-150">
            {/* Tab Navigasi Mode Editor */}
            <div className="flex items-center justify-between bg-slate-900 text-white rounded-t-xl px-4 py-2 text-xs border border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditModeTab("canvas")}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    editModeTab === "canvas"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Workflow className="w-3.5 h-3.5" />
                  <span>Canvas Draw.io Live</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditModeTab("steps")}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    editModeTab === "steps"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>Editor Langkah Sekuens (Offline)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReloadIframe}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer flex items-center gap-1"
                  title="Muat ulang canvas jika tampilan hitam atau macet"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Muat Ulang Canvas</span>
                </button>

                <a
                  href={`https://app.diagrams.net/#R${encodeURIComponent(data.xml)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer flex items-center gap-1"
                  title="Buka langsung di tab baru diagrams.net"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka Tab Baru</span>
                </a>
              </div>
            </div>

            {/* TAB 1: CANVAS DRAW.IO LIVE */}
            {editModeTab === "canvas" ? (
              <div className="relative rounded-b-2xl overflow-hidden border border-slate-800 bg-[#1e1e24] shadow-2xl">
                {/* Banner Fallback jika iframe lambat/hang */}
                {loadError && (
                  <div className="bg-amber-950/90 border-b border-amber-800 text-amber-200 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span>
                      ⚠️ <strong>Canvas memuat lebih lama dari biasanya.</strong> Jika jaringan dibatasi, gunakan{" "}
                      <strong>&ldquo;Editor Langkah Sekuens (Offline)&rdquo;</strong> di atas atau buka di tab baru.
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditModeTab("steps")}
                      className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                    >
                      Pindah ke Editor Offline
                    </button>
                  </div>
                )}

                {/* Iframe Draw.io Live */}
                <div className="relative w-full h-[640px] sm:h-[720px]">
                  {/* Loading overlay sebelum iframe siap */}
                  {!iframeReady && (
                    <div className="absolute inset-0 bg-[#1e1e24] flex flex-col items-center justify-center text-slate-300 gap-3 z-10">
                      <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-semibold text-slate-400">
                        Menyiapkan canvas diagram alur sekuens mesin...
                      </p>
                      <button
                        type="button"
                        onClick={sendLoadMessage}
                        className="text-xs text-indigo-400 underline hover:text-indigo-300 cursor-pointer"
                      >
                        Klik di sini jika canvas tidak muncul otomatis
                      </button>
                    </div>
                  )}

                  <iframe
                    ref={iframeRef}
                    src={drawioEmbedUrl}
                    title="Draw.io Flowchart Editor Live"
                    className="w-full h-full border-0 bg-[#1e1e24]"
                    allow="clipboard-read; clipboard-write"
                    onLoad={() => {
                      setTimeout(sendLoadMessage, 400);
                    }}
                  />
                </div>
              </div>
            ) : (
              /* TAB 2: EDITOR LANGKAH SEKUEN SPM (BUILT-IN OFFLINE BUILDER) */
              <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-b-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200/60">
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-indigo-950">
                      Editor Langkah Alur Sekuens SPM (Cepat &amp; Mandiri)
                    </h4>
                    <p className="text-xs text-indigo-800 mt-0.5">
                      Ubah judul langkah, instruksi aktuator, sensor, dan hasil uji. Klik &ldquo;Terapkan ke Diagram&rdquo; untuk memperbarui flowchart secara otomatis.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyStepsToDiagram}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                    <span>{saving ? "Menyimpan..." : "Terapkan ke Diagram Flowchart"}</span>
                  </button>
                </div>

                {/* List Langkah-langkah */}
                <div className="space-y-2.5">
                  {steps.map((st, idx) => (
                    <div
                      key={st.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>

                        <div className="flex-1 space-y-1">
                          <input
                            type="text"
                            value={st.judul}
                            onChange={(e) => {
                              const newSteps = [...steps];
                              newSteps[idx] = { ...st, judul: e.target.value };
                              setSteps(newSteps);
                            }}
                            className="w-full text-xs sm:text-sm font-extrabold text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none pb-0.5"
                            placeholder="Judul langkah..."
                          />
                          <input
                            type="text"
                            value={st.deskripsi}
                            onChange={(e) => {
                              const newSteps = [...steps];
                              newSteps[idx] = { ...st, deskripsi: e.target.value };
                              setSteps(newSteps);
                            }}
                            className="w-full text-xs text-slate-600 bg-transparent border-b border-dashed border-slate-200 focus:border-indigo-500 focus:outline-none pb-0.5"
                            placeholder="Deskripsi aksi / sensor / aktuator..."
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            st.tipe === "START" || st.tipe === "FINISH"
                              ? "bg-blue-100 text-blue-700"
                              : st.tipe === "DECISION"
                              ? "bg-purple-100 text-purple-700"
                              : st.tipe === "OK"
                              ? "bg-emerald-100 text-emerald-700"
                              : st.tipe === "NG"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {st.tipe}
                        </span>

                        {st.tipe === "STEP" && (
                          <button
                            type="button"
                            onClick={() => {
                              setSteps(steps.filter((_, i) => i !== idx));
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Hapus langkah ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newId = `step-${Date.now()}`;
                      const insertIndex = Math.max(steps.length - 3, 1);
                      const newStep: FlowStepItem = {
                        id: newId,
                        nomor: `${insertIndex}`,
                        judul: "LANGKAH BARU MESIN",
                        deskripsi: "Aksi silinder / sensor / proses",
                        tipe: "STEP",
                      };
                      const updated = [...steps];
                      updated.splice(insertIndex, 0, newStep);
                      setSteps(updated);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Langkah Proses</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyStepsToDiagram}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{saving ? "Menyimpan..." : "Terapkan Perubahan ke Flowchart"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Footer Info */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-2">
              <span>
                Setelah selesai mengedit diagram alur mesin, klik tombol{" "}
                <strong>&ldquo;Selesai &amp; Simpan Gambar&rdquo;</strong> untuk kembali ke tampilan pratinjau gambar.
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-rose-600 font-bold hover:underline cursor-pointer"
              >
                Tutup Editor Tanpa Simpan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Dialog Import & Konversi Gambar PNG ke Flowchart Editable */}
      <ProjectFlowchartImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onApplyConverted={handleApplyConverted}
        projectId={projectId}
      />
    </div>
  );
}
