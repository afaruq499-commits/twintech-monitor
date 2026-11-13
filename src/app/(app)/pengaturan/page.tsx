import { getAppSettings } from "@/lib/data-queries";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  const settings = await getAppSettings();
  return <SettingsClient initialSettings={settings} />;
}
