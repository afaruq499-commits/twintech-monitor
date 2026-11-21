/**
 * Definisi Tipe Data Flowchart Studio (Tahap 1)
 * TypeScript Strict - Tanpa menggunakan type `any`
 */

export type FlowchartShapeType =
  | "start_end"     // Terminator (Pill / Capsule)
  | "process"       // Standard Process (Rectangle)
  | "decision"      // Decision (Rhombus / Diamond)
  | "input_output"  // Data / I/O (Parallelogram)
  | "subprocess"    // Predefined Process / Subroutine (Double vertical borders)
  | "database"      // Database / Storage (Cylinder)
  | "document"      // Document (Wavy bottom)
  | "connector"     // Circular On-page Connector
  | "note";         // Annotation / Note (Folded corner)

export interface FlowchartNode {
  id: string;
  type: FlowchartShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
}

export interface CanvasViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface DraggedShapePayload {
  type: FlowchartShapeType;
  defaultWidth: number;
  defaultHeight: number;
  defaultLabel: string;
}

export interface PaletteShapeDefinition {
  type: FlowchartShapeType;
  name: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultLabel: string;
}
