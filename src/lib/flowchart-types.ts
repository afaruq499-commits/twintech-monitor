/**
 * Definisi Tipe Data Flowchart Studio (Tahap 1, 2, & 3)
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

export type TextAlign = "left" | "center" | "right";

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
  strokeWidth?: number; // 1, 2, 3, 4
  textColor?: string;
  fontSize?: number; // 10, 11, 12, 14, 16, 18
  textAlign?: TextAlign; // "left" | "center" | "right"
}

export type PortPosition = "top" | "right" | "bottom" | "left";

export type EdgeRoutingType = "straight" | "orthogonal" | "curved";

export type EdgeMarker = "arrow" | "arrow-both" | "arrow-start" | "none";

export type EdgeStyle = "solid" | "dashed";

export interface FlowchartEdge {
  id: string;
  sourceNodeId: string;
  sourcePort: PortPosition;
  targetNodeId: string;
  targetPort: PortPosition;
  routing: EdgeRoutingType;
  style: EdgeStyle;
  marker: EdgeMarker;
  label?: string;
  color?: string;
  strokeWidth?: number; // 1, 2, 3, 4
}

export interface ConnectionDraft {
  sourceNodeId: string;
  sourcePort: PortPosition;
  sourcePoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
}

export type ResizeHandleType = "nw" | "ne" | "se" | "sw" | "n" | "s" | "e" | "w";

export interface AlignmentGuide {
  type: "horizontal" | "vertical";
  position: number; // koordinat x (vertikal) atau y (horizontal)
  start: number;
  end: number;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
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
