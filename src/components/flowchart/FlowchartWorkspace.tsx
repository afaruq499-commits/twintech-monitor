"use client";

import { useState } from "react";
import { FlowchartDiagramList } from "./FlowchartDiagramList";
import { FlowchartEditor } from "./FlowchartEditor";

export function FlowchartWorkspace() {
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [activeDiagramTitle, setActiveDiagramTitle] = useState<string>("Diagram Alur");

  // Buat diagram baru melalui API dan langsung buka di kanvas
  const handleCreateNew = async (
    nama: string,
    template?: "blank" | "spm" | "decision"
  ) => {
    try {
      const initialData =
        template === "blank"
          ? { nodes: [], edges: [], viewport: { zoom: 1, panX: 40, panY: 20 } }
          : undefined;

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
