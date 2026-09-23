import { Suspense } from "react";
import { requirePageUser, isManagerRole } from "@/lib/rbac";
import { TaskList } from "@/components/tasks/TaskList";

export default async function TasksPage() {
  const user = await requirePageUser();
  const manager = isManagerRole(user.role);
  return (
    <Suspense>
      <TaskList canSeeAll={manager} canCreate={manager} />
    </Suspense>
  );
}
