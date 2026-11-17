import { AppShell } from "@/components/AppShell";
import { getAppSettings } from "@/lib/data-queries";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, currentUser] = await Promise.all([
    getAppSettings(),
    getSessionUser(),
  ]);

  return (
    <AppShell
      companyName={settings.namaPerusahaan}
      logoBase64={settings.logoBase64}
      currentUser={currentUser}
    >
      {children}
    </AppShell>
  );
}
