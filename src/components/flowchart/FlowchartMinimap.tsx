"use client";

import { useMemo, useState } from "react";
import { Map, ChevronDown, ChevronUp } from "lucide-react";
import type { FlowchartNode, CanvasViewport } from "@/lib/flowchart-types";

interface FlowchartMinimapProps {
  nodes: FlowchartNode[];
  viewport: CanvasViewport;
  containerWidth: number;
  containerHeight: number;
  onJumpPan: (newPanX: number, newPanY: number) => void;
}

export function FlowchartMinimap({
  nodes,
  viewport,
  containerWidth,
  containerHeight,
  onJumpPan,
}: FlowchartMinimapProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const miniWidth = 180;
  const miniHeight = 120;

  // Hitung total area diagram
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: -200, maxX: 1000, minY: -200, maxY: 800, width: 1200, height: 1000 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y < minY) minY = n.y;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }

    // Tambahkan padding
    const pad = 150;
    minX -= pad;
    maxX += pad;
    minY -= pad;
    maxY += pad;

    const width = Math.max(maxX - minX, 800);
    const height = Math.max(maxY - minY, 600);

    return { minX, maxX, minY, maxY, width, height };
  }, [nodes]);

  // Skala minimap
  const scaleX = miniWidth / bounds.width;
  const scaleY = miniHeight / bounds.height;
  const scale = Math.min(scaleX, scaleY);

  // Posisi viewport saat ini di koordinat dunia
  const worldViewLeft = -viewport.panX / viewport.zoom;
  const worldViewTop = -viewport.panY / viewport.zoom;
  const worldViewWidth = containerWidth / viewport.zoom;
  const worldViewHeight = containerHeight / viewport.zoom;

  // Konversi ke koordinat minimap
  const viewRectX = Math.max(0, (worldViewLeft - bounds.minX) * scale);
  const viewRectY = Math.max(0, (worldViewTop - bounds.minY) * scale);
  const viewRectW = Math.min(miniWidth, worldViewWidth * scale);
  const viewRectH = Math.min(miniHeight, worldViewHeight * scale);

  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Balik ke koordinat dunia
    const targetWorldX = bounds.minX + clickX / scale;
    const targetWorldY = bounds.minY + clickY / scale;

    // Pusatkan viewport pada target
    const newPanX = containerWidth / 2 - targetWorldX * viewport.zoom;
    const newPanY = containerHeight / 2 - targetWorldY * viewport.zoom;

    onJumpPan(newPanX, newPanY);
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 select-none shadow-xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-all">
      {/* Header Minimap */}
      <div className="px-3 py-1.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5 font-bold text-[11px]">
          <Map className="w-3.5 h-3.5 text-indigo-500" />
          <span>Minimap</span>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          title={isCollapsed ? "Buka minimap" : "Tutup minimap"}
        >
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-2">
          <svg
            width={miniWidth}
            height={miniHeight}
            onClick={handleMinimapClick}
            className="cursor-crosshair rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 block"
          >
            {/* Render Node Kecil */}
            {nodes.map((node) => {
              const nx = (node.x - bounds.minX) * scale;
              const ny = (node.y - bounds.minY) * scale;
              const nw = Math.max(2, node.width * scale);
              const nh = Math.max(2, node.height * scale);

              return (
                <rect
                  key={node.id}
                  x={nx}
                  y={ny}
                  width={nw}
                  height={nh}
                  rx="1"
                  className="fill-indigo-500/80 dark:fill-indigo-400/80"
                />
              );
            })}

            {/* Viewport Box Indikator */}
            <rect
              x={viewRectX}
              y={viewRectY}
              width={viewRectW}
              height={viewRectH}
              fill="rgba(99, 102, 241, 0.15)"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="3 2"
              className="pointer-events-none"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
