import { getSessionUser } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell role={user.role} userName={user.name}>
      {children}
    </AppShell>
  );
}
