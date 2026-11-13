import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Monitor — PT. Twintech Precision",
    short_name: "Project Monitor",
    description:
      "Aplikasi pemantauan komponen PR, jadwal hierarkis, dan prioritas proyek otomasi industri.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    orientation: "any",
    lang: "id-ID",
    icons: [
      {
        src: "/icons/icon-192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
