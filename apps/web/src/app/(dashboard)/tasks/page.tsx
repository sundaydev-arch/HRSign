import { Suspense } from "react";
import { requirePageUser, isManagerRole } from "@/lib/rbac";
import { TaskList } from "@/components/tasks/TaskList";

export default async function TasksPage() {
  const user = await requirePageUser();
  const manager = isManagerRole(user.role);
  // Dept leaders see department-scoped "all"; only HR/admin initiate tasks.
  const canSeeAll = manager || user.role === "DEPT_LEADER";
  return (
    <Suspense>
      <TaskList canSeeAll={canSeeAll} canCreate={manager} />
    </Suspense>
  );
}
