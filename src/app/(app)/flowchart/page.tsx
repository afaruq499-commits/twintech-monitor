import { Metadata } from "next";
import { FlowchartEditor } from "@/components/flowchart/FlowchartEditor";

export const metadata: Metadata = {
  title: "Flowchart Editor | PT Twintech Precision",
  description:
    "Editor flowchart native mandiri standar Twintech Suite dengan palet bentuk, kanvas zoom & pan, minimap, dan grid snap.",
};

export default function FlowchartPage() {
  return (
    <div className="p-2 sm:p-4 lg:p-6 w-full h-full max-w-[1920px] mx-auto">
      <FlowchartEditor />
    </div>
  );
}
