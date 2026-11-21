import type {
  FlowchartNode,
  FlowchartEdge,
  CanvasViewport,
} from "./flowchart-types";
import {
  getNodePortCoordinates,
  computeEdgePath,
} from "./flowchart-routing";
import {
  flowchartDiagramDataSchema,
  type FlowchartDiagramData,
} from "./flowchart-schema";

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  viewBox: string;
}

export type ExportBackgroundOption = "transparent" | "white" | "dark";

export interface ExportOptions {
  background?: ExportBackgroundOption;
  padding?: number;
  scale?: number; // 1x, 2x, 3x (High-DPI)
  diagramTitle?: string;
}

/**
 * Menghitung batas terluar (bounding box) seluruh node dengan margin padding aman
 * agar diagram TIDAK TERPOTONG sama sekali saat diekspor.
 */
export function calculateDiagramBoundingBox(
  nodes: FlowchartNode[],
  padding = 60
): BoundingBox {
  if (nodes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 800,
      maxY: 600,
      width: 800,
      height: 600,
      viewBox: "0 0 800 600",
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  const boundedMinX = minX - padding;
  const boundedMinY = minY - padding;
  const width = Math.max(300, maxX - minX + padding * 2);
  const height = Math.max(200, maxY - minY + padding * 2);

  return {
    minX: boundedMinX,
    minY: boundedMinY,
    maxX: maxX + padding,
    maxY: maxY + padding,
    width,
    height,
    viewBox: `${boundedMinX} ${boundedMinY} ${width} ${height}`,
  };
}

/**
 * Escape teks untuk XML / SVG agar aman dari karakter khusus
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Menghasilkan string markup SVG mandiri (standalone SVG) lengkap dengan styles,
 * shapes, markers, dan teks badge garis alur.
 */
export function generateStandaloneSvg(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  options: ExportOptions = {}
): { svgString: string; box: BoundingBox } {
  const { background = "white", padding = 60 } = options;
  const box = calculateDiagramBoundingBox(nodes, padding);

  let bgRect = "";
  if (background === "white") {
    bgRect = `<rect id="flowchart-background" x="${box.minX}" y="${box.minY}" width="${box.width}" height="${box.height}" fill="#ffffff" />`;
  } else if (background === "dark") {
    bgRect = `<rect id="flowchart-background" x="${box.minX}" y="${box.minY}" width="${box.width}" height="${box.height}" fill="#0f172a" />`;
  }

  // Defs untuk Marker Panah Alur
  const defs = `
    <defs>
      <marker id="arrow-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
      </marker>
      <marker id="arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 10 1 L 0 5 L 10 9 z" fill="#64748b" />
      </marker>
    </defs>
  `;

  // Render Garis Alur (Edges)
  const edgesMarkup = edges
    .map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
      const targetNode = nodes.find((n) => n.id === edge.targetNodeId);
      if (!sourceNode || !targetNode) return "";

      const sourceCoord = getNodePortCoordinates(sourceNode, edge.sourcePort);
      const targetCoord = getNodePortCoordinates(targetNode, edge.targetPort);
      const routing = edge.routing || "orthogonal";
      const { path: pathData, labelPosition: mid } = computeEdgePath(
        sourceCoord,
        edge.sourcePort,
        targetCoord,
        edge.targetPort,
        routing
      );

      const stroke = edge.color || "#64748b";
      const strokeWidth = edge.strokeWidth || 2;
      const strokeDash =
        edge.style === "dashed" ? 'stroke-dasharray="6,4"' : "";

      const marker = edge.marker || "arrow";
      let markerAttrs = "";
      if (marker === "arrow") {
        markerAttrs = 'marker-end="url(#arrow-end)"';
      } else if (marker === "arrow-both") {
        markerAttrs = 'marker-start="url(#arrow-start)" marker-end="url(#arrow-end)"';
      } else if (marker === "arrow-start") {
        markerAttrs = 'marker-start="url(#arrow-start)"';
      }

      // Label teks badge
      let labelMarkup = "";
      if (edge.label && edge.label.trim().length > 0) {
        const textLen = edge.label.length;
        const pillWidth = Math.max(36, textLen * 7.5 + 16);
        const pillHeight = 22;

        labelMarkup = `
          <g transform="translate(${mid.x}, ${mid.y})">
            <rect x="${-pillWidth / 2}" y="${-pillHeight / 2}" width="${pillWidth}" height="${pillHeight}" rx="6" fill="${
          background === "dark" ? "#1e293b" : "#ffffff"
        }" stroke="${stroke}" stroke-width="1.5" />
            <text x="0" y="4" text-anchor="middle" font-size="10" font-weight="bold" fill="${
              background === "dark" ? "#e2e8f0" : "#334155"
            }" font-family="Inter, Arial, sans-serif">${escapeXml(
          edge.label
        )}</text>
          </g>
        `;
      }

      return `
        <g id="${edge.id}">
          <path d="${pathData}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${markerAttrs} stroke-linecap="round" stroke-linejoin="round" />
          ${labelMarkup}
        </g>
      `;
    })
    .join("\n");

  // Render Simbol (Nodes)
  const nodesMarkup = nodes
    .map((node) => {
      const { width: w, height: h, type } = node;

      const fill = node.fillColor || "#1e293b";
      const stroke = node.strokeColor || "#475569";
      const strokeWidth = node.strokeWidth || 2;
      const textColor = node.textColor || "#ffffff";
      const fontSize = node.fontSize || 11;
      const textAlign = node.textAlign || "center";

      let textAnchor = "middle";
      let textX = w / 2;
      if (textAlign === "left") {
        textAnchor = "start";
        textX = 14;
      } else if (textAlign === "right") {
        textAnchor = "end";
        textX = w - 14;
      }

      let shapeSvg = "";
      switch (type) {
        case "start_end":
          shapeSvg = `<rect x="0" y="0" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
          break;
        case "decision":
          shapeSvg = `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
          break;
        case "input_output":
          shapeSvg = `<polygon points="16,0 ${w},0 ${w - 16},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
          break;
        case "subprocess":
          shapeSvg = `
            <rect x="0" y="0" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <line x1="12" y1="0" x2="12" y2="${h}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <line x1="${w - 12}" y1="0" x2="${w - 12}" y2="${h}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          `;
          break;
        case "database":
          shapeSvg = `
            <path d="M 0,10 L 0,${h - 10} A ${w / 2} 10 0 0 0 ${w} ${h - 10} L ${w},10 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <ellipse cx="${w / 2}" cy="10" rx="${w / 2}" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          `;
          break;
        case "document":
          shapeSvg = `
            <path d="M 0,0 L ${w},0 L ${w},${h - 10} Q ${w * 0.75} ${h - 20}, ${w * 0.5} ${h - 10} T 0 ${h - 10} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          `;
          break;
        case "connector":
          shapeSvg = `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
          break;
        case "note":
          shapeSvg = `
            <rect x="0" y="0" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <path d="M ${w - 12},0 L ${w},12 L ${w - 12},12 Z" fill="${stroke}" opacity="0.4" />
          `;
          break;
        case "process":
        default:
          shapeSvg = `<rect x="0" y="0" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
          break;
      }

      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          ${shapeSvg}
          <text x="${textX}" y="${h / 2 + 4}" text-anchor="${textAnchor}" fill="${textColor}" font-size="${fontSize}" font-weight="bold" font-family="Inter, Arial, sans-serif">${escapeXml(
        node.label
      )}</text>
        </g>
      `;
    })
    .join("\n");

  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.viewBox}" width="${box.width}" height="${box.height}">
  ${defs}
  ${bgRect}
  <g id="flowchart-layer">
    <g id="edges-layer">
      ${edgesMarkup}
    </g>
    <g id="nodes-layer">
      ${nodesMarkup}
    </g>
  </g>
</svg>`;

  return { svgString, box };
}

/**
 * Unduh file di browser dengan blob URL
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. Ekspor Diagram ke Berkas SVG (.svg)
 */
export function exportDiagramToSvg(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  filename = "flowchart.svg",
  options: ExportOptions = {}
) {
  const { svgString } = generateStandaloneSvg(nodes, edges, options);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  triggerFileDownload(blob, filename.endsWith(".svg") ? filename : `${filename}.svg`);
}

/**
 * 2. Ekspor Diagram ke Berkas PNG (High-DPI 2x / 3x)
 */
export async function exportDiagramToPng(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  filename = "flowchart.png",
  options: ExportOptions = {}
): Promise<void> {
  const { scale = 2, background = "white" } = options;
  const { svgString, box } = generateStandaloneSvg(nodes, edges, options);

  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = box.width * scale;
        canvas.height = box.height * scale;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Gagal menginisialisasi Canvas 2D context");
        }

        // Latar Belakang (jika bukan transparan)
        if (background === "white") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (background === "dark") {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Gambar SVG ke canvas dengan skala High-DPI
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            triggerFileDownload(
              pngBlob,
              filename.endsWith(".png") ? filename : `${filename}.png`
            );
            URL.revokeObjectURL(url);
            resolve();
          } else {
            URL.revokeObjectURL(url);
            reject(new Error("Gagal menghasilkan Blob PNG"));
          }
        }, "image/png");
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal me-render SVG ke objek Image: " + String(err)));
    };

    img.src = url;
  });
}

/**
 * 3. Ekspor Diagram ke PDF (Cetak Langsung / Unduh PDF Vektor Landscape)
 */
export async function exportDiagramToPdf(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  title = "Flowchart Twintech",
  options: ExportOptions = {}
): Promise<void> {
  const { background = "white" } = options;
  const { svgString, box } = generateStandaloneSvg(nodes, edges, {
    ...options,
    background,
  });

  // Buka jendela cetak mandiri ramah PDF dengan CSS page landscape
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Pop-up browser terblokir. Izinkan pop-up untuk mencetak / menyimpan PDF.");
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>${escapeXml(title)} — Ekspor PDF</title>
        <style>
          @page {
            size: landscape;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: ${background === "dark" ? "#0f172a" : "#ffffff"};
            font-family: Arial, sans-serif;
            min-height: 100vh;
          }
          .header-info {
            width: 100%;
            max-width: ${box.width}px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            color: ${background === "dark" ? "#94a3b8" : "#64748b"};
            font-size: 11px;
            font-weight: bold;
          }
          .svg-wrapper {
            width: 100%;
            max-width: ${box.width}px;
            display: flex;
            justify-content: center;
          }
          svg {
            width: 100%;
            height: auto;
            max-height: 85vh;
          }
          @media print {
            body {
              padding: 0;
              background: transparent;
            }
          }
        </style>
      </head>
      <body>
        <div class="header-info">
          <span>PT. TWINTECH PRECISION — DOKUMENTASI FLOWCHART</span>
          <span>${escapeXml(title)}</span>
        </div>
        <div class="svg-wrapper">
          ${svgString.replace(/<\?xml.*?\?>/, "")}
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

/**
 * 4. Ekspor Diagram ke File JSON (.flowchart.json)
 */
export function exportDiagramToJson(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  viewport: CanvasViewport,
  filename = "flowchart.json"
) {
  const normalizedEdges = edges.map((edge) => ({
    ...edge,
    label: edge.label ?? "",
  }));

  const data: FlowchartDiagramData = {
    nodes,
    edges: normalizedEdges,
    viewport,
  };

  // Validasi format data menggunakan Zod
  const validated = flowchartDiagramDataSchema.parse(data);
  const jsonText = JSON.stringify(validated, null, 2);
  const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });

  triggerFileDownload(
    blob,
    filename.endsWith(".json") ? filename : `${filename}.flowchart.json`
  );
}

/**
 * 5. Impor Diagram dari File JSON dengan Validasi Zod Ketat
 */
export function importDiagramFromJson(jsonContent: string): FlowchartDiagramData {
  try {
    const parsedRaw = JSON.parse(jsonContent);
    const validated = flowchartDiagramDataSchema.safeParse(parsedRaw);

    if (!validated.success) {
      const issue = validated.error.issues[0];
      const fieldPath = issue?.path.join(".") || "format";
      throw new Error(`Validasi JSON gagal pada [${fieldPath}]: ${issue?.message}`);
    }

    return validated.data;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Berkas JSON korup atau tidak dapat dibaca");
  }
}

/**
 * 6. (OPSIONAL) Ekspor ke XML mxGraph (.drawio)
 * Format standar offline tanpa dependensi atau koneksi ke layanan draw.io luar.
 */
export function exportDiagramToMxGraphXml(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  title = "Flowchart Twintech"
): string {
  const nodesXml = nodes
    .map((node) => {
      let shapeStyle = "rounded=1;arcSize=10;";
      switch (node.type) {
        case "start_end":
          shapeStyle = "rounded=1;arcSize=50;";
          break;
        case "decision":
          shapeStyle = "rhombus;";
          break;
        case "input_output":
          shapeStyle = "shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;";
          break;
        case "subprocess":
          shapeStyle = "shape=process;backgroundOutline=1;";
          break;
        case "database":
          shapeStyle = "shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=15;";
          break;
        case "document":
          shapeStyle = "shape=document;whiteSpace=wrap;boundedLbl=1;";
          break;
        case "connector":
          shapeStyle = "ellipse;aspect=fixed;";
          break;
        case "note":
          shapeStyle = "shape=note;whiteSpace=wrap;backgroundOutline=1;darkOpacity=0.05;";
          break;
      }

      const fill = node.fillColor || "#1e293b";
      const stroke = node.strokeColor || "#475569";
      const strokeWidth = node.strokeWidth || 2;
      const fontColor = node.textColor || "#ffffff";
      const fontSize = node.fontSize || 11;
      const align = node.textAlign || "center";

      const style = `${shapeStyle}whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};strokeWidth=${strokeWidth};fontColor=${fontColor};fontSize=${fontSize};align=${align};`;

      return `        <mxCell id="${node.id}" value="${escapeXml(
        node.label
      )}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry" />
        </mxCell>`;
    })
    .join("\n");

  const edgesXml = edges
    .map((edge) => {
      const routing =
        edge.routing === "orthogonal"
          ? "orthogonalEdgeStyle"
          : edge.routing === "curved"
          ? "curvedEdgeStyle"
          : "straightEdgeStyle";
      const dashed = edge.style === "dashed" ? "dashed=1;" : "";
      const arrow = edge.marker === "none" ? "endArrow=none;" : "endArrow=classic;";
      const strokeColor = edge.color || "#64748b";
      const strokeWidth = edge.strokeWidth || 2;

      const style = `edgeStyle=${routing};rounded=0;html=1;strokeColor=${strokeColor};strokeWidth=${strokeWidth};${dashed}${arrow}`;

      return `        <mxCell id="${edge.id}" value="${escapeXml(
        edge.label || ""
      )}" style="${style}" edge="1" parent="1" source="${edge.sourceNodeId}" target="${edge.targetNodeId}">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="Twintech Suite" modified="${new Date().toISOString()}" agent="Twintech Flowchart Studio" version="1.0">
  <diagram id="twintech-diagram" name="${escapeXml(title)}">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${nodesXml}
${edgesXml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  return xml;
}
