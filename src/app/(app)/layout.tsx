import { AppShell } from "@/components/shell";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/modules/core/actions";
import { getSettings } from "@/modules/core/queries";

// Every page reads live data for the signed-in user: never prerender at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();
  return (
    <AppShell company={settings.companyName} userName={user.name} logout={logoutAction}>
      {children}
    </AppShell>
  );
}
