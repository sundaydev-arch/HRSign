import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/rbac";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect("/tasks");
  return children;
}
