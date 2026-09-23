import { getSessionUser } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import type { Metadata } from "next";

/** Workspace pages are private — keep them out of search and AI indexes. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell role={user.role} userName={user.name} userEmail={user.email}>
      {children}
    </AppShell>
  );
}
