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
          borderRadius: "36px",
          fontWeight: 800,
          fontSize: 72,
          letterSpacing: "-2px",
        }}
      >
        PM
      </div>
    ),
    { width: 192, height: 192 }
  );
}
