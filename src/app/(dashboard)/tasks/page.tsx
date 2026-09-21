import { Suspense } from "react";
import { requirePageUser, isManagerRole } from "@/lib/rbac";
import { TaskList } from "@/components/tasks/TaskList";

export default async function TasksPage() {
  const user = await requirePageUser();
  return (
    <Suspense>
      <TaskList canSeeAll={isManagerRole(user.role)} />
    </Suspense>
  );
}
