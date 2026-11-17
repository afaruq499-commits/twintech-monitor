import { getAppSettings } from "@/lib/data-queries";
import { getSessionUser } from "@/lib/auth";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  const [settings, currentUser] = await Promise.all([
    getAppSettings(),
    getSessionUser(),
  ]);

  return <SettingsClient initialSettings={settings} currentUser={currentUser} />;
}
