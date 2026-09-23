import { requirePageUser } from "@/lib/rbac";

export default async function BulkSendLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["SUPER_ADMIN", "HR"]);
  return children;
}
