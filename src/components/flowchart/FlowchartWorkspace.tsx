"use client";

import { useState } from "react";
import { FlowchartDiagramList } from "./FlowchartDiagramList";
import { FlowchartEditor } from "./FlowchartEditor";
import {
  TEMPLATE_STANDARD_PROCESS,
  TEMPLATE_APPROVAL_WORKFLOW,
  TEMPLATE_PLC_AUTOMATION,
} from "@/lib/flowchart-templates";

export function FlowchartWorkspace() {
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [activeDiagramTitle, setActiveDiagramTitle] = useState<string>("Diagram Alur");

  // Buat diagram baru melalui API dan langsung buka di kanvas
  const handleCreateNew = async (
    nama: string,
    template?: "blank" | "spm" | "standard" | "approval" | "decision"
  ) => {
    try {
      let initialData;
      if (template === "blank") {
        initialData = { nodes: [], edges: [], viewport: { zoom: 1, panX: 40, panY: 20 } };
      } else if (template === "standard") {
        initialData = {
          nodes: TEMPLATE_STANDARD_PROCESS.nodes,
          edges: TEMPLATE_STANDARD_PROCESS.edges,
          viewport: { zoom: 1, panX: 40, panY: 20 },
        };
      } else if (template === "spm") {
        initialData = {
          nodes: TEMPLATE_PLC_AUTOMATION.nodes,
          edges: TEMPLATE_PLC_AUTOMATION.edges,
          viewport: { zoom: 0.9, panX: 40, panY: 20 },
        };
      } else if (template === "approval") {
        initialData = {
          nodes: TEMPLATE_APPROVAL_WORKFLOW.nodes,
          edges: TEMPLATE_APPROVAL_WORKFLOW.edges,
          viewport: { zoom: 1, panX: 40, panY: 20 },
        };
      }

      const res = await fetch("/api/flowchart/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama,
          deskripsi: "Diagram alur sistem otomatisasi",
          initialData,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.diagram?.id) {
        setActiveDiagramId(data.diagram.id);
        setActiveDiagramTitle(nama);
        return;
      }
      throw new Error(data.error || "Gagal membuat diagram baru.");
    } catch (err) {
      console.warn("Gagal membuat di cloud, membuat instance lokal:", err);
      // Fallback ID lokal
      const localId = `local-${Date.now()}`;
      setActiveDiagramId(localId);
      setActiveDiagramTitle(nama);
    }
  };

  const handleOpenDiagram = (id: string, name: string) => {
    setActiveDiagramId(id);
    setActiveDiagramTitle(name);
  };

  const handleBackToList = () => {
    setActiveDiagramId(null);
  };

  if (!activeDiagramId) {
    return (
      <FlowchartDiagramList
        onOpenDiagram={handleOpenDiagram}
        onCreateNewDiagram={handleCreateNew}
      />
    );
  }

  return (
    <FlowchartEditor
      diagramId={activeDiagramId}
      initialTitle={activeDiagramTitle}
      onBackToList={handleBackToList}
    />
  );
}
