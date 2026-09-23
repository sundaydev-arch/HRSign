import { requirePageUser } from "@/lib/rbac";

/** Envelope tools are HR / admin only — employees use Signing Tasks. */
export default async function EnvelopesLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["SUPER_ADMIN", "HR"]);
  return children;
}
