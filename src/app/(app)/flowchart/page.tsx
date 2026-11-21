import { Metadata } from "next";
import { FlowchartWorkspace } from "@/components/flowchart/FlowchartWorkspace";

export const metadata: Metadata = {
  title: "Flowchart Studio | PT Twintech Precision",
  description:
    "Editor flowchart native mandiri standar Twintech Suite dengan daftar diagram cloud, auto-save, palet bentuk, kanvas zoom & pan, minimap, dan grid snap.",
};

export default function FlowchartPage() {
  return (
    <div className="p-2 sm:p-4 lg:p-6 w-full h-full max-w-[1920px] mx-auto">
      <FlowchartWorkspace />
    </div>
  );
}
