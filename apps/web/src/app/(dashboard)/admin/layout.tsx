import { AdminSubnav } from "@/components/admin/AdminSubnav";
import { requirePageUser } from "@/lib/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["SUPER_ADMIN"]);
  return (
    <div>
      <AdminSubnav />
      {children}
    </div>
  );
}
