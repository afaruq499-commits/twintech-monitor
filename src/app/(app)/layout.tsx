import { AppShell } from "@/components/AppShell";
import { getAppSettings } from "@/lib/data-queries";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getAppSettings();
  return (
    <AppShell
      companyName={settings.namaPerusahaan}
      logoBase64={settings.logoBase64}
    >
      {children}
    </AppShell>
  );
}
