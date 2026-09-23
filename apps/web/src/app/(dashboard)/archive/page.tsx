import ArchiveClient from "./ArchiveClient";
import { isManagerRole, requirePageUser } from "@/lib/rbac";

export default async function ArchivePage() {
  const user = await requirePageUser();
  return <ArchiveClient canManageHold={isManagerRole(user.role)} />;
}
