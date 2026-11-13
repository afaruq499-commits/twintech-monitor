import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
          color: "#ffffff",
          borderRadius: "96px",
          fontWeight: 800,
          fontSize: 196,
          letterSpacing: "-6px",
        }}
      >
        PM
      </div>
    ),
    { width: 512, height: 512 }
  );
}
