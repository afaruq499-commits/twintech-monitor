import type { Metadata, Viewport } from "next";
import { PwaRegistrar } from "@/components/PwaRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Twintech Precision — Electrical Monitoring",
  description:
    "Aplikasi pemantauan komponen PR, jadwal hierarkis, dan prioritas proyek otomasi industri.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Electrical Monitoring",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("pm_theme");if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.setAttribute("data-theme","dark");}var f=localStorage.getItem("pm_font_scale");if(f==="normal"||f==="large"||f==="xlarge"){document.documentElement.setAttribute("data-font-scale",f);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-[#f4f5f7] text-slate-900 transition-colors duration-300">
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
