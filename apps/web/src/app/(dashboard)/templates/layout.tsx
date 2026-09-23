import { requirePageUser } from "@/lib/rbac";

export default async function TemplatesLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["SUPER_ADMIN", "HR"]);
  return children;
}
